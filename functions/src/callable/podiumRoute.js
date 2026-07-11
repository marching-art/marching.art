/**
 * Podium route preview + state read, split from callable/podium.js for
 * file-size hygiene. Shares podiumContext (feature gate + season/day
 * derivation + balance overrides) with the rest of the Podium API.
 */

const { onCall } = require("firebase-functions/v2/https");
const store = require("../helpers/podium/store");
const venues = require("../helpers/podium/venues");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");
const { podiumContext } = require("./podium");

// Branded names for the fixed majors on the route sheet.
const MAJOR_ROUTE_LABELS = {
  28: "marching.art Southwestern Championship",
  35: "marching.art Southeastern Championship",
  41: "marching.art Eastern Classic",
  42: "marching.art Eastern Classic",
};

/**
 * Upcoming route: the single tour view (design §5.3). One ordered chain of
 * travel legs through the corps' next show days — the self-picked shows the
 * director has added to the schedule PLUS the auto-attended majors and
 * Championship Week — each carrying the show name, tier, miles, coin cost
 * (majors subsidized), heat surcharge, and (for the majors and Championship
 * Week in Indianapolis) the event label. Championship Week mirrors the fantasy
 * bracket: Open/A corps see Open & A Prelims/Finals then the World rounds; a
 * World corps sees the World Prelims/Semis/Finals.
 *
 * Each self-pick routes through its OWN chosen venue, so shows added to the
 * schedule are routed between each other leg-to-leg: the cursor advances to
 * each show's location before pricing the next hop. Shown BEFORE selections
 * are confirmed (open-information routing).
 */
async function buildRoutePreview(db, seasonData, state, uid, competitionDay, easternAssignments) {
  const division = divisions.normalizeDivision(state.division);
  const upcoming = [
    ...new Set([
      ...store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
      ...store.selectedDaysOf(state),
    ]),
  ]
    .filter((day) => day > Math.max(0, competitionDay) && day <= 49)
    .sort((a, b) => a - b)
    .slice(0, 8);
  if (upcoming.length === 0) return [];

  const scheduleId = seasonData.dataDocId || seasonData.name;
  let locations = {};
  if (scheduleId) {
    const doc = await db.doc(`schedules/${scheduleId}`).get();
    if (doc.exists) {
      for (const comp of doc.data().competitions || []) {
        if (comp.day != null && comp.location && locations[comp.day] == null) {
          locations[comp.day] = comp.location;
        }
      }
    }
  }

  const legs = [];
  let cursor = state.lastVenue || venues.venueFor(state.location) || null;
  for (const day of upcoming) {
    const isMajor = Boolean(venues.MAJOR_VENUES[day]);
    // Route to the CHOSEN show's location on a self-pick day so consecutive
    // picks chain leg-to-leg through their actual venues; majors have fixed
    // venues; legacy picks (no stored location) fall back to the day's schedule.
    const pick = isMajor ? null : store.showPickFor(state, day);
    const pickLocation = pick?.location || locations[day];
    const venue = venues.MAJOR_VENUES[day] || (pickLocation ? venues.venueFor(pickLocation) : null);
    const leg = venues.travelLeg(cursor, venue, store.balance);
    legs.push({
      day,
      eventName: pick?.eventName || null,
      city: venue ? `${venue.city}, ${venue.region}` : "TBA",
      label: store.championshipEventFor(day) || MAJOR_ROUTE_LABELS[day] || null,
      tier: leg ? leg.tier : null,
      miles: leg ? leg.miles : null,
      coinCost: leg && !isMajor ? leg.coinCost : 0,
      staminaCost: leg ? leg.staminaCost : 0,
      heat: venues.heatStamina(venue, store.balance),
      isMajor,
    });
    if (venue) cursor = venue;
  }
  return legs;
}

exports.getPodiumState = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay, competitionDay } = await podiumContext(request);
  const snapshot = await store.stateRef(db, uid).get();
  if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
    return { exists: false, calendarDay, competitionDay };
  }
  const state = snapshot.data();
  const easternAssignments = await store.loadEasternAssignments(db, seasonData.seasonUid);
  const isShowDay = store.isShowDayFor(state, uid, competitionDay, easternAssignments);
  const routePreview = await buildRoutePreview(
    db, seasonData, state, uid, competitionDay, easternAssignments
  );
  const careerSnapshot = await career.careerRef(db, uid).get();
  const careerData = careerSnapshot.exists ? careerSnapshot.data() : null;
  const division = divisions.normalizeDivision(state.division);
  return {
    exists: true,
    calendarDay,
    competitionDay,
    isShowDay,
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
    commitmentCap:
      (store.balance.budget.commitmentCapByDivision || {})[division] ||
      store.balance.budget.commitmentCap,
    easternNight: store.easternNightFor(uid, seasonData.seasonUid, easternAssignments),
    easternNightFinal: Boolean(easternAssignments && easternAssignments[uid]),
    autoDays: store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
    routePreview,
    career: careerData
      ? {
        reputation: careerData.reputation,
        historicalPeak: careerData.historicalPeak,
        seasonsPlayed: careerData.seasonsPlayed,
        history: (careerData.history || []).slice(-5),
      }
      : null,
    state,
  };
});
