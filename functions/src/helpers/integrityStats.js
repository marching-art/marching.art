/**
 * Account-integrity instrumentation — the third operator dashboard, alongside
 * helpers/economyStats.js (mint-vs-sink) and helpers/retentionStats.js
 * (active/cohorts). Where those answer "is the economy balanced" and "are
 * people coming back", this answers the question FMA never had a tool for and
 * paid for dearly: "which of these accounts are the same person?"
 *
 * The lesson is concrete (docs/FMA_LESSONS.md §3): FMA's forums are full of
 * "Remove all of FastForward's alt accounts" and "Moderator Desperately
 * Needed". Alt-account abuse corroded trust in a game whose leagues, prediction
 * pools, and now the ~monthly voted Showcase (docs/UNIFORM_STUDIO.md §7.4) are
 * all zero-sum — every one of them is farmable by one person with three logins.
 *
 * This job is deliberately DETECTION-ONLY. It computes signals and surfaces
 * them for a human to judge; it never suspends, bans, or flags an account.
 * A false positive here would ban a real director over a coincidence — the
 * cure is worse than the disease, so enforcement stays a manual decision the
 * operator makes with these signals in front of them, not an automatic one.
 *
 * The signals are what the data supports today without any schema change
 * (there is no IP/device/App-Check capture at signup — see the report in
 * ARCHITECTURE.md's data model):
 *   - Email clusters: multiple accounts whose addresses normalize to the same
 *     inbox (the classic Gmail dot/+tag alias trick). The strongest signal.
 *   - Signup bursts: clusters of accounts created within a tight time window.
 *   - Attribute clusters: accounts sharing a specific identity (same
 *     location + favorite corps, or a shared username stem like name1/name2).
 * An account appearing in two or more of these is the high-confidence
 * watchlist — that is the row an operator should actually look at.
 *
 * Written weekly to admin-stats/integrity (admin-only per firestore.rules) and
 * rendered in Admin > Jobs. Weekly, not nightly: like economyStats this is a
 * heavier cross-account correlation, and an alt ring does not need same-night
 * detection the way a scoring bug does.
 *
 * Privacy: the stored doc never contains a raw email. Each email cluster keys
 * on a truncated SHA-256 of the normalized address (groups without revealing
 * the inbox) and shows one redacted sample (`jo…@gmail.com`) for readability.
 * Members are listed by username + uid, both already admin-visible.
 */

const crypto = require("crypto");
const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { processAllInPages } = require("./firestorePaging");

const STATS_DOC = "admin-stats/integrity";

/** Profile fields the join needs. Keep in sync with mergeAccounts. */
const PROJECTED_FIELDS = [
  "username",
  "displayName",
  "createdAt",
  "engagement.lastLogin",
  "location",
  "favoriteCorps",
  "moderation.restricted",
];

/**
 * Caps so the output doc stays comfortably under Firestore's 1 MiB cap even on
 * a large, adversarial roster. We surface the worst offenders, not everything;
 * the summary counts stay exact so nothing is silently hidden.
 */
const MAX_CLUSTERS = 50;
const MAX_MEMBERS_PER_CLUSTER = 25;
const MAX_WATCHLIST = 100;

/** Default detection thresholds (overridable for tests / tuning). */
const DEFAULTS = {
  // A signup burst: at least this many accounts created within the window.
  burstWindowMs: 15 * 60 * 1000, // 15 minutes
  burstMinSize: 4,
  // An attribute cluster (shared location+corps, or username stem): this many.
  attrMinSize: 3,
};

/**
 * Coerce a Firestore Timestamp, Date, ISO string, or epoch number to a Date.
 * Profiles carry all of these shapes (see the same helper in retentionStats).
 * Returns null for anything unusable.
 */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Normalize an email to the inbox it actually delivers to, so alias tricks
 * collapse onto one key:
 *   - lowercase, trimmed
 *   - Gmail (gmail.com / googlemail.com): drop dots and any `+tag` from the
 *     local part — `j.o.h.n+alts@gmail.com` and `john@googlemail.com` are one
 *     inbox
 *   - other providers: drop only a `+tag` (widely supported), keep dots
 * Returns null for anything that is not a plausible `local@domain`.
 *
 * @param {unknown} email
 * @returns {string|null}
 */
function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".")) return null;

  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    if (!local) return null;
    return `${local}@gmail.com`;
  }
  if (!local) return null;
  return `${local}@${domain}`;
}

/**
 * A stable, non-reversible key for an email cluster. Truncated because a
 * cluster id only needs to group, not to authenticate.
 * @param {string} normalized
 */
function emailClusterKey(normalized) {
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * A human-readable, redacted hint at an address — enough for an operator to
 * recognize a pattern, not enough to leak the inbox.
 * `johndoe@gmail.com` -> `jo…@gmail.com`; single-char locals fully masked.
 * @param {unknown} email
 * @returns {string|null}
 */
function redactEmail(email) {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${head}…@${domain.toLowerCase()}`;
}

/**
 * The username stem: leading non-digit run, so `smith1`, `smith2`, `smith_3`
 * share the stem `smith`. Returns null for a username with no alpha stem or a
 * stem too short to be meaningful.
 * @param {unknown} username
 */
function usernameStem(username) {
  if (typeof username !== "string") return null;
  const match = username.trim().toLowerCase().match(/^([a-z]+)/);
  if (!match) return null;
  const stem = match[1];
  // A trailing digit is what makes name1/name2 suspicious; a bare alpha
  // username shared by two people is just a common handle, not a signal.
  const hasTrailingDigit = /\d\s*$/.test(username.trim());
  if (!hasTrailingDigit || stem.length < 3) return null;
  return stem;
}

/**
 * @typedef {Object} Account
 * @property {string} uid
 * @property {string} [username]
 * @property {string} [displayName]
 * @property {string} [email]        raw email (from Auth); never stored
 * @property {string} [provider]
 * @property {Date|null} [createdAt]
 * @property {string} [location]
 * @property {string} [favoriteCorps]
 * @property {boolean} [restricted]  admin moderation.restricted state
 */

/** Trim a members array to the cap, keeping oldest accounts (likeliest origin). */
function capMembers(members) {
  return members
    .slice()
    .sort((a, b) => (a.createdAtMs ?? Infinity) - (b.createdAtMs ?? Infinity))
    .slice(0, MAX_MEMBERS_PER_CLUSTER)
    .map(({ uid, username }) => ({ uid, username: username || null }));
}

/**
 * Group accounts by normalized-email inbox. Clusters of 2+ are returned,
 * largest first, capped. Each carries a hashed key, a redacted sample, the
 * count, and (capped) members.
 * @param {Account[]} accounts
 */
function findEmailClusters(accounts) {
  const groups = new Map(); // normalized -> { members[], sampleRaw }
  for (const acct of accounts) {
    const normalized = normalizeEmail(acct.email);
    if (!normalized) continue;
    let group = groups.get(normalized);
    if (!group) {
      group = { members: [], sampleRaw: acct.email };
      groups.set(normalized, group);
    }
    group.members.push({
      uid: acct.uid,
      username: acct.username,
      createdAtMs: acct.createdAt ? acct.createdAt.getTime() : null,
    });
  }

  const clusters = [];
  for (const [normalized, group] of groups) {
    if (group.members.length < 2) continue;
    clusters.push({
      key: emailClusterKey(normalized),
      size: group.members.length,
      sample: redactEmail(group.sampleRaw),
      members: capMembers(group.members),
    });
  }
  clusters.sort((a, b) => b.size - a.size);
  return clusters.slice(0, MAX_CLUSTERS);
}

/**
 * Find runs of accounts created close together in time. A run starts at an
 * account and greedily extends to every later account within `windowMs` of the
 * run's FIRST account; a run of `minSize`+ is reported. Non-overlapping: once
 * an account is claimed by a burst it is not the seed of another.
 * @param {Account[]} accounts
 * @param {{windowMs:number, minSize:number}} opts
 */
function findSignupBursts(accounts, { windowMs, minSize }) {
  const dated = accounts
    .filter((a) => a.createdAt)
    .map((a) => ({
      uid: a.uid,
      username: a.username,
      createdAtMs: a.createdAt.getTime(),
    }))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  const bursts = [];
  let i = 0;
  while (i < dated.length) {
    const start = dated[i].createdAtMs;
    let j = i;
    while (j < dated.length && dated[j].createdAtMs - start <= windowMs) j += 1;
    const run = dated.slice(i, j);
    if (run.length >= minSize) {
      bursts.push({
        startedAt: new Date(start).toISOString(),
        spanMs: run[run.length - 1].createdAtMs - start,
        size: run.length,
        members: run.slice(0, MAX_MEMBERS_PER_CLUSTER).map(({ uid, username }) => ({
          uid,
          username: username || null,
        })),
      });
      i = j; // don't re-seed inside a burst we already reported
    } else {
      i += 1;
    }
  }
  bursts.sort((a, b) => b.size - a.size);
  return bursts.slice(0, MAX_CLUSTERS);
}

/** Normalize a free-text attribute for grouping; null if too thin to matter. */
function attrValue(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, " ");
  return cleaned.length >= 2 ? cleaned : null;
}

/**
 * Cluster accounts that share a specific identity: the same
 * `location | favoriteCorps` pair (both present), or the same username stem
 * (name1/name2/name3). Weaker than email on their own, but a member that also
 * lands in another signal is what makes the watchlist.
 * @param {Account[]} accounts
 * @param {{minSize:number}} opts
 */
function findAttributeClusters(accounts, { minSize }) {
  const groups = new Map(); // key -> { kind, label, members[] }
  const add = (key, kind, label, acct) => {
    let group = groups.get(key);
    if (!group) {
      group = { kind, label, members: [] };
      groups.set(key, group);
    }
    group.members.push({
      uid: acct.uid,
      username: acct.username,
      createdAtMs: acct.createdAt ? acct.createdAt.getTime() : null,
    });
  };

  for (const acct of accounts) {
    const loc = attrValue(acct.location);
    const corps = attrValue(acct.favoriteCorps);
    if (loc && corps) {
      add(`lc:${loc}|${corps}`, "location+corps", `${acct.location} · ${acct.favoriteCorps}`, acct);
    }
    const stem = usernameStem(acct.username);
    if (stem) add(`us:${stem}`, "username-stem", `${stem}#`, acct);
  }

  const clusters = [];
  for (const [key, group] of groups) {
    if (group.members.length < minSize) continue;
    clusters.push({
      key,
      kind: group.kind,
      label: group.label,
      size: group.members.length,
      members: capMembers(group.members),
    });
  }
  clusters.sort((a, b) => b.size - a.size);
  return clusters.slice(0, MAX_CLUSTERS);
}

/**
 * Accounts implicated by two or more independent signals — the rows worth a
 * human's time. Keyed by uid, with the list of signal kinds that flagged them.
 */
function buildWatchlist(
  { emailClusters, signupBursts, attributeClusters },
  usernameByUid,
  restrictedByUid = new Set()
) {
  const hits = new Map(); // uid -> Set<signal>
  const mark = (members, signal) => {
    for (const m of members) {
      if (!hits.has(m.uid)) hits.set(m.uid, new Set());
      hits.get(m.uid).add(signal);
    }
  };
  for (const c of emailClusters) mark(c.members, "email");
  for (const b of signupBursts) mark(b.members, "signup-burst");
  for (const c of attributeClusters) mark(c.members, `attr:${c.kind}`);

  const watchlist = [];
  for (const [uid, signals] of hits) {
    if (signals.size < 2) continue;
    watchlist.push({
      uid,
      username: usernameByUid.get(uid) || null,
      // Whether an admin has already restricted this account, as of this run —
      // so the operator sees who's been actioned. The panel updates it live.
      restricted: restrictedByUid.has(uid),
      signals: [...signals].sort(),
    });
  }
  watchlist.sort((a, b) => b.signals.length - a.signals.length);
  return watchlist.slice(0, MAX_WATCHLIST);
}

/**
 * Reduce merged account records into the integrity rollup. Pure: takes records
 * plus options, returns the doc payload (minus computedAt). Unit-testable
 * without Firestore or Auth.
 *
 * @param {Account[]} accounts
 * @param {{now?: Date, burstWindowMs?: number, burstMinSize?: number, attrMinSize?: number}} [options]
 * @returns {Object} the admin-stats/integrity payload (minus computedAt)
 */
function computeIntegritySignals(accounts, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const usernameByUid = new Map(accounts.map((a) => [a.uid, a.username]));
  const restrictedByUid = new Set(accounts.filter((a) => a.restricted).map((a) => a.uid));

  const emailClusters = findEmailClusters(accounts);
  const signupBursts = findSignupBursts(accounts, {
    windowMs: opts.burstWindowMs,
    minSize: opts.burstMinSize,
  });
  const attributeClusters = findAttributeClusters(accounts, { minSize: opts.attrMinSize });
  const watchlist = buildWatchlist(
    { emailClusters, signupBursts, attributeClusters },
    usernameByUid,
    restrictedByUid
  );

  const withEmail = accounts.filter((a) => normalizeEmail(a.email)).length;
  const accountsInEmailClusters = emailClusters.reduce((n, c) => n + c.size, 0);

  return {
    totalAccounts: accounts.length,
    withEmail,
    emailClusters,
    signupBursts,
    attributeClusters,
    watchlist,
    summary: {
      emailClusterCount: emailClusters.length,
      accountsInEmailClusters,
      largestEmailCluster: emailClusters[0]?.size || 0,
      signupBurstCount: signupBursts.length,
      attributeClusterCount: attributeClusters.length,
      watchlistCount: watchlist.length,
    },
    thresholds: {
      burstWindowMinutes: Math.round(opts.burstWindowMs / 60000),
      burstMinSize: opts.burstMinSize,
      attrMinSize: opts.attrMinSize,
    },
  };
}

/**
 * Default Auth lister: page through every Firebase Auth user, yielding the
 * fields we correlate on. Injected so tests can supply a fake.
 *
 * @returns {Promise<Map<string, {email?: string, provider?: string}>>}
 */
async function listAuthUsers() {
  // Lazy require: firebase-admin is only needed for the live scan, and keeping
  // it out of module scope keeps the pure logic importable in a bare test.
  const admin = require("firebase-admin");
  const byUid = new Map();
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) {
      byUid.set(user.uid, {
        email: user.email,
        provider: user.providerData?.[0]?.providerId,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return byUid;
}

/**
 * Read every profile (projected), join to Auth for email/provider, and reduce.
 *
 * Profiles are missing-ancestor subcollection docs, so this uses a
 * collectionGroup("profile") scan filtered by path prefix — the same shape as
 * retentionStats/lifetimeLeaderboard. uid is recovered from the doc path
 * (`.../users/{uid}/profile/data`).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{now?: Date, authLister?: () => Promise<Map>, [k: string]: any}} [options]
 */
async function computeIntegrityStats(db, options = {}) {
  const { authLister = listAuthUsers, ...signalOptions } = options;

  const query = db.collectionGroup("profile").select(...PROJECTED_FIELDS);
  const docs = await processAllInPages(query, 1000, async (doc) => doc);

  const usersPrefix = `${paths.users()}/`;
  const profileDocs = docs.filter((doc) => doc.ref.path.startsWith(usersPrefix));

  const authByUid = await authLister();

  const accounts = profileDocs.map((doc) => {
    const data = doc.data() || {};
    const uid = doc.ref.parent.parent?.id || doc.ref.path;
    const auth = authByUid.get(uid) || {};
    return {
      uid,
      username: data.username,
      displayName: data.displayName,
      email: auth.email,
      provider: auth.provider,
      createdAt: toDate(data.createdAt),
      location: data.location,
      favoriteCorps: data.favoriteCorps,
      restricted: data.moderation?.restricted === true,
    };
  });

  return computeIntegritySignals(accounts, signalOptions);
}

/**
 * Compute and persist the doc the admin page reads.
 * @param {FirebaseFirestore.Firestore} db
 */
async function updateIntegrityStats(db, options = {}) {
  const stats = await computeIntegrityStats(db, options);
  await db.doc(STATS_DOC).set({ ...stats, computedAt: new Date() }, { merge: false });

  logger.info(
    `Integrity stats: ${stats.totalAccounts} accounts, ` +
      `${stats.summary.emailClusterCount} email clusters ` +
      `(${stats.summary.accountsInEmailClusters} accounts, largest ${stats.summary.largestEmailCluster}), ` +
      `${stats.summary.signupBurstCount} signup bursts, ` +
      `${stats.summary.attributeClusterCount} attribute clusters, ` +
      `${stats.summary.watchlistCount} on the multi-signal watchlist.`
  );
  return stats;
}

module.exports = {
  STATS_DOC,
  PROJECTED_FIELDS,
  DEFAULTS,
  normalizeEmail,
  redactEmail,
  usernameStem,
  findEmailClusters,
  findSignupBursts,
  findAttributeClusters,
  buildWatchlist,
  computeIntegritySignals,
  computeIntegrityStats,
  updateIntegrityStats,
};
