/**
 * Buying an alternate scoring format for a league.
 *
 * A commissioner can put their league on Caption Wars — weeks decided as a
 * best-of-three across GE, Visual and Music rather than one comparison of
 * totals (helpers/captionWars.js, docs/CAPTION_WARS_SPEC.md) — or on
 * One-Night Slate — weeks decided by each director's best single show
 * (helpers/oneNightSlate.js).
 *
 * Three decisions are baked into this endpoint and are the reason it exists as
 * its own callable rather than another field on updateLeagueSettings:
 *
 * It costs CorpsCoin, paid by the COMMISSIONER out of their own balance. Never
 * per member: the format is a property of a matchup, so both sides must be
 * playing the same one, and a member who declined to pay could not be given a
 * different format — only excluded. That is pay-to-play in a league they
 * already paid an entry fee to join. Commissioner-paid is symmetric — it
 * changes how everyone's matchup is scored, identically — so no CorpsCoin buys
 * anybody an advantage.
 *
 * It never touches `settings.prizePool`. The pool is members' escrow, and the
 * same reasoning that makes `entryFee` uneditable makes the pool unspendable.
 *
 * It is PRESEASON ONLY. Switching format mid-season would mix two formats
 * inside one standings table, and `rebuildStandingsFromMatchups` would then
 * produce a number that never existed. That is a hard precondition, not a
 * warning.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const {
  assertAuth,
  hasAdminClaim,
  assertWriteBudget,
  assertDocId,
} = require("../helpers/callableGuards");
const { createLeagueActivity } = require("../helpers/leagueHelpers");
const { getActiveSeasonUid } = require("../helpers/leagueActivity");
const { isLeagueCommissioner } = require("../helpers/leaguePermissions");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("../helpers/economy");
const { SCORING_FORMATS, CAPTION_WARS_SEASON_COST } = require("../helpers/captionWars");
const { ONE_NIGHT_SEASON_COST } = require("../helpers/oneNightSlate");

/** What each format costs for one season. The default is always free. */
const FORMAT_COSTS = {
  [SCORING_FORMATS.TOTAL]: 0,
  [SCORING_FORMATS.CAPTION_WARS]: CAPTION_WARS_SEASON_COST,
  [SCORING_FORMATS.ONE_NIGHT]: ONE_NIGHT_SEASON_COST,
};

/** Player-facing copy per format: the activity-feed announcement members see
 *  and the confirmation the commissioner gets back. */
const FORMAT_COPY = {
  [SCORING_FORMATS.TOTAL]: {
    label: "standard scoring",
    title: "Back to standard scoring",
    announcement: "Weeks are decided on total score again this season.",
    confirmation: "This league is back on standard scoring.",
  },
  [SCORING_FORMATS.CAPTION_WARS]: {
    label: "Caption Wars",
    title: "Caption Wars enabled",
    announcement:
      "Weeks are decided as a best-of-three across General Effect, Visual and Music this season — win two captions and you win the week.",
    confirmation: "Caption Wars is on for this season.",
  },
  [SCORING_FORMATS.ONE_NIGHT]: {
    label: "One-Night Slate",
    title: "One-Night Slate enabled",
    announcement:
      "Weeks are decided by each director's best single show this season — one great night beats a week of grinding.",
    confirmation: "One-Night Slate is on for this season.",
  },
};

/**
 * Has this league already played a week of the live season?
 *
 * Pure, so the precondition can be tested without Firestore. A `week-N`
 * document with no season stamp predates stamping; rollover empties the live
 * collection, so anything unstamped still sitting here belongs to the current
 * season — the same reading the matchup generator uses.
 *
 * @param {Array<{id: string, data: function}>} matchupDocs
 * @param {string} seasonUid
 */
function seasonUnderway(matchupDocs, seasonUid) {
  return (matchupDocs || []).some((doc) => {
    if (!/^week-\d+$/.test(String(doc.id))) return false;
    const stamped = doc.data()?.seasonUid;
    return !stamped || stamped === seasonUid;
  });
}

exports.setLeagueScoringFormat = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, format } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId) throw new HttpsError("invalid-argument", "A league ID is required.");
  assertDocId(leagueId, "league ID");
  if (!Object.prototype.hasOwnProperty.call(FORMAT_COSTS, format)) {
    throw new HttpsError(
      "invalid-argument",
      `Scoring format must be one of: ${Object.keys(FORMAT_COSTS).join(", ")}.`
    );
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueFormat", { max: 10, windowMs: 60 * 60 * 1000 });

  const seasonUid = await getActiveSeasonUid(db);
  if (!seasonUid) throw new HttpsError("failed-precondition", "No active season.");

  const leagueRef = db.doc(paths.league(leagueId));
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");

  const league = leagueDoc.data();
  if (!isLeagueCommissioner(league, uid) && !hasAdminClaim(request)) {
    throw new HttpsError(
      "permission-denied",
      "Only a commissioner can change the league's scoring format."
    );
  }

  // Already on this format for this season — nothing to charge for.
  const currentFormat =
    league.settings?.scoringFormatSeasonUid === seasonUid
      ? league.settings?.scoringFormat || SCORING_FORMATS.TOTAL
      : SCORING_FORMATS.TOTAL;
  if (currentFormat === format) {
    return { success: true, charged: 0, format, message: "That is already this league's format." };
  }

  // Read the whole live matchup collection rather than probing week-1: a league
  // repaired by hand, or one whose first week was generated late, would slip
  // past a single-week check.
  const matchupsSnapshot = await db.collection(paths.leagueMatchups(leagueId)).get();
  if (seasonUnderway(matchupsSnapshot.docs, seasonUid)) {
    throw new HttpsError(
      "failed-precondition",
      "The season is already under way. A league's scoring format can only be changed before its first week is generated."
    );
  }

  const cost = FORMAT_COSTS[format];
  const profileRef = db.doc(paths.userProfile(uid));

  // Charge and set together. A commissioner whose balance moves between the
  // check and the write must not end up paying for a format that did not land,
  // or landing one they did not pay for.
  const charged = await db.runTransaction(async (transaction) => {
    const profileDoc = await transaction.get(profileRef);
    if (!profileDoc.exists) throw new HttpsError("not-found", "Your profile was not found.");

    const balance = profileDoc.data().corpsCoin || 0;
    if (cost > 0 && balance < cost) {
      throw new HttpsError(
        "failed-precondition",
        `${FORMAT_COPY[format].label} costs ${cost.toLocaleString()} CC for the season. You have ${balance.toLocaleString()} CC.`
      );
    }

    transaction.update(leagueRef, {
      "settings.scoringFormat": format,
      // Pinned to the season it was bought for. Resolution requires both, so a
      // stale format left on a league can never switch it into a paid format
      // nobody bought (helpers/captionWars.js isCaptionWarsLeague).
      "settings.scoringFormatSeasonUid": seasonUid,
    });

    if (cost > 0) {
      transaction.update(profileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(-cost),
      });
      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: TRANSACTION_TYPES.LEAGUE_FORMAT,
        amount: -cost,
        balance: balance - cost,
        description: `${FORMAT_COPY[format].label} for ${league.name || "your league"} this season`,
        leagueId,
      });
    }
    return cost;
  });

  // Members are entitled to know the rules of their league changed, before the
  // season starts rather than when their first result looks wrong.
  await createLeagueActivity(db, leagueId, {
    type: "settings_changed",
    title: FORMAT_COPY[format].title,
    message: FORMAT_COPY[format].announcement,
    userId: uid,
    metadata: { changes: [{ field: "scoringFormat", to: format }], seasonUid },
  });

  logger.info(
    `Commissioner ${uid} set league ${leagueId} to ${format} for ${seasonUid} (charged ${charged} CC).`
  );
  return {
    success: true,
    charged,
    format,
    message: FORMAT_COPY[format].confirmation,
  };
});

exports.seasonUnderway = seasonUnderway;
exports.FORMAT_COSTS = FORMAT_COSTS;
