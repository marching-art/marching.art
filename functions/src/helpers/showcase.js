// =============================================================================
// THE SHOWCASE — monthly community-voted styling contest (UNIFORM_STUDIO.md §7.4)
// =============================================================================
// A themed contest on a fixed monthly clock (all UTC):
//
//   days 1-20   SUBMISSIONS — one entry per director (resubmitting replaces
//               it); entering pays a small participation token, once.
//   day 21-EOM  VOTING — anonymous PAIRWISE ballots (the Trial of Style
//               format, which resists popularity metas better than star
//               ratings): the server deals two entries with no names
//               attached, the voter picks one, the first few votes each
//               month pay a token.
//   next month  FINALIZED — the nightly pipeline tallies wins, publishes the
//               public results doc, and grants the winner the grant-only
//               Showcase Champion title (never purchasable).
//
// Entries and ballots are server-only documents (anonymity is a data rule,
// not a UI courtesy); only the finalized results doc is world-readable.
// Announcements to the Discord #announcements channel ride the same
// lease-guarded postOnce machinery as the Fan Favorite ballot.

const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { paths } = require("./paths");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("./economy");
const {
  COLORS,
  SITE_URL,
  clampName,
  joinLines,
  payloadOf,
  postOnce,
} = require("./discord");

/** Participation token, paid once per director per month on first entry. */
const SHOWCASE_ENTRY_REWARD = 25;
/** Per-vote token, paid for the first SHOWCASE_PAID_VOTES ballots a month. */
const SHOWCASE_VOTE_REWARD = 5;
const SHOWCASE_PAID_VOTES = 5;
/** Grant-only prize (shopCatalog.js) — awarded at finalization, never sold. */
const SHOWCASE_WINNER_ITEM = "title_showcase_champion";
/** Submissions close at the START of this UTC day; voting runs to month end. */
const SHOWCASE_VOTING_OPENS_DAY = 21;
const MAX_SHOWCASE_ENTRIES = 200;

// -----------------------------------------------------------------------------
// THEMES + CLOCK
// -----------------------------------------------------------------------------

const SHOWCASE_THEMES = [
  { id: "opening-night", title: "Opening Night", blurb: "The look your corps premieres a season in — first impressions, full confidence." },
  { id: "home-town-heroes", title: "Hometown Heroes", blurb: "The uniform your community would recognize from three blocks away." },
  { id: "midnight-encore", title: "Midnight Encore", blurb: "The exhibition look for the show after the show — lights down, drama up." },
  { id: "founders-day", title: "Founders' Day", blurb: "Honor the corps that would have marched a century ago — reimagined, not reenacted." },
  { id: "storm-front", title: "Storm Front", blurb: "Weather as wardrobe: pressure, electricity, and the calm that breaks." },
  { id: "gilded-age", title: "Gilded Age", blurb: "Maximum ornament: metallics, braid, sequins — opulence that still marches clean." },
  { id: "midway-lights", title: "Midway Lights", blurb: "The county-fair midway after dark: color, spectacle, a little too much of both." },
  { id: "silver-screen", title: "Silver Screen", blurb: "A corps that walked out of a film — any era, any genre, unmistakably cinematic." },
  { id: "winter-line", title: "The Winter Line", blurb: "The cold-season concept look: darker, sleeker, built for an indoor floor." },
  { id: "heritage-block", title: "Heritage Block", blurb: "Tradition worn proudly: the classic silhouette, executed perfectly." },
  { id: "new-wave", title: "New Wave", blurb: "The costume future: asymmetry, gradients, glow — the uniform after uniforms." },
  { id: "field-of-flowers", title: "Field of Flowers", blurb: "Growing season: warmth, brightness, and color that reads like a bloom at 50 yards." },
];

// The callables read the cycle clock through this indirection so tests can
// pin a phase; production never touches it.
let nowFn = () => new Date();
/** @param {(() => Date) | null} fn */
function setShowcaseNowForTesting(fn) {
  nowFn = fn || (() => new Date());
}
function showcaseNow() {
  return nowFn();
}

/** fnv-ish string hash for the monthly rotation. @param {string} s */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** UTC month id, e.g. "2026-09". @param {Date} date */
function monthIdFor(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month id BEFORE the given date's month (for finalization). @param {Date} date */
function previousMonthId(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return monthIdFor(d);
}

/** @param {string} monthId */
function themeForMonth(monthId) {
  return SHOWCASE_THEMES[hashString(monthId) % SHOWCASE_THEMES.length];
}

/**
 * Where the given instant falls in the monthly cycle.
 * @param {Date} date
 * @returns {{monthId: string, phase: 'submissions'|'voting', votingOpensDay: number}}
 */
function phaseFor(date) {
  return {
    monthId: monthIdFor(date),
    phase: date.getUTCDate() < SHOWCASE_VOTING_OPENS_DAY ? "submissions" : "voting",
    votingOpensDay: SHOWCASE_VOTING_OPENS_DAY,
  };
}

// -----------------------------------------------------------------------------
// TALLY
// -----------------------------------------------------------------------------

/**
 * Rank entries: pairwise wins first, then fewer losses, then earlier
 * submission (a stable, explainable ladder — random pair dealing keeps
 * appearances roughly even, so raw wins are fair). Pure.
 *
 * @param {Array<Object>} entries [{uid, wins, losses, submittedAt, ...}]
 * @returns {Array<Object>} the same entries, ranked, with `rank` assigned.
 */
function tallyShowcase(entries) {
  const ranked = [...entries].sort((a, b) => {
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    if ((a.losses || 0) !== (b.losses || 0)) return (a.losses || 0) - (b.losses || 0);
    return String(a.submittedAt || "").localeCompare(String(b.submittedAt || ""));
  });
  ranked.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return ranked;
}

// -----------------------------------------------------------------------------
// FINALIZATION (nightly stage)
// -----------------------------------------------------------------------------

/**
 * Finalize the previous month's Showcase if it ended with entries and has no
 * results yet: tally, publish the world-readable results doc, grant the
 * winner the Showcase Champion title. Idempotent — the results doc's
 * existence is the gate, checked inside the transaction, so concurrent
 * schedulers can't double-finalize or double-grant.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Date} [now]
 * @returns {Promise<{status: string, monthId?: string, winner?: string, entryCount?: number}>}
 */
async function finalizeShowcase(db, now = new Date()) {
  const monthId = previousMonthId(now);
  const resultsRef = db.doc(paths.showcaseResults(monthId));
  const existing = await resultsRef.get();
  if (existing.exists) return { status: "already-finalized", monthId };

  const entriesSnap = await db.collection(paths.showcaseEntries(monthId)).get();
  if (entriesSnap.empty) return { status: "no-entries", monthId };

  const ranked = tallyShowcase(entriesSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  const theme = themeForMonth(monthId);
  const winners = ranked.slice(0, 3).map((entry) => ({
    rank: entry.rank,
    uid: entry.uid,
    username: entry.username || "a director",
    designName: entry.designName || "Untitled design",
    colors: entry.colors || null,
    wins: entry.wins || 0,
    losses: entry.losses || 0,
    // top three carry the renderable figure so the results display is real
    design: entry.design || null,
  }));

  const winnerRef = db.doc(paths.userProfile(winners[0].uid));
  await db.runTransaction(async (tx) => {
    const [resultsNow, winnerProfile] = await Promise.all([
      tx.get(resultsRef),
      tx.get(winnerRef),
    ]);
    if (resultsNow.exists) return; // another scheduler got here first
    tx.set(resultsRef, {
      monthId,
      theme: { id: theme.id, title: theme.title, blurb: theme.blurb },
      winners,
      entryCount: ranked.length,
      finalizedAt: new Date().toISOString(),
    });
    if (winnerProfile.exists) {
      tx.update(winnerRef, {
        "cosmetics.owned": FieldValue.arrayUnion(SHOWCASE_WINNER_ITEM),
      });
      addCoinHistoryEntryToTransaction(tx, db, winners[0].uid, {
        type: TRANSACTION_TYPES.SHOWCASE_WIN,
        amount: 0,
        balance: winnerProfile.data().corpsCoin || 0,
        description: `Showcase Champion — "${theme.title}" (${monthId})`,
        grantItem: SHOWCASE_WINNER_ITEM,
      });
    }
  });

  logger.info(`Showcase ${monthId} finalized`, {
    winner: winners[0].uid,
    entryCount: ranked.length,
  });
  return { status: "finalized", monthId, winner: winners[0].uid, entryCount: ranked.length };
}

// -----------------------------------------------------------------------------
// DISCORD ANNOUNCEMENTS (#announcements, lease-guarded like the Fan Favorite)
// -----------------------------------------------------------------------------

const EXCHANGE_URL = `${SITE_URL}/exchange`;

/** @param {{monthId: string, theme: Object}} params */
function buildShowcaseOpenPayload({ monthId, theme }) {
  return payloadOf({
    title: `🎨 The Showcase is open — “${theme.title}”`,
    url: EXCHANGE_URL,
    description:
      `${theme.blurb}\n\nDesign it in the Uniform Studio and enter on the Exchange page. ` +
      `One entry per director (resubmit to swap it); entering pays CorpsCoin. ` +
      `Submissions close on the 20th, then the community votes. Cosmetic only — zero score impact.`,
    color: COLORS.fan,
    footer: { text: `Showcase ${monthId} · enter on the Exchange` },
  });
}

/** @param {{monthId: string, theme: Object, entryCount: number}} params */
function buildShowcaseVotingPayload({ monthId, theme, entryCount }) {
  return payloadOf({
    title: `🗳️ Showcase voting is open — “${theme.title}”`,
    url: EXCHANGE_URL,
    description:
      `${entryCount} ${entryCount === 1 ? "design is" : "designs are"} in. ` +
      `Ballots are anonymous head-to-heads: two looks, pick one, no names shown. ` +
      `Your first few votes each month pay CorpsCoin. Voting runs through the end of the month.`,
    color: COLORS.fan,
    footer: { text: `Showcase ${monthId} · vote on the Exchange` },
  });
}

/** @param {{monthId: string, theme: Object, results: Object}} params */
function buildShowcaseWinnerPayload({ monthId, theme, results }) {
  const medals = ["🥇", "🥈", "🥉"];
  const lines = (results.winners || []).map(
    (w, i) =>
      `${medals[i] || `${w.rank}.`} **${clampName(w.designName)}** — ${clampName(w.username)} (${w.wins} wins)`
  );
  return payloadOf({
    title: `🏆 Showcase Champion — “${theme.title}”`,
    url: EXCHANGE_URL,
    description:
      `The community has voted. ${results.entryCount} designs entered; these took the podium:\n\n` +
      joinLines(lines) +
      `\n\nThe champion wears the grant-only Showcase Champion title — it cannot be bought.`,
    color: COLORS.champion,
    footer: { text: `Showcase ${monthId} · results on the Exchange` },
  });
}

/**
 * Post whichever Showcase announcements are due tonight. Safe to call every
 * night: each announcement is lease-guarded (posted at most once per month),
 * and quiet nights return skips. Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{webhookUrl: string, fetchImpl?: typeof fetch, now?: Date}} params
 * @returns {Promise<Array<{kind: string, status: string}>>}
 */
async function announceShowcase(db, { webhookUrl, fetchImpl, now = new Date() }) {
  if (!webhookUrl) return [];
  const announcements = [];
  const { monthId, phase } = phaseFor(now);
  const theme = themeForMonth(monthId);
  const tag = "showcase";

  if (phase === "submissions") {
    announcements.push(
      await postOnce(db, {
        kind: "showcase-open",
        tag,
        leaseKey: `showcase_${monthId}_open`,
        leaseDay: 0,
        payload: buildShowcaseOpenPayload({ monthId, theme }),
        webhookUrl,
        fetchImpl,
      })
    );
  } else {
    // voting phase: announce once, with the real entry count
    const countSnap = await db.collection(paths.showcaseEntries(monthId)).count().get();
    const entryCount = countSnap.data().count;
    if (entryCount > 0) {
      announcements.push(
        await postOnce(db, {
          kind: "showcase-voting",
          tag,
          leaseKey: `showcase_${monthId}_voting`,
          leaseDay: 0,
          payload: buildShowcaseVotingPayload({ monthId, theme, entryCount }),
          webhookUrl,
          fetchImpl,
        })
      );
    }
  }

  // Last month's crowning, once its results doc exists.
  const lastMonth = previousMonthId(now);
  const resultsDoc = await db.doc(paths.showcaseResults(lastMonth)).get();
  if (resultsDoc.exists) {
    announcements.push(
      await postOnce(db, {
        kind: "showcase-winner",
        tag,
        leaseKey: `showcase_${lastMonth}_winner`,
        leaseDay: 0,
        payload: buildShowcaseWinnerPayload({
          monthId: lastMonth,
          theme: themeForMonth(lastMonth),
          results: resultsDoc.data(),
        }),
        webhookUrl,
        fetchImpl,
      })
    );
  }

  return announcements.filter((a) => a.status !== "skipped");
}

module.exports = {
  setShowcaseNowForTesting,
  showcaseNow,
  SHOWCASE_ENTRY_REWARD,
  SHOWCASE_VOTE_REWARD,
  SHOWCASE_PAID_VOTES,
  SHOWCASE_WINNER_ITEM,
  SHOWCASE_VOTING_OPENS_DAY,
  MAX_SHOWCASE_ENTRIES,
  SHOWCASE_THEMES,
  monthIdFor,
  previousMonthId,
  themeForMonth,
  phaseFor,
  tallyShowcase,
  finalizeShowcase,
  announceShowcase,
  buildShowcaseOpenPayload,
  buildShowcaseVotingPayload,
  buildShowcaseWinnerPayload,
};
