/**
 * Podium callable input validators, split from callable/podium.js for
 * file-size hygiene. Pure request-shape/argument validation only — no
 * Firestore reads or writes happen here; transactional checks stay with the
 * callables. Covered directly by podium.test.js.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");
const staffMarket = require("../helpers/podium/staffMarket");

const AUDITION_POOL = 100;

/**
 * Validate a CorpsCoin -> Corps Budget commitment amount against the
 * division-equal cap (decision 24). `alreadyCommitted` enforces the
 * cumulative cap for mid-season top-ups; the cap scales with the corps'
 * division seat (a World budget fields World staff payrolls).
 */
function validateCommitment(amount, alreadyCommitted, division) {
  if (amount == null || amount === 0) return 0;
  if (!Number.isInteger(amount) || amount < 0) {
    throw new HttpsError("invalid-argument", "Budget commitment must be a non-negative integer.");
  }
  const byDivision = store.balance.budget.commitmentCapByDivision || {};
  const cap = byDivision[division] || store.balance.budget.commitmentCap;
  if (alreadyCommitted + amount > cap) {
    throw new HttpsError(
      "invalid-argument",
      `Budget commitments are capped at ${cap} CC per season for your division ` +
        `(already committed: ${alreadyCommitted}).`
    );
  }
  return amount;
}

/**
 * Validate an optional staff keep-priority list: the specialties the director
 * wants to retain next season, in keep-first order (design §5.6, the funding
 * decision). Deduped and filtered to real specialties. A staffer omitted from
 * a provided list is a voluntary release; when the list is absent entirely the
 * roster is kept priciest-first and a shortfall sheds the cheapest. Returns
 * undefined when absent so downstream code can tell "keep all" from "keep none".
 */
function validateStaffPriority(value) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "staffPriority must be an array of specialties.");
  }
  const seen = new Set();
  const order = [];
  for (const specialty of value) {
    if (typeof specialty === "string" && staffMarket.SPECIALTIES.includes(specialty) && !seen.has(specialty)) {
      seen.add(specialty);
      order.push(specialty);
    }
  }
  return order;
}

/** Validate a challenge map: all 8 captions, integers 1-8. Returns normalized copy. */
function validateChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new HttpsError("invalid-argument", "Challenge levels are required.");
  }
  const normalized = {};
  for (const caption of engine.CAPTIONS) {
    const level = challenge[caption];
    if (!Number.isInteger(level) || level < 1 || level > 8) {
      throw new HttpsError("invalid-argument", `Challenge for ${caption} must be an integer 1-8.`);
    }
    normalized[caption] = level;
  }
  return normalized;
}

/**
 * Validate an audition allocation: non-negative integers per caption summing
 * to at most AUDITION_POOL. Returns per-caption shares for the engine
 * (undefined when the director skipped the step — even distribution).
 */
function validateAuditions(auditions) {
  if (auditions == null) return undefined;
  if (typeof auditions !== "object") {
    throw new HttpsError("invalid-argument", "Auditions must be a points-per-caption object.");
  }
  let total = 0;
  const points = {};
  for (const caption of engine.CAPTIONS) {
    const value = auditions[caption] ?? 0;
    if (!Number.isInteger(value) || value < 0) {
      throw new HttpsError("invalid-argument", `Audition points for ${caption} must be a non-negative integer.`);
    }
    points[caption] = value;
    total += value;
  }
  if (total === 0) return undefined;
  if (total > AUDITION_POOL) {
    throw new HttpsError("invalid-argument", `Audition points exceed the pool of ${AUDITION_POOL}.`);
  }
  const shares = {};
  for (const caption of engine.CAPTIONS) shares[caption] = points[caption] / total;
  return shares;
}

/**
 * Validate a week's self-selected SHOW picks against the pick budget and the
 * schedule. Podium now registers for a specific show (like fantasy), one per
 * night; majors and championship week are auto-attended and never selectable.
 *
 * `division`/`easternAssignments` make the auto-day set division-correct and
 * match the client's locked days — without them a World corps' Championship
 * day 49 and the published Eastern night would be computed with A Class /
 * hash-parity fallbacks and reject picks the client shows as valid.
 * `scheduleShowsByDay` ({ [day]: [{eventName, location}] }) lets the server
 * confirm each picked eventName is actually on the schedule that day and
 * resolve its authoritative location (the client's location is never trusted).
 *
 * @returns {{ [day:number]: { eventName: string, location: string } }} normalized picks
 */
function validateShowPicks(
  week,
  shows,
  uid,
  seasonUid,
  currentCompetitionDay,
  { division, easternAssignments, scheduleShowsByDay = {} } = {}
) {
  if (!Number.isInteger(week) || week < 1 || week > 7) {
    throw new HttpsError("invalid-argument", "Week must be 1-7.");
  }
  if (!Array.isArray(shows)) {
    throw new HttpsError("invalid-argument", "Shows must be an array.");
  }
  const maxPicks = store.maxPicksForWeek(week);
  const autoDays = store.autoDaysFor(uid, seasonUid, { division, easternAssignments });
  const byDay = {};
  for (const pick of shows) {
    const day = pick && pick.day;
    const eventName = typeof (pick && pick.eventName) === "string" ? pick.eventName.trim() : "";
    if (!Number.isInteger(day) || Math.ceil(day / 7) !== week) {
      throw new HttpsError("invalid-argument", `Day ${day} is not in week ${week}.`);
    }
    if (store.CHAMPIONSHIP_WEEK_DAYS.includes(day)) {
      throw new HttpsError("invalid-argument", `Day ${day} is Championship Week (auto-attended) and not selectable.`);
    }
    if (autoDays.includes(day) || store.EASTERN_DAYS.includes(day)) {
      throw new HttpsError("invalid-argument", `Day ${day} is auto-attended (major/championship) and not selectable.`);
    }
    // Strictly-before only: the current competition day's show is still open
    // (it scores at the 2 AM ET run the next day, when currentCompetitionDay
    // advances), matching the fantasy show-registration deadline.
    if (day < currentCompetitionDay) {
      throw new HttpsError("invalid-argument", `Day ${day} has already passed.`);
    }
    if (!eventName) {
      throw new HttpsError("invalid-argument", `A show must be chosen for day ${day}.`);
    }
    // The picked show must actually be on the schedule that day.
    const dayList = scheduleShowsByDay[day] || [];
    const match = dayList.find((s) => s.eventName === eventName);
    if (!match) {
      throw new HttpsError("invalid-argument", `"${eventName}" is not a scheduled show on day ${day}.`);
    }
    // One show per night — a later pick for the same day replaces the earlier.
    byDay[day] = { eventName, location: match.location || "" };
  }
  if (Object.keys(byDay).length > maxPicks) {
    throw new HttpsError("invalid-argument", `Week ${week} allows at most ${maxPicks} selected shows.`);
  }
  return byDay;
}

// The assistant director keeps a plan per day TYPE (design §5.2): `rehearsal`
// is the full-grind default, `show` the lighter pre-performance routine, and
// `springTraining` the install-heavy camp plan — each run by the nightly
// autoplay on the matching unplayed day. `rehearsal` writes the legacy
// `planTemplate` field so existing corps are untouched.
const PLAN_FIELD_BY_TYPE = {
  rehearsal: "planTemplate",
  show: "showDayPlan",
  springTraining: "springTrainingPlan",
};

// A plan may hold at most the blocks its matching day type actually runs
// (§6.1): 12 on a rehearsal day, 8 on a show day, 20 in spring training. The
// nightly autoplay clamps to this anyway (processor.js), but capping here keeps
// the assistant-director editor honest instead of accepting blocks that would
// never run. Read from balanceConfig so a Phase 8 re-tune stays in one place.
function maxBlocksForPlanType(planType) {
  const cfg = store.balance.rehearsal;
  if (planType === "show") return cfg.blocksOnShowDay;
  if (planType === "springTraining") return cfg.blocksPerDaySpringTraining;
  return cfg.blocksPerDay;
}

module.exports = {
  validateCommitment,
  validateStaffPriority,
  validateChallenge,
  validateAuditions,
  validateShowPicks,
  maxBlocksForPlanType,
  PLAN_FIELD_BY_TYPE,
};
