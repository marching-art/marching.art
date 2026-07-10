/**
 * Podium staff labor market (Phase 4.3-4.4, design §5.6; careers per
 * decision 28).
 *
 * Staff are generated PERSONS with CAREERS, not catalog rows: name,
 * specialty (one of the 8 captions, Tour Manager, or Program Coordinator),
 * tier, salary, trait — and a persistent resume across seasons (the
 * `podium-staff/registry` doc). The season market is generated
 * DETERMINISTICALLY from the seasonUid, so lazy creation is idempotent and
 * every player sees the same pool. Scarcity is real: each person signs with
 * exactly one corps.
 *
 * THE CAREER ARC (decision 28):
 *   - Staff age one season per game season from their debut and RETIRE at
 *     `career.maxSeasons` (30) — a full career is Hall of Fame stuff, and
 *     retirement cycles the pool forever (no terminal maxed-staff state).
 *   - Tenure PROMOTES: a person's tier floor rises with seasons worked
 *     (promotionSeasons), and their salary escalates
 *     (base x (1 + tenureSalaryPerSeason x careerSeasons)) — a year-25
 *     legend costs multiples of a rookie while the boost stays capped, so
 *     veteran staff are prestige + reliability, never a power spiral.
 *   - CONTRACTS run 1-3 seasons at a salary frozen at signing (the hedge
 *     against tenure inflation); each new season's salary is charged from
 *     the fresh Corps Budget at re-registration, and an unaffordable
 *     renewal lapses the contract (released, never a debt).
 *   - Mid-season TRANSFERS: an employer can post a contract to the open
 *     market; a buyer pays the remaining pro-rata salary plus a buyout
 *     premium (the premium is a sink), the seller recoups the remainder.
 *   - RETRAINING: an employer can move a person to a new specialty — the
 *     person keeps tenure, works at reduced boost for the rest of the
 *     season (learning curve), and the new specialty sticks for life.
 *
 * Effects (applied in the callable/processor, capped at maxTotalBoost):
 *   - Caption techs boost rehearsal yield on blocks where their caption is
 *     a PRIMARY effect.
 *   - Program Coordinator boosts the Full Ensemble block.
 *   - Tour Manager reduces travel stamina costs by their tier's percentage.
 */

const engine = require("./engine");
const balance = require("./balanceConfig.json");

const TIER_ORDER = ["apprentice", "journeyman", "veteran", "master", "legend"];

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

// ---------------------------------------------------------------------------
// Careers (decision 28)
// ---------------------------------------------------------------------------

/** Seasons a person has been in the game (never negative). */
function careerSeasonsOf(person, seasonIndex) {
  if (person.debutIndex == null) return 0;
  return Math.max(0, seasonIndex - person.debutIndex);
}

/** The tier a person works at: their generated talent, floored by tenure. */
function tierForCareer(generatedTier, careerSeasons, cfg) {
  let floor = "apprentice";
  for (const [tier, seasons] of Object.entries(cfg.staff.career.promotionSeasons)) {
    if (careerSeasons >= seasons) floor = tier;
  }
  const generatedRank = TIER_ORDER.indexOf(generatedTier);
  const floorRank = TIER_ORDER.indexOf(floor);
  return TIER_ORDER[Math.max(generatedRank, floorRank)];
}

/** Tenure-escalated per-season salary (a year-25 legend costs multiples). */
function salaryFor(tier, careerSeasons, cfg) {
  const base = cfg.staff.tiers[tier].salary;
  return Math.round(base * (1 + cfg.staff.career.tenureSalaryPerSeason * careerSeasons));
}

/** Generate one deterministic rookie person. */
function generateRookie(seasonUid, seasonIndex, specialty, tier, index) {
  const seed = `${seasonUid}|staff|${specialty}|${tier}|${index}`;
  const first = pick(FIRST_NAMES, `${seed}|first`);
  const last = pick(LAST_NAMES, `${seed}|last`);
  return {
    id: `${specialty}_s${seasonIndex}_${tier}_${index}`,
    name: `${first} ${last}`,
    specialty,
    generatedTier: tier,
    trait: pick(TRAITS, `${seed}|trait`),
    debutIndex: seasonIndex,
    resume: [],
    retired: false,
  };
}

/**
 * Build (or extend) the persistent registry and derive this season's market.
 * Ages every person, retires full careers (maxSeasons), carries available
 * veterans into the market, and generates deterministic rookies to keep
 * each specialty stocked. Mutates and returns `registry` alongside the
 * market staff array.
 *
 * @param {object|null} registryData `podium-staff/registry` doc data or null
 * @param {string} seasonUid
 * @param {number} seasonIndex global Podium season index
 * @param {object} cfg balance config
 * @returns {{registry: object, staff: Array<object>}}
 */
function buildSeasonMarket(registryData, seasonUid, seasonIndex, cfg) {
  const registry = registryData && registryData.people ? registryData : { people: {} };

  // Age + retire.
  for (const person of Object.values(registry.people)) {
    if (person.retired) continue;
    if (careerSeasonsOf(person, seasonIndex) >= cfg.staff.career.maxSeasons) {
      person.retired = true;
      person.retiredIndex = seasonIndex;
    }
  }

  const staff = [];
  for (const specialty of SPECIALTIES) {
    const veterans = Object.values(registry.people).filter(
      (person) => !person.retired && person.specialty === specialty
    );

    // Keep each specialty stocked to the configured counts with fresh blood;
    // veterans always return to the market on top of the rookie floor.
    const rookieTiers = [];
    for (const [tier, count] of Object.entries(cfg.staff.marketPerSpecialty)) {
      const veteransAtLeast = veterans.filter(
        (person) =>
          TIER_ORDER.indexOf(
            tierForCareer(person.generatedTier, careerSeasonsOf(person, seasonIndex), cfg)
          ) >= TIER_ORDER.indexOf(tier)
      ).length;
      for (let i = 0; i < Math.max(0, count - veteransAtLeast); i++) rookieTiers.push(tier);
    }
    if (
      veterans.length === 0 &&
      engine.seededUnit(`${seasonUid}|staff|${specialty}|master`) < cfg.staff.masterChance
    ) {
      rookieTiers.push("master");
    }
    if (
      veterans.length === 0 &&
      engine.seededUnit(`${seasonUid}|staff|${specialty}|legend`) < cfg.staff.legendChance
    ) {
      rookieTiers.push("legend");
    }
    const rookies = rookieTiers.map((tier, index) =>
      generateRookie(seasonUid, seasonIndex, specialty, tier, index)
    );
    for (const rookie of rookies) registry.people[rookie.id] = rookie;

    for (const person of [...veterans, ...rookies]) {
      const careerSeasons = careerSeasonsOf(person, seasonIndex);
      const tier = tierForCareer(person.generatedTier, careerSeasons, cfg);
      staff.push({
        id: person.id,
        name: person.name,
        specialty,
        tier,
        careerSeasons,
        salary: salaryFor(tier, careerSeasons, cfg),
        boost: cfg.staff.tiers[tier].boost,
        trait: person.trait,
        resume: (person.resume || []).slice(-3),
        signedBy: null,
      });
    }
  }
  registry.updatedAt = new Date().toISOString();
  return { registry, staff };
}

/**
 * Generate the full, deterministic staff market for a season (legacy
 * registry-less path — kept for tests and as the fallback when the
 * registry is unavailable).
 * @param {string} seasonUid
 * @returns {Array<object>} staff persons (signedBy: null)
 */
function generateMarket(seasonUid) {
  return buildSeasonMarket(null, seasonUid, 1, balance).staff;
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
    // Retraining learning curve: reduced boost for the rest of the season
    // the retrain happened in (decision 28).
    const retrainMult =
      member.retrain && member.retrain.seasonUid === state.seasonUid
        ? cfg.staff.career.retrainBoostMultiplier
        : 1;
    const boost = (member.boost || 0) * retrainMult;
    if (specialty === "programCoordinator" && blockType === "fullEnsemble") {
      total += boost;
    } else if ((block.captions[specialty] || 0) >= 1) {
      total += boost;
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

module.exports = {
  SPECIALTIES,
  TIER_ORDER,
  careerSeasonsOf,
  tierForCareer,
  salaryFor,
  buildSeasonMarket,
  generateMarket,
  staffYieldMultiplier,
  tourStaminaReduction,
};
