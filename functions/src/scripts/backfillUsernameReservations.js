/**
 * One-off repair: give every profile's username a `usernames/{lower}`
 * reservation, resolving duplicates in favor of the OLDER account.
 *
 * WHY: the reservation collection is the username → uid map behind the
 * `/profile/@username` links and the uniqueness check in updateUsername /
 * createUserProfile. Accounts that onboarded before reservations were made
 * server-side (or whose reservation was lost) have a username on the profile
 * and nothing in `usernames/`, so their handle resolves to "not found" — and
 * because nothing blocked the name, a NEWER account may have registered the
 * same one since. (The Directors page was keyed on this collection until
 * 2026-09-14 and dropped exactly these accounts, which is how the gap
 * surfaced; it no longer reads it.)
 *
 * RULES, per username (case-insensitive):
 *   - one claimant, reservation missing        → create { uid }
 *   - one claimant, reservation held by them   → nothing
 *   - reservation held by an account that no longer exists or no longer uses
 *     the name                                 → reassigned to the claimant
 *   - several accounts share the name          → the OLDEST (profile
 *     createdAt; a missing createdAt counts as oldest) keeps it and gets the
 *     reservation; every newer account is RENAMED to a temporary handle —
 *     the name plus the smallest free number (alice → alice2, alice3, …,
 *     trimmed to fit 15 chars) — which is reserved for them, their profile
 *     is flagged `usernameTemporary: true` (the app then asks them to pick a
 *     new username; updateUsername clears the flag), and an inbox
 *     notification explains why.
 *   - username outside the 3–15 [A-Za-z0-9_] shape → reported, skipped.
 *
 * Idempotent: a re-run finds every reservation held and renames nothing.
 * Reads profile/data; writes only `usernames/*`, the renamed profiles'
 * username fields, and one notification per renamed director.
 *
 *   node src/scripts/backfillUsernameReservations.js --dry-run
 *   node src/scripts/backfillUsernameReservations.js --commit
 */
const { FieldPath, getFirestore } = require("firebase-admin/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");

const { paths } = require("../helpers/paths");

const BATCH = 400;
/** Same shape updateUsername / createUserProfile enforce. */
const USERNAME_RE = /^[A-Za-z0-9_]{3,15}$/;
const USERNAME_MAX = 15;

/**
 * Milliseconds since epoch for a profile's createdAt, whatever shape it was
 * stored in (Firestore Timestamp, Date, ISO string, number). null = unknown.
 * @param {unknown} value
 * @returns {number | null}
 */
function createdAtMs(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "object") {
    const v = /** @type {any} */ (value);
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") return v.seconds * 1000;
    if (typeof v._seconds === "number") return v._seconds * 1000;
  }
  return null;
}

/**
 * Oldest first: a missing createdAt sorts as the oldest (the accounts that
 * predate reservations are also the ones most likely to lack the field),
 * then the current reservation holder, then uid for a stable order.
 * @param {string | null} holderUid
 */
function byAgeThenHolder(holderUid) {
  /**
   * @param {{uid: string, createdAt: number | null}} a
   * @param {{uid: string, createdAt: number | null}} b
   */
  return (a, b) => {
    const am = a.createdAt ?? -Infinity;
    const bm = b.createdAt ?? -Infinity;
    if (am !== bm) return am < bm ? -1 : 1;
    if (a.uid === holderUid) return -1;
    if (b.uid === holderUid) return 1;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  };
}

/**
 * The temporary handle for a displaced account: base + smallest free number
 * from 2, base trimmed so the whole thing fits the 15-char cap.
 * @param {string} base The lost username (original case kept).
 * @param {(key: string) => boolean} isTaken Lowercase key already in use.
 */
function temporaryUsername(base, isTaken) {
  for (let n = 2; n < 100000; n++) {
    const suffix = String(n);
    const stem = base.slice(0, USERNAME_MAX - suffix.length);
    const candidate = `${stem}${suffix}`;
    if (!isTaken(candidate.toLowerCase())) return candidate;
  }
  throw new Error(`No free temporary username for ${base}`);
}

/**
 * Decide what to write. Pure, so the rules above pin down in a unit test.
 *
 * @param {Array<{uid: string, username: unknown, createdAt?: unknown}>} profiles One per profile/data.
 * @param {Map<string, {uid?: unknown}>} existing `usernames/{key}` docs by key.
 * @returns {{
 *   reserve: Array<{key: string, uid: string, previousHolder: string | null}>,
 *   held: number,
 *   renames: Array<{uid: string, from: string, to: string, key: string, keptBy: string}>,
 *   skipped: Array<{uid: string, username: unknown, reason: string}>,
 * }}
 */
function planUsernameReservations(profiles, existing) {
  const reserve = [];
  const renames = [];
  const skipped = [];
  let held = 0;

  /** @type {Map<string, {uid: string, username: string}>} usernames each profile currently uses */
  const usernameByUid = new Map();
  /** @type {Map<string, Array<{uid: string, username: string, createdAt: number | null}>>} */
  const claimants = new Map();
  for (const { uid, username, createdAt } of profiles) {
    if (typeof username !== "string" || username.trim() === "") {
      skipped.push({ uid, username, reason: "no username on profile" });
      continue;
    }
    const trimmed = username.trim();
    if (!USERNAME_RE.test(trimmed)) {
      skipped.push({ uid, username, reason: "username outside the 3-15 [A-Za-z0-9_] shape" });
      continue;
    }
    const key = trimmed.toLowerCase();
    usernameByUid.set(uid, { uid, username: trimmed });
    if (!claimants.has(key)) claimants.set(key, []);
    claimants.get(key).push({ uid, username: trimmed, createdAt: createdAtMs(createdAt) });
  }

  // Keys that are or will be in use: every existing reservation plus every
  // claimed name, so temporary handles never collide with either.
  const takenKeys = new Set([...existing.keys(), ...claimants.keys()]);

  for (const [key, group] of [...claimants.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const current = existing.get(key);
    const holderUid = current && typeof current.uid === "string" ? current.uid : null;
    // A holder who still uses this name is a claimant like any other (already
    // in the group). One who has no profile, or has since renamed, is stale:
    // their reservation is reassigned, never honored.
    const holderStillUsesName = holderUid !== null && group.some((c) => c.uid === holderUid);

    const ordered = [...group].sort(byAgeThenHolder(holderStillUsesName ? holderUid : null));
    const winner = ordered[0];

    if (holderUid === winner.uid) held++;
    else reserve.push({ key, uid: winner.uid, previousHolder: holderUid });

    for (const loser of ordered.slice(1)) {
      const to = temporaryUsername(loser.username, (k) => takenKeys.has(k));
      takenKeys.add(to.toLowerCase());
      renames.push({ uid: loser.uid, from: loser.username, to, key: to.toLowerCase(), keptBy: winner.uid });
    }
  }

  return { reserve, held, renames, skipped };
}

/**
 * Read every profile/data doc's { uid, username, createdAt } (namespace-pinned).
 * @param {FirebaseFirestore.Firestore} db
 */
async function readProfiles(db) {
  const prefix = `${paths.users()}/`;
  const profiles = [];
  let cursor = null;
  for (;;) {
    let query = db
      .collectionGroup("profile")
      .orderBy(FieldPath.documentId())
      .select("username", "createdAt")
      .limit(BATCH);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      if (doc.id !== "data" || !doc.ref.path.startsWith(prefix)) continue;
      // .../users/{uid}/profile/data
      const uid = doc.ref.parent.parent.id;
      const data = doc.data();
      profiles.push({ uid, username: data.username, createdAt: data.createdAt });
    }
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH) break;
  }
  return profiles;
}

/**
 * Read the whole reservation collection (small: one tiny doc per director).
 * @param {FirebaseFirestore.Firestore} db
 */
async function readReservations(db) {
  const snap = await db.collection("usernames").get();
  const existing = new Map();
  for (const doc of snap.docs) existing.set(doc.id, doc.data() || {});
  return existing;
}

/**
 * @param {{commit: boolean}} options
 */
async function run({ commit }) {
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const { createUserNotification } = require("../helpers/userNotifications");

  const [profiles, existing] = await Promise.all([readProfiles(db), readReservations(db)]);
  const plan = planUsernameReservations(profiles, existing);
  const verb = commit ? "" : "WOULD ";

  for (const s of plan.skipped) console.log(`SKIP     ${s.uid}: ${s.reason} (${JSON.stringify(s.username)})`);
  for (const r of plan.reserve) {
    const from = r.previousHolder ? ` (was held by ${r.previousHolder})` : "";
    console.log(`${verb}RESERVE usernames/${r.key} → ${r.uid}${from}`);
  }
  for (const r of plan.renames) {
    console.log(`${verb}RENAME  ${r.uid}: @${r.from} → @${r.to} (older account ${r.keptBy} keeps @${r.from})`);
  }

  if (commit) {
    let batch = db.batch();
    let inBatch = 0;
    const flush = async () => {
      if (inBatch > 0) await batch.commit();
      batch = db.batch();
      inBatch = 0;
    };
    const stage = async (fn) => {
      fn(batch);
      inBatch++;
      if (inBatch >= BATCH) await flush();
    };

    // Same shape updateUsername / createUserProfile write: { uid } only.
    for (const { key, uid } of plan.reserve) {
      await stage((b) => b.set(db.collection("usernames").doc(key), { uid }));
    }
    for (const { uid, to, key } of plan.renames) {
      await stage((b) => b.set(db.collection("usernames").doc(key), { uid }));
      await stage((b) =>
        b.update(db.doc(paths.userProfile(uid)), {
          username: to,
          usernameTemporary: true,
          updatedAt: new Date(),
        })
      );
    }
    await flush();

    for (const { uid, from, to } of plan.renames) {
      await createUserNotification(db, uid, {
        type: "account",
        title: "Please choose a new username",
        message:
          `Another director registered @${from} before you did, so your account now uses the ` +
          `temporary handle @${to}. Open your profile to pick a new username.`,
        link: "/profile",
        dedupeKey: `username-temporary:${to.toLowerCase()}`,
      });
    }
  }

  console.log(
    `${commit ? "Applied" : "Would apply"}: ${plan.reserve.length} reservation(s), ` +
      `${plan.renames.length} rename(s); ${plan.held} already held; ${plan.skipped.length} skipped ` +
      `(${profiles.length} profiles scanned, ${existing.size} reservations on file).`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");
  return plan;
}

module.exports = { planUsernameReservations, temporaryUsername, createdAtMs, USERNAME_RE };

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  if (!commit && !process.argv.includes("--dry-run")) {
    console.error("Pass --dry-run or --commit");
    process.exit(2);
  }
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
