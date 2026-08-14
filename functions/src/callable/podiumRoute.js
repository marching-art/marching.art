/**
 * Podium route preview + state read, split from callable/podium.js for
 * file-size hygiene. Shares podiumContext (feature gate + season/day
 * derivation + balance overrides) with the rest of the Podium API.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { assertWriteBudget } = require("../helpers/callableGuards");
const store = require("../helpers/podium/store");
const venues = require("../helpers/podium/venues");
const jointHelper = require("../helpers/podium/joint");
const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");
const staffMarket = require("../helpers/podium/staffMarket");
const assessment = require("../helpers/podium/assessment");
const { podiumContext } = require("./podium");

// Branded names for the fixed majors on the route sheet.
const MAJOR_ROUTE_LABELS = {
  28: "marching.art Southwestern Championship",
  35: "marching.art Southeastern Championship",
  41: "marching.art Eastern Classic",
  42: "marching.art Eastern Classic",
};

/**
 * Where the corps is standing right now (design §5.12 "current location"): the
 * venue of its most recent show, else its hometown before the first show. Every
 * upcoming leg is priced from here, so the route sheet leads with it.
 * @returns {{venueId, city, region, lat, lng}|null} null when the corps has no
 *   show behind it and its hometown isn't in the gazetteer.
 */
function currentVenueOf(state) {
  // The origin is the last show's venue once the tour is underway, else the
  // corps' official home — the structured `home` venue (design §5.3), falling
  // back to resolving the legacy free-text `location` for corps founded before
  // homes were stored structurally.
  return state.lastVenue || state.home || venues.venueFor(state.location) || null;
}

/**
 * Display form of the current location for the route sheet: the city label, the
 * stadium when one is on file, whether the corps is still at its hometown, and
 * the show day that put it where it is. `city` falls back to the raw hometown
 * string when that hometown isn't on the tour map — the route can't be priced
 * from an unmapped town, and saying so beats showing a blank origin.
 */
function buildCurrentLocation(state, uid, competitionDay, easternAssignments) {
  const venue = currentVenueOf(state);
  const atHome = !state.lastVenue;
  // The show that moved the corps here — the most recent show day on or before
  // today. Only meaningful once a show has actually been performed.
  let sinceDay = null;
  if (!atHome) {
    for (let day = Math.min(Math.max(0, competitionDay), 49); day >= 1; day--) {
      if (store.isShowDayFor(state, uid, day, easternAssignments)) {
        sinceDay = day;
        break;
      }
    }
  }
  return {
    venueId: venue ? venue.venueId : null,
    city: venue ? `${venue.city}, ${venue.region}` : state.location || null,
    stadium: venue ? venues.stadiumFor(venue.venueId) : null,
    // False when the hometown isn't in the gazetteer: legs from it are free and
    // mileage-less, which the client explains rather than silently showing.
    mapped: Boolean(venue),
    atHome,
    sinceDay,
  };
}

// Exported for unit tests; the callables below are the production entry points.
exports.buildCurrentLocation = buildCurrentLocation;

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
  // Accepted joint rehearsals are real legs on the tour (design §5.12), so fold
  // each upcoming joint day into the route alongside the shows.
  const jointByDay = {};
  for (const j of jointHelper.pendingJoints(state)) {
    if (j.day > Math.max(0, competitionDay)) jointByDay[j.day] = j;
  }
  const upcoming = [
    ...new Set([
      ...store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
      ...store.selectedDaysOf(state),
      ...Object.keys(jointByDay).map(Number),
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

  return buildRouteLegs(state, upcoming, { jointByDay, locations });
}

/**
 * Assemble the ordered travel legs for a route from already-resolved inputs
 * (the upcoming show/joint days, the per-day joint map, and the schedule's
 * day→location lookup). Pure and exported for unit tests; buildRoutePreview
 * supplies the Firestore-backed inputs.
 *
 * A joint rehearsal is a day-trip REHEARSAL, never a tour relocation: the corps
 * rehearses with whoever's housed nearby and stays at its own tour position
 * (design §5.12). So a joint leg is priced and shown, but it MUST NOT advance
 * the routing cursor — otherwise every onward show is re-priced from the
 * joint's host city, a location the corps doesn't control (it's the partner's
 * tour position, set by the OTHER director's schedule). That injected a phantom
 * onward-travel penalty of up to -10 stamina onto the accepting director, who
 * agreed to the joint on its proposed location and never chose to move there.
 * The nightly processor already treats a joint this way — it never sets
 * state.lastVenue on a joint day, so the corps' next show is priced from its
 * last real venue — and this preview must match that authority.
 */
function buildRouteLegs(state, upcoming, { jointByDay, locations }) {
  const legs = [];
  let cursor = currentVenueOf(state);
  for (const day of upcoming) {
    // Joint-rehearsal day: a rehearsal leg, not a show. The partner's city
    // hosts; the proposer's copy carries the frozen travel tier (the acceptor's
    // is null → free), and both get the Full Ensemble bonus (design §5.12).
    const joint = jointByDay[day];
    if (joint) {
      const venue = joint.city ? venues.venueFor(joint.city) : null;
      const tierCfg = joint.travelTier
        ? store.balance.travel.tiers.find((t) => t.key === joint.travelTier)
        : null;
      const move = venues.travelLeg(cursor, venue, store.balance);
      legs.push({
        day,
        eventName: null,
        city: venue ? `${venue.city}, ${venue.region}` : joint.city || "TBA",
        stadium: venue ? venues.stadiumFor(venue.venueId) : null,
        label: `Joint rehearsal · ${joint.partnerCorpsName || "corps"}`,
        isJoint: true,
        partnerCorpsName: joint.partnerCorpsName || null,
        ensembleBonusPct: Math.round(((joint.bonusMult || 1) - 1) * 100),
        tier: joint.travelTier || null,
        miles: move ? move.miles : null,
        coinCost: tierCfg ? tierCfg.coinCost : 0,
        staminaCost: tierCfg ? tierCfg.staminaCost : 0,
        heat: 0,
        isMajor: false,
      });
      // A joint day-trips out and back — the cursor stays at the corps' real
      // tour position, so the next show is never priced from the host city.
      continue;
    }
    const isMajor = Boolean(venues.MAJOR_VENUES[day]);
    // Route to the CHOSEN show's location on a self-pick day so consecutive
    // picks chain leg-to-leg through their actual venues; majors have fixed
    // venues; legacy picks (no stored location) fall back to the day's schedule.
    const pick = isMajor ? null : store.showPickFor(state, day);
    const pickLocation = pick?.location || locations[day];
    const venue = venues.MAJOR_VENUES[day] || (pickLocation ? venues.venueFor(pickLocation) : null);
    const leg = venues.travelLeg(cursor, venue, store.balance);
    // Airfare (design §5.3): long legs can fly to halve their stamina hit for a
    // CorpsCoin fare. The portal shows the fare, the flown stamina, and whether
    // the director has already booked it — an open-information routing choice.
    const airfare = venues.airfareFor(leg, store.balance);
    const airfarePurchased = Boolean(airfare.eligible && state.airfare && state.airfare[day]);
    const rawStamina = leg ? leg.staminaCost : 0;
    legs.push({
      day,
      eventName: pick?.eventName || null,
      city: venue ? `${venue.city}, ${venue.region}` : "TBA",
      stadium: venue ? venues.stadiumFor(venue.venueId) : null,
      label: store.championshipEventFor(day) || MAJOR_ROUTE_LABELS[day] || null,
      tier: leg ? leg.tier : null,
      miles: leg ? leg.miles : null,
      coinCost: leg && !isMajor ? leg.coinCost : 0,
      staminaCost: rawStamina,
      heat: venues.heatStamina(venue, store.balance),
      isMajor,
      // Airfare affordance for this leg (absent/eligible:false on short legs).
      airfareEligible: airfare.eligible,
      airfareCost: airfare.coinCost,
      airfareStaminaCost: airfare.eligible
        ? Math.round(rawStamina * airfare.staminaMultiplier * 10) / 10
        : null,
      airfarePurchased,
    });
    if (venue) cursor = venue;
  }
  return legs;
}

// Exported for unit tests; buildRoutePreview is the production entry point.
exports.buildRouteLegs = buildRouteLegs;

/**
 * Between-seasons funding preview (design §5.6, the "guns vs. butter" commit
 * decision). getPodiumState only speaks for the CURRENT season, so before a
 * director re-registers there is no server surface that shows what NEXT
 * season's staff will cost. This read fills that gap: it ages every carried
 * staffer one season and reports their projected salary, the total payroll,
 * the director's CorpsCoin balance, and the division commitment cap — the
 * numbers the registration screen compares so a director can see a shortfall
 * and choose who to keep BEFORE committing, never discovering a silent lapse
 * after the fact.
 *
 * Read-only: it never advances the season index (that write belongs to
 * registration), so the division is approximated from the career's current
 * seat — validateCommitment stays authoritative on submit.
 */
exports.getPodiumRegistrationPreview = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData } = await podiumContext(request);
  const [staleSnapshot, careerSnapshot, profileSnapshot] = await Promise.all([
    store.stateRef(db, uid).get(),
    career.careerRef(db, uid).get(),
    store.profileRef(db, uid).get(),
  ]);

  const careerData = careerSnapshot.exists ? careerSnapshot.data() : null;
  const division = divisions.normalizeDivision(careerData && careerData.division);
  const commitmentCap =
    (store.balance.budget.commitmentCapByDivision || {})[division] ||
    store.balance.budget.commitmentCap;
  const corpsCoin = profileSnapshot.exists ? profileSnapshot.data().corpsCoin || 0 : 0;

  // Carried staff exist only when last season's corps hasn't been re-founded
  // yet (a different seasonUid). A fresh corps or a current-season doc has no
  // payroll to preview.
  const hasCarried =
    staleSnapshot.exists && staleSnapshot.data().seasonUid !== seasonData.seasonUid;
  const roster = hasCarried ? staleSnapshot.data().staff || {} : {};
  // Project against the most a director could possibly commit (min of the cap
  // and their wallet), so `affordable` answers "can I keep everyone even at
  // max funding?" — the actual keep/drop math re-runs client-side as they
  // dial the commitment.
  const projection = staffMarket.projectRetention(
    roster,
    Math.min(commitmentCap, corpsCoin),
    store.balance
  );

  // Last season's financial report + refund. Prefer the banked report (the
  // nightly sweep already settled and refunded); otherwise project it from the
  // still-present prior-season state, whose unspent budget this registration
  // will refund on submit. Either way the director sees the settlement — and
  // the refund it frees up — BEFORE committing next season's CC.
  const bankedReport =
    careerData && careerData.lastSeasonReport ? careerData.lastSeasonReport : null;
  const lastSeasonReport =
    bankedReport ||
    (hasCarried
      ? store.buildSeasonFinancialReport(staleSnapshot.data(), {
        seasonUid: staleSnapshot.data().seasonUid,
      })
      : null);
  // Estimated budget for a comparable next season: last season's operating
  // spend (travel/food/camp/clinicians) plus next season's exact aged staff
  // payroll — staff is re-derived precisely at re-registration, the rest is
  // approximated by what it actually cost. Rounded up to the commit step,
  // clamped to the division cap. Null with no prior season to learn from.
  const roundUpToStep = (value) => Math.ceil(Math.max(0, value) / 50) * 50;
  const estimatedSeasonBudget = lastSeasonReport
    ? Math.min(commitmentCap, roundUpToStep((lastSeasonReport.operatingSpend || 0) + projection.payroll))
    : null;

  return {
    success: true,
    hasCarriedStaff: projection.staff.length > 0,
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
    commitmentCap,
    corpsCoin,
    payroll: projection.payroll,
    affordable: projection.affordable,
    // Between-seasons financial settlement (design §14.2.1): the just-ended
    // season's line-item report, the refund swept back to the wallet, and a
    // data-driven estimate to fund the next one.
    lastSeasonReport,
    estimatedSeasonBudget,
    staff: projection.staff.map((s) => ({
      specialty: s.specialty,
      id: s.id,
      tier: s.tier,
      nextTier: s.nextTier,
      salary: s.salary,
      nextSalary: s.nextSalary,
      // Multi-season contract lock (design §5.6): the reconfirm screen shows a
      // still-contracted staffer as held at their original price rather than a
      // bare keep/drop, so a rising tenured rate never reads as a surprise raise.
      contract: s.contract,
      locked: s.locked,
      retiring: s.retiring,
    })),
    // The season-start assessment (§5.7/§5.13): the corps' complete evaluation
    // against last season's field — class, status, peer standing, activity —
    // published by the archival sweep, shown BEFORE the director decides. Null
    // for a first-time director (no prior season to assess). `assessment.decisions`
    // gains "unretire" here when banked lineages exist.
    assessment: careerData && careerData.pendingAssessment
      ? {
        ...careerData.pendingAssessment,
        decisions: [
          ...(careerData.pendingAssessment.decisions || ["continue", "retire", "startNew"]),
          ...((careerData.retiredCareers || []).length > 0 ? ["unretire"] : []),
        ],
      }
      : null,
    // Between-seasons home relocation (design §5.3): the CorpsCoin-per-mile rate
    // so the client can price a move as the director picks a new home, matching
    // the authoritative charge in registerPodiumCorps.
    homeRelocationMilesPerCoin: (store.balance.home && store.balance.home.milesPerCoin) || 2,
    // The carried-over corps identity, so the screen greets "continue <Name>"
    // instead of a blank founding form.
    carryover: hasCarried
      ? {
        corpsName: staleSnapshot.data().corpsName || null,
        location: staleSnapshot.data().location || null,
        // The current official home, resolved to a tour-map venue so the client
        // can preselect it AND measure the distance to any new pick (the move
        // fee). Legacy corps with only a free-text `location` resolve here too.
        ...(() => {
          const home =
            staleSnapshot.data().home ||
            venues.venueFor(staleSnapshot.data().location) ||
            null;
          return home
            ? {
              homeVenueId: home.venueId,
              homeCity: `${home.city}, ${home.region}`,
              homeLat: home.lat,
              homeLng: home.lng,
            }
            : {};
        })(),
        showConcept: staleSnapshot.data().showConcept || null,
        reputation: careerData ? careerData.reputation || 0 : 0,
        tier: engineTierLabel(careerData),
      }
      : null,
    // Banked lineages a director can un-retire (each re-assessed on selection).
    retiredLineages: (careerData && careerData.retiredCareers ? careerData.retiredCareers : []).map(
      (lineage, index) => ({
        index,
        corpsName: lineage.corpsName || null,
        seasonsPlayed: lineage.seasonsPlayed || 0,
        reputation: Math.round((lineage.reputation || 0) * 10) / 10,
        tierLabel: assessment.tierLabel(engineTierForCareer(lineage)),
      })
    ),
  };
});

/** Named tier label for a career's current reputation (helper for the preview). */
function engineTierForCareer(careerData) {
  const engine = require("../helpers/podium/engine");
  return engine.tierForReputation((careerData && careerData.reputation) || 0, store.balance);
}
function engineTierLabel(careerData) {
  return assessment.tierLabel(engineTierForCareer(careerData));
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

  // Today's block budget (used / cap / remaining) and the plan-editor caps,
  // both server-authoritative so the client stops hardcoding 12/8/20 and the
  // planner can show how many blocks are actually left (stamina penalty and
  // all). See store.computeTodayBlockBudget for the freshness handling.
  const { maxBlocksToday, blocksUsedToday, blocksRemainingToday } = store.computeTodayBlockBudget(
    state,
    { calendarDay, competitionDay, isShowDay }
  );
  const blockCaps = store.planBlockCaps();
  const routePreview = await buildRoutePreview(
    db, seasonData, state, uid, competitionDay, easternAssignments
  );
  // Resolved independently of the route so the origin still shows when there
  // are no upcoming shows left to route.
  const currentLocation = buildCurrentLocation(state, uid, competitionDay, easternAssignments);
  const careerSnapshot = await career.careerRef(db, uid).get();
  const careerData = careerSnapshot.exists ? careerSnapshot.data() : null;
  const division = divisions.normalizeDivision(state.division);
  const commitmentCap =
    (store.balance.budget.commitmentCapByDivision || {})[division] ||
    store.balance.budget.commitmentCap;
  // Payroll outlook: what THIS corps' staff will cost next season once every
  // staffer ages up. When that aged payroll can't fit the division cap, the
  // director will have to release or retrain someone at re-registration no
  // matter how much CorpsCoin they save — the season-boundary warning worth
  // surfacing NOW, while there's still time to act (design §5.6).
  const staffProjection = staffMarket.projectRetention(state.staff || {}, commitmentCap, store.balance);
  const staffOutlook = {
    payroll: staffProjection.payroll,
    commitmentCap,
    shortfall: Math.max(0, staffProjection.payroll - commitmentCap),
    atRisk: !staffProjection.affordable && staffProjection.payroll > 0,
    // The banner stays dismissed until the projected payroll changes (a hire,
    // a release, or next season's aging), at which point it re-warns.
    acknowledged: state.staffOutlookAck === staffProjection.payroll,
  };
  return {
    exists: true,
    calendarDay,
    competitionDay,
    isShowDay,
    // Today's rehearsal budget (server-authoritative; see above).
    maxBlocksToday,
    blocksUsedToday,
    blocksRemainingToday,
    blockCaps,
    division,
    divisionLabel: divisions.DIVISION_LABELS[division],
    commitmentCap,
    staffOutlook,
    easternNight: store.easternNightFor(uid, seasonData.seasonUid, easternAssignments),
    easternNightFinal: Boolean(easternAssignments && easternAssignments[uid]),
    autoDays: store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
    routePreview,
    currentLocation,
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

/**
 * Book or cancel airfare on an upcoming show leg (design §5.3). Toggling `fly`
 * records an intent flag keyed by competition day; the nightly processor prices
 * and charges it against the REALIZED leg (only if it's still over the tier
 * floor and the Corps Budget can pay), so this is a free, reversible choice
 * right up to the show — no charge lands here, and a leg that reroutes short
 * simply never flies. The day must be one the corps actually attends (a self-
 * pick or an auto-attended major/championship day) and still ahead of today.
 */
exports.setPodiumAirfare = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const day = Number(request.data && request.data.day);
  const fly = Boolean(request.data && request.data.fly);
  if (!Number.isInteger(day) || day < 1 || day > 49) {
    throw new HttpsError("invalid-argument", "Airfare day must be a competition day (1-49).");
  }
  if (day <= Math.max(0, competitionDay)) {
    throw new HttpsError(
      "failed-precondition",
      "That show has already passed — airfare is set ahead of the show."
    );
  }
  await assertWriteBudget(db, uid, "podium", { max: 120, windowMs: 10 * 60 * 1000 });
  const easternAssignments = await store.loadEasternAssignments(db, seasonData.seasonUid);
  const sRef = store.stateRef(db, uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    // Only show days the corps rides on tour are flyable — auto-attended majors
    // and championship week plus the director's own picks. Joint rehearsals are
    // day-trips, never flights, so they're excluded by construction.
    const division = divisions.normalizeDivision(state.division);
    const showDays = new Set([
      ...store.autoDaysFor(uid, seasonData.seasonUid, { division, easternAssignments }),
      ...store.selectedDaysOf(state),
    ]);
    if (!showDays.has(day)) {
      throw new HttpsError(
        "failed-precondition",
        "You're not attending a show that day — add it before booking airfare."
      );
    }
    const airfare = { ...(state.airfare || {}) };
    if (fly) airfare[day] = true;
    else delete airfare[day];
    // Whole-field replace (not a merge): set-with-merge deep-merges nested maps,
    // which would strand a cancelled day's flag instead of clearing it.
    transaction.update(sRef, { airfare, updatedAt: new Date().toISOString() });
  });
  return { success: true, day, fly };
});
