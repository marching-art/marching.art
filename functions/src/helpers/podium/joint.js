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
const staffMarket = require("./staffMarket");

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
 *
 * Each show day resolves exactly the way the nightly processor routes it
 * (processor.showVenueFor): a branded major's fixed site, else the location of
 * the show THIS corps picked that day, and only for a legacy pick with no
 * stored location the day's first scheduled show (`scheduleLocations`, the
 * {day -> location} preload). Reading the day's first show unconditionally put
 * a corps touring Indiana/Ohio at whatever show happened to be listed first
 * that day — a Virginia venue hundreds of miles off its route — so windows,
 * proposals and acceptances all priced and hosted joints somewhere neither
 * corps was. The hometown fallback prefers the structured `home` venue, as the
 * processor and route sheet do.
 */
function corpsVenueOnDay(state, uid, competitionDay, scheduleLocations, storeModule, easternAssignments) {
  for (let day = Math.min(competitionDay - 1, 49); day >= 1; day--) {
    if (!storeModule.isShowDayFor(state, uid, day, easternAssignments)) continue;
    const major = venues.MAJOR_VENUES[day];
    if (major) return major;
    const pick = storeModule.showPickFor(state, day);
    const location = (pick && pick.location) || scheduleLocations[day];
    const venue = location ? venues.venueFor(location) : null;
    if (venue) return venue;
  }
  return state.home || venues.venueFor(state.location) || null;
}

/**
 * Where a corps stands on tour right now: its last performed show's venue,
 * else its structured home, else its free-text hometown resolved against the
 * gazetteer. The same origin the processor prices every show leg from.
 */
function tourPositionOf(state) {
  return state.lastVenue || state.home || venues.venueFor(state.location) || null;
}

/**
 * Where a proposed joint lands and who travels (pure; design §5.12): the
 * invitee's tour position on that day hosts (the proposer's when the
 * invitee's can't be placed), and the proposer owes any gap beyond the free
 * tier. One rule for the propose-time snapshot, the live refresh the inbox
 * reads, and acceptance — so every screen names the same city and cost.
 *
 * @param {object} fromState proposer's state
 * @param {string} fromUid
 * @param {object} toState invitee's state
 * @param {string} toUid
 * @param {number} day proposed competition day
 * @param {{scheduleLocations: object, easternAssignments: any, storeModule: any, cfg: any}} ctx
 * @returns {{city: string|null, stadium: string|null, proposerTravelTier: string|null,
 *   milesApart: number|null, proposerStaminaCost: number, proposerCoinCost: number}}
 */
function proposalPreview(fromState, fromUid, toState, toUid, day, ctx) {
  const { scheduleLocations, easternAssignments, storeModule, cfg } = ctx;
  const fromVenue = corpsVenueOnDay(
    fromState, fromUid, day, scheduleLocations, storeModule, easternAssignments
  );
  const toVenue = corpsVenueOnDay(
    toState, toUid, day, scheduleLocations, storeModule, easternAssignments
  );
  const host = toVenue || fromVenue || null;
  const gate = geographyGate(fromVenue, toVenue, cfg);
  const tierCfg = gate.travelTier ? cfg.travel.tiers.find((t) => t.key === gate.travelTier) : null;
  return {
    city: host ? `${host.city}, ${host.region}` : null,
    stadium: host ? venues.stadiumFor(host.venueId) : null,
    proposerTravelTier: gate.travelTier,
    milesApart: gate.miles,
    proposerStaminaCost: travelStaminaFor(fromState, tierCfg, cfg),
    proposerCoinCost: tierCfg ? tierCfg.coinCost || 0 : 0,
  };
}

/**
 * Stamina a travel tier costs THIS corps: the tier's base cost less its Tour
 * Manager's reduction, rounded to a tenth exactly as the processor rounds a
 * show leg — so every preview shows the number the nightly run will charge.
 */
function travelStaminaFor(state, tierCfg, cfg) {
  if (!tierCfg || !tierCfg.staminaCost) return 0;
  const reduction = staffMarket.tourStaminaReduction(state, cfg);
  return Math.round(tierCfg.staminaCost * (1 - reduction) * 10) / 10;
}

/**
 * The proposer's travel charge on the joint day (pure; design §5.12). A joint
 * is ONE outbound leg — a day trip, never a relocation — priced like any tour
 * leg: the tier's coin cost plus its stamina (Tour Manager applies).
 *
 * The charged tier is the LOWER of the tier frozen at acceptance and the tier
 * the two corps' real positions produce tonight: nobody ever pays more than
 * they agreed to, and a joint booked from a stale position (a partner who has
 * since moved closer, or a joint priced before tour positions followed each
 * corps' own picked show) is charged the gap that actually exists. A partner
 * within the free tier, or a position the gazetteer can't place, costs
 * nothing.
 *
 * @param {object} state the proposer's state (drives the Tour Manager cut)
 * @param {string|null} bookedTier travel tier frozen on the booking
 * @param {object|null} fromVenue proposer's tour position as the day began
 * @param {object|null} hostVenue partner's tour position as the day began
 * @param {object} cfg balance config
 * @returns {{tier: string, miles: number, coinCost: number, staminaCost: number,
 *   hostVenueId: string|null}|null} null when the joint costs nothing
 */
function jointTravelCharge(state, bookedTier, fromVenue, hostVenue, cfg) {
  if (!bookedTier) return null;
  const tiers = cfg.travel.tiers;
  const bookedIndex = tiers.findIndex((t) => t.key === bookedTier);
  if (bookedIndex < 0) return null;
  const gate = geographyGate(fromVenue, hostVenue, cfg);
  if (!gate.travelTier) return null;
  const liveIndex = tiers.findIndex((t) => t.key === gate.travelTier);
  const tierCfg = tiers[Math.min(bookedIndex, liveIndex < 0 ? bookedIndex : liveIndex)];
  if (!tierCfg.coinCost && !tierCfg.staminaCost) return null;
  return {
    tier: tierCfg.key,
    miles: gate.miles,
    coinCost: tierCfg.coinCost || 0,
    staminaCost: travelStaminaFor(state, tierCfg, cfg),
    hostVenueId: hostVenue ? hostVenue.venueId : null,
  };
}

/**
 * Bill a jointTravelCharge to the proposer's state (mutates): the coin from the
 * Corps Budget — an unaffordable fare becomes the usual stamina surcharge, the
 * bus still rolls (free floor) — then the leg's stamina, logged to the travel
 * log beside the show legs. `debitBudget` is store.debitBudget (injected so
 * this module stays free of the store's Firestore surface).
 */
function applyJointTravel(state, charge, competitionDay, debitBudget, cfg) {
  let staminaCost = charge.staminaCost;
  let coinCharged = 0;
  let paid = true;
  if (charge.coinCost > 0) {
    paid = debitBudget(state, charge.coinCost, "jointTravel", competitionDay);
    if (paid) coinCharged = charge.coinCost;
    else staminaCost += cfg.travel.unaffordableStaminaSurcharge;
  }
  state.condition.stamina = Math.max(0, state.condition.stamina - staminaCost);
  state.travelLog = [
    ...(state.travelLog || []).slice(-30),
    {
      day: competitionDay,
      to: charge.hostVenueId,
      tier: charge.tier,
      miles: charge.miles,
      coinCost: coinCharged,
      unaffordable: !paid || undefined,
      staminaCost,
      heat: 0,
      joint: true,
    },
  ];
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
      staminaCost = travelStaminaFor(myState, tierCfg, cfg);
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
  proposalPreview,
  tourPositionOf,
  travelStaminaFor,
  jointTravelCharge,
  applyJointTravel,
  geographyGate,
  computeOverlaps,
  scrimmageReport,
};
