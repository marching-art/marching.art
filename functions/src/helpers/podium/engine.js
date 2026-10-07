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
 * Content/clean split (fractions of a block's yield) for a competition day.
 * A smooth linear ramp from `startContentShare` at day 1 to `endContentShare`
 * at day 49: the season slides continuously from installing the book to
 * cleaning it, with no phase cliffs. Diminishing returns still do most of the
 * steering (see allocateBlock), so this is a gentle bias, not a hard switch.
 * Falls back to the legacy 3-phase step table when no ramp is configured.
 * @param {number} day competition day (>=1)
 * @returns {[number, number]} [contentShare, cleanShare]
 */
function contentSplitForDay(day, cfg) {
  const ramp = cfg.rehearsal.contentSplitRamp;
  if (ramp) {
    const t = Math.max(0, Math.min(1, (day - 1) / 48));
    const c = ramp.startContentShare + (ramp.endContentShare - ramp.startContentShare) * t;
    return [c, 1 - c];
  }
  const phase = phaseForDay(day, cfg);
  return cfg.rehearsal.contentCleanSplitByPhase[phase];
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
 * Challenge-model versions. A season state is stamped with the model it was
 * created under (createSeasonState) and keeps it for life, so a balance change
 * never re-shapes a season already in flight.
 *   1 — legacy: curve shape from the archetype with the nearest ceiling, one
 *       rep-independent performance floor for every challenge level. Left
 *       challenge 8 dominant on every day of the season (its nearest archetype
 *       is the early-saturating one), and mid levels a trap.
 *   2 — the challenge knob is a real bet: low levels reach more of their
 *       (lower) ceiling early and hold a higher floor; high levels start
 *       further back and only pay off if the book gets cleaned
 *       (scoring.challengeModel).
 */
const LEGACY_CHALLENGE_MODEL = 1;

/** The challenge-model version a fresh season state is stamped with. */
function currentChallengeModel(cfg) {
  const version = cfg.scoring.challengeModel && cfg.scoring.challengeModel.version;
  return Number.isFinite(version) ? version : LEGACY_CHALLENGE_MODEL;
}

/** The challenge-model block when `model` opts into it, else null (legacy). */
function challengeModelConfig(model, cfg) {
  const cm = cfg.scoring.challengeModel;
  return model >= 2 && cm && cm.dayOneShareByChallenge ? cm : null;
}

/**
 * A caption's growth rate: the population-weighted mean `k` of its mined
 * archetypes — how fast real corps-seasons actually climbed. Falls back to
 * `challengeModel.growthRate` when the curve set carries no archetypes.
 * @returns {number}
 */
function growthRateFor(caption, curves, cm) {
  const archetypes = (curves.archetypes && curves.archetypes[caption]) || [];
  let weight = 0;
  let sum = 0;
  for (const archetype of archetypes) {
    const share = Number.isFinite(archetype.share) ? archetype.share : 0;
    if (!(archetype.k > 0) || !(share > 0)) continue;
    weight += share;
    sum += archetype.k * share;
  }
  return weight > 0 ? sum / weight : cm.growthRate;
}

/**
 * The inflection day `d0` at which a logistic of rate `k` reaches exactly
 * `dayOneShare` of its day-49 value on day 1. That ratio falls monotonically
 * as d0 moves later, so a bisection converges.
 * @param {number} k growth rate (>0)
 * @param {number} dayOneShare 0..1 (exclusive)
 * @returns {number}
 */
function onsetDayForShare(k, dayOneShare) {
  const share = (d0) => (1 + Math.exp(-k * (49 - d0))) / (1 + Math.exp(-k * (1 - d0)));
  let lo = -500;
  let hi = 549;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (share(mid) > dayOneShare) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Derive a caption's growth-curve parameters from its challenge level. The
 * ceiling L targets the challenge-mapped percentile of the day-49 band under
 * every model. The SHAPE depends on the model:
 *   v1 — (k, d0) from the archetype whose fitted L is nearest that target.
 *   v2 — the caption's mined growth rate, with the inflection placed so the
 *        curve stands at `dayOneShareByChallenge[challenge]` of its finals
 *        ceiling on day 1: an easy book is mostly there in June, a hard one
 *        surges in August.
 * @param {number} [model] challenge-model version (default: legacy)
 * @returns {{L: number, k: number, d0: number, norm: number}}
 */
function curveForChallenge(caption, challenge, curves, cfg, model = LEGACY_CHALLENGE_MODEL) {
  const day49 = curves.bands[caption][48];
  const pct = cfg.scoring.challengeCeilingPercentile[String(challenge)];
  const L = bandValueAtPercentile(day49, pct);
  let k;
  let d0;
  const cm = challengeModelConfig(model, cfg);
  if (cm) {
    k = growthRateFor(caption, curves, cm);
    d0 = onsetDayForShare(k, cm.dayOneShareByChallenge[String(challenge)]);
  } else {
    const archetypes = curves.archetypes[caption];
    let best = archetypes[0];
    for (const archetype of archetypes) {
      if (Math.abs(archetype.L - L) < Math.abs(best.L - L)) best = archetype;
    }
    k = best.k;
    d0 = best.d0;
  }
  // Normalize so a fully-realized curve reaches its ceiling exactly at
  // finals (the raw logistic is still shy of L at day 49).
  const norm = 1 / (1 + Math.exp(-k * (49 - d0)));
  return { L, k, d0, norm };
}

/**
 * The fraction of potential an UNREHEARSED caption still fields (the
 * reputation-independent performance floor). Legacy states share one floor;
 * under v2 an easy book holds a higher floor than a hard one, so a hard book
 * left dirty scores BELOW an easy book left dirty — the risk side of the bet.
 * @param {number} challenge 1-8
 * @param {number|undefined} model challenge-model version (undefined = legacy)
 * @returns {number}
 */
function perfFloorFor(challenge, model, cfg) {
  const cm = challengeModelConfig(model, cfg);
  const table = cm && cm.floorFractionByChallenge;
  if (table && table[String(challenge)] != null) return Number(table[String(challenge)]);
  return cfg.scoring.perfFloorFraction;
}

/**
 * The rehearsal attainment (installed x clean) at which a caption fields its
 * whole book. Legacy states share one threshold; under v2 a hard book asks for
 * more of it to be clean before it pays in full.
 * @param {number} challenge 1-8
 * @param {number|undefined} model challenge-model version (undefined = legacy)
 * @returns {number}
 */
function fullRealizationFor(challenge, model, cfg) {
  const cm = challengeModelConfig(model, cfg);
  const table = cm && cm.fullRealizationByChallenge;
  if (table && table[String(challenge)] != null) return Number(table[String(challenge)]);
  return cfg.scoring.attainmentFullRealization;
}

/**
 * Head-start fraction (0..1) a returning director earns from LAST season's
 * engagement. Linear in the activity percentile from `pivotPercentile` (below
 * which a merely-casual season earns nothing) to `fullPercentile` (an Iron
 * Corps season earns the full bonus). A brand-new director passes no percentile
 * and earns 0. Pure; keyed to engagement ONLY — never reputation or results.
 * @param {number|null|undefined} activityPercentile 0-100 from assessment
 * @returns {number} 0..1
 */
function veteranStartFraction(activityPercentile, cfg) {
  const vs = cfg.veteranStart;
  if (!vs || activityPercentile == null || !Number.isFinite(activityPercentile)) return 0;
  const pivot = vs.pivotPercentile ?? 20;
  const full = vs.fullPercentile ?? 90;
  if (activityPercentile <= pivot) return 0;
  if (activityPercentile >= full || full <= pivot) return activityPercentile >= full ? 1 : 0;
  return (activityPercentile - pivot) / (full - pivot);
}

/**
 * Create a fresh season state for a corps.
 * @param {object} params { challenge: {caption: 1-8}, repTier: 1-7,
 *   auditions: {caption: 0-1 share of audition pool} (optional),
 *   activityPercentile: 0-100 last-season engagement (optional; drives the
 *     veteran head-start — see veteranStartFraction),
 *   challengeModel: model version to stamp (optional; defaults to the
 *     configured current model — see currentChallengeModel) }
 */
function createSeasonState(params, curves, cfg) {
  const challengeModel = params.challengeModel ?? currentChallengeModel(cfg);
  // Veteran head-start: a returning grinder starts with more of the book
  // installed and clean. Washes out by finals (rehearsal caps both), so it
  // shapes ONLY the early season — never a finals total or promotion.
  const vs = cfg.veteranStart || {};
  const vetFrac = veteranStartFraction(params.activityPercentile, cfg);
  const contentBonus = vetFrac * (vs.maxContentBonus || 0);
  const cleanBonus = vetFrac * (vs.maxCleanBonus || 0);

  const captions = {};
  for (const caption of CAPTIONS) {
    const challenge = params.challenge[caption] || 4;
    // Audition allocation shifts the starting content WITHIN the day-1 band:
    // baseline 0.28 content, +- up to 0.10 by allocation vs the even 1/8 share.
    const share = params.auditions ? params.auditions[caption] || 0 : 1 / 8;
    const auditionShift = Math.max(-0.1, Math.min(0.1, (share - 1 / 8) * 1.6));
    captions[caption] = {
      challenge,
      curve: curveForChallenge(caption, challenge, curves, cfg, challengeModel),
      content: Math.min(1, 0.28 + auditionShift + contentBonus),
      clean: Math.min(1, 0.2 + cleanBonus),
      lastRehearsedDay: 0,
    };
  }
  return {
    captions,
    condition: { stamina: cfg.condition.staminaMax, morale: 80 },
    foodTier: params.foodTier || "standard",
    consecutiveMaxDays: 0,
    repTier: params.repTier || 1,
    // Locked for the season: how challenge level shapes the curve and floor.
    challengeModel,
    // Per-corps performance momentum (§4.2 trajectory model): an independent
    // random-walk in score-fraction units, evolved nightly by updateForm. Two
    // corps never share a form draw, so the field fluctuates individually.
    form: 0,
  };
}

/**
 * Ensemble readiness (0..1 yield multiplier): an ensemble block assembles the
 * sections' parts, so it only rehearses at full value once enough of those
 * parts are installed. `block.readiness` lists the section captions whose mean
 * CONTENT gates the block; the multiplier rises linearly to 1 at `fullAt` and
 * never drops below `floor`. A block without a readiness rule returns 1, so a
 * config without one rehearses exactly as before. Pure.
 * @param {any} state season state
 * @param {any} block a cfg.blocks entry
 * @returns {number}
 */
function ensembleReadiness(state, block) {
  const rule = block && block.readiness;
  if (!rule || !Array.isArray(rule.captions) || rule.captions.length === 0 || !(rule.fullAt > 0)) {
    return 1;
  }
  let sum = 0;
  for (const caption of rule.captions) sum += (state.captions[caption] && state.captions[caption].content) || 0;
  const mean = sum / rule.captions.length;
  return Math.max(rule.floor || 0, Math.min(1, mean / rule.fullAt));
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
  // Judged BEFORE this block's own gains land: the parts as they stood when
  // the ensemble walked onto the field.
  const readinessMult = ensembleReadiness(state, block);
  const [contentShare, cleanShare] = contentSplitForDay(Math.max(1, day), cfg);
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
      cfg.rehearsal.primaryGain *
      weight *
      repeatMult *
      readinessMult *
      challengeMult *
      conditionMult *
      yieldMultiplier *
      showDayMult;
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

  return {
    blockType,
    day,
    gains,
    staminaCost,
    repeatMult,
    readinessMult: Number(readinessMult.toFixed(3)),
  };
}

/**
 * Judges' tapes (§5.4): performing teaches. After a scored show the judges'
 * commentary points at the corps' weakest captions — the `captions` lowest by
 * attainment (installed x clean) — and the corps cleans them from the tapes:
 * `cleanGain` / `contentGain` of the remaining headroom, scaled by the same
 * challenge install rate a rehearsal block uses (a harder book cleans
 * slower). It also counts as rehearsing those captions for neglect decay.
 * Applied AFTER the night's score, so it pays at the next show. Returns null
 * (and changes nothing) when `cfg.shows.judgesTapes` is absent. Mutates state.
 * @param {any} state season state
 * @param {number} day competition day of the show
 * @param {any} cfg balance config
 * @returns {{day: number, captions: string[], gains: Record<string, {content: number, clean: number}>} | null}
 */
function applyJudgesTapes(state, day, cfg) {
  const tapes = cfg.shows && cfg.shows.judgesTapes;
  if (!tapes || !(tapes.captions > 0)) return null;
  const sc = cfg.scoring;
  const weakest = CAPTIONS.map((caption) => {
    const cap = state.captions[caption];
    return { caption, attainment: cap.content * (sc.cleanFloor + sc.cleanWeight * cap.clean) };
  })
    .sort((a, b) => a.attainment - b.attainment || CAPTIONS.indexOf(a.caption) - CAPTIONS.indexOf(b.caption))
    .slice(0, tapes.captions)
    .map((entry) => entry.caption);
  /** @type {Record<string, {content: number, clean: number}>} */
  const gains = {};
  for (const caption of weakest) {
    const cap = state.captions[caption];
    const challengeMult = Math.pow(4 / cap.challenge, cfg.rehearsal.challengeGainExponent);
    const contentGain = (tapes.contentGain || 0) * challengeMult * (1 - cap.content);
    const cleanGain = (tapes.cleanGain || 0) * challengeMult * (1 - cap.clean);
    cap.content = Math.min(1, cap.content + contentGain);
    cap.clean = Math.min(1, cap.clean + cleanGain);
    cap.lastRehearsedDay = Math.max(cap.lastRehearsedDay || 0, day);
    gains[caption] = { content: Number(contentGain.toFixed(5)), clean: Number(cleanGain.toFixed(5)) };
  }
  return { day, captions: weakest, gains };
}

/**
 * Clinician bookings (2026-10): the lengths a director may book a clinician
 * for and what each costs, shortest first. Read from `cfg.clinician.costByDays`
 * ({ [days]: cost }); entries that are not a positive whole number of days
 * with a positive cost are dropped, so a malformed balance override can never
 * offer a free or fractional booking.
 * @param {any} cfg balance config
 * @returns {{days: number, cost: number}[]}
 */
function clinicianBookings(cfg) {
  const costByDays = (cfg.clinician && cfg.clinician.costByDays) || {};
  return Object.entries(costByDays)
    .map(([days, cost]) => ({ days: Number(days), cost: Number(cost) }))
    .filter(({ days, cost }) => Number.isInteger(days) && days > 0 && Number.isFinite(cost) && cost > 0)
    .sort((a, b) => a.days - b.days);
}

/**
 * The booking a hire request names, or null when that length is not offered.
 * A request without a length (pre-2026-10 clients) books the longest stay —
 * the residency those clients were offering.
 * @param {any} cfg balance config
 * @param {unknown} days requested booking length
 * @returns {{days: number, cost: number} | null}
 */
function clinicianBookingFor(cfg, days) {
  const bookings = clinicianBookings(cfg);
  if (days === undefined || days === null) return bookings[bookings.length - 1] || null;
  return bookings.find((booking) => booking.days === days) || null;
}

/**
 * Book rewrite (2026-10): once a season a director may rewrite part of the
 * show — move up to `cfg.bookRewrite.maxCaptions` captions to a new challenge
 * level before `lastDay`. Pure validation: returns the reason it is refused,
 * or null when it may proceed. The Budget fee is checked by the caller.
 * @param {any} state season state
 * @param {string[]} captions captions to rewrite
 * @param {number} toLevel the new challenge level (1-8)
 * @param {number} day competition day
 * @param {any} cfg balance config
 * @returns {string | null}
 */
function bookRewriteRefusal(state, captions, toLevel, day, cfg) {
  const rule = cfg.bookRewrite;
  if (!rule) return "Book rewrites are not available.";
  if (state.bookRewrite) return "This season's book rewrite is already used.";
  if (day > rule.lastDay) return `Book rewrites close after Day ${rule.lastDay}.`;
  if (!Number.isInteger(toLevel) || toLevel < 1 || toLevel > 8) return "Pick a challenge level from 1 to 8.";
  if (!Array.isArray(captions) || captions.length === 0) return "Pick at least one caption to rewrite.";
  if (captions.length > rule.maxCaptions) return `Rewrite at most ${rule.maxCaptions} captions.`;
  if (new Set(captions).size !== captions.length) return "Each caption once.";
  for (const caption of captions) {
    if (!CAPTIONS.includes(caption)) return `Unknown caption ${caption}.`;
    if (state.captions[caption].challenge === toLevel) return `${caption} is already at level ${toLevel}.`;
  }
  return null;
}

/**
 * Apply a book rewrite (validated by bookRewriteRefusal). A raised caption is
 * new material: it keeps `raise.keepContent` / `raise.keepClean` of what was
 * installed and clean; a simplified one keeps more (`lower.*`). The caller
 * re-derives the curve (store.hydrateState does it from `challenge`). Mutates
 * state; returns the
 * record stored at `state.bookRewrite`.
 * @param {any} state season state
 * @param {string[]} captions
 * @param {number} toLevel
 * @param {number} day competition day
 * @param {any} cfg balance config
 * @returns {{day: number, toLevel: number, from: Record<string, number>}}
 */
function applyBookRewrite(state, captions, toLevel, day, cfg) {
  const rule = cfg.bookRewrite;
  /** @type {Record<string, number>} */
  const from = {};
  for (const caption of captions) {
    const cap = state.captions[caption];
    from[caption] = cap.challenge;
    const keep = toLevel > cap.challenge ? rule.raise : rule.lower;
    cap.challenge = toLevel;
    cap.content = cap.content * keep.keepContent;
    cap.clean = cap.clean * keep.keepClean;
  }
  state.bookRewrite = { day, toLevel, from };
  return state.bookRewrite;
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

  // Grind fatigue. With a `moraleModel` (2026-10) fatigue is GRADED by the
  // day's workload: past `sustainableShare` of the day's blocks every extra
  // block drains morale (warmup mitigates), below it the corps recovers a
  // little — so volume and morale trade off smoothly, and leaving one block
  // unused no longer resets a hidden streak. Rest days are handled below.
  // Without it: the legacy rule — consecutive max-block days past a grace
  // window drain morale, any other day recovers +1.
  const mm = cfg.condition.moraleModel;
  if (mm && !opts.restDay) {
    const maxBlocks = Math.max(1, opts.maxBlocksToday || 1);
    const load = Math.min(1, (opts.blocksUsedToday || 0) / maxBlocks);
    const over = Math.max(0, load - mm.sustainableShare) / Math.max(1e-6, 1 - mm.sustainableShare);
    const mitigation = opts.warmupUsed ? 1 - cfg.blocks.warmup.conditionEffect.fatigueMitigationPct / 100 : 1;
    // The food plan feeds morale every night (`nightlyMoraleDelta`): a full
    // kitchen is a real weekly buy, not just a rest-day garnish.
    const foodTier = cfg.condition.foodTiers[state.foodTier] || cfg.condition.foodTiers.standard;
    const delta =
      mm.dailyRecovery - over * mm.fatigueAtFullLoad * mitigation + (foodTier.nightlyMoraleDelta || 0);
    state.condition.morale = Math.max(0, Math.min(cfg.condition.moraleMax, state.condition.morale + delta));
    state.consecutiveMaxDays = load >= 1 ? (state.consecutiveMaxDays || 0) + 1 : 0;
  } else if (mm) {
    state.consecutiveMaxDays = 0;
  } else if (!opts.restDay && opts.blocksUsedToday >= opts.maxBlocksToday) {
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

/**
 * Attrition (2026-10): a corps whose morale has collapsed loses members. Each
 * night morale sits below `condition.attrition.moraleBelow`, a seeded draw
 * (`chance`, scaled up the lower morale sits) decides whether someone quits;
 * if so a seeded caption loses `contentLoss` of its installed content (the
 * replacement has to learn the spots) and `cleanLoss` of its clean. Pure in
 * its inputs (seeded, no clock). Returns the event, or null when nobody left
 * or the rule is unconfigured. Mutates state.
 * @param {any} state season state
 * @param {number} day competition day
 * @param {string} seed per-corps seed, e.g. `${seasonUid}|${uid}`
 * @param {any} cfg balance config
 * @returns {{day: number, caption: string, contentLoss: number, cleanLoss: number} | null}
 */
function applyAttrition(state, day, seed, cfg) {
  const rule = cfg.condition && cfg.condition.attrition;
  if (!rule || !(rule.moraleBelow > 0)) return null;
  const morale = state.condition.morale;
  if (!(morale < rule.moraleBelow)) return null;
  // Deeper misery, likelier departures: chance at the threshold, rising
  // linearly to `chance * maxScale` at morale 0.
  const depth = 1 - morale / rule.moraleBelow;
  const chance = rule.chance * (1 + depth * ((rule.maxScale || 1) - 1));
  if (seededUnit(`${seed}|attrition|${day}`) >= chance) return null;
  const caption = CAPTIONS[Math.floor(seededUnit(`${seed}|attrition-caption|${day}`) * CAPTIONS.length)];
  const cap = state.captions[caption];
  const contentLoss = Math.min(cap.content, rule.contentLoss || 0);
  const cleanLoss = Math.min(cap.clean, rule.cleanLoss || 0);
  cap.content -= contentLoss;
  cap.clean -= cleanLoss;
  return {
    day,
    caption,
    contentLoss: Number(contentLoss.toFixed(4)),
    cleanLoss: Number(cleanLoss.toFixed(4)),
  };
}

/**
 * Blocks available today given day type and condition.
 *
 * The low-stamina penalty is a START-OF-DAY property — a corps that woke up
 * tired rehearses fewer blocks. It must be judged against the stamina the day
 * BEGAN with, not the live value: blocks drain stamina, so keying the cap off
 * live stamina let it shrink mid-day and strand a player who had already used
 * more blocks than the shrunken cap ("All 8 blocks are used" while 10 showed as
 * done). Within-day fatigue is modeled separately by the yieldByStamina tiers,
 * not by the cap. Callers that hold a start-of-day snapshot pass it as
 * `staminaForCap`; the nightly processor omits it (its cap is computed once,
 * before any of the day's blocks run, so live stamina already IS start-of-day).
 *
 * @param {any} state
 * @param {{isShowDay: boolean, isSpringTraining: boolean, staminaForCap?: number}} day
 * @param {any} cfg
 */
function blocksAvailable(state, { isShowDay, isSpringTraining, staminaForCap }, cfg) {
  let blocks = isShowDay
    ? cfg.rehearsal.blocksOnShowDay
    : isSpringTraining
      ? cfg.rehearsal.blocksPerDaySpringTraining
      : cfg.rehearsal.blocksPerDay;
  const stamina = typeof staminaForCap === "number" ? staminaForCap : state.condition.stamina;
  if (stamina < cfg.condition.lowStaminaThreshold) {
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
  // Morale pulls the walk (2026-10, `form.moraleDrift`): centered on
  // `form.moralePivot` (a well-run corps' morale), so good management is
  // roughly neutral and a collapsing corps trends cold. Zero when unconfigured.
  const pivot = fc.moralePivot ?? 60;
  const morale = (state.condition && state.condition.morale) ?? pivot;
  const moraleDrift = fc.moraleDrift ? ((morale - pivot) / Math.max(1, 100 - pivot)) * fc.moraleDrift : 0;
  let form = (state.form || 0) * (1 - fc.reversion) + shock * fc.step + moraleDrift;
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
 * How much of its book a caption fields (0..1): rehearsal attainment
 * (installed x clean) over the challenge's full-realization threshold, capped
 * at 1. At 1 the caption has learned its whole book — more rehearsal no longer
 * raises its score; only a harder book (next season's challenge) adds room.
 * That cap is by design (decision 43): a safe book is a capped book. Pure.
 * @param {{content: number, clean: number, challenge: number}} cap caption state
 * @param {number|undefined} challengeModel the state's model stamp
 * @param {any} cfg balance config
 * @returns {number}
 */
function realizedFor(cap, challengeModel, cfg) {
  const sc = cfg.scoring;
  const attainment = cap.content * (sc.cleanFloor + sc.cleanWeight * cap.clean);
  return Math.min(1, attainment / fullRealizationFor(cap.challenge, challengeModel, cfg));
}

/**
 * Every caption's realization ({ GE1: 0.93, ... }, three decimals) — an
 * analysis readout for the sims (podiumSim section M). Never shown to players
 * (decision 47).
 * @param {any} state season state (stored or hydrated)
 * @param {any} cfg balance config
 * @returns {Record<string, number>}
 */
function captionRealization(state, cfg) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const caption of CAPTIONS) {
    out[caption] = Number(realizedFor(state.captions[caption], state.challengeModel, cfg).toFixed(3));
  }
  return out;
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
    // This corps' OWN potential trajectory: its challenge-selected shape
    // (see curveForChallenge), normalized to reach its ceiling at
    // finals. Smooth by construction — no shared per-day national floor.
    let potential = (L * (1 / (1 + Math.exp(-k * (day - d0))))) / norm;
    // Early-season lift: raises opening-show scores so the newcomer arc matches
    // DCI's shallower June-to-August climb (openers near two-thirds of finals,
    // not under half). Decays linearly to 1.0 by `untilDay`, so mid-season,
    // finals, and the reputation ladder (which reads off finals) are untouched.
    const eb = sc.earlyBoost;
    if (eb && eb.maxPct > 0 && day < eb.untilDay) {
      const ramp = Math.max(0, (eb.untilDay - day) / (eb.untilDay - 1));
      potential *= 1 + (eb.maxPct / 100) * ramp;
    }
    // Rehearsal attainment: how much of the book is installed AND clean.
    const realized = realizedFor(cap, state.challengeModel, cfg);
    // Position between the rep-independent floor and the rep-gated ceiling,
    // set ENTIRELY by this corps' own rehearsal. This is where effort becomes
    // score — and why two same-tier corps that rehearsed differently differ.
    // Under the v2 challenge model the floor falls as challenge rises, so a
    // hard book only beats an easy one once enough of it is clean.
    const floorFrac = perfFloorFor(cap.challenge, state.challengeModel, cfg);
    const frac = floorFrac + (ceilFrac - floorFrac) * realized;
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

/**
 * The assistant director's yield on the `streak`-th CONSECUTIVE day it runs
 * the plan (1 = the first missed day). Full `assistantYield` through the grace
 * window, then `perDay` less for every further day away, never below `floor`.
 * A director who plays (or declares rest) resets the streak, so a weekend off
 * costs nothing extra — only a corps left on autopilot for weeks sinks. Pure.
 * @param {number} streak consecutive assistant-run days including this one (>= 1)
 * @param {object} cfg balance config
 * @returns {number} yield multiplier in (0, 1]
 */
function assistantYieldFor(streak, cfg) {
  const base = cfg.rehearsal.assistantYield;
  const decay = cfg.rehearsal.assistantDecay;
  if (!decay) return base;
  const extra = Math.max(0, (Number.isFinite(streak) ? streak : 1) - (decay.graceDays || 0));
  return Math.max(decay.floor ?? 0, base - extra * (decay.perDay || 0));
}

/**
 * Tomorrow's assistant streak after today's day type (pure): a day the
 * director played or declared rest resets it to 0; an assistant-run day
 * extends it by one; a day nothing ran (no plan) leaves it as is.
 * @param {number|undefined} previous the streak carried into today
 * @param {{playedSelf: boolean, restDay: boolean, assistant: boolean}} day
 * @returns {number}
 */
function assistantStreakAfter(previous, { playedSelf, restDay, assistant }) {
  if (playedSelf || restDay) return 0;
  if (assistant) return (previous || 0) + 1;
  return previous || 0;
}

module.exports = {
  clinicianBookings,
  clinicianBookingFor,
  assistantYieldFor,
  assistantStreakAfter,
  LEGACY_CHALLENGE_MODEL,
  currentChallengeModel,
  onsetDayForShare,
  perfFloorFor,
  fullRealizationFor,
  CAPTIONS,
  BLOCK_TYPES,
  seededUnit,
  phaseForDay,
  bandValueAtPercentile,
  curveForChallenge,
  veteranStartFraction,
  createSeasonState,
  ensembleReadiness,
  allocateBlock,
  applyJudgesTapes,
  applyAttrition,
  bookRewriteRefusal,
  applyBookRewrite,
  endOfDay,
  blocksAvailable,
  sampleDelta,
  deltaDistFor,
  softCap,
  updateForm,
  ceilFracForTier,
  realizedFor,
  captionRealization,
  scoreCorps,
  maxPotentialTotal,
  tierPerformance,
  updateReputation,
  tierForReputation,
  percentileOfTotal,
};
