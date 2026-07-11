/**
 * Podium staff — a generic, always-available labor catalog with per-hire
 * careers. Supply scales with the playerbase instead of a scarce shared
 * pool: a director never claims a pre-made person, the catalog offers a ROLE
 * (specialty) at an ENTRY experience level, and hiring MINTS a staff instance
 * owned by that corps. The instance keeps a stable id, its tenure, and its
 * resume for the rest of its career.
 *
 * EARN experience by RETAINING (the whole game):
 *   - Only entry tiers (apprentice, journeyman) are hireable. Veteran ->
 *     Master -> Legend are reached SOLELY by keeping a staffer across seasons
 *     (promotionSeasons) — a Legend is proof you kept them ~22 seasons, never
 *     something bought off the shelf.
 *   - Each retained season ages the instance one year: the tenure floor
 *     raises its tier (and boost), and its salary escalates
 *     (base x (1 + tenureSalaryPerSeason x careerSeasons)).
 *   - CONTRACTS lock the salary for their length (a hedge against tenure
 *     inflation); once the lock lapses the salary floats to the current
 *     tenured rate. A staffer is retained automatically each season the corps
 *     can pay their salary from the fresh Corps Budget; an unaffordable season
 *     lapses the contract (released, never a debt), and a 30-season career
 *     ends in retirement.
 *
 * Effects (applied in the callable/processor, capped at maxTotalBoost):
 *   - Caption techs boost rehearsal yield on blocks where their caption is a
 *     PRIMARY effect.
 *   - Program Coordinator boosts the Full Ensemble block.
 *   - Tour Manager reduces travel stamina costs by their tier's percentage.
 */

const engine = require("./engine");

const TIER_ORDER = ["apprentice", "journeyman", "veteran", "master", "legend"];

const SPECIALTIES = [...engine.CAPTIONS, "tourManager", "programCoordinator"];

// The tiers a director can hire DIRECTLY. Everything above is earned by
// retention (tierForCareer floors the tier up as tenure accrues).
const HIRABLE_TIERS = ["apprentice", "journeyman"];

// ---------------------------------------------------------------------------
// Careers — tenure, salary, retirement
// ---------------------------------------------------------------------------

/** The boost fraction a tier yields (0 for an unknown tier). */
function boostFor(tier, cfg) {
  return (cfg.staff.tiers[tier] && cfg.staff.tiers[tier].boost) || 0;
}

/** The tier a staffer works at: their hired entry tier, floored by tenure. */
function tierForCareer(hiredTier, careerSeasons, cfg) {
  let floor = "apprentice";
  for (const [tier, seasons] of Object.entries(cfg.staff.career.promotionSeasons)) {
    if (careerSeasons >= seasons) floor = tier;
  }
  const hiredRank = TIER_ORDER.indexOf(hiredTier);
  const floorRank = TIER_ORDER.indexOf(floor);
  return TIER_ORDER[Math.max(hiredRank < 0 ? 0 : hiredRank, floorRank)];
}

/** Tenure-escalated per-season salary (a year-25 legend costs multiples). */
function salaryFor(tier, careerSeasons, cfg) {
  const base = cfg.staff.tiers[tier].salary;
  return Math.round(base * (1 + cfg.staff.career.tenureSalaryPerSeason * careerSeasons));
}

/**
 * The always-available hiring catalog: every specialty at every entry tier.
 * Generic — a role and an experience level, no names. Salaries/boosts are the
 * rookie (careerSeasons 0) rates; retention is what makes staff pricier and
 * better over time.
 * @returns {Array<{specialty:string, tier:string, salary:number, boost:number}>}
 */
function buildCatalog(cfg) {
  const catalog = [];
  for (const specialty of SPECIALTIES) {
    for (const tier of HIRABLE_TIERS) {
      catalog.push({
        specialty,
        tier,
        salary: salaryFor(tier, 0, cfg),
        boost: boostFor(tier, cfg),
      });
    }
  }
  return catalog;
}

/**
 * Mint a fresh staff instance at hire. The id sticks with this staffer for
 * the rest of their career (tenure + resume hang off it).
 * @param {{id:string, specialty:string, tier:string, seasons:number, day:number}} args
 * @returns {object} the instance stored at state.staff[specialty]
 */
function mintStaff({ id, specialty, tier, seasons, day }, cfg) {
  return {
    id,
    specialty,
    hiredTier: tier,
    careerSeasons: 0,
    tier,
    boost: boostFor(tier, cfg),
    salaryPerSeason: salaryFor(tier, 0, cfg),
    contract: { seasons, remaining: seasons },
    resume: [],
    hiredDay: day,
  };
}

/**
 * Age a retained staffer into the next season (pure). Increments tenure,
 * re-derives the tier/boost the tenure now earns, floats or holds the salary
 * per the contract lock, decrements the lock, and appends the just-completed
 * season to the resume. Returns null when a 30-season career retires.
 *
 * @param {object} member the instance carried from last season
 * @param {object} cfg balance config
 * @param {{seasonUid:string, corpsName:string|null, placement:number|null}} [completed]
 *        the season being LEFT, banked onto the resume (omit to skip)
 * @returns {object|null} the aged instance, or null if retired
 */
function ageStaff(member, cfg, completed) {
  const hiredTier = member.hiredTier || member.tier;
  const careerSeasons = (member.careerSeasons || 0) + 1;
  if (careerSeasons >= cfg.staff.career.maxSeasons) return null; // retired

  const tier = tierForCareer(hiredTier, careerSeasons, cfg);
  const prevContract = member.contract || { seasons: 1, remaining: 0 };
  const remaining = Math.max(0, (prevContract.remaining || 0) - 1);
  // Salary stays frozen while the contract lock still has seasons left; it
  // floats up to the current tenured rate once the lock lapses.
  const salaryPerSeason =
    remaining > 0 ? member.salaryPerSeason : salaryFor(tier, careerSeasons, cfg);

  const cap = cfg.staff.career.resumeCap || 30;
  const resume = completed
    ? [
        ...(member.resume || []).slice(-(cap - 1)),
        {
          seasonUid: completed.seasonUid,
          corpsName: completed.corpsName || null,
          placement: completed.placement ?? null,
        },
      ]
    : member.resume || [];

  const aged = {
    ...member,
    hiredTier,
    careerSeasons,
    tier,
    boost: boostFor(tier, cfg),
    salaryPerSeason,
    contract: { seasons: prevContract.seasons || 1, remaining },
    resume,
  };
  delete aged.retrain; // the learning curve ended with the old season
  return aged;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

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
    // the retrain happened in.
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
  HIRABLE_TIERS,
  boostFor,
  tierForCareer,
  salaryFor,
  buildCatalog,
  mintStaff,
  ageStaff,
  staffYieldMultiplier,
  tourStaminaReduction,
};
