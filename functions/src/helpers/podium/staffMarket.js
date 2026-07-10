/**
 * Podium staff labor market (Phase 4.3-4.4, design §5.6).
 *
 * Staff are generated PERSONS, not catalog rows: name, specialty (one of the
 * 8 captions, Tour Manager, or Program Coordinator), tier, salary, and a
 * displayed trait. The market for a season is generated DETERMINISTICALLY
 * from the seasonUid, so lazy creation is idempotent and every player sees
 * the same pool. Scarcity is real: each person signs with exactly one corps
 * (first-come in v1; the bid/preference free-agency window is the Phase 5+
 * evolution recorded in the design doc).
 *
 * Effects (applied in the callable/processor, capped at maxTotalBoost):
 *   - Caption techs boost rehearsal yield on blocks where their caption is
 *     a PRIMARY effect.
 *   - Program Coordinator boosts the Full Ensemble block.
 *   - Tour Manager reduces travel stamina costs by their tier's percentage.
 */

const engine = require("./engine");
const balance = require("./balanceConfig.json");

const SPECIALTIES = [...engine.CAPTIONS, "tourManager", "programCoordinator"];

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Riley", "Casey", "Devon", "Morgan", "Quinn",
  "Taylor", "Avery", "Marcus", "Elena", "Sofia", "Andre", "Naomi", "Victor",
  "Priya", "Diego", "Lena", "Theo", "Maya", "Owen", "Iris", "Hugo",
];

const LAST_NAMES = [
  "Alvarez", "Brennan", "Chen", "Dubois", "Ellis", "Fitzgerald", "Garza",
  "Hoffman", "Iwata", "Jacobs", "Kowalski", "Lindqvist", "Moreau", "Nakamura",
  "Okafor", "Petrov", "Quintana", "Rossi", "Silva", "Thibodeaux", "Ueda",
  "Vasquez", "Whitfield", "Zhang",
];

const TRAITS = [
  "Basics-first", "Peaker", "Ensemble ear", "Drill doctor", "Tone farmer",
  "Clean freak", "Old school", "Analytics nerd", "Motivator", "Quiet legend",
];

/** Deterministic pick from a list. */
function pick(list, seed) {
  return list[Math.floor(engine.seededUnit(seed) * list.length) % list.length];
}

/**
 * Generate the full, deterministic staff market for a season.
 * @param {string} seasonUid
 * @returns {Array<object>} staff persons (signedBy: null)
 */
function generateMarket(seasonUid) {
  const staff = [];
  const cfg = balance.staff;
  for (const specialty of SPECIALTIES) {
    const entries = [];
    for (const [tier, count] of Object.entries(cfg.marketPerSpecialty)) {
      for (let i = 0; i < count; i++) entries.push(tier);
    }
    if (engine.seededUnit(`${seasonUid}|staff|${specialty}|master`) < cfg.masterChance) {
      entries.push("master");
    }
    if (engine.seededUnit(`${seasonUid}|staff|${specialty}|legend`) < cfg.legendChance) {
      entries.push("legend");
    }
    entries.forEach((tier, index) => {
      const seed = `${seasonUid}|staff|${specialty}|${tier}|${index}`;
      const first = pick(FIRST_NAMES, `${seed}|first`);
      const last = pick(LAST_NAMES, `${seed}|last`);
      staff.push({
        id: `${specialty}_${tier}_${index}`,
        name: `${first} ${last}`,
        specialty,
        tier,
        salary: cfg.tiers[tier].salary,
        boost: cfg.tiers[tier].boost,
        trait: pick(TRAITS, `${seed}|trait`),
        signedBy: null,
      });
    });
  }
  return staff;
}

/**
 * Total staff yield multiplier for a block type, capped at maxTotalBoost.
 * `state.staff` is { specialty: { tier, boost, ... } }.
 * @returns {number} e.g. 1.09
 */
function staffYieldMultiplier(state, blockType, cfg) {
  const roster = state.staff || {};
  const block = cfg.blocks[blockType];
  if (!block) return 1;
  let total = 0;
  for (const [specialty, member] of Object.entries(roster)) {
    if (!member) continue;
    if (specialty === "programCoordinator" && blockType === "fullEnsemble") {
      total += member.boost || 0;
    } else if ((block.captions[specialty] || 0) >= 1) {
      total += member.boost || 0;
    }
  }
  return 1 + Math.min(cfg.staff.maxTotalBoost, total);
}

/** Travel-stamina reduction fraction from a hired Tour Manager (0 when none). */
function tourStaminaReduction(state, cfg) {
  const tourManager = state.staff && state.staff.tourManager;
  if (!tourManager) return 0;
  const tier = cfg.staff.tiers[tourManager.tier];
  return tier ? tier.tourStaminaReductionPct / 100 : 0;
}

module.exports = { SPECIALTIES, generateMarket, staffYieldMultiplier, tourStaminaReduction };
