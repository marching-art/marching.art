/**
 * Fan Favorite callables (decision 30) — split from podium.js. Any
 * signed-in user votes (fans included, no corps required); one vote per
 * prelims major, one in the finals; candidates validated server-side.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const store = require("../helpers/podium/store");
const fanFavorite = require("../helpers/podium/fanFavorite");
const { podiumContext } = require("./podium");
const { assertWriteBudget } = require("../helpers/callableGuards");

exports.getFanFavorite = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const seasonUid = seasonData.seasonUid;
  const cfg = store.balance;

  const prelimsMajor = fanFavorite.openPrelimsMajor(competitionDay, cfg);
  const inFinals = fanFavorite.finalsOpen(competitionDay, cfg);
  const fanSnapshot = await fanFavorite.fanDocRef(db, seasonUid).get();
  const fanData = fanSnapshot.exists ? fanSnapshot.data() : {};
  const ballotSnapshot = await fanFavorite.ballotRef(db, seasonUid, uid).get();
  const ballot = ballotSnapshot.exists ? ballotSnapshot.data() : {};

  let stage = null;
  let candidates = [];
  if (fanData.winner) {
    stage = "decided";
  } else if (inFinals && (fanData.finalists || []).length > 0) {
    stage = "finals";
    candidates = fanData.finalists;
  } else if (prelimsMajor) {
    stage = "prelims";
    candidates = await fanFavorite.candidatesForMajor(db, seasonUid, prelimsMajor);
  }

  return {
    success: true,
    stage,
    major: prelimsMajor,
    candidates,
    myVote:
      stage === "finals"
        ? ballot.finals || null
        : stage === "prelims"
          ? (ballot.prelims || {})[String(prelimsMajor)] || null
          : null,
    finalists: fanData.finalists || [],
    winner: fanData.winner || null,
  };
});

exports.castFanFavoriteVote = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { corpsUid } = request.data || {};
  if (typeof corpsUid !== "string" || !corpsUid) {
    throw new HttpsError("invalid-argument", "corpsUid is required.");
  }

  // Abuse throttle — voting is one-per-day server-side; this just stops
  // unthrottled hammering from a scripted client.
  await assertWriteBudget(db, uid, "fanVotes", { max: 60 });
  const seasonUid = seasonData.seasonUid;
  const cfg = store.balance;

  const prelimsMajor = fanFavorite.openPrelimsMajor(competitionDay, cfg);
  const inFinals = fanFavorite.finalsOpen(competitionDay, cfg);

  if (inFinals) {
    const fanSnapshot = await fanFavorite.fanDocRef(db, seasonUid).get();
    const finalists = (fanSnapshot.exists && fanSnapshot.data().finalists) || [];
    if (fanSnapshot.exists && fanSnapshot.data().winner) {
      throw new HttpsError("failed-precondition", "The Fan Favorite has already been decided.");
    }
    if (!finalists.some((f) => f.uid === corpsUid)) {
      throw new HttpsError("invalid-argument", "Vote for one of the finalists.");
    }
    await fanFavorite.ballotRef(db, seasonUid, uid).set({ finals: corpsUid }, { merge: true });
    return { success: true, stage: "finals", vote: corpsUid };
  }

  if (prelimsMajor) {
    const candidates = await fanFavorite.candidatesForMajor(db, seasonUid, prelimsMajor);
    if (!candidates.some((c) => c.uid === corpsUid)) {
      throw new HttpsError("invalid-argument", "Vote for a corps that performed at this major.");
    }
    await fanFavorite
      .ballotRef(db, seasonUid, uid)
      .set({ prelims: { [String(prelimsMajor)]: corpsUid } }, { merge: true });
    return { success: true, stage: "prelims", major: prelimsMajor, vote: corpsUid };
  }

  throw new HttpsError("failed-precondition", "No Fan Favorite ballot is open right now.");
});
