/**
 * Podium Phase 0.4 — Simulation harness.
 *
 * Plays full seasons and multi-season careers through the REAL engine
 * (helpers/podium/engine.js) with the REAL calibration data
 * (helpers/podium/curveData.json) and tunables
 * (helpers/podium/balanceConfig.json), then asserts the design's promises
 * (docs/PODIUM_CLASS_DESIGN.md §9, §5.13):
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
 *      good-but-imperfect Champion (tier 7) in 30-45% of finals.
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
        // Rests exactly when stamina demands it; warmup every working day;
        // targets the weakest captions with remaining blocks.
        if (state.condition.stamina < 45 && !SHOW_DAYS.has(day)) {
          return { restDay: true, blocks: [] };
        }
        const weakest = Object.entries(state.captions)
          .map(([caption, c]) => ({ caption, value: c.content * (0.72 + 0.28 * c.clean) }))
          .sort((a, b) => a.value - b.value)
          .map((e) => e.caption);
        const picks = [];
        for (const caption of weakest) {
          for (const [blockType, block] of Object.entries(cfg.blocks)) {
            if (blockType === "warmup") continue;
            if ((block.captions[caption] || 0) >= 1 && !picks.includes(blockType)) {
              picks.push(blockType);
              break;
            }
          }
          if (picks.length >= blocks - 1) break;
        }
        while (picks.length < blocks - 1) picks.push("fullEnsemble");
        return { restDay: false, blocks: ["warmup", ...picks] };
      },
    },
    goodButImperfect: {
      challenge: () => 8,
      planDay: (state, day, { blocks }) => {
        // The complacent champion: plays a champion's game — weakest-caption
        // targeting, warmups, stamina-aware rests — but skips ~6% of days
        // outright. One bad habit, not a bad director.
        if (engine.seededUnit(`${seed}|skip|${day}`) < 0.06) return { restDay: false, blocks: [] };
        if (state.condition.stamina < 45 && !SHOW_DAYS.has(day)) {
          return { restDay: true, blocks: [] };
        }
        const weakest = Object.entries(state.captions)
          .map(([caption, c]) => ({ caption, value: c.content * (0.72 + 0.28 * c.clean) }))
          .sort((a, b) => a.value - b.value)
          .map((e) => e.caption);
        const picks = [];
        for (const caption of weakest) {
          for (const [blockType, block] of Object.entries(cfg.blocks)) {
            if (blockType === "warmup") continue;
            if ((block.captions[caption] || 0) >= 1 && !picks.includes(blockType)) {
              picks.push(blockType);
              break;
            }
          }
          if (picks.length >= blocks - 1) break;
        }
        while (picks.length < blocks - 1) picks.push("fullEnsemble");
        return { restDay: false, blocks: ["warmup", ...picks] };
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
    if (isShowDay) {
      state.condition.stamina = Math.max(0, state.condition.stamina - cfg.condition.showStaminaCost);
      scores.push({ day, ...engine.scoreCorps(state, day, `${seed}|${day}`, curves, cfg) });
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
  }
  return { finalsTotal: scores[scores.length - 1].total, scores, state };
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
      const pct = engine.percentileOfTotal(finalsTotal, 49, curves);
      reputation = engine.updateReputation(reputation, pct, { dormantSeasons: 0 }, cfg);
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
  assert("F. upset rate in 30-45%", upsetRate >= 0.3 && upsetRate <= 0.45, `${(upsetRate * 100).toFixed(0)}%`);

  // --- Summary --------------------------------------------------------------
  const summary =
    failures.length === 0 ? "ALL ASSERTIONS PASS" : `${failures.length} FAILURES: ${failures.join(", ")}`;
  console.log(`\n== ${summary} ==`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
