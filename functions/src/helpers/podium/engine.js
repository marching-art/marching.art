/**
 * Podium Class scoring/rehearsal engine — PURE functions only.
 *
 * No Firebase imports, no I/O, no Date.now(), no Math.random(): every
 * function is deterministic in its inputs so the Phase 0 simulation harness
 * (src/scripts/podiumSim.js) exercises exactly the code the Phase 2
 * callables and nightly processor will ship. Design: docs/PODIUM_CLASS_DESIGN.md
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
      cfg.rehearsal.primaryGain * weight * repeatMult * challengeMult * conditionMult * yieldMultiplier;
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
  const staminaCost = block.staminaCost * (1 - costReduction);
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
 * Score a corps for a show on `day` (§4.2). Pure; does not mutate state.
 * @param {string} varianceSeed e.g. `${seasonUid}|${day}|${uid}`
 * @returns {{captions: object, geScore, visualScore, musicScore, total}}
 */
function scoreCorps(state, day, varianceSeed, curves, cfg) {
  const captionScores = {};
  const conditionSignal =
    ((state.condition.stamina - 60) / 40 + (state.condition.morale - 60) / 40) / 2;
  const conditionMod =
    Math.max(-1, Math.min(1, conditionSignal)) * cfg.condition.scoreModifierMaxPerCaption;

  for (const caption of CAPTIONS) {
    const cap = state.captions[caption];
    const band = curves.bands[caption][Math.min(48, Math.max(0, day - 1))];
    const { L, k, d0, norm } = cap.curve;
    // The corps' potential trajectory: its challenge-selected archetype
    // shape, normalized to reach the challenge ceiling exactly at finals.
    const curveValue = (L * (1 / (1 + Math.exp(-k * (day - d0))))) / norm;
    // Attainment realizes the gap between the band floor ("a corps that
    // showed up") and the corps' own curve. The band's percentile spread is
    // narrow (~8% at the top), so attainment interpolates the gap rather
    // than multiplying the curve — see Phase 0 notes.
    const attainment =
      cap.content * (cfg.scoring.cleanFloor + cfg.scoring.cleanWeight * cap.clean);
    // Structural ceiling: with seven block types and ~3 blocks/day, even a
    // flawless season peaks near attainment 0.70-0.75, so "full
    // realization" is normalized to that observed optimum (Phase 0 tuning).
    const realized = Math.min(1, attainment / cfg.scoring.attainmentFullRealization);
    const floor = band.p5;
    const raw = floor + (curveValue - floor) * realized;
    const variance = (seededUnit(`${varianceSeed}|${caption}`) * 2 - 1) * cfg.scoring.judgeVarianceMax;
    const repCeiling = bandValueAtPercentile(
      band,
      cfg.scoring.repCeilingPercentileByTier[String(state.repTier)]
    );
    captionScores[caption] = Number(
      Math.max(floor, Math.min(repCeiling, raw + conditionMod + variance)).toFixed(3)
    );
  }

  const geScore = captionScores.GE1 + captionScores.GE2;
  const visualScore = (captionScores.VP + captionScores.VA + captionScores.CG) / 2;
  const musicScore = (captionScores.B + captionScores.MA + captionScores.P) / 2;
  const total = Math.min(cfg.scoring.totalCap, geScore + visualScore + musicScore);
  return {
    captions: captionScores,
    geScore: Number(geScore.toFixed(3)),
    visualScore: Number(visualScore.toFixed(3)),
    musicScore: Number(musicScore.toFixed(3)),
    total: Number(total.toFixed(3)),
  };
}

/**
 * Season-end reputation update (§5.13). Returns the new reputation value.
 * @param {number} reputation current 0-100
 * @param {number} finalsPercentile 0-100 percentile of finals total within the band
 * @param {object} opts { dormantSeasons: number, historicalPeak: number }
 */
function updateReputation(reputation, finalsPercentile, opts, cfg) {
  const r = cfg.reputation;
  if (opts.dormantSeasons > 0) {
    let decay = 0;
    for (let i = 0; i < opts.dormantSeasons; i++) {
      decay += r.dormancyDecayBySeason[Math.min(i, r.dormancyDecayBySeason.length - 1)];
    }
    return Math.max(0, reputation - decay);
  }
  // Gain is earned only by performing NEAR YOUR CURRENT CEILING: the season
  // gain is how far the finals percentile reaches into the window just
  // below the tier's ceiling percentile. A corps whose absolute quality
  // sits below its tier's window stops climbing — the ladder advances only
  // while you keep outperforming at your own altitude (§5.13).
  const tier = tierForReputation(reputation, cfg);
  const ceilingPct = Number(
    (cfg.scoring.repCeilingPercentileByTier[String(tier)] ?? 100)
  );
  let gain = Math.max(
    0,
    Math.min(r.seasonGainCap, Math.round(finalsPercentile - (ceilingPct - r.gainWindow)))
  );
  // Heritage credit: accelerated re-earn below (peak - one tier's width).
  const tierWidth = r.tierThresholds["3"] - r.tierThresholds["2"];
  if (opts.historicalPeak && reputation < opts.historicalPeak - tierWidth) {
    gain = Math.round(gain * r.heritageCreditMultiplier);
  }
  // Underperformance decay: well below tier expectation.
  if (gain === 0 && tier >= 3 && finalsPercentile < 25) gain = -r.underperformDecay;
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
  scoreCorps,
  updateReputation,
  tierForReputation,
  percentileOfTotal,
};
