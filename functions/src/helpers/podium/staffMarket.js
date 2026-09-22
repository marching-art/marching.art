/**
 * Podium staff — a generic, always-available labor catalog with per-hire
 * careers. Supply scales with the playerbase instead of a scarce shared
 * pool: a director never claims a pre-made person, the catalog offers a ROLE
 * (specialty) at an ENTRY experience level, and hiring MINTS a staff instance
 * owned by that corps. The instance keeps a stable id, its tenure, and its
 * resume for the rest of its career. A staffer never leaves for another corps:
 * they stay until released, unaffordable, or retired.
 *
 * EARN experience by RETAINING (the whole game):
 *   - Only entry tiers (apprentice, journeyman) are hireable. Veteran ->
 *     Master -> Legend are reached SOLELY by keeping a staffer across seasons
 *     (promotionSeasons) — a Legend is proof you kept them ~22 seasons, never
 *     something bought off the shelf.
 *   - Each retained season ages the instance one year: the tenure floor
 *     raises its tier (and boost), and its salary escalates
 *     (base x (1 + tenureSalaryPerSeason x min(careerSeasons,
 *     tenureSalaryCapSeasons))). Tier bases are proportional to the boost
 *     each tier yields, and the tenure premium stops growing once a career
 *     reaches the legend threshold, so a veteran costs the same per boost
 *     point as an apprentice plus a bounded experience premium — loyalty is
 *     never punished by a runaway bill.
 *   - CONTRACTS lock the salary for their length (a hedge against tenure
 *     inflation and the promotion raises at 3/8/15/22 seasons). Once the lock
 *     lapses the salary floats to the current tenured rate — and the director
 *     may RE-SIGN the staffer at that rate for another 1-3 seasons at the next
 *     re-registration (renewContract). Renewal is only offered on a lapsed
 *     lock, so a signed price can never be rolled forward indefinitely.
 *   - A contract binds both ways: releasing a still-locked staffer costs a
 *     BUYOUT (buyoutPremium x salary x unexpired seasons), in season or at the
 *     season boundary. A staffer is retained automatically each season the
 *     corps can pay their salary from the fresh Corps Budget; an unaffordable
 *     season lapses the contract (released, never a debt, never a buyout),
 *     and a 30-season career ends in retirement.
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

/**
 * Tenure-escalated per-season salary. The tenure premium grows per season up
 * to `tenureSalaryCapSeasons` (the legend threshold) and then holds, so a
 * legend's price is a ceiling, not a treadmill.
 */
function salaryFor(tier, careerSeasons, cfg) {
  const base = cfg.staff.tiers[tier].salary;
  const cap = cfg.staff.career.tenureSalaryCapSeasons;
  const seasons =
    Number.isFinite(cap) && cap >= 0 ? Math.min(careerSeasons, cap) : careerSeasons;
  return Math.round(base * (1 + cfg.staff.career.tenureSalaryPerSeason * seasons));
}

/**
 * The next tier a career will reach by tenure alone, and the season it lands
 * — null once the staffer is at the top of the ladder (or their hired tier
 * already outranks every remaining floor).
 * @returns {{tier:string, atSeason:number, seasonsAway:number}|null}
 */
function nextPromotion(member, cfg) {
  const currentRank = TIER_ORDER.indexOf(member.tier || member.hiredTier || "apprentice");
  const careerSeasons = member.careerSeasons || 0;
  let best = null;
  for (const [tier, seasons] of Object.entries(cfg.staff.career.promotionSeasons)) {
    if (TIER_ORDER.indexOf(tier) <= currentRank) continue;
    if (best === null || seasons < best.atSeason) {
      best = { tier, atSeason: seasons, seasonsAway: Math.max(0, seasons - careerSeasons) };
    }
  }
  return best;
}

/**
 * Seasons this staffer has left before their career retires (the season
 * being played counts as one of them). 0 means this is their final season.
 */
function seasonsUntilRetirement(member, cfg) {
  return Math.max(0, cfg.staff.career.maxSeasons - 1 - (member.careerSeasons || 0));
}

/**
 * The buyout owed to release a still-contracted staffer: the contract premium
 * on every locked season the corps walks away from. In season, the current
 * season's salary is already paid so only the seasons beyond it are owed;
 * at the season boundary (a re-registration release) every remaining locked
 * season is unexpired. 0 once the lock has lapsed.
 *
 * @param {object} member the instance as stored (in season) or as aged by
 *        ageStaff (at the boundary — its `remaining` already counts the
 *        season being registered)
 * @param {object} cfg balance config
 * @param {{atBoundary?: boolean}} [opts]
 */
function buyoutFor(member, cfg, { atBoundary = false } = {}) {
  const remaining = (member && member.contract && member.contract.remaining) || 0;
  const unexpired = atBoundary ? remaining : Math.max(0, remaining - 1);
  if (unexpired <= 0) return 0;
  const premium = cfg.staff.career.buyoutPremium || 0;
  return Math.round((member.salaryPerSeason || 0) * premium * unexpired);
}

/**
 * Re-sign a staffer whose salary lock has lapsed (pure): a fresh 1-N season
 * lock at their CURRENT tenured salary. Only a lapsed lock (remaining 0) is
 * renewable — renewing mid-lock would let a signed price roll forward
 * forever. Called on the AGED instance at re-registration, so the frozen
 * rate is next season's floated rate and the lock counts that season.
 * Returns null when the staffer is not renewable.
 */
function renewContract(member, seasons, cfg) {
  const max = cfg.staff.career.maxContractSeasons;
  if (!member || !Number.isInteger(seasons) || seasons < 1 || seasons > max) return null;
  if (member.contract && member.contract.remaining > 0) return null;
  return { ...member, contract: { seasons, remaining: seasons } };
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
 * Contracts bind both ways. A voluntarily released staffer whose lock still
 * has seasons left owes a BUYOUT, charged from the commitment BEFORE payroll
 * (an obligation, not a choice). An unaffordable lapse never owes one. A kept
 * staffer whose lock has lapsed may be RE-SIGNED via `renewals`
 * ({specialty: seasons}): the projection reports `renewable` and, when a valid
 * renewal is requested, `renewSeasons` — the callable applies it with
 * renewContract on the aged instance.
 *
 * @param {object} roster        state.staff — { specialty: member }
 * @param {number} budget        CorpsCoin available for payroll (the commitment)
 * @param {object} cfg           balance config
 * @param {string[]} [keepOrder] specialties in keep-priority order; when
 *                               omitted, every staffer is a keep candidate,
 *                               ordered priciest-first so a shortfall sheds the
 *                               cheapest staffer rather than an arbitrary one.
 * @param {Record<string, number>} [renewals] contract lengths to re-sign, by
 *                               specialty; ignored for staff who are not
 *                               renewable (still locked, retiring, released).
 * @returns {{
 *   staff: Array<{specialty:string, id:string|null, tier:string,
 *                 nextTier:string|null, salary:number, nextSalary:number,
 *                 contract:{seasons:number, remaining:number}|null, locked:boolean,
 *                 renewable:boolean, renewSeasons:number|null, buyout:number,
 *                 retiring:boolean, kept:boolean, lapseReason:string|null}>,
 *   payroll:number, buyoutTotal:number, kept:string[], lapsed:string[],
 *   renewed:string[], affordable:boolean
 * }}
 */
function projectRetention(roster, budget, cfg, keepOrder, renewals) {
  const staff = Object.values(roster || {})
    .filter((m) => m && m.specialty)
    .map((member) => {
      const next = ageStaff(member, cfg); // no `completed`: numbers only, no resume row
      // Contract lock as it stands NEXT season: ageStaff decrements the lock and
      // holds the salary while seasons remain, so `remaining > 0` is exactly the
      // condition under which nextSalary is the frozen contract rate rather than
      // the floated tenured rate. Surfacing it lets the re-registration screen
      // show a still-contracted staffer as locked-at-their-original-price
      // instead of a bare keep/drop with no explanation for the held cost.
      const nextContract = next && next.contract ? next.contract : null;
      const locked = Boolean(nextContract && nextContract.remaining > 0);
      return {
        specialty: member.specialty,
        id: member.id || null,
        tier: member.tier,
        salary: member.salaryPerSeason || 0,
        retiring: next === null,
        nextTier: next ? next.tier : null,
        nextSalary: next ? next.salaryPerSeason : 0,
        // The lock's length and how many of those seasons (including the one
        // being registered) are still held. null once the staffer retires.
        contract: nextContract
          ? { seasons: nextContract.seasons || 0, remaining: nextContract.remaining || 0 }
          : null,
        locked,
        // A lapsed lock on a still-active career can be re-signed at the
        // floated rate; the premium owed if a locked staffer is let go now.
        renewable: Boolean(next) && !locked,
        renewSeasons: null,
        buyout: next && locked ? buyoutFor(next, cfg, { atBoundary: true }) : 0,
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

  // Voluntary releases (active roster staff the director left out of
  // keepOrder) are settled first: a buyout on a still-locked contract is an
  // obligation the commitment must cover before it funds anyone's salary.
  const lapsed = [];
  let buyoutTotal = 0;
  for (const s of active) {
    if (!candidates.has(s.specialty)) {
      s.lapseReason = "released";
      lapsed.push(s.specialty);
      buyoutTotal += s.buyout;
    }
  }

  let remaining = Math.max(0, (budget || 0) - buyoutTotal);
  const kept = [];
  const renewed = [];
  const maxSeasons = cfg.staff.career.maxContractSeasons;
  for (const s of ordered) {
    if (s.nextSalary <= remaining) {
      remaining -= s.nextSalary;
      s.kept = true;
      kept.push(s.specialty);
      const want = renewals && renewals[s.specialty];
      if (s.renewable && Number.isInteger(want) && want >= 1 && want <= maxSeasons) {
        s.renewSeasons = want;
        renewed.push(s.specialty);
      }
    } else {
      s.lapseReason = "unaffordable";
      lapsed.push(s.specialty);
    }
  }
  for (const s of staff) {
    if (s.retiring) s.lapseReason = "retired";
  }

  const payroll = active.reduce((sum, s) => sum + s.nextSalary, 0);
  return {
    staff,
    payroll,
    buyoutTotal,
    kept,
    lapsed,
    renewed,
    affordable: payroll <= Math.max(0, budget || 0),
  };
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
  nextPromotion,
  seasonsUntilRetirement,
  buyoutFor,
  renewContract,
  buildCatalog,
  mintStaff,
  ageStaff,
  projectRetention,
  staffYieldMultiplier,
  tourStaminaReduction,
};
