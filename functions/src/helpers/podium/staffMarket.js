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

/**
 * Project next season's payroll for a stored roster and decide who a given
 * budget can retain. Pure — mirrors the re-registration retention loop
 * (ageStaff + greedy debit) WITHOUT mutating anything, so the client can show
 * the "your CorpsCoin won't cover payroll — pick who to keep" preview before
 * the director commits, and the register callable can reuse the SAME decision
 * so the preview and the authoritative outcome never disagree (design §5.6).
 *
 * Each carried staffer is aged one season (tenure raises tier/boost; a lapsed
 * salary lock floats the salary up to the current tenured rate). A 30-season
 * career retires and drops off at zero cost — neither a keep nor a loss the
 * director chose. Retention is greedy in `keepOrder`: the director's priority
 * decides WHO lapses when the budget falls short. A roster specialty absent
 * from a provided `keepOrder` is treated as a voluntary release (dropped to
 * leave budget for food/travel), so the same list expresses both "keep these,
 * in this order" and "let these go".
 *
 * @param {object} roster        state.staff — { specialty: member }
 * @param {number} budget        CorpsCoin available for payroll (the commitment)
 * @param {object} cfg           balance config
 * @param {string[]} [keepOrder] specialties in keep-priority order; when
 *                               omitted, every staffer is a keep candidate,
 *                               ordered priciest-first so a shortfall sheds the
 *                               cheapest staffer rather than an arbitrary one.
 * @returns {{
 *   staff: Array<{specialty:string, id:string|null, tier:string,
 *                 nextTier:string|null, salary:number, nextSalary:number,
 *                 retiring:boolean, kept:boolean, lapseReason:string|null}>,
 *   payroll:number, kept:string[], lapsed:string[], affordable:boolean
 * }}
 */
function projectRetention(roster, budget, cfg, keepOrder) {
  const staff = Object.values(roster || {})
    .filter((m) => m && m.specialty)
    .map((member) => {
      const next = ageStaff(member, cfg); // no `completed`: numbers only, no resume row
      return {
        specialty: member.specialty,
        id: member.id || null,
        tier: member.tier,
        salary: member.salaryPerSeason || 0,
        retiring: next === null,
        nextTier: next ? next.tier : null,
        nextSalary: next ? next.salaryPerSeason : 0,
        kept: false,
        lapseReason: null,
      };
    });

  const bySpecialty = new Map(staff.map((s) => [s.specialty, s]));
  const active = staff.filter((s) => !s.retiring);
  // Candidate order: an explicit keepOrder in the director's order; otherwise
  // every active staffer, priciest-first.
  const ordered = Array.isArray(keepOrder)
    ? keepOrder.map((sp) => bySpecialty.get(sp)).filter((s) => s && !s.retiring)
    : [...active].sort((a, b) => b.nextSalary - a.nextSalary);
  const candidates = new Set(ordered.map((s) => s.specialty));

  let remaining = Math.max(0, budget || 0);
  const kept = [];
  const lapsed = [];
  for (const s of ordered) {
    if (s.nextSalary <= remaining) {
      remaining -= s.nextSalary;
      s.kept = true;
      kept.push(s.specialty);
    } else {
      s.lapseReason = "unaffordable";
      lapsed.push(s.specialty);
    }
  }
  // Active roster staff the director left out of keepOrder: voluntary releases.
  for (const s of active) {
    if (!candidates.has(s.specialty)) {
      s.lapseReason = "released";
      lapsed.push(s.specialty);
    }
  }
  for (const s of staff) {
    if (s.retiring) s.lapseReason = "retired";
  }

  const payroll = active.reduce((sum, s) => sum + s.nextSalary, 0);
  return { staff, payroll, kept, lapsed, affordable: payroll <= Math.max(0, budget || 0) };
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
  projectRetention,
  staffYieldMultiplier,
  tourStaminaReduction,
};
