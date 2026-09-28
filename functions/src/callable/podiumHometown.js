/**
 * Podium hometown correction callable, split from callable/podium.js for
 * file-size hygiene. Shares podiumContext (feature gate + season/day
 * derivation) with the rest of the Podium API.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { assertWriteBudget } = require("../helpers/callableGuards");
const store = require("../helpers/podium/store");
const venues = require("../helpers/podium/venues");
const hometown = require("../helpers/podium/hometown");
const { podiumContext } = require("./podium");

/**
 * One-time free hometown correction (design §5.3). Directors who registered
 * while the official home had to be a historical show city may move it to ANY
 * real US/Canadian town once, mid-season, at no cost. Eligibility and the
 * stored record live in helpers/podium/hometown.js.
 *
 * Effects: the home is the tour's origin only until the first show, so a corps
 * still at home has its upcoming legs re-priced from the new town; a corps
 * already touring keeps routing from its last show venue — nothing already
 * charged is revisited either way. The profile, the joint-rehearsal roster and
 * next season's relocation baseline all follow the new home.
 */
exports.correctPodiumHometown = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  const location = request.data && request.data.location;
  const venue = typeof location === "string" ? venues.venueFor(location) : null;
  if (!venue) {
    throw new HttpsError(
      "invalid-argument",
      "We couldn't place that hometown — pick your town from the list (any US or Canadian town works)."
    );
  }
  const homeRecord = hometown.homeRecordFor(venue);
  const homeLabel = `${venue.city}, ${venue.region}`;
  const seasonUid = seasonData.seasonUid;
  const sRef = store.stateRef(db, uid);

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    const state = snapshot.exists ? snapshot.data() : null;
    if (!state || state.seasonUid !== seasonUid) {
      throw new HttpsError("failed-precondition", "Register your corps for this season first.");
    }
    if (!hometown.canCorrectHome(state, seasonUid)) {
      throw new HttpsError(
        "failed-precondition",
        "Your free hometown correction has been used. You can move your home between seasons when you register."
      );
    }
    const previous = state.home
      ? `${state.home.city}, ${state.home.region}`
      : state.location || null;
    const now = new Date().toISOString();
    transaction.update(sRef, {
      home: homeRecord,
      location: homeLabel,
      homeCorrectedAt: now,
      homeCorrectedFrom: previous,
      updatedAt: now,
    });
    transaction.set(
      store.profileRef(db, uid),
      { corps: { podiumClass: { location: homeLabel } } },
      { merge: true }
    );
    transaction.set(store.rosterRef(db, seasonUid, uid), { location: homeLabel }, { merge: true });
    return { previous, touring: Boolean(state.lastVenue) };
  });

  logger.info(`Podium hometown corrected: ${uid} ${result.previous || "(none)"} → ${homeLabel}`);
  return {
    success: true,
    home: homeLabel,
    previous: result.previous,
    // Still at home → upcoming legs now price from the new town; touring → the
    // route keeps running from the last show venue.
    touring: result.touring,
  };
});
