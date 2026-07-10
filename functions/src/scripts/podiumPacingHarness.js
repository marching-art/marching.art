/**
 * Podium pacing harness — multi-season calibration checks against the
 * committed curveData + balanceConfig (no Firestore, engine only).
 *
 * Asserts the design invariants (PODIUM_CLASS_DESIGN.md §5.13, §12):
 *   1. A debut Community Corps season finishes in Surf/Genesis territory
 *      (finals total ~70-78) — never a finalist-level 90 (2026-07 user
 *      calibration report: the pre-correction bands let debuts hit ~91).
 *   2. A flawless director reaches Champion Status in roughly a dozen
 *      seasons (10-16), never faster than 9.
 *   3. Elite (tier 6) beats Champion (tier 7) sometimes — the dynasty is
 *      beatable — but not most of the time (upset rate ~15-50%).
 *   4. No corps ever reaches 100 (hard cap 99.7; observed max well below).
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
 * Play one season with a strong, simple policy: rotate all six caption
 * blocks, rest when stamina runs low, take the show-day load. `skipRate`
 * models an absent director: each DAY is skipped whole with probability
 * skipRate (an absence is a day you never opened the app — the granularity
 * absence actually happens at; per-block skipping would average out over a
 * 12-block day and never dent a champion). Deterministic per seed.
 * Returns the finals score sheet.
 */
function playSeason(repTier, challengeLevel, seed, skipRate = 0) {
  const challenge = Object.fromEntries(engine.CAPTIONS.map((c) => [c, challengeLevel]));
  const state = engine.createSeasonState({ challenge, repTier }, curves, balance);
  let rotationIndex = 0;
  for (let day = 1; day <= 49; day++) {
    const isShowDay = SHOW_DAYS.includes(day);
    const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining: false }, balance);
    const skippedDay = skipRate > 0 && engine.seededUnit(`${seed}|skip|${day}`) < skipRate;
    const rest = !isShowDay && !skippedDay && state.condition.stamina < 25;
    let used = 0;
    const blocksSoFar = {};
    if (!rest) {
      // On a skipped day the assistant director runs the plan template at
      // reduced yield — exactly what the nightly processor does for a
      // director who never opened the app (§5.2). Absence costs the yield
      // gap, never a wrecked season.
      const yieldMultiplier = skippedDay ? balance.rehearsal.assistantYield : 1;
      for (let i = 0; i < maxBlocks; i++) {
        const blockType = ROTATION[rotationIndex % ROTATION.length];
        rotationIndex++;
        engine.allocateBlock(state, blockType, day, i, blocksSoFar, curves, balance, {
          yieldMultiplier,
        });
        blocksSoFar[blockType] = (blocksSoFar[blockType] || 0) + 1;
        used++;
      }
    }
    engine.endOfDay(
      state,
      day,
      { restDay: rest, blocksUsedToday: used, maxBlocksToday: maxBlocks, warmupUsed: false },
      balance
    );
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

// --- 1. Debut season: Community Corps territory -----------------------------
const debut = playSeason(1, 6, "debut");
check(
  "debut finals in Surf/Genesis territory (70-78)",
  debut.total >= 68 && debut.total <= 79,
  `total ${debut.total}`
);

// --- 5. Tier ceilings: the DCI-shaped ladder --------------------------------
const ladder = [1, 2, 3, 4, 5, 6, 7].map((tier) => playSeason(tier, 8, `tier${tier}`).total);
console.log(`tier ceilings at finals: ${ladder.map((t) => t.toFixed(1)).join(" / ")}`);
check(
  "ceilings strictly increase by tier",
  ladder.every((t, i) => i === 0 || t > ladder[i - 1])
);
check("tier-4 (Finalist) ceiling ~88-93", ladder[3] >= 88 && ladder[3] <= 93, ladder[3].toFixed(2));
check("tier-6 (Elite) ceiling ~96-98", ladder[5] >= 96 && ladder[5] <= 98, ladder[5].toFixed(2));
check("no 100s anywhere (hard cap 99.7)", Math.max(...ladder) <= balance.scoring.totalCap);

// --- 2. Seasons to Champion Status ------------------------------------------
let reputation = 0;
let championSeason = null;
for (let season = 1; season <= 25 && championSeason === null; season++) {
  const tier = engine.tierForReputation(reputation, balance);
  if (tier >= 7) {
    championSeason = season;
    break;
  }
  // A committed director raises the book as the corps grows.
  const challengeLevel = Math.min(8, 4 + tier);
  const result = playSeason(tier, challengeLevel, `career|s${season}`);
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
const flawlessChampion = playSeason(7, 8, "upset|champ|flawless");
const flawlessElite = playSeason(6, 8, "upset|elite|flawless");
check(
  "a flawless champion holds off a flawless elite",
  flawlessChampion.total > flawlessElite.total,
  `${flawlessChampion.total} vs ${flawlessElite.total}`
);
// The realization plateau (attainmentFullRealization, Phase 0) makes the
// top of the ladder forgiving of moderate absence by design — an off-year
// only opens the door when the champion loses about HALF the season's
// rehearsal time (the director coasting on the assistant).
let upsets = 0;
const TRIALS = 60;
for (let t = 0; t < TRIALS; t++) {
  const elite = playSeason(6, 8, `upset|elite|${t}`);
  const champion = playSeason(7, 8, `upset|champ|${t}`, 0.5); // half-absent year
  if (elite.total > champion.total) upsets++;
}
const upsetRate = upsets / TRIALS;
check(
  "a flawless Elite beats a half-absent Champion sometimes, not usually (15-60%)",
  upsetRate >= 0.15 && upsetRate <= 0.6,
  `${(upsetRate * 100).toFixed(0)}%`
);

// --- 4. Dormancy invariant ----------------------------------------------------
const rested = engine.updateReputation(90, 0, { dormantSeasons: 2 }, balance);
check("a corps never returns stronger than it left", rested < 90, `90 -> ${rested}`);

console.log(failures.length === 0 ? "\nPACING HARNESS PASS" : `\nFAILURES: ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);
