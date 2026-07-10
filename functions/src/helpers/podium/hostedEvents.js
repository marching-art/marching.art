/**
 * Director-hosted events — ALL classes (Phase 6.2, design §5.10).
 *
 * Any director can rent a venue tier and host a show on an open tour date.
 * The FMA failure modes are designed out:
 *   - OPEN ENROLLMENT: the show appears in the season schedule like any
 *     other; fantasy corps select it through the normal weekly picker. No
 *     host approval, no gatekeeping.
 *   - INSTANT PAYOUT: attendance pays out at that night's processing run,
 *     not season end.
 *   - ALT-FARM GUARD: attendance counts DISTINCT DIRECTORS whose corps
 *     actually scored at the event (recap entries are active by
 *     construction), capped at venue capacity.
 *   - Hosting is CorpsCoin (cross-class prestige economy), never Corps
 *     Budget, and confers zero competitive advantage.
 *
 * Event docs: hosted-events/{seasonUid}/events/{eventId} (public read).
 */

const { logger } = require("firebase-functions/v2");
const { dataNamespaceParam } = require("../../config");
const balance = require("./balanceConfig.json");
const venues = require("./venues");
const store = require("./store");

function eventsCollection(db, seasonUid) {
  return db.collection(`hosted-events/${seasonUid}/events`);
}

/**
 * Validate a hosting request (pure). Throws Error with a message on
 * violation; the callable maps it to an HttpsError.
 * @returns {{eventName, venueTier, tier, day, venue}}
 */
function validateHostRequest({ eventName, venueTier, day, location }, currentCompetitionDay) {
  const cfg = balance.hostedEvents;
  const tier = cfg.venueTiers[venueTier];
  if (!tier) throw new Error(`Unknown venue tier: ${venueTier}`);
  if (
    typeof eventName !== "string" ||
    eventName.trim().length < cfg.nameMin ||
    eventName.trim().length > cfg.nameMax
  ) {
    throw new Error(`Event name must be ${cfg.nameMin}-${cfg.nameMax} characters.`);
  }
  if (!Number.isInteger(day) || day < 1 || day > cfg.lastHostableDay) {
    throw new Error(`Hostable days are 1-${cfg.lastHostableDay}.`);
  }
  if (day < currentCompetitionDay + cfg.minDaysAhead) {
    throw new Error(`Events must be scheduled at least ${cfg.minDaysAhead} days ahead.`);
  }
  if (store.MAJOR_DAYS.includes(day)) {
    throw new Error("The majors' days are exclusive — pick another date.");
  }
  const venue = venues.venueFor(location);
  if (!venue) {
    throw new Error("Venue city not recognized — use a \"City, State\" from the tour map.");
  }
  return { eventName: eventName.trim(), venueTier, tier, day, venue };
}

/**
 * Pay hosts for events on the completed competition day. Attendance =
 * distinct directors with scored results at the event in the fantasy recap
 * (plus Podium corps scored that day for Podium-hosted visibility later),
 * capped at capacity. Safe to call once per day (the caller runs it inside
 * the once-per-day Podium stage completion).
 */
async function payoutHostedEvents(db, seasonData, competitionDay) {
  const seasonUid = seasonData.seasonUid;
  const snapshot = await eventsCollection(db, seasonUid).where("day", "==", competitionDay).get();
  if (snapshot.empty) return { events: 0, paid: 0 };

  const recapSnapshot = await db.doc(`fantasy_recaps/${seasonUid}/days/${competitionDay}`).get();
  const recapShows = recapSnapshot.exists ? recapSnapshot.data().shows || [] : [];

  let paid = 0;
  for (const eventDoc of snapshot.docs) {
    // Per-event isolation: one bad event (deleted host profile, transient
    // write error) must not abort payouts for the rest of the day — the
    // payout branch only runs on the day's single completed stage run, so
    // an aborted sweep would never be retried.
    try {
      const event = eventDoc.data();
      if (event.paidOut) continue;
      const tier = balance.hostedEvents.venueTiers[event.venueTier];
      if (!tier) continue;

      const show = recapShows.find((s) => s.eventName === event.eventName);
      const uids = new Set();
      for (const result of (show && show.results) || []) {
        if (result.uid) uids.add(result.uid);
      }
      const attendance = Math.min(uids.size, tier.capacity);
      const payout = attendance * tier.payoutPerCorpsCC;

      if (payout > 0) {
        const profileRef = db.doc(
          `artifacts/${dataNamespaceParam.value()}/users/${event.hostUid}/profile/data`
        );
        await db.runTransaction(async (transaction) => {
          const profile = await transaction.get(profileRef);
          if (!profile.exists) return; // host profile gone — nothing to pay
          const corpsCoin = profile.data().corpsCoin || 0;
          transaction.update(profileRef, { corpsCoin: corpsCoin + payout });
          const historyRef = db
            .collection(
              `artifacts/${dataNamespaceParam.value()}/users/${event.hostUid}/corpsCoinHistory`
            )
            .doc();
          transaction.set(historyRef, {
            type: "hosted_event_payout",
            amount: payout,
            description: `Hosting payout: ${event.eventName} (${attendance} corps)`,
            timestamp: new Date(),
          });
        });
      }
      await eventDoc.ref.set(
        { paidOut: true, attendance, payout, paidAt: new Date().toISOString() },
        { merge: true }
      );
      paid += payout;
    } catch (error) {
      logger.error(`[hosted-events] payout failed for event ${eventDoc.id}: ${error.message}`);
    }
  }
  logger.info(
    `[hosted-events] day ${competitionDay}: ${snapshot.size} event(s), ${paid} CC paid out.`
  );
  return { events: snapshot.size, paid };
}

module.exports = { eventsCollection, validateHostRequest, payoutHostedEvents };
