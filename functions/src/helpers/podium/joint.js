/**
 * Joint rehearsals — the Podium social mechanic (Phase 7.1, design §5.12).
 *
 * Two corps share a rehearsal day: a deliberately HUMAN handshake (the
 * assistant director never accepts on anyone's behalf), gated by tour
 * geography, capped weekly, with repeat-pair decay so the social graph is
 * pushed outward instead of two friends farming each other.
 *
 * Mechanics on the shared day (all applied by the nightly processor or the
 * block callable, never here):
 *   - each corps' Full Ensemble block yields +ensembleBonus (decayed per
 *     repeat pairing; the multiplier is FROZEN at acceptance so both sides
 *     agree on it forever),
 *   - both corps get a morale bump,
 *   - both directors receive the scrimmage report: a PRIVATE caption-by-
 *     caption head-to-head scored as if tonight were a show — scouting,
 *     invisible to leaderboards and recaps,
 *   - the day's public recap gets the feed line ("X and Y held a joint
 *     rehearsal in Allentown") — public smoke, private fire.
 *
 * Proposals live in `podium-joint/{seasonUid}/proposals/{id}` (backend-only;
 * the callables are the API). Accepted joints are denormalized onto BOTH
 * corps' states as `state.jointRehearsal` (upcoming, one at a time) plus a
 * `state.jointHistory` append that drives the weekly cap and pair decay.
 */

const engine = require("./engine");
const venues = require("./venues");

function proposalsCollection(db, seasonUid) {
  return db.collection(`podium-joint/${seasonUid}/proposals`);
}

/** Competition week of a competition day (pre-season days count as week 0). */
function weekOf(competitionDay) {
  return competitionDay < 1 ? 0 : Math.ceil(competitionDay / 7);
}

/** Accepted joints already banked for the given week (drives the weekly cap). */
function jointsUsedInWeek(state, week) {
  return (state.jointHistory || []).filter((j) => j && weekOf(j.day) === week).length;
}

/** Prior accepted joints with this partner this season (drives pair decay). */
function pairCountWith(state, partnerUid) {
  return (state.jointHistory || []).filter((j) => j && j.partnerUid === partnerUid).length;
}

/**
 * A corps' not-yet-processed joint rehearsals. The season allows one per week
 * (the weekly cap, enforced via jointHistory), so a corps can carry SEVERAL
 * upcoming joints in different weeks at once — the feature only locks a week,
 * never the whole calendar. Tolerates the legacy single `jointRehearsal` slot
 * so saves written before the multi-joint change still resolve.
 * @returns {Array<object>}
 */
function pendingJoints(state) {
  if (Array.isArray(state.jointRehearsals)) return state.jointRehearsals;
  if (state.jointRehearsal && state.jointRehearsal.day) return [state.jointRehearsal];
  return [];
}

/**
 * The Full Ensemble bonus multiplier for the Nth pairing (0-indexed prior
 * count). 1st: full bonus; 2nd: half; 3rd+: none (the scrimmage report
 * always works).
 */
function ensembleBonusFor(priorPairCount, cfg) {
  const decay = cfg.joint.repeatBonusMultipliers;
  const mult = decay[Math.min(priorPairCount, decay.length - 1)];
  return 1 + cfg.joint.ensembleBonus * mult;
}

/**
 * A corps' location on a given competition day: its most recent show venue
 * strictly before that day, else hometown (design §5.12 "current location").
 * `scheduleLocations` is the processor's {day -> location} preload.
 */
function corpsVenueOnDay(state, uid, competitionDay, scheduleLocations, storeModule, easternAssignments) {
  for (let day = Math.min(competitionDay - 1, 49); day >= 1; day--) {
    if (!storeModule.isShowDayFor(state, uid, day, easternAssignments)) continue;
    const major = venues.MAJOR_VENUES[day];
    if (major) return major;
    const location = scheduleLocations[day];
    const venue = location ? venues.venueFor(location) : null;
    if (venue) return venue;
  }
  return venues.venueFor(state.location) || null;
}

/**
 * Ranked joint-rehearsal overlap windows for a proposer→partner pair (design
 * §5.12, redesign). Scans the next `proposalMaxAheadDays` for days that are
 * open REHEARSAL days for BOTH corps (a joint fills the quiet days), prices the
 * proposer's travel to close the gap (the proposer covers it — the partner's
 * city hosts), and ranks best-fit first: free windows, then least distance,
 * then soonest. Pure — the callable supplies the schedule + eastern preloads.
 *
 * @returns {Array<{day:number, week:number, hostVenueId:string|null,
 *   city:string|null, stadium:string|null, milesApart:number|null,
 *   travelTier:string|null, isFree:boolean, staminaCost:number,
 *   coinCost:number, ensembleBonusPct:number, priorPairs:number}>}
 */
function computeOverlaps(myState, theirState, myUid, theirUid, ctx) {
  const { competitionDay, scheduleLocations, easternAssignments, storeModule, cfg } = ctx;
  const maxPerWeek = cfg.joint.maxPerWeek;
  const lastDay = Math.min(49, competitionDay + cfg.joint.proposalMaxAheadDays);
  const priorPairs = pairCountWith(myState, theirUid);
  const ensembleBonusPct = Math.round((ensembleBonusFor(priorPairs, cfg) - 1) * 100);
  const windows = [];

  for (let day = competitionDay + 1; day <= lastDay; day++) {
    // Both corps must be OPEN — a shared rehearsal day, never a show day.
    if (storeModule.isShowDayFor(myState, myUid, day, easternAssignments)) continue;
    if (storeModule.isShowDayFor(theirState, theirUid, day, easternAssignments)) continue;
    // Weekly cap: neither corps can have already banked that week's joint.
    const week = weekOf(day);
    if (jointsUsedInWeek(myState, week) >= maxPerWeek) continue;
    if (jointsUsedInWeek(theirState, week) >= maxPerWeek) continue;

    const myVenue = corpsVenueOnDay(
      myState, myUid, day, scheduleLocations, storeModule, easternAssignments
    );
    const theirVenue = corpsVenueOnDay(
      theirState, theirUid, day, scheduleLocations, storeModule, easternAssignments
    );
    // The partner's city hosts; the proposer closes any gap (the burden rule).
    const host = theirVenue || myVenue || null;
    const gate = geographyGate(myVenue, theirVenue, cfg);
    let travelTier = null;
    let staminaCost = 0;
    let coinCost = 0;
    if (gate.travelTier) {
      const tierCfg = cfg.travel.tiers.find((t) => t.key === gate.travelTier);
      travelTier = gate.travelTier;
      staminaCost = tierCfg ? tierCfg.staminaCost : 0;
      coinCost = tierCfg ? tierCfg.coinCost : 0;
    }
    windows.push({
      day,
      week,
      hostVenueId: host ? host.venueId : null,
      city: host ? `${host.city}, ${host.region}` : null,
      stadium: host ? venues.stadiumFor(host.venueId) : null,
      milesApart: gate.miles,
      travelTier,
      isFree: !travelTier,
      staminaCost,
      coinCost,
      ensembleBonusPct,
      priorPairs,
    });
  }

  // Best fit first: free windows, then least distance, then soonest day.
  windows.sort(
    (a, b) =>
      Number(b.isFree) - Number(a.isFree) ||
      (a.milesApart ?? Infinity) - (b.milesApart ?? Infinity) ||
      a.day - b.day
  );
  return windows;
}

/**
 * Geography gate (pure): joint is free within the day-trip tier; beyond it
 * the PROPOSER owes the normal travel cost of the gap tier (charged by the
 * nightly processor on the joint day, debit-or-surcharge like any leg).
 * Unknown venues (unlisted hometowns) pass free — geography can gate play,
 * bad gazetteer data must not.
 *
 * @returns {{allowed: true, travelTier: string|null, miles: number|null}}
 */
function geographyGate(venueA, venueB, cfg) {
  if (!venueA || !venueB) return { allowed: true, travelTier: null, miles: null };
  const leg = venues.travelLeg(venueA, venueB, cfg);
  if (!leg || leg.miles === 0) return { allowed: true, travelTier: null, miles: 0 };
  const freeTier = cfg.joint.maxFreeDistanceTier;
  const freeMax = (cfg.travel.tiers.find((t) => t.key === freeTier) || {}).maxMiles || 0;
  if (leg.miles <= freeMax) return { allowed: true, travelTier: null, miles: leg.miles };
  return { allowed: true, travelTier: leg.tier, miles: leg.miles };
}

/**
 * The scrimmage report for one side (pure): my full sheet vs theirs, scored
 * as if tonight were a show. Deterministic; the seed matches the processor's
 * scoring seeds in shape but is joint-specific so it never equals an
 * official score.
 */
function scrimmageReport(myState, theirState, competitionDay, seasonUid, curves, cfg) {
  const day = Math.max(1, Math.min(competitionDay, 49));
  const mine = engine.scoreCorps(
    myState, day, `${seasonUid}|joint|${competitionDay}|${myState.corpsName}`, curves, cfg
  );
  const theirs = engine.scoreCorps(
    theirState, day, `${seasonUid}|joint|${competitionDay}|${theirState.corpsName}`, curves, cfg
  );
  return {
    day: competitionDay,
    partnerCorpsName: theirState.corpsName || null,
    mine: { total: mine.total, captions: mine.captions },
    theirs: { total: theirs.total, captions: theirs.captions },
  };
}

module.exports = {
  proposalsCollection,
  weekOf,
  jointsUsedInWeek,
  pairCountWith,
  pendingJoints,
  ensembleBonusFor,
  corpsVenueOnDay,
  geographyGate,
  computeOverlaps,
  scrimmageReport,
};
