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
 * Upcoming route preview: the chain of travel legs through the corps' next
 * show days (auto + selected), each with tier, miles, coin cost (majors
 * subsidized), heat surcharge, and — for the majors and Championship Week
 * in Indianapolis — the division-correct event label (an A Class corps sees
 * A Class Prelims/Finals, a World corps sees Prelims/Semis/Finals). Shown
 * in the tour picker BEFORE selections are confirmed (design §5.3
 * open-information routing).
 */
async function buildRoutePreview(db, seasonData, state, uid, competitionDay, easternAssignments) {
  const division = divisions.normalizeDivision(state.division);
  const upcoming = [
    ...new Set([
      ...store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
      ...(state.selectedShowDays || []),
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

  const championshipLabels = store.CHAMPIONSHIP_LABELS_BY_DIVISION[division];
  const legs = [];
  let cursor = state.lastVenue || venues.venueFor(state.location) || null;
  for (const day of upcoming) {
    const venue = venues.MAJOR_VENUES[day] || (locations[day] ? venues.venueFor(locations[day]) : null);
    const leg = venues.travelLeg(cursor, venue, store.balance);
    const isMajor = Boolean(venues.MAJOR_VENUES[day]);
    legs.push({
      day,
      city: venue ? `${venue.city}, ${venue.region}` : "TBA",
      label: championshipLabels[day] || MAJOR_ROUTE_LABELS[day] || null,
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
