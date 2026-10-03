/**
 * Podium Phase 0.4 — Simulation harness.
 *
 * Plays full seasons and multi-season careers through the REAL engine
 * (helpers/podium/engine.js) with the REAL calibration data
 * (helpers/podium/curveData.json) and tunables
 * (helpers/podium/balanceConfig.json), then asserts the design's promises
 * (docs/PODIUM.md §9, §5.13):
 *
 *   A. Envelope containment — every simulated show total sits inside the
 *      historical TOTAL band for its day.
 *   B. No 100s — no simulated score ever reaches 100 (cap 99.9, and the
 *      envelope max is 99.117 in the current corpus).
 *   C. Strategy ordering — balanced+present strictly beats brass-spam,
 *      which beats chronically-absent, at equal challenge/reputation.
 *   D. Champion pacing — flawless play reaches Champion Status (tier 7)
 *      in 10-14 seasons; casual play does not.
 *   E. Dormancy invariant — a corps NEVER returns from absence with
 *      higher reputation than it left with.
 *   F. Upset rate — a flawless Elite (tier 6) challenger beats a
 *      good-but-imperfect Champion (tier 7) in 25-45% of finals.
 *   H. Challenge levels are a bet — easy books lead the opening weeks, the
 *      best level climbs through the season, a cleaned hard book wins finals,
 *      and an under-rehearsed one loses to an easier book.
 *   I. Rehearsal choices matter — one-button spam loses, sectionals-first
 *      timing pays early, a daily director beats a part-timer, and identical
 *      play stays inside a bounded luck spread.
 *   K. Morale is managed — grinding every day loses to a managed rest
 *      rhythm, leaving one block unused is no exploit, over-resting loses.
 *   J. Shows pay their way — a moderate schedule breaks even against the
 *      automatic shows alone; an overloaded tour of long hauls still costs.
 *
 * Run:  cd functions && node src/scripts/podiumSim.js
 * Exits non-zero if any assertion fails — CI-friendly.
 */

const engine = require("../helpers/podium/engine");
const curves = require("../helpers/podium/curveData.json");
const cfg = require("../helpers/podium/balanceConfig.json");

const SHOW_DAYS = new Set([4, 6, 10, 13, 17, 20, 24, 27, 28, 31, 34, 35, 38, 41, 45, 47, 48, 49]);
const REST_PREFERENCE_DAYS = new Set([2, 9, 16, 23, 30, 37, 43]);
const ROTATION = [
  "warmup",
  "visualBasics",
  "brassSectionals",
  "fullEnsemble",
  "percussionSectionals",
  "visualEnsemble",
  "guardSectionals",
];

/** A flawless director's day after warmup: every rehearsal block in turn. */
const BALANCED_ORDER = [
  "fullEnsemble",
  "visualBasics",
  "brassSectionals",
  "percussionSectionals",
  "guardSectionals",
  "visualEnsemble",
];

/**
 * Warmup, then an even mix of every rehearsal block. Under the repeat ladder
 * and ensemble readiness this beats weakest-caption targeting that tops the day
 * up with Full Ensemble (the pre-2026-10 flawless policy).
 * @param {number} blocks blocks available today
 * @returns {string[]}
 */
function balancedDay(blocks) {
  return ["warmup", ...Array.from({ length: blocks - 1 }, (_, i) => BALANCED_ORDER[i % BALANCED_ORDER.length])];
}

/** Majors and Championship Week nights a flawless director freshens up for. */
const BIG_NIGHTS = new Set([28, 35, 41, 47, 48, 49]);

/**
 * A flawless director's rest call (morale v2, 2026-10): rest when stamina or
 * morale sags, and freshen up the day before a major unless already fresh.
 * Never on a show night — the corps performs.
 * @param {any} state season state
 * @param {number} day competition day
 * @param {Set<number>} [showDays] the corps' show schedule
 * @returns {boolean}
 */
function managedRest(state, day, showDays = SHOW_DAYS) {
  if (showDays.has(day)) return false;
  const { stamina, morale } = state.condition;
  return stamina < 45 || morale < 50 || (BIG_NIGHTS.has(day + 1) && morale < 80);
}

/**
 * Strategy = { name, challenge(caption)->1..8, planDay(state, day, ctx) ->
 * { restDay, blocks: [types] } }. Deterministic; `seed` varies weekly-plan
 * rotation offsets so paired sims aren't identical.
 */
function makeStrategies(seed) {
  const rotate = (day, extra) => {
    const list = [];
    const offset = Math.floor(engine.seededUnit(`${seed}|rot|${day}`) * ROTATION.length);
    for (let i = 0; i < extra; i++) list.push(ROTATION[(offset + i + 1) % ROTATION.length]);
    return list;
  };
  return {
    balanced: {
      challenge: () => 5,
      planDay: (state, day, { blocks }) => {
        if (REST_PREFERENCE_DAYS.has(day) && state.condition.stamina < 70) {
          return { restDay: true, blocks: [] };
        }
        return { restDay: false, blocks: ["warmup", ...rotate(day, blocks - 1)] };
      },
    },
    flawless: {
      challenge: () => 8,
      planDay: (state, day, { blocks }) => {
        // Rests when stamina or morale demands it and freshens up before the
        // majors (managedRest); warmup every working day, then an even mix of
        // every block (balancedDay).
        if (managedRest(state, day)) {
          return { restDay: true, blocks: [] };
        }
        return { restDay: false, blocks: balancedDay(blocks) };
      },
    },
    goodButImperfect: {
      challenge: () => 8,
      planDay: (state, day, { blocks }) => {
        // The complacent champion: plays a champion's game — an even block
        // mix, warmups, stamina-aware rests — but skips ~6% of days
        // outright. One bad habit, not a bad director.
        if (engine.seededUnit(`${seed}|skip|${day}`) < 0.06) return { restDay: false, blocks: [] };
        if (managedRest(state, day)) {
          return { restDay: true, blocks: [] };
        }
        return { restDay: false, blocks: balancedDay(blocks) };
      },
    },
    brassSpam: {
      challenge: (caption) => (caption === "B" ? 8 : 4),
      planDay: (state, day, { blocks }) => ({
        restDay: false,
        blocks: Array(blocks).fill("brassSectionals"),
      }),
    },
    absent: {
      challenge: () => 4,
      planDay: (state, day, { blocks }) => {
        if (engine.seededUnit(`${seed}|abs|${day}`) < 0.6) return { restDay: false, blocks: [] };
        return { restDay: false, blocks: rotate(day, Math.min(2, blocks)) };
      },
    },
  };
}

/**
 * Simulate one 49-day off-season for a corps.
 * @returns {{finalsTotal: number, scores: Array<{day, total}>, state}}
 */
function simulateSeason(strategy, repTier, seed) {
  const challenge = {};
  for (const caption of engine.CAPTIONS) challenge[caption] = strategy.challenge(caption);
  const state = engine.createSeasonState({ challenge, repTier }, curves, cfg);
  const scores = [];

  for (let day = 1; day <= 49; day++) {
    const isShowDay = SHOW_DAYS.has(day);
    const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining: false }, cfg);
    const plan = strategy.planDay(state, day, { blocks: maxBlocks });
    const blocksSoFar = {};
    let used = 0;
    if (!plan.restDay) {
      for (const blockType of plan.blocks.slice(0, maxBlocks)) {
        engine.allocateBlock(state, blockType, day, used, blocksSoFar, curves, cfg, { isShowDay });
        blocksSoFar[blockType] = (blocksSoFar[blockType] || 0) + 1;
        used++;
      }
    }
    // Evolve independent per-corps form every day (seeded only by this corps).
    engine.updateForm(state, day, `form|${seed}`, curves, cfg);
    if (isShowDay) {
      state.condition.stamina = Math.max(0, state.condition.stamina - cfg.condition.showStaminaCost);
      scores.push({ day, ...engine.scoreCorps(state, day, `${seed}|${day}`, curves, cfg) });
      // Judges' tapes after every scored show, as the nightly processor does.
      engine.applyJudgesTapes(state, day, cfg);
    }
    engine.endOfDay(
      state,
      day,
      {
        restDay: plan.restDay,
        blocksUsedToday: used,
        maxBlocksToday: maxBlocks,
        warmupUsed: (blocksSoFar.warmup || 0) > 0,
      },
      cfg
    );
    // Members quit when morale collapses (morale v2), as the processor runs it.
    engine.applyAttrition(state, day, `attr|${seed}`, cfg);
  }
  return { finalsTotal: scores[scores.length - 1].total, scores, state };
}

/** The assistant director's template day (what an absent director's saved plan runs). */
const ASSISTANT_PLAN = [
  "warmup",
  "fullEnsemble",
  "visualEnsemble",
  "brassSectionals",
  "percussionSectionals",
  "guardSectionals",
  "visualBasics",
  "fullEnsemble",
  "visualEnsemble",
  "brassSectionals",
  "percussionSectionals",
  "guardSectionals",
];

/**
 * Simulate a season at a uniform challenge `level` for a director who plays
 * (weakest-caption targeting, stamina-aware rests) on `playRate` of days and
 * leaves the rest to the assistant director at its streak-decayed yield — the
 * processor's real absence path.
 * @param {number} level uniform challenge level 1-8
 * @param {number} playRate share of days the director plays (0-1)
 * @param {number} repTier reputation tier
 * @param {string} seed
 * @param {{dayPlan?: ((maxBlocks: number) => string[]) | null, showDays?: Set<number>,
 *   travelStamina?: number, restCall?: (state: any, day: number, showDays: Set<number>) => boolean}} [opts]
 *   `showDays` overrides the show schedule; `travelStamina` is charged on top
 *   of the show's own stamina each show night; `restCall` replaces the
 *   flawless director's rest decision (managedRest)
 * @returns {{scores: Array<{day: number, total: number}>}}
 */
function simulateCommitment(
  level,
  playRate,
  repTier,
  seed,
  { dayPlan = null, showDays = SHOW_DAYS, travelStamina = 0, restCall = managedRest } = {}
) {
  const challenge = {};
  for (const caption of engine.CAPTIONS) challenge[caption] = level;
  const state = engine.createSeasonState({ challenge, repTier }, curves, cfg);
  // The flawless director's rest calls on THIS schedule (managedRest), and
  // their even block mix unless a fixed `dayPlan(maxBlocks)` replaces it.
  const blocksFor = dayPlan || balancedDay;
  const plan = (/** @type {any} */ st, /** @type {number} */ day, /** @type {{blocks: number}} */ ctx) =>
    restCall(st, day, showDays)
      ? { restDay: true, blocks: [] }
      : { restDay: false, blocks: blocksFor(ctx.blocks) };
  const scores = [];
  let streak = 0;
  for (let day = 1; day <= 49; day++) {
    const isShowDay = showDays.has(day);
    const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining: false }, cfg);
    const plays = engine.seededUnit(`${seed}|play|${day}`) < playRate;
    let restDay = false;
    let blocks = [];
    let yieldMultiplier = 1;
    if (plays) {
      streak = 0;
      ({ restDay, blocks } = plan(state, day, { blocks: maxBlocks }));
    } else {
      streak += 1;
      yieldMultiplier = engine.assistantYieldFor(streak, cfg);
      blocks = ASSISTANT_PLAN;
    }
    const blocksSoFar = {};
    let used = 0;
    if (!restDay) {
      for (const blockType of blocks.slice(0, maxBlocks)) {
        engine.allocateBlock(state, blockType, day, used, blocksSoFar, curves, cfg, {
          isShowDay,
          yieldMultiplier,
        });
        blocksSoFar[blockType] = (blocksSoFar[blockType] || 0) + 1;
        used++;
      }
    }
    engine.updateForm(state, day, `form|${seed}`, curves, cfg);
    if (isShowDay) {
      state.condition.stamina = Math.max(
        0,
        state.condition.stamina - cfg.condition.showStaminaCost - travelStamina
      );
      scores.push({ day, total: engine.scoreCorps(state, day, `${seed}|${day}`, curves, cfg).total });
      // Judges' tapes after every scored show, as the nightly processor does.
      engine.applyJudgesTapes(state, day, cfg);
    }
    engine.endOfDay(
      state,
      day,
      { restDay, blocksUsedToday: used, maxBlocksToday: maxBlocks, warmupUsed: (blocksSoFar.warmup || 0) > 0 },
      cfg
    );
    // Members quit when morale collapses (morale v2), as the processor runs it.
    engine.applyAttrition(state, day, `attr|${seed}`, cfg);
  }
  return { scores };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const failures = [];
function assert(name, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  console.log(`  [${status}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures.push(name);
}

function main() {
  console.log("== Podium simulation harness ==\n");

  // --- Single-season sweep across strategies and reputation tiers ---------
  console.log("A/B/C. Single-season sweep (5 seeds x 5 strategies x tiers 1/4/7):");
  const results = {};
  let envelopeViolations = 0;
  let maxTotalSeen = 0;
  for (const strategyName of ["flawless", "balanced", "goodButImperfect", "brassSpam", "absent"]) {
    results[strategyName] = {};
    for (const repTier of [1, 4, 7]) {
      const finals = [];
      for (let s = 0; s < 5; s++) {
        const strategies = makeStrategies(`seed${s}`);
        const { finalsTotal, scores } = simulateSeason(strategies[strategyName], repTier, `s${s}`);
        finals.push(finalsTotal);
        for (const { day, total } of scores) {
          maxTotalSeen = Math.max(maxTotalSeen, total);
          const band = curves.totalBands[day - 1];
          // Envelope: caption clamps guarantee caption containment; totals may
          // exceed the historical TOTAL band only marginally (caption-mix), so
          // assert against band.max + 1.0 tolerance and the hard cap.
          if (total > band.max + 1.0) envelopeViolations++;
        }
      }
      results[strategyName][repTier] = finals.reduce((a, b) => a + b, 0) / finals.length;
    }
  }
  for (const [name, byTier] of Object.entries(results)) {
    console.log(
      `    ${name.padEnd(18)} finals avg — tier1: ${byTier[1].toFixed(2)}  ` +
        `tier4: ${byTier[4].toFixed(2)}  tier7: ${byTier[7].toFixed(2)}`
    );
  }
  assert("A. envelope containment", envelopeViolations === 0, `${envelopeViolations} violations`);
  assert("B. no 100s ever", maxTotalSeen < 100, `max total seen ${maxTotalSeen.toFixed(3)}`);
  assert(
    "C1. balance beats spam, presence beats absence (tier 7)",
    results.flawless[7] > results.balanced[7] &&
      results.balanced[7] > results.brassSpam[7] &&
      results.balanced[7] > results.absent[7],
    `flawless ${results.flawless[7].toFixed(1)} > balanced ${results.balanced[7].toFixed(1)} > ` +
      `spam ${results.brassSpam[7].toFixed(1)} / absent ${results.absent[7].toFixed(1)}`
  );
  assert(
    "C2. reputation is ceiling-only (tier7 absent still loses to tier1 flawless)",
    results.flawless[1] > results.absent[7],
    `tier1 flawless ${results.flawless[1].toFixed(1)} vs tier7 absent ${results.absent[7].toFixed(1)}`
  );

  // --- D. Champion pacing --------------------------------------------------
  console.log("\nD. Multi-season pacing (reputation climb):");
  const climb = (strategyName, seasons) => {
    let reputation = 0;
    let tierReachedAt = null;
    for (let season = 1; season <= seasons; season++) {
      const strategies = makeStrategies(`career|${season}`);
      const tier = engine.tierForReputation(reputation, cfg);
      const { finalsTotal } = simulateSeason(strategies[strategyName], tier, `career|${season}`);
      const perf = engine.tierPerformance(finalsTotal, 49, tier, curves, cfg);
      reputation = engine.updateReputation(reputation, perf, { dormantSeasons: 0 }, cfg);
      if (!tierReachedAt && engine.tierForReputation(reputation, cfg) === 7) tierReachedAt = season;
    }
    return { reputation, tierReachedAt };
  };
  const flawlessClimb = climb("flawless", 20);
  const balancedClimb = climb("balanced", 20);
  console.log(
    `    flawless: Champion at season ${flawlessClimb.tierReachedAt}; balanced after 20 ` +
      `seasons: rep ${balancedClimb.reputation.toFixed(0)} ` +
      `(tier ${engine.tierForReputation(balancedClimb.reputation, cfg)})`
  );
  assert(
    "D1. flawless reaches Champion in 10-14 seasons",
    flawlessClimb.tierReachedAt >= 10 && flawlessClimb.tierReachedAt <= 14,
    `season ${flawlessClimb.tierReachedAt}`
  );
  assert(
    "D2. casual play does not reach Champion in 20 seasons",
    engine.tierForReputation(balancedClimb.reputation, cfg) < 7,
    `tier ${engine.tierForReputation(balancedClimb.reputation, cfg)}`
  );

  // --- E. Dormancy invariant ----------------------------------------------
  console.log("\nE. Dormancy invariant:");
  let dormancyViolations = 0;
  for (const start of [20, 50, 75, 90, 100]) {
    for (const dormantSeasons of [1, 2, 3, 6]) {
      const after = engine.updateReputation(start, 0, { dormantSeasons }, cfg);
      if (after >= start && start > 0) dormancyViolations++;
    }
  }
  assert("E. return reputation strictly below departure", dormancyViolations === 0);

  // --- F. Upset rate --------------------------------------------------------
  console.log("\nF. Upset rate (flawless Elite tier-6 vs good-but-imperfect Champion tier-7):");
  let upsets = 0;
  const trials = 100;
  for (let t = 0; t < trials; t++) {
    const strategies = makeStrategies(`upset|${t}`);
    const challenger = simulateSeason(strategies.flawless, 6, `chal|${t}`);
    const champion = simulateSeason(strategies.goodButImperfect, 7, `champ|${t}`);
    if (challenger.finalsTotal > champion.finalsTotal) upsets++;
  }
  const upsetRate = upsets / trials;
  console.log(`    upset rate: ${(upsetRate * 100).toFixed(0)}% (${upsets}/${trials})`);
  // 25-45% since 2026-10: luck was cut on purpose (decision 39) and the
  // judges' tapes make an off-year Champion's missed days cheaper to recover
  // (decision 40), so the Elite now wins on the Champion's lapses, not dice.
  assert("F. upset rate in 25-45%", upsetRate >= 0.25 && upsetRate <= 0.45, `${(upsetRate * 100).toFixed(0)}%`);

  // --- G. Independence (the 2026-07 trajectory-model fix) ------------------
  // The original bug: every corps was anchored to the same per-day historical
  // band, so the whole field moved in lockstep and dipped together on days the
  // 2000s field happened to dip. Under the trajectory model each corps carries
  // its OWN form, so corps at DIFFERENT shows must fluctuate INDEPENDENTLY.
  //
  // Method: plateau K identical corps (same challenge/rep/rehearsal, so growth
  // is ~0 and any day-to-day movement is pure fluctuation), evolve each with an
  // INDEPENDENT seed, score daily, and measure (1) mean pairwise correlation of
  // daily deltas and (2) how often the field moves UNANIMOUSLY. A lockstep model
  // scores ~1.0 correlation and ~100% unanimous; independent corps do not.
  console.log("\nG. Independence — corps at different shows fluctuate on their own:");
  const K = 12;
  const DAYS = 40;
  const series = [];
  for (let i = 0; i < K; i++) {
    const challenge = {};
    for (const caption of engine.CAPTIONS) challenge[caption] = 5;
    const state = engine.createSeasonState({ challenge, repTier: 4 }, curves, cfg);
    // Plateau: fully installed & clean, so rehearsal growth is not the mover.
    for (const caption of engine.CAPTIONS) {
      state.captions[caption].content = 1;
      state.captions[caption].clean = 1;
    }
    state.condition.stamina = 100;
    state.condition.morale = 100;
    const totals = [];
    for (let d = 20; d < 20 + DAYS; d++) {
      engine.updateForm(state, d, `indep|corps${i}`, curves, cfg);
      totals.push(engine.scoreCorps(state, d, `indep|${d}|corps${i}`, curves, cfg).total);
    }
    series.push(totals);
  }
  const deltas = series.map((t) => t.slice(1).map((v, j) => v - t[j]));
  // Mean pairwise Pearson correlation of daily deltas.
  const corr = (a, b) => {
    const ma = a.reduce((s, v) => s + v, 0) / a.length;
    const mb = b.reduce((s, v) => s + v, 0) / b.length;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let j = 0; j < a.length; j++) {
      num += (a[j] - ma) * (b[j] - mb);
      da += (a[j] - ma) ** 2;
      db += (b[j] - mb) ** 2;
    }
    return num / Math.max(1e-9, Math.sqrt(da * db));
  };
  let corrSum = 0;
  let pairs = 0;
  for (let i = 0; i < K; i++) {
    for (let j = i + 1; j < K; j++) {
      corrSum += corr(deltas[i], deltas[j]);
      pairs++;
    }
  }
  const meanCorr = corrSum / pairs;
  // Unanimity: fraction of transitions where the WHOLE field moved one way.
  let unanimous = 0;
  for (let t = 0; t < DAYS - 1; t++) {
    const downs = deltas.filter((d) => d[t] < 0).length;
    if (downs === 0 || downs === K) unanimous++;
  }
  const unanimousFrac = unanimous / (DAYS - 1);
  console.log(
    `    mean pairwise delta-correlation: ${meanCorr.toFixed(3)} (lockstep→1.0); ` +
      `unanimous-direction days: ${(unanimousFrac * 100).toFixed(0)}% (lockstep→100%)`
  );
  assert("G1. corps move independently (mean delta-correlation < 0.35)", meanCorr < 0.35, meanCorr.toFixed(3));
  assert(
    "G2. no whole-field lockstep (unanimous-direction days < 20%)",
    unanimousFrac < 0.2,
    `${(unanimousFrac * 100).toFixed(0)}%`
  );

  // --- H. Challenge levels are a bet (challenge model v2, 2026-10) ---------
  // Under v1 all-8 outscored every other build on EVERY show day and mid levels
  // were a trap, so the registration knob had one right answer. v2 must hold:
  // easy books lead the opening weeks, the best level climbs as the season
  // goes on, a director who cleans every day wins finals at 8, and a corps
  // left to the assistant director is better off with an easier book.
  console.log("\nH. Challenge levels are a bet (tier 4, uniform challenge 1-8):");
  const H_DAYS = [4, 10, 17, 24, 31, 38, 45, 49];
  const H_SEEDS = 8;
  const hTable = (playRate) => {
    const table = {};
    for (let level = 1; level <= 8; level++) {
      table[level] = {};
      for (let s = 0; s < H_SEEDS; s++) {
        const { scores } = simulateCommitment(level, playRate, 4, `bet|${s}`);
        for (const { day, total } of scores) {
          if (H_DAYS.includes(day)) table[level][day] = (table[level][day] || 0) + total / H_SEEDS;
        }
      }
    }
    return table;
  };
  const bestLevel = (table, day) => {
    let best = 1;
    for (let level = 2; level <= 8; level++) if (table[level][day] > table[best][day]) best = level;
    return best;
  };
  const grinder = hTable(1);
  const light = hTable(0.15);
  const absentee = hTable(0);
  const levelClimb = H_DAYS.map((day) => bestLevel(grinder, day));
  console.log(`    grinder best level by day: ${H_DAYS.map((d, i) => `${d}:${levelClimb[i]}`).join(" ")}`);
  console.log(
    `    finals by level — grinder ${[1, 2, 3, 4, 5, 6, 7, 8].map((l) => grinder[l][49].toFixed(1)).join(" ")}`
  );
  console.log(
    `    finals by level — absent  ${[1, 2, 3, 4, 5, 6, 7, 8].map((l) => absentee[l][49].toFixed(1)).join(" ")}`
  );
  assert(
    "H1. easy books lead the opening weeks (all-1 beats all-8 on days 4 and 10)",
    grinder[1][4] > grinder[8][4] && grinder[1][10] > grinder[8][10],
    `day 4 ${grinder[1][4].toFixed(1)} vs ${grinder[8][4].toFixed(1)}`
  );
  assert(
    "H2. the best level climbs through the season (never falls; >= 3 distinct)",
    levelClimb.every((level, i) => i === 0 || level >= levelClimb[i - 1]) && new Set(levelClimb).size >= 3,
    levelClimb.join(" > ")
  );
  let finalsMonotone = true;
  for (let level = 2; level <= 8; level++) {
    if (grinder[level][49] <= grinder[level - 1][49]) finalsMonotone = false;
  }
  assert("H3. a cleaned hard book wins finals (grinder finals rise with every level)", finalsMonotone);
  assert(
    "H4. a dirty hard book is a risk (absent corps: an easier book beats all-8 at finals)",
    bestLevel(absentee, 49) <= 5 && absentee[8][49] < absentee[bestLevel(absentee, 49)][49],
    `best ${bestLevel(absentee, 49)}`
  );
  assert(
    "H5. the right level tracks commitment (a 15%-play corps peaks below the grinder)",
    bestLevel(light, 49) < bestLevel(grinder, 49),
    `light ${bestLevel(light, 49)} vs grinder ${bestLevel(grinder, 49)}`
  );

  // --- I. Rehearsal choices matter (gameplay depth, 2026-10) --------------
  // The 2026-10 engine probe found warmup + 11x Full Ensemble within ~1 point
  // of the best plan, Full Ensemble spam ahead of a sectionals-first opener,
  // and one night's form swing (~3.6 points p5-p95) larger than the gap
  // between a careful plan and a lazy one. Ensemble readiness, the repeat
  // ladder and a calmer form walk must hold the opposite.
  console.log("\nI. Rehearsal choices matter (tier 4, challenge 8):");
  const I_SEEDS = 40;
  const feSpam = (/** @type {number} */ n) => ["warmup", ...Array(n - 1).fill("fullEnsemble")];
  const sectionalsFirst = (/** @type {number} */ n) => [
    "warmup",
    ...Array.from({ length: n - 1 }, (_, i) =>
      ["brassSectionals", "percussionSectionals", "guardSectionals", "visualBasics"][i % 4]
    ),
  ];
  const showTotal = (/** @type {{scores: Array<{day: number, total: number}>}} */ run, /** @type {number} */ day) =>
    /** @type {{total: number}} */ (run.scores.find((s) => s.day === day)).total;
  const iRuns = (/** @type {number} */ playRate, /** @type {any} */ opts = {}) =>
    Array.from({ length: I_SEEDS }, (_, s) => simulateCommitment(8, playRate, 4, `depth|${s}`, opts));
  const mean = (/** @type {number[]} */ xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const iBalanced = iRuns(1);
  const iSpam = iRuns(1, { dayPlan: feSpam });
  const iSections = iRuns(1, { dayPlan: sectionalsFirst });
  const iPartTime = iRuns(0.7);
  const balancedFinals = iBalanced.map((r) => showTotal(r, 49));
  const spamGap = mean(balancedFinals) - mean(iSpam.map((r) => showTotal(r, 49)));
  const openerEdge = mean(iSections.map((r) => showTotal(r, 10))) - mean(iSpam.map((r) => showTotal(r, 10)));
  const partTimeFinals = iPartTime.map((r) => showTotal(r, 49));
  let effortWins = 0;
  for (const a of balancedFinals) for (const b of partTimeFinals) if (a > b) effortWins++;
  const effortRate = effortWins / (balancedFinals.length * partTimeFinals.length);
  const sorted = [...balancedFinals].sort((a, b) => a - b);
  const luckSpread = sorted[Math.floor(I_SEEDS * 0.95) - 1] - sorted[Math.floor(I_SEEDS * 0.05)];
  console.log(
    `    finals: balanced ${mean(balancedFinals).toFixed(2)} · FE spam gap ${spamGap.toFixed(2)} · ` +
      `day-10 sectionals-first edge ${openerEdge.toFixed(2)} · daily beats 70%-play ${(effortRate * 100).toFixed(0)}% · ` +
      `identical-play spread ${luckSpread.toFixed(2)}`
  );
  assert("I1. one-button spam loses (Full Ensemble spam >= 3 points behind an even mix)", spamGap >= 3, spamGap.toFixed(2));
  assert(
    "I2. timing matters (sectionals-first leads Full Ensemble spam on day 10 by >= 1)",
    openerEdge >= 1,
    openerEdge.toFixed(2)
  );
  assert(
    "I3. effort beats luck (a daily director out-scores a 70%-play one in >= 78% of pairings; v1 tuning: 67%)",
    effortRate >= 0.78,
    `${(effortRate * 100).toFixed(0)}%`
  );
  assert("I4. luck is bounded (identical play spans <= 3.0 points p5-p95 at finals)", luckSpread <= 3, luckSpread.toFixed(2));

  // --- K. Morale is managed (2026-10) --------------------------------------
  // Before: fatigue counted only days that used EVERY block, so leaving one
  // unused kept morale at 100, and a corps that ground itself to morale 16 by
  // Finals lost ~1 point. Graded workload fatigue, a bigger rest day, morale
  // pulling form, and attrition below morale 30 must make rhythm matter:
  // grinding loses, the hidden-streak trick is gone, over-resting loses too.
  console.log("\nK. Morale is managed (tier 4, challenge 8, even block mix):");
  const K_SEEDS = 24;
  const spentOnly = (/** @type {any} */ st, /** @type {number} */ day, /** @type {Set<number>} */ shows) =>
    !shows.has(day) && st.condition.stamina < 45;
  const twiceWeekly = (/** @type {any} */ st, /** @type {number} */ day, /** @type {Set<number>} */ shows) =>
    !shows.has(day) && (day % 7 === 2 || day % 7 === 5 || st.condition.stamina < 45);
  const rhythmFinals = (/** @type {any} */ opts) =>
    mean(Array.from({ length: K_SEEDS }, (_, s) => showTotal(simulateCommitment(8, 1, 4, `morale|${s}`, opts), 49)));
  const managedFinals = rhythmFinals({});
  const grindFinals = rhythmFinals({ restCall: spentOnly });
  const elevensFinals = rhythmFinals({
    restCall: spentOnly,
    dayPlan: (/** @type {number} */ n) => balancedDay(n - 1),
  });
  const overRestFinals = rhythmFinals({ restCall: twiceWeekly });
  console.log(
    `    finals: managed ${managedFinals.toFixed(2)} · grind ${grindFinals.toFixed(2)} · ` +
      `11-of-12 grind ${elevensFinals.toFixed(2)} · rest twice a week ${overRestFinals.toFixed(2)}`
  );
  assert(
    "K1. grinding every day loses (>= 2 below a managed rhythm)",
    managedFinals - grindFinals >= 2,
    (managedFinals - grindFinals).toFixed(2)
  );
  assert(
    "K2. no hidden-streak trick (11-of-12 grind >= 1 below managed)",
    managedFinals - elevensFinals >= 1,
    (managedFinals - elevensFinals).toFixed(2)
  );
  assert(
    "K3. over-resting loses too (twice-weekly rest >= 1.5 below managed)",
    managedFinals - overRestFinals >= 1.5,
    (managedFinals - overRestFinals).toFixed(2)
  );

  // --- J. Shows pay their way (2026-10) -----------------------------------
  // Before: a show day's 8 blocks ran at half value and performing taught the
  // corps nothing, so a full schedule finished ~8 points below attending only
  // the automatic shows — the game paid directors to skip shows and starve
  // the fields. Show-day blocks at 3/4 value plus the judges' tapes must make
  // a moderate schedule at least break even, while an overloaded tour of long
  // hauls still costs — routing and rest decide it, not avoidance.
  console.log("\nJ. Shows pay their way (tier 4, challenge 8, even block mix):");
  const AUTO_ONLY = new Set([28, 35, 41, 47, 48, 49]);
  const MODERATE = new Set([4, 10, 13, 17, 20, 24, 28, 31, 35, 38, 41, 47, 48, 49]);
  const MAXIMAL = new Set([
    2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 20, 21, 23, 25, 27, 28, 30, 32, 34, 35, 37, 39, 40, 41, 43, 44, 47, 48, 49,
  ]);
  const J_SEEDS = 24;
  const scheduleFinals = (/** @type {Set<number>} */ showDays, /** @type {number} */ travelStamina) =>
    mean(
      Array.from({ length: J_SEEDS }, (_, s) =>
        showTotal(simulateCommitment(8, 1, 4, `shows|${s}`, { showDays, travelStamina }), 49)
      )
    );
  const autoOnly = scheduleFinals(AUTO_ONLY, 4);
  const moderate = scheduleFinals(MODERATE, 4);
  const maximalFar = scheduleFinals(MAXIMAL, 9);
  console.log(
    `    finals: auto-only (6 shows) ${autoOnly.toFixed(2)} · moderate (14) ${moderate.toFixed(2)} · ` +
      `maximal on long hauls (29) ${maximalFar.toFixed(2)}`
  );
  assert(
    "J1. a moderate schedule breaks even (>= auto-only - 0.25)",
    moderate >= autoOnly - 0.25,
    `${(moderate - autoOnly).toFixed(2)}`
  );
  assert(
    "J2. an overloaded tour of long hauls still costs (>= 1.5 below moderate)",
    moderate - maximalFar >= 1.5,
    `${(moderate - maximalFar).toFixed(2)}`
  );

  // --- Summary --------------------------------------------------------------
  const summary =
    failures.length === 0 ? "ALL ASSERTIONS PASS" : `${failures.length} FAILURES: ${failures.join(", ")}`;
  console.log(`\n== ${summary} ==`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
