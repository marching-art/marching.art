/**
 * Director-hosted events — ALL classes (Phase 6.2, design §5.10; venue
 * ladder per decision 27: hosting REPLACES the old show-sponsorship
 * purchase as the way a director puts their name on the season).
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
 * THE VENUE LADDER: everyone can book the high-school stadium on day one
 * (150 CC — inside the 1,000-CC starting grant). The College Bowl unlocks
 * after 2 SUCCESSFUL high-school events, the NFL Stadium after 3 successful
 * College Bowls — success means drawing at least the tier's
 * `successAttendance`. A well-drawn show profits (capacity x payout beats
 * rental), so a good host climbs from Friday-night fields to Lucas Oil on
 * hosting revenue alone. Progress lives on the host profile at
 * `hosting.byTier.{tier}.{hosted,successful}` — written by the payout pass,
 * displayed on the Schedule page's hosting card.
 *
 * Event docs: hosted-events/{seasonUid}/events/{eventId} (public read).
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("../paths");
const venues = require("./venues");
const store = require("./store");

function eventsCollection(db, seasonUid) {
  return db.collection(`hosted-events/${seasonUid}/events`);
}

/**
 * The unlock gate for a venue tier against a host profile's hosting record
 * (pure). Returns null when unlocked, else a human-readable requirement.
 */
function tierLockReason(profileData, venueTier, cfg) {
  const tier = cfg.hostedEvents.venueTiers[venueTier];
  if (!tier || !tier.unlock) return null;
  const record = ((profileData && profileData.hosting) || {}).byTier || {};
  const successful = (record[tier.unlock.tier] || {}).successful || 0;
  if (successful >= tier.unlock.successful) return null;
  const neededLabel = cfg.hostedEvents.venueTiers[tier.unlock.tier].label;
  return (
    `${tier.label} unlocks after ${tier.unlock.successful} successful ` +
    `${neededLabel} events (you have ${successful}). Success = drawing at least ` +
    `${cfg.hostedEvents.venueTiers[tier.unlock.tier].successAttendance} corps.`
  );
}

/**
 * Validate a hosting request (pure). Throws Error with a message on
 * violation; the callable maps it to an HttpsError.
 * @returns {{eventName, venueTier, tier, day, venue}}
 */
function validateHostRequest({ eventName, venueTier, day, location }, currentCompetitionDay) {
  const cfg = store.balance.hostedEvents;
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
 * Resolve the set of venueIds already claimed by shows on a season schedule
 * (pure). A city hosts at most one show per season, so booking is refused for
 * any city already on the schedule — scraped majors/regionals or another
 * director's hosted event alike. Unrecognized location strings resolve to null
 * and are simply skipped.
 * @param {Array<{location?: string}>} competitions schedule competitions
 * @returns {Set<string>}
 */
function scheduledVenueIds(competitions) {
  const taken = new Set();
  for (const comp of competitions || []) {
    const venue = venues.venueFor(comp && comp.location);
    if (venue) taken.add(venue.venueId);
  }
  return taken;
}

/**
 * Pay hosts for events on the completed competition day. Attendance =
 * distinct directors with scored results at the event in the fantasy recap,
 * PLUS Podium corps that performed that day when this event was the day's
 * tour stop (the Podium processor routes corps to the day's first scheduled
 * location) — capped at capacity. Also advances the host's hosting résumé
 * (`hosting.byTier`), which gates the venue ladder. Safe to call once per
 * day (the caller runs it inside the once-per-day Podium stage completion).
 */
async function payoutHostedEvents(db, seasonData, competitionDay) {
  const seasonUid = seasonData.seasonUid;
  const snapshot = await eventsCollection(db, seasonUid).where("day", "==", competitionDay).get();
  if (snapshot.empty) return { events: 0, paid: 0 };

  const recapSnapshot = await db.doc(`fantasy_recaps/${seasonUid}/days/${competitionDay}`).get();
  const recapShows = recapSnapshot.exists ? recapSnapshot.data().shows || [] : [];

  // Podium corps now register for a specific show, so credit the host by
  // eventName (mirroring the fantasy path below). Build eventName -> [uids]
  // from the per-show podium recap. Legacy flat recaps fall back to matching
  // the day's first scheduled location.
  const podiumUidsByEvent = new Map();
  let podiumLegacyUids = [];
  let podiumLegacyLocation = null;
  try {
    const podiumRecap = await store.recapDayRef(db, seasonUid, competitionDay).get();
    const podiumData = podiumRecap.exists ? podiumRecap.data() : null;
    if (podiumData && podiumData.shows) {
      for (const show of podiumData.shows) {
        const uids = (show.results || []).map((r) => r.uid).filter(Boolean);
        if (show.eventName) podiumUidsByEvent.set(show.eventName, uids);
      }
    } else if (podiumData && podiumData.results) {
      // Legacy per-day recap: attribute to the day's first scheduled location.
      const scheduleId = seasonData.dataDocId || seasonData.name;
      if (scheduleId) {
        const scheduleDoc = await db.doc(`schedules/${scheduleId}`).get();
        const todays = ((scheduleDoc.exists && scheduleDoc.data().competitions) || []).filter(
          (comp) => comp.day === competitionDay && comp.location
        );
        podiumLegacyLocation = todays.length > 0 ? todays[0].location : null;
      }
      podiumLegacyUids = podiumData.results.map((r) => r.uid).filter(Boolean);
    }
  } catch (error) {
    logger.warn(`[hosted-events] podium attendance lookup failed: ${error.message}`);
  }

  let paid = 0;
  for (const eventDoc of snapshot.docs) {
    // Per-event isolation: one bad event (deleted host profile, transient
    // write error) must not abort payouts for the rest of the day — the
    // payout branch only runs on the day's single completed stage run, so
    // an aborted sweep would never be retried.
    try {
      const event = eventDoc.data();
      if (event.paidOut) continue;
      const tier = store.balance.hostedEvents.venueTiers[event.venueTier];
      if (!tier) continue;

      const show = recapShows.find((s) => s.eventName === event.eventName);
      const uids = new Set();
      for (const result of (show && show.results) || []) {
        if (result.uid) uids.add(result.uid);
      }
      // Podium performers at this event (by eventName; legacy: by location).
      for (const uid of podiumUidsByEvent.get(event.eventName) || []) uids.add(uid);
      if (podiumLegacyLocation && event.location === podiumLegacyLocation) {
        for (const uid of podiumLegacyUids) uids.add(uid);
      }
      const attendance = Math.min(uids.size, tier.capacity);
      const payout = attendance * tier.payoutPerCorpsCC;
      const successful = attendance >= (tier.successAttendance || Infinity);

      const profileRef = db.doc(
        paths.userProfile(event.hostUid)
      );
      await db.runTransaction(async (transaction) => {
        const profile = await transaction.get(profileRef);
        if (!profile.exists) return; // host profile gone — nothing to record
        const data = profile.data();
        const byTier = ((data.hosting || {}).byTier || {})[event.venueTier] || {};
        transaction.update(profileRef, {
          ...(payout > 0 ? { corpsCoin: (data.corpsCoin || 0) + payout } : {}),
          [`hosting.byTier.${event.venueTier}`]: {
            hosted: (byTier.hosted || 0) + 1,
            successful: (byTier.successful || 0) + (successful ? 1 : 0),
          },
        });
        if (payout > 0) {
          const historyRef = db
            .collection(
              paths.userCorpsCoinHistory(event.hostUid)
            )
            .doc();
          transaction.set(historyRef, {
            type: "hosted_event_payout",
            amount: payout,
            description: `Hosting payout: ${event.eventName} (${attendance} corps)`,
            timestamp: new Date(),
          });
        }
      });
      await eventDoc.ref.set(
        { paidOut: true, attendance, payout, successful, paidAt: new Date().toISOString() },
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

module.exports = {
  eventsCollection,
  tierLockReason,
  validateHostRequest,
  scheduledVenueIds,
  payoutHostedEvents,
};
