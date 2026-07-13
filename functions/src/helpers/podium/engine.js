/**
 * Podium Class scoring/rehearsal engine — PURE functions only.
 *
 * No Firebase imports, no I/O, no Date.now(), no Math.random(): every
 * function is deterministic in its inputs so the Phase 0 simulation harness
 * (src/scripts/podiumSim.js) exercises exactly the code the Phase 2
 * callables and nightly processor will ship. Design: docs/PODIUM.md
 * §4.2 (scoring), §5.2 (blocks), §5.3 (condition), §5.13 (reputation).
 *
 * Data dependencies (passed in, never required here):
 *   curves  — helpers/podium/curveData.json shape (bands, archetypes)
 *   cfg     — helpers/podium/balanceConfig.json shape (tunables)
 */

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const BLOCK_TYPES = [
  "warmup",
  "visualBasics",
  "visualEnsemble",
  "guardSectionals",
  "brassSectionals",
  "percussionSectionals",
  "fullEnsemble",
];

/** Deterministic 0..1 hash from a string seed (xmur3/mulberry-style). */
function seededUnit(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967295;
}

/** Season phase key for a competition day. */
function phaseForDay(day, cfg) {
  if (day <= cfg.rehearsal.phaseBounds.earlyThroughDay) return "early";
  if (day <= cfg.rehearsal.phaseBounds.midThroughDay) return "mid";
  return "late";
}

/**
 * Read a band value at an arbitrary percentile by interpolating the stored
 * p5/p25/p50/p75/p95/max points.
 * @param {object} band one day's band entry
 * @param {number} pct 0-100
 * @returns {number}
 */
function bandValueAtPercentile(band, pct) {
  const points = [
    [5, band.p5],
    [25, band.p25],
    [50, band.p50],
    [75, band.p75],
    [95, band.p95],
    [100, band.max],
  ];
  if (pct <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [p1, v1] = points[i - 1];
    const [p2, v2] = points[i];
    if (pct <= p2) return v1 + ((v2 - v1) * (pct - p1)) / (p2 - p1);
  }
  return points[points.length - 1][1];
}

/**
 * Derive a caption's growth-curve parameters from its challenge level:
 * the ceiling L targets the challenge-mapped percentile of the day-49 band,
 * and (k, d0) come from the archetype whose fitted L is nearest that target
 * (higher challenge -> later, slower-certain curves by construction of the
 * archetype set).
 * @returns {{L: number, k: number, d0: number}}
 */
function curveForChallenge(caption, challenge, curves, cfg) {
  const day49 = curves.bands[caption][48];
  const pct = cfg.scoring.challengeCeilingPercentile[String(challenge)];
  const L = bandValueAtPercentile(day49, pct);
  const archetypes = curves.archetypes[caption];
  let best = archetypes[0];
  for (const archetype of archetypes) {
    if (Math.abs(archetype.L - L) < Math.abs(best.L - L)) best = archetype;
  }
  // Normalize so a fully-realized curve reaches its ceiling exactly at
  // finals (the raw logistic is still ~6% shy of L at day 49).
  const norm = 1 / (1 + Math.exp(-best.k * (49 - best.d0)));
  return { L, k: best.k, d0: best.d0, norm };
}

/**
 * Create a fresh season state for a corps.
 * @param {object} params { challenge: {caption: 1-8}, repTier: 1-7,
 *   auditions: {caption: 0-1 share of audition pool} (optional) }
 */
function createSeasonState(params, curves, cfg) {
  const captions = {};
  for (const caption of CAPTIONS) {
    const challenge = params.challenge[caption] || 4;
    // Audition allocation shifts the starting content WITHIN the day-1 band:
    // baseline 0.28 content, +- up to 0.10 by allocation vs the even 1/8 share.
    const share = params.auditions ? params.auditions[caption] || 0 : 1 / 8;
    const auditionShift = Math.max(-0.1, Math.min(0.1, (share - 1 / 8) * 1.6));
    captions[caption] = {
      challenge,
      curve: curveForChallenge(caption, challenge, curves, cfg),
      content: 0.28 + auditionShift,
      clean: 0.2,
      lastRehearsedDay: 0,
    };
  }
  return {
    captions,
    condition: { stamina: cfg.condition.staminaMax, morale: 80 },
    foodTier: params.foodTier || "standard",
    consecutiveMaxDays: 0,
    repTier: params.repTier || 1,
    // Per-corps performance momentum (§4.2 trajectory model): an independent
    // random-walk in score-fraction units, evolved nightly by updateForm. Two
    // corps never share a form draw, so the field fluctuates individually.
    form: 0,
  };
}

/**
 * Allocate one rehearsal block. Mutates state; returns itemized gains
 * (the "Action Complete" panel payload).
 * @param {object} state season state
 * @param {string} blockType
 * @param {number} day competition day (may be <=0 during spring training)
 * @param {number} blockIndexToday 0-based index of this block today
 * @param {object} blocksSoFarToday counts by blockType already run today
 */
function allocateBlock(state, blockType, day, blockIndexToday, blocksSoFarToday, curves, cfg, opts = {}) {
  const block = cfg.blocks[blockType];
  if (!block) throw new Error(`Unknown block type: ${blockType}`);
  // Assistant-director autoplay runs template blocks at reduced yield
  // (design §5.2): active play strictly dominates.
  const yieldMultiplier = opts.yieldMultiplier ?? 1;
  // Show days grant twice the blocks (a long morning run-through) but each
  // click is worth half — the day nets the same growth and stamina as before,
  // just with more to click. Applied to yield AND per-block stamina so the
  // show day stays balance-neutral in both dimensions.
  const showDayMult = opts.isShowDay ? cfg.rehearsal.showDayYieldMultiplier : 1;

  const repeats = blocksSoFarToday[blockType] || 0;
  const repeatMult =
    cfg.rehearsal.repeatBlockMultipliers[
      Math.min(repeats, cfg.rehearsal.repeatBlockMultipliers.length - 1)
    ];
  const phase = phaseForDay(Math.max(1, day), cfg);
  const [contentShare, cleanShare] = cfg.rehearsal.contentCleanSplitByPhase[phase];
  // Spring training installs: force content-heavy split regardless of date.
  const [cShare, clShare] = day < 1 ? [0.85, 0.15] : [contentShare, cleanShare];

  // Tired corps rehearse badly: yield scales down through stamina tiers,
  // and morale nudges yield within the configured band. This is what makes
  // rest days a real strategy instead of lost time.
  let staminaFactor = 1;
  for (const tier of cfg.condition.yieldByStamina) {
    if (state.condition.stamina >= tier.minStamina) {
      staminaFactor = tier.multiplier;
      break;
    }
  }
  const conditionMult =
    staminaFactor *
    (1 + ((state.condition.morale - 50) / 50) * (cfg.condition.blockYieldModifierMaxPct / 100));

  const gains = {};
  for (const [caption, weight] of Object.entries(block.captions)) {
    const cap = state.captions[caption];
    // Higher challenge installs slower (harder book).
    const challengeMult = Math.pow(4 / cap.challenge, cfg.rehearsal.challengeGainExponent);
    const gain =
      cfg.rehearsal.primaryGain * weight * repeatMult * challengeMult * conditionMult * yieldMultiplier * showDayMult;
    const contentGain = gain * cShare * (1 - cap.content);
    const cleanGain = gain * clShare * (1 - cap.clean);
    cap.content = Math.min(1, cap.content + contentGain);
    cap.clean = Math.min(1, cap.clean + cleanGain);
    cap.lastRehearsedDay = day;
    gains[caption] = { content: contentGain, clean: cleanGain };
  }

  // Stamina: warmup reduces the cost of the day's REMAINING blocks.
  const warmupActive = (blocksSoFarToday.warmup || 0) > 0 && blockType !== "warmup";
  const costReduction = warmupActive ? cfg.blocks.warmup.conditionEffect.staminaCostReductionPct / 100 : 0;
  const staminaCost = block.staminaCost * (1 - costReduction) * showDayMult;
  state.condition.stamina = Math.max(0, state.condition.stamina - staminaCost);

  return { blockType, day, gains, staminaCost, repeatMult };
}

/**
 * End-of-day processing: neglect decay, overnight recovery, grind fatigue.
 * Mutates state.
 * @param {object} opts { restDay, blocksUsedToday, maxBlocksToday, warmupUsed }
 */
function endOfDay(state, day, opts, cfg) {
  // Neglect decay: unrehearsed captions lose clean after the grace window.
  const { graceDays, cleanLossPerDay, maxLossPerDay } = cfg.rehearsal.neglectDecay;
  for (const caption of CAPTIONS) {
    const cap = state.captions[caption];
    const idle = day - cap.lastRehearsedDay;
    if (idle > graceDays) {
      const loss = Math.min(maxLossPerDay, cleanLossPerDay * (idle - graceDays));
      cap.clean = Math.max(0, cap.clean - loss);
    }
  }

  // Grind fatigue: consecutive max-block days sap morale (warmup mitigates).
  if (!opts.restDay && opts.blocksUsedToday >= opts.maxBlocksToday) {
    state.consecutiveMaxDays += 1;
    if (state.consecutiveMaxDays > cfg.condition.moraleGrindThresholdDays) {
      const mitigation = opts.warmupUsed
        ? 1 - cfg.blocks.warmup.conditionEffect.fatigueMitigationPct / 100
        : 1;
      state.condition.morale = Math.max(
        0,
        state.condition.morale - cfg.condition.grindFatiguePerMaxDay * mitigation
      );
    }
  } else {
    state.consecutiveMaxDays = 0;
    state.condition.morale = Math.min(cfg.condition.moraleMax, state.condition.morale + 1);
  }

  // Recovery.
  const food = cfg.condition.foodTiers[state.foodTier] || cfg.condition.foodTiers.standard;
  const recovery = opts.restDay
    ? cfg.condition.restDayStaminaRecovery
    : cfg.condition.overnightStaminaRecovery;
  state.condition.stamina = Math.min(
    cfg.condition.staminaMax,
    state.condition.stamina + recovery + food.staminaRecoveryDelta
  );
  if (opts.restDay) {
    state.condition.morale = Math.min(
      cfg.condition.moraleMax,
      state.condition.morale + cfg.condition.restDayMoraleRecovery + food.moraleDelta
    );
  }
}

/** Blocks available today given day type and condition. */
function blocksAvailable(state, { isShowDay, isSpringTraining }, cfg) {
  let blocks = isShowDay
    ? cfg.rehearsal.blocksOnShowDay
    : isSpringTraining
      ? cfg.rehearsal.blocksPerDaySpringTraining
      : cfg.rehearsal.blocksPerDay;
  if (state.condition.stamina < cfg.condition.lowStaminaThreshold) {
    blocks = Math.max(1, blocks - cfg.condition.lowStaminaBlockPenalty);
  }
  return blocks;
}

/**
 * Inverse-CDF sample from a stored delta-rate distribution (p5/p25/p50/p75/p95),
 * linearly interpolated with flat tails. `u` is a deterministic 0..1 draw.
 * These distributions ARE the historical day-over-day movement of real corps —
 * the raw material for realistic, INDEPENDENT fluctuation.
 * @param {{p5,p25,p50,p75,p95:number}} dist
 * @param {number} u 0..1
 * @returns {number} a rate in the distribution's units (points/day)
 */
function sampleDelta(dist, u) {
  const points = [
    [5, dist.p5],
    [25, dist.p25],
    [50, dist.p50],
    [75, dist.p75],
    [95, dist.p95],
  ];
  const pct = Math.max(0, Math.min(100, u * 100));
  if (pct <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [p1, v1] = points[i - 1];
    const [p2, v2] = points[i];
    if (pct <= p2) return v1 + ((v2 - v1) * (pct - p1)) / (p2 - p1);
  }
  return points[points.length - 1][1];
}

/** The delta distribution for a caption (or "TOTAL") in the day's season phase. */
function deltaDistFor(key, day, curves, cfg) {
  const phase = phaseForDay(Math.max(1, day), cfg);
  const source = key === "TOTAL" ? curves.totalDeltas : curves.deltas[key];
  return (source && source[phase]) || { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 };
}

/**
 * Soft-knee ceiling: values below `knee = max * kneeFrac` pass through; above
 * it, the remaining headroom to `max` is approached asymptotically and NEVER
 * reached. This is how the historical envelope acts as a realism guardrail (no
 * 100s, no score above the all-time day mark) WITHOUT being a shared floor that
 * drags the field around.
 */
function softCap(value, max, kneeFrac) {
  if (!(max > 0)) return Math.max(0, value);
  const knee = max * kneeFrac;
  if (value <= knee) return Math.max(0, value);
  const room = max - knee;
  return knee + room * (1 - Math.exp(-(value - knee) / room));
}

/**
 * Evolve a corps' independent performance form one night (§4.2). Pure per
 * corps: the draw is seeded ONLY by this corps' seed, so no two corps — even
 * at the same show on the same day — share a shock. Mean-reverting and bounded,
 * so form is a gentle multi-day hot-streak / slump, never a runaway.
 * @param {object} state season state (mutated: state.form)
 * @param {number} day competition day
 * @param {string} seed per-corps seed, e.g. `${seasonUid}|${uid}`
 * @returns {number} the new form value
 */
function updateForm(state, day, seed, curves, cfg) {
  const fc = cfg.scoring.form;
  const dist = deltaDistFor("TOTAL", day, curves, cfg);
  const u = seededUnit(`${seed}|form|${day}`);
  // Standardize the historical rate into a ~[-1,1] zero-median shock, so form's
  // magnitude is set by fc.step (not by the raw point scale of the era's data).
  const spread = Math.max(1e-6, (dist.p95 - dist.p5) / 2);
  const shock = (sampleDelta(dist, u) - dist.p50) / spread;
  let form = (state.form || 0) * (1 - fc.reversion) + shock * fc.step;
  form = Math.max(-fc.max, Math.min(fc.max, form));
  state.form = Number(form.toFixed(5));
  return state.form;
}

/**
 * The reputation-gated ceiling fraction for a tier: the fraction of full
 * potential a FLAWLESS corps at this tier can reach. An explicit, top-bunched
 * ladder (diminishing returns near the top: Elite and Champion sit close, big
 * gaps are lower down) — a newcomer tops out at repCeilingFracByTier["1"], a
 * Champion at 1.0. Falls back to a linear repCeilingFloor→1.0 ramp if the
 * per-tier table is absent.
 */
function ceilFracForTier(repTier, cfg) {
  const sc = cfg.scoring;
  const tier = Math.max(1, Math.min(sc.maxRepTier || 7, repTier || 1));
  const table = sc.repCeilingFracByTier;
  if (table && table[String(tier)] != null) return Number(table[String(tier)]);
  const span = (sc.maxRepTier || 7) - 1;
  const progress = span > 0 ? (tier - 1) / span : 0;
  return sc.repCeilingFloor + (1 - sc.repCeilingFloor) * progress;
}

/**
 * Score a corps for a show on `day` (§4.2, trajectory-anchored model). Pure;
 * does not mutate state.
 *
 * Each corps rides its OWN challenge-selected potential curve, realized by its
 * OWN rehearsal, nudged by its OWN independent form and a one-night judge
 * wiggle. The historical band supplies only a per-day realism CEILING
 * (`band.max`, soft-knee) — there is no shared floor, so two corps at two shows
 * move independently and a historical field-dip is never replayed on the field.
 * @param {string} varianceSeed e.g. `${seasonUid}|${day}|${uid}`
 * @returns {{captions: object, geScore, visualScore, musicScore, total}}
 */
function scoreCorps(state, day, varianceSeed, curves, cfg) {
  const sc = cfg.scoring;
  const captionScores = {};
  const conditionSignal =
    ((state.condition.stamina - 60) / 40 + (state.condition.morale - 60) / 40) / 2;
  const conditionMod =
    Math.max(-1, Math.min(1, conditionSignal)) * cfg.condition.scoreModifierMaxPerCaption;
  // Reputation gates the CEILING — not a wall, not a shared clamp. A newcomer's
  // best-possible show tops out well below a dynasty's (ceilFracForTier).
  // Rehearsal then places the corps between the reputation-INDEPENDENT floor
  // (any corps can field a mediocre show) and that reputation-gated ceiling —
  // so rehearsal fully controls where you land within your tier, and a
  // perfectly-rehearsed FIRST season still tops out in the mid/upper 70s while
  // a Champion can reach the high 90s.
  const ceilFrac = ceilFracForTier(state.repTier || 1, cfg);
  // Independent per-corps momentum (see updateForm) — the field's individuality.
  const formMult = 1 + (state.form || 0);

  for (const caption of CAPTIONS) {
    const cap = state.captions[caption];
    const band = curves.bands[caption][Math.min(48, Math.max(0, day - 1))];
    const { L, k, d0, norm } = cap.curve;
    // This corps' OWN potential trajectory: its challenge-selected archetype
    // shape (fit from real corps-seasons), normalized to reach its ceiling at
    // finals. Smooth by construction — no shared per-day national floor.
    const potential = (L * (1 / (1 + Math.exp(-k * (day - d0))))) / norm;
    // Rehearsal attainment: how much of the book is installed AND clean.
    const attainment = cap.content * (sc.cleanFloor + sc.cleanWeight * cap.clean);
    const realized = Math.min(1, attainment / sc.attainmentFullRealization);
    // Position between the rep-independent floor and the rep-gated ceiling,
    // set ENTIRELY by this corps' own rehearsal. This is where effort becomes
    // score — and why two same-tier corps that rehearsed differently differ.
    const frac = sc.perfFloorFraction + (ceilFrac - sc.perfFloorFraction) * realized;
    // One-night judge wiggle, shaped by the caption's real day-over-day
    // movement (zero-median), seeded independently per corps + caption.
    const dist = deltaDistFor(caption, day, curves, cfg);
    const noise =
      (sampleDelta(dist, seededUnit(`${varianceSeed}|${caption}`)) - dist.p50) * sc.judgeNoiseScale;
    const value = potential * frac * formMult + conditionMod + noise;
    // Realism guardrail only: never negative, never above the all-time day mark.
    captionScores[caption] = Number(softCap(value, band.max, sc.softCapKnee).toFixed(3));
  }

  const geScore = captionScores.GE1 + captionScores.GE2;
  const visualScore = (captionScores.VP + captionScores.VA + captionScores.CG) / 2;
  const musicScore = (captionScores.B + captionScores.MA + captionScores.P) / 2;
  // Total realism guardrail: the per-day historical TOTAL max (soft-knee), then
  // the absolute cap. Keeps "looks like DCI" at the total level and guarantees
  // no 100s, without any shared floor pulling the field together.
  const totalBand = curves.totalBands[Math.min(48, Math.max(0, day - 1))];
  const rawTotal = geScore + visualScore + musicScore;
  const total = Math.min(
    sc.totalCap,
    softCap(rawTotal, totalBand ? totalBand.max : sc.totalCap, sc.softCapKnee)
  );
  return {
    captions: captionScores,
    geScore: Number(geScore.toFixed(3)),
    visualScore: Number(visualScore.toFixed(3)),
    musicScore: Number(musicScore.toFixed(3)),
    total: Number(total.toFixed(3)),
  };
}

/**
 * The reference maximum finals-caliber total for a day: a challenge-8,
 * fully-realized potential total. This is the top of the ladder — what a
 * Champion-tier flawless corps is measured against. Deterministic in the curve
 * data; cheap enough to call once per reputation update.
 */
function maxPotentialTotal(day, curves, cfg) {
  const challenge = {};
  for (const caption of CAPTIONS) challenge[caption] = 8;
  const state = createSeasonState({ challenge, repTier: cfg.scoring.maxRepTier || 7 }, curves, cfg);
  const p = {};
  for (const caption of CAPTIONS) {
    const { L, k, d0, norm } = state.captions[caption].curve;
    p[caption] = (L * (1 / (1 + Math.exp(-k * (day - d0))))) / norm;
  }
  return p.GE1 + p.GE2 + (p.VP + p.VA + p.CG) / 2 + (p.B + p.MA + p.P) / 2;
}

/**
 * Tier-relative season performance (0-100): how close to your CURRENT tier's
 * flawless ceiling you finished. Because scoring is reputation-gated (a
 * newcomer physically cannot post a Champion's number), reputation must be
 * earned by maxing out AT YOUR OWN ALTITUDE — a perfect tier-1 season reads as
 * ~100 here even though its absolute total (~76) is mid-field. This is the
 * signal the reputation ladder climbs on (§5.13).
 * @returns {number} 0-100
 */
function tierPerformance(finalsTotal, day, repTier, curves, cfg) {
  const sc = cfg.scoring;
  const refMax = maxPotentialTotal(day, curves, cfg);
  const ceilFrac = ceilFracForTier(repTier || 1, cfg);
  const ceiling = refMax * ceilFrac;
  const floor = refMax * sc.perfFloorFraction;
  return Math.max(0, Math.min(100, (100 * (finalsTotal - floor)) / Math.max(1e-6, ceiling - floor)));
}

/**
 * Season-end reputation update (§5.13). Returns the new reputation value.
 * @param {number} reputation current 0-100
 * @param {number} seasonPerf tier-relative performance 0-100 (see tierPerformance)
 * @param {object} opts { dormantSeasons: number, historicalPeak: number }
 */
function updateReputation(reputation, seasonPerf, opts, cfg) {
  const r = cfg.reputation;
  if (opts.dormantSeasons > 0) {
    let decay = 0;
    for (let i = 0; i < opts.dormantSeasons; i++) {
      decay += r.dormancyDecayBySeason[Math.min(i, r.dormancyDecayBySeason.length - 1)];
    }
    return Math.max(0, reputation - decay);
  }
  // Gain is earned only by finishing NEAR THE TOP OF YOUR TIER: seasonPerf is a
  // tier-relative 0-100 (how close to your tier's flawless ceiling you played),
  // so you climb only while you keep maxing out at your own altitude. A merely-
  // good season for your tier plateaus; the ladder never advances on absolute
  // field position, which reputation itself gates (§5.13).
  const tier = tierForReputation(reputation, cfg);
  let gain = Math.max(0, Math.min(r.seasonGainCap, Math.round(seasonPerf - r.climbThreshold)));
  // Heritage credit: accelerated re-earn below (peak - one tier's width).
  const tierWidth = r.tierThresholds["3"] - r.tierThresholds["2"];
  if (opts.historicalPeak && reputation < opts.historicalPeak - tierWidth) {
    gain = Math.round(gain * r.heritageCreditMultiplier);
  }
  // Underperformance decay: a proven corps (tier 3+) that has a poor season
  // for its tier slides back a little.
  if (gain === 0 && tier >= 3 && seasonPerf < r.underperformThreshold) gain = -r.underperformDecay;
  return Math.max(0, Math.min(r.max, reputation + gain));
}

/** Reputation tier (1-7) for a reputation value. */
function tierForReputation(reputation, cfg) {
  const thresholds = cfg.reputation.tierThresholds;
  let tier = 1;
  for (const [t, min] of Object.entries(thresholds)) {
    if (reputation >= min) tier = Math.max(tier, Number(t));
  }
  return tier;
}

/** Percentile (0-100) of a total score within the TOTAL band for a day. */
function percentileOfTotal(total, day, curves) {
  const band = curves.totalBands[Math.min(48, Math.max(0, day - 1))];
  const points = [
    [5, band.p5],
    [25, band.p25],
    [50, band.p50],
    [75, band.p75],
    [95, band.p95],
    [100, band.max],
  ];
  if (total <= points[0][1]) return points[0][0];
  for (let i = 1; i < points.length; i++) {
    const [p1, v1] = points[i - 1];
    const [p2, v2] = points[i];
    if (total <= v2) return p1 + ((p2 - p1) * (total - v1)) / Math.max(1e-9, v2 - v1);
  }
  return 100;
}

module.exports = {
  CAPTIONS,
  BLOCK_TYPES,
  seededUnit,
  phaseForDay,
  bandValueAtPercentile,
  curveForChallenge,
  createSeasonState,
  allocateBlock,
  endOfDay,
  blocksAvailable,
  sampleDelta,
  deltaDistFor,
  softCap,
  updateForm,
  ceilFracForTier,
  scoreCorps,
  maxPotentialTotal,
  tierPerformance,
  updateReputation,
  tierForReputation,
  percentileOfTotal,
};
