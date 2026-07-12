/**
 * Podium pacing harness — multi-season calibration checks against the
 * committed curveData + balanceConfig (no Firestore, engine only).
 *
 * Recalibrated 2026-07 for the trajectory-anchored scoring model (engine.js
 * §4.2): each corps rides its OWN challenge-selected potential curve, realized
 * by its OWN rehearsal and nudged by its OWN independent form. Reputation is a
 * modest earned tailwind (~+1.7%/tier), NOT the old hard per-day band clamp —
 * so a diligent NEWCOMER now earns a real score instead of being pinned to a
 * tier-1 percentile, and no two corps move in lockstep. The invariants:
 *   1. A typical diligent debut finishes in the low-to-mid 80s — a real,
 *      rehearsal-earned result (NOT the old reputation-gated ~72), but still
 *      clearly short of the dynasty ceiling (§5.13 progression).
 *   2. A flawless director (optimal blocks + the occasional hot-form season)
 *      reaches Champion Status in roughly a dozen seasons (10-16); a simple
 *      rotation plateaus below it (proven in podiumSim.js D2).
 *   3. Elite (tier 6) beats a Champion having an off-year sometimes — the
 *      dynasty is beatable — but not most of the time (upset rate ~15-60%).
 *   4. No corps ever reaches 100 (soft-cap to the day's historical max).
 *   5. Tier ceilings at finals land on the intended DCI-shaped ladder.
 *
 * Run:  cd functions && node src/scripts/podiumPacingHarness.js
 */

const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");

const balance = store.balance;
const curves = store.curves;

const SHOW_DAYS = [10, 17, 24, 28, 35, 41, 47, 48, 49];
const ROTATION = [
  "visualBasics",
  "visualEnsemble",
  "guardSectionals",
  "brassSectionals",
  "percussionSectionals",
  "fullEnsemble",
];

/**
 * The ordered block plan for one day.
 * @param {object} state season state
 * @param {number} maxBlocks blocks available today
 * @param {boolean} optimal true = a flawless director (warmup + weakest-caption
 *   targeting); false = a diligent-but-simple rotation
 * @param {{index:number}} rot rotation cursor (mutated) for the simple policy
 */
function planDay(state, maxBlocks, optimal, rot) {
  if (!optimal) {
    const blocks = [];
    for (let i = 0; i < maxBlocks; i++) blocks.push(ROTATION[rot.index++ % ROTATION.length]);
    return blocks;
  }
  // Flawless: warmup first, then hit the weakest captions with the block whose
  // primary caption they are — the policy podiumSim.js proves reaches Champion.
  const weakest = Object.entries(state.captions)
    .map(([caption, cap]) => ({ caption, value: cap.content * (0.72 + 0.28 * cap.clean) }))
    .sort((a, b) => a.value - b.value)
    .map((e) => e.caption);
  const picks = ["warmup"];
  for (const caption of weakest) {
    for (const [blockType, block] of Object.entries(balance.blocks)) {
      if (blockType === "warmup") continue;
      if ((block.captions[caption] || 0) >= 1 && !picks.includes(blockType)) {
        picks.push(blockType);
        break;
      }
    }
    if (picks.length >= maxBlocks) break;
  }
  while (picks.length < maxBlocks) picks.push("fullEnsemble");
  return picks.slice(0, maxBlocks);
}

/**
 * Play one season. `skipRate` models an absent director: each DAY is skipped
 * whole with probability skipRate (the granularity absence actually happens
 * at). `optimal` selects the flawless policy; `useForm` evolves the corps'
 * independent form (needed for a realistic climb — a Champion breakthrough
 * needs the occasional peak season). Deterministic per seed.
 * @returns {object} the finals score sheet
 */
function playSeason(repTier, challengeLevel, seed, { skipRate = 0, optimal = false, useForm = false } = {}) {
  const challenge = Object.fromEntries(engine.CAPTIONS.map((c) => [c, challengeLevel]));
  const state = engine.createSeasonState({ challenge, repTier }, curves, balance);
  const rot = { index: 0 };
  for (let day = 1; day <= 49; day++) {
    const isShowDay = SHOW_DAYS.includes(day);
    const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining: false }, balance);
    const skippedDay = skipRate > 0 && engine.seededUnit(`${seed}|skip|${day}`) < skipRate;
    const restFloor = optimal ? 45 : 25;
    const rest = !isShowDay && !skippedDay && state.condition.stamina < restFloor;
    let used = 0;
    const blocksSoFar = {};
    if (!rest) {
      // On a skipped day the assistant director runs the plan at reduced yield
      // — exactly what the nightly processor does for a director who never
      // opened the app (§5.2). Absence costs the yield gap, never a wreck.
      const yieldMultiplier = skippedDay ? balance.rehearsal.assistantYield : 1;
      const plan = planDay(state, maxBlocks, optimal, rot);
      for (let i = 0; i < plan.length; i++) {
        engine.allocateBlock(state, plan[i], day, i, blocksSoFar, curves, balance, {
          yieldMultiplier,
          isShowDay,
        });
        blocksSoFar[plan[i]] = (blocksSoFar[plan[i]] || 0) + 1;
        used++;
      }
    }
    engine.endOfDay(
      state,
      day,
      { restDay: rest, blocksUsedToday: used, maxBlocksToday: maxBlocks, warmupUsed: (blocksSoFar.warmup || 0) > 0 },
      balance
    );
    // Independent per-corps form evolves every day (seeded only by this corps).
    if (useForm) engine.updateForm(state, day, `form|${seed}`, curves, balance);
    if (isShowDay) {
      state.condition.stamina = Math.max(
        0,
        state.condition.stamina - balance.condition.showStaminaCost
      );
    }
  }
  return engine.scoreCorps(state, 49, `harness|${seed}`, curves, balance);
}

const failures = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

// --- 1. Debut season: a real, rehearsal-earned newcomer result --------------
// A typical diligent debut (simple rotation, mid challenge) now earns a
// low-to-mid 80s score — rehearsal is rewarded immediately, no longer pinned
// to a tier-1 percentile — while still sitting well below the dynasty ceiling.
const debut = playSeason(1, 6, "debut");
check(
  "debut finals is a rehearsal-earned low-to-mid 80s (80-89)",
  debut.total >= 80 && debut.total <= 89,
  `total ${debut.total}`
);

// --- 5. Tier ceilings: the DCI-shaped ladder (flawless play per tier) --------
const ladder = [1, 2, 3, 4, 5, 6, 7].map(
  (tier) => playSeason(tier, 8, `tier${tier}`, { optimal: true }).total
);
console.log(`tier ceilings at finals: ${ladder.map((t) => t.toFixed(1)).join(" / ")}`);
check(
  "ceilings increase by tier (non-decreasing)",
  ladder.every((t, i) => i === 0 || t >= ladder[i - 1] - 0.01)
);
check("tier-4 (Finalist) ceiling ~93-96", ladder[3] >= 93 && ladder[3] <= 96, ladder[3].toFixed(2));
check("tier-6 (Elite) ceiling ~96-98.5", ladder[5] >= 96 && ladder[5] <= 98.5, ladder[5].toFixed(2));
check("no 100s anywhere (hard cap 99.7)", Math.max(...ladder) <= balance.scoring.totalCap);

// --- 2. Seasons to Champion Status (flawless play + real form variance) -----
let reputation = 0;
let championSeason = null;
for (let season = 1; season <= 25 && championSeason === null; season++) {
  const tier = engine.tierForReputation(reputation, balance);
  if (tier >= 7) {
    championSeason = season;
    break;
  }
  // A flawless director plays the hardest book with optimal blocks; the
  // occasional hot-form season is what finally breaks into Champion (§5.13).
  const result = playSeason(tier, 8, `career|s${season}`, { optimal: true, useForm: true });
  const pct = engine.percentileOfTotal(result.total, 49, curves);
  reputation = engine.updateReputation(reputation, pct, { dormantSeasons: 0 }, balance);
}
check(
  "flawless climb to Champion Status in ~a dozen seasons (10-16)",
  championSeason !== null && championSeason >= 10 && championSeason <= 16,
  `season ${championSeason ?? ">25"}`
);

// --- 3. The dynasty is beatable — under the right circumstances ---------------
// A flawless champion holds off a flawless elite (that IS the tier ceiling);
// the upset window is a perfect Elite season against a champion having an
// off-year (missed rehearsal time), per §5.13 "beatable under the right
// circumstances".
const flawlessChampion = playSeason(7, 8, "upset|champ|flawless", { optimal: true });
const flawlessElite = playSeason(6, 8, "upset|elite|flawless", { optimal: true });
check(
  "a flawless champion holds off a flawless elite",
  flawlessChampion.total > flawlessElite.total,
  `${flawlessChampion.total} vs ${flawlessElite.total}`
);
// The dynasty is beatable when the Champion has an OFF-YEAR: a flawless Elite
// challenger against a Champion who skips ~1 rehearsal day a week wins
// sometimes, not usually. Independent form supplies the night-to-night luck.
let upsets = 0;
const TRIALS = 60;
for (let t = 0; t < TRIALS; t++) {
  const elite = playSeason(6, 8, `upset|elite|${t}`, { optimal: true, useForm: true });
  const champion = playSeason(7, 8, `upset|champ|${t}`, { optimal: true, useForm: true, skipRate: 0.12 });
  if (elite.total > champion.total) upsets++;
}
const upsetRate = upsets / TRIALS;
check(
  "a flawless Elite beats an off-year Champion sometimes, not usually (15-60%)",
  upsetRate >= 0.15 && upsetRate <= 0.6,
  `${(upsetRate * 100).toFixed(0)}%`
);

// --- 4. Dormancy invariant ----------------------------------------------------
const rested = engine.updateReputation(90, 0, { dormantSeasons: 2 }, balance);
check("a corps never returns stronger than it left", rested < 90, `90 -> ${rested}`);

console.log(failures.length === 0 ? "\nPACING HARNESS PASS" : `\nFAILURES: ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);
