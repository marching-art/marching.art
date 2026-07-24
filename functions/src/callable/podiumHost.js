/**
 * Podium hosted-events callable, split from callable/podium.js for file-size
 * hygiene. Shares podiumContext (feature gate + season/day derivation +
 * balance overrides) with the rest of the Podium API.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const store = require("../helpers/podium/store");
const hostedEvents = require("../helpers/podium/hostedEvents");
const { podiumContext } = require("./podium");
const { paths } = require("../helpers/paths");
const { assertWriteBudget } = require("../helpers/callableGuards");

exports.hostEvent = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  // Abuse throttle (shared podium bucket) — rehearsal/staff actions are the
  // Podium core loop, so the budget is generous (still far above human rate).
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  let validated;
  try {
    validated = hostedEvents.validateHostRequest(request.data || {}, Math.max(0, competitionDay));
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const { eventName, venueTier, tier, day, venue } = validated;

  // Host must field a corps somewhere in the game (anti-alt guard).
  const profileSnapshotPre = await store.profileRef(db, uid).get();
  const corpsMap = profileSnapshotPre.exists ? profileSnapshotPre.data().corps || {} : {};
  if (Object.values(corpsMap).filter(Boolean).length === 0) {
    throw new HttpsError("failed-precondition", "Field a corps before hosting events.");
  }
  // Venue ladder (decision 27): bigger stadiums are earned by running
  // successful smaller shows, never bought outright.
  const lockReason = hostedEvents.tierLockReason(
    profileSnapshotPre.exists ? profileSnapshotPre.data() : null,
    venueTier,
    store.balance
  );
  if (lockReason) {
    throw new HttpsError("failed-precondition", lockReason);
  }

  const seasonUid = seasonData.seasonUid;
  const dayEvents = await hostedEvents
    .eventsCollection(db, seasonUid)
    .where("day", "==", day)
    .get();
  if (dayEvents.size >= store.balance.hostedEvents.maxEventsPerDay) {
    throw new HttpsError("failed-precondition", `Day ${day} already has the maximum hosted events.`);
  }

  // A city hosts one show per season: refuse a location already on the
  // schedule (scraped majors/regionals or another director's hosted event).
  // Authoritative mirror of the greyed-out cities in the client picker.
  const scheduleId = seasonData.dataDocId || seasonData.name;
  if (scheduleId) {
    const scheduleDoc = await db.doc(`schedules/${scheduleId}`).get();
    const competitions = (scheduleDoc.exists && scheduleDoc.data().competitions) || [];
    if (hostedEvents.scheduledVenueIds(competitions).has(venue.venueId)) {
      throw new HttpsError(
        "failed-precondition",
        `${venue.city}, ${venue.region} is already on the schedule — pick a city that isn't hosting yet.`
      );
    }
  }

  const eventRef = hostedEvents.eventsCollection(db, seasonUid).doc();
  // One show per director per season (read inside the transaction so a
  // rapid double-submit can't slip two events past the check).
  const maxPerSeason = store.balance.hostedEvents.maxEventsPerSeasonPerHost || 1;
  const hostEventsQuery = hostedEvents.eventsCollection(db, seasonUid).where("hostUid", "==", uid);
  await db.runTransaction(async (transaction) => {
    const hostedThisSeason = await transaction.get(hostEventsQuery);
    if (hostedThisSeason.size >= maxPerSeason) {
      throw new HttpsError(
        "failed-precondition",
        "You've already hosted a show this season — directors can host one show per season."
      );
    }
    const profileSnapshot = await transaction.get(store.profileRef(db, uid));
    const corpsCoin = profileSnapshot.exists ? profileSnapshot.data().corpsCoin || 0 : 0;
    if (corpsCoin < tier.rentalCC) {
      throw new HttpsError(
        "failed-precondition",
        `Venue rental is ${tier.rentalCC} CC (you have ${corpsCoin}).`
      );
    }
    transaction.update(store.profileRef(db, uid), { corpsCoin: corpsCoin - tier.rentalCC });
    const historyRef = db.collection(paths.userCorpsCoinHistory(uid)).doc();
    transaction.set(historyRef, {
      type: "hosted_event_rental",
      amount: -tier.rentalCC,
      description: `Venue rental: ${eventName} (${tier.label})`,
      timestamp: new Date(),
    });
    transaction.set(eventRef, {
      hostUid: uid,
      eventName,
      venueTier,
      day,
      location: `${venue.city}, ${venue.region}`,
      venueId: venue.venueId,
      rentalCC: tier.rentalCC,
      capacity: tier.capacity,
      paidOut: false,
      createdAt: new Date().toISOString(),
    });
  });

  // Insert into the season schedule so every class can select it through
  // the normal weekly picker (open enrollment — no host approval).
  const { addShowToDay } = require("../helpers/seasonSchedule");
  if (scheduleId) {
    await addShowToDay(scheduleId, day, {
      eventName,
      location: `${venue.city}, ${venue.region}`,
      eventTier: "hosted",
      hostUid: uid,
    });
  }

  logger.info(`Hosted event created: ${eventName} day ${day} by ${uid}`);
  return { success: true, eventId: eventRef.id, day, eventName };
});
