/**
 * Podium season-start assessment (design §5.7 + §5.13).
 *
 * At every season boundary each corps is evaluated against the directors it
 * actually competed with the season before, and that evaluation decides how it
 * STARTS the new season. It is the deepest reward moment in the game — "how good
 * a job did I do, and where do I stand now?" — so it is built as one explicit,
 * surfaced object rather than left implicit in scattered reputation/division
 * writes.
 *
 * Three independent dimensions, each earned, each published:
 *
 *   1. CLASS — the A → Open → World division (divisions.js, §5.7). Peer-relative
 *      by construction: your class is set by where your finals total landed
 *      against the veteran pool's published cutoffs. Promotion/relegation is one
 *      step per season.
 *   2. STATUS — the seven-tier reputation ladder (Community Corps → Champion
 *      Status, engine.js, §5.13). The long multi-season climb; earned ONLY from
 *      competitive results relative to your own tier, decaying when you coast or
 *      sit out. Gates your scoring ceiling.
 *   3. ACTIVITY — a SEPARATE engagement rating (this module). It recognizes how
 *      hard the director worked the season relative to the field, and it NEVER
 *      moves reputation — the §5.13 covenant is that status is results-only, not
 *      activity. Activity is its own surfaced honor (and small recognition
 *      reward), so an "Iron Corps" director is celebrated without reintroducing
 *      FMA's compounding "influence" stat.
 *
 * Everything here is pure: given a corps' finished state, its career before/after
 * the season, and the field it competed in, it returns the assessment object the
 * archival sweep persists and the between-seasons screen renders. No IO.
 */

const engine = require("./engine");
const divisions = require("./divisions");

// The seven named reputation tiers (§5.13). The organizational-level / status
// ladder every corps climbs. Mirrors the client's REP_TIER_NAMES so the backend
// can name the status in the assessment it publishes.
const REP_TIER_NAMES = Object.freeze({
  1: "Community Corps",
  2: "Regional Contender",
  3: "National Contender",
  4: "Finalist",
  5: "Medalist",
  6: "Elite",
  7: "Champion Status",
});

/** The named tier label for a numeric reputation tier (1-7). */
function tierLabel(tier) {
  return REP_TIER_NAMES[tier] || REP_TIER_NAMES[1];
}

// ---------------------------------------------------------------------------
// Activity rating — the separate engagement axis.
// ---------------------------------------------------------------------------

/** An empty per-season activity accumulator (the shape the processor writes). */
function initActivity() {
  return {
    activeDays: 0, // days the director personally rehearsed or declared rest
    autoRunDays: 0, // days the assistant director ran the plan (no login)
    restDays: 0, // rest days the director declared
    blocksAllocated: 0, // total rehearsal blocks the director allocated
    showsAttended: 0, // scored show days the corps competed in
    lastCountedDay: 0, // guard so each calendar day is counted at most once
  };
}

/**
 * Raw engagement score for one corps' season (pure). Rewards showing up and
 * doing the work; penalizes leaning on the assistant director. Clamped at 0 so a
 * fully-absent corps (all auto-run) floors instead of going negative. This is a
 * RELATIVE quantity — only its rank within the season's field is meaningful, so
 * the absolute number is never shown.
 */
function activityScore(activity, cfg) {
  const a = activity || {};
  const w = cfg.assessment.activity.weights;
  const penalty = cfg.assessment.activity.autoRunPenalty || 0;
  const raw =
    w.activeDays * (a.activeDays || 0) +
    w.restDays * (a.restDays || 0) +
    w.blocksAllocated * (a.blocksAllocated || 0) +
    w.showsAttended * (a.showsAttended || 0) -
    penalty * (a.autoRunDays || 0);
  return Math.max(0, raw);
}

/**
 * Percentile rank (0-100) of `value` within `sortedAsc` — the fraction of the
 * field at or below it, counting ties at half weight (a fair mid-rank). An empty
 * or single-entry field returns 100 (nobody to place you behind). Pure.
 */
function percentileRank(sortedAsc, value) {
  const n = sortedAsc.length;
  if (n <= 1) return 100;
  let below = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return Math.round(((below + 0.5 * equal) / n) * 1000) / 10;
}

/** The named activity tier for a percentile (highest matching threshold). Pure. */
function activityTierFor(percentile, cfg) {
  const tiers = cfg.assessment.activity.tiers;
  let match = tiers[0];
  for (const tier of tiers) {
    if (percentile >= tier.minPercentile) match = tier;
  }
  return { key: match.key, label: match.label };
}

/**
 * Rate the whole field's activity (pure). `pool` is [{ uid, activity }]; returns
 * a Map uid -> { score, percentile, tier, label, recognition }. Recognition is
 * the small coin/XP honor for the top engagement tiers (config-driven, may be
 * absent) — surfaced as a reward, never fed into reputation.
 */
function buildActivityRatings(pool, cfg) {
  const scores = pool.map((entry) => ({ uid: entry.uid, score: activityScore(entry.activity, cfg) }));
  const sortedAsc = scores.map((s) => s.score).sort((a, b) => a - b);
  const recognitionCfg = cfg.assessment.activity.recognition || {};
  const ratings = new Map();
  for (const { uid, score } of scores) {
    const percentile = percentileRank(sortedAsc, score);
    const tier = activityTierFor(percentile, cfg);
    ratings.set(uid, {
      score: Math.round(score * 10) / 10,
      percentile,
      tier: tier.key,
      label: tier.label,
      recognition: recognitionCfg[tier.key] || null,
    });
  }
  return ratings;
}

// ---------------------------------------------------------------------------
// The unified per-corps assessment.
// ---------------------------------------------------------------------------

/** 'promoted' | 'relegated' | 'held' between two divisions. Pure. */
function divisionChangeKind(prev, next) {
  const delta = divisions.divisionRank(next) - divisions.divisionRank(prev);
  if (delta > 0) return "promoted";
  if (delta < 0) return "relegated";
  return "held";
}

/** 'promoted' | 'relegated' | 'held' between two reputation tiers. Pure. */
function tierChangeKind(prevTier, nextTier) {
  if (nextTier > prevTier) return "promoted";
  if (nextTier < prevTier) return "relegated";
  return "held";
}

/**
 * Peer percentile (0-100, higher = better) from a finals placement. Rank 1 of N
 * is 100, rank N is 0. A field of one (or an unranked corps) returns null —
 * there was nobody to stack up against. Pure.
 */
function peerPercentileFromRank(rank, rankOf) {
  if (!rank || !rankOf || rankOf <= 1) return rank ? 100 : null;
  return Math.round(((rankOf - rank) / (rankOf - 1)) * 1000) / 10;
}

/**
 * Build the complete season-start assessment for one corps (pure). Combines the
 * three axes into the single object the sweep persists (career.pendingAssessment)
 * and the between-seasons screen renders BEFORE the director chooses to continue,
 * retire, start new, or un-retire.
 *
 * @param {object} input
 * @param {string} input.seasonUid            season just ended
 * @param {number} input.seasonIndex          global index of the ended season
 * @param {string} input.assessedForSeasonUid the upcoming season this governs
 * @param {object} input.state                finished podium/state (source of truth)
 * @param {number|null} input.reputationBefore reputation entering the ended season
 * @param {number|null} input.reputationAfter  reputation after applySeasonResult
 * @param {number|null} input.finalsPerformance tier-relative perf 0-100 (tierPerformance)
 * @param {string} input.previousDivision      division the corps competed in
 * @param {string} input.nextDivision          assessed division for the new season
 * @param {object|null} input.divisionCutoffs  published Open/World cutoffs
 * @param {object|null} input.activityRating   from buildActivityRatings
 * @param {number} [input.missedSeasons]       dormant seasons before the ended one
 * @param {boolean} [input.heritageApplied]    whether heritage credit accelerated the climb
 * @param {string[]} input.decisions           available decisions for the surface
 * @param {object} cfg                         balance config
 */
function buildAssessment(input, cfg) {
  const {
    seasonUid,
    seasonIndex = null,
    assessedForSeasonUid,
    state,
    reputationBefore = 0,
    reputationAfter = 0,
    finalsPerformance = null,
    previousDivision,
    nextDivision,
    divisionCutoffs = null,
    activityRating = null,
    missedSeasons = 0,
    heritageApplied = false,
    decisions = [],
  } = input;

  const competed = state && state.lastTotal != null;
  const prevDivision = divisions.normalizeDivision(previousDivision || (state && state.division));
  const newDivision = divisions.normalizeDivision(nextDivision);
  const prevTier = engine.tierForReputation(reputationBefore || 0, cfg);
  const newTier = engine.tierForReputation(reputationAfter || 0, cfg);

  return {
    seasonUid,
    seasonIndex,
    assessedForSeasonUid,
    corpsName: (state && state.corpsName) || null,
    competed,

    // How the corps stacked up against its peers last season.
    performance: {
      finalsTotal: (state && state.lastTotal) ?? null,
      finalsDay: (state && state.lastScoredDay) ?? null,
      seasonRank: (state && state.seasonRank) ?? null,
      seasonRankOf: (state && state.seasonRankOf) ?? null,
      // How close to this corps' own tier ceiling it played (drives the climb).
      tierPerformance: finalsPerformance == null ? null : Math.round(finalsPerformance * 10) / 10,
      // Field position 0-100 (higher = better) — the head-to-head peer standing.
      peerPercentile: peerPercentileFromRank(
        state && state.seasonRank,
        state && state.seasonRankOf
      ),
      medals: (state && state.medals) || {},
    },

    // CLASS — the competitive division for the new season.
    class: {
      previous: prevDivision,
      previousLabel: divisions.DIVISION_LABELS[prevDivision],
      next: newDivision,
      nextLabel: divisions.DIVISION_LABELS[newDivision],
      change: divisionChangeKind(prevDivision, newDivision),
      cutoffs: divisionCutoffs,
    },

    // STATUS — the organizational-level / reputation tier for the new season.
    status: {
      previousTier: prevTier,
      previousLabel: tierLabel(prevTier),
      nextTier: newTier,
      nextLabel: tierLabel(newTier),
      change: tierChangeKind(prevTier, newTier),
      reputationBefore: Math.round((reputationBefore || 0) * 10) / 10,
      reputationAfter: Math.round((reputationAfter || 0) * 10) / 10,
      reputationDelta: Math.round(((reputationAfter || 0) - (reputationBefore || 0)) * 10) / 10,
      heritageApplied: Boolean(heritageApplied),
    },

    // ACTIVITY — the separate engagement honor (never moves status).
    activity: activityRating
      ? {
        tier: activityRating.tier,
        label: activityRating.label,
        percentile: activityRating.percentile,
        recognition: activityRating.recognition || null,
      }
      : null,

    // Multi-season context that shaped the numbers above.
    context: {
      seasonsPlayed: (state && state.seasonsPlayed) ?? null,
      missedSeasons: missedSeasons || 0,
      dormancyApplied: (missedSeasons || 0) > 0,
    },

    decisions,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  REP_TIER_NAMES,
  tierLabel,
  initActivity,
  activityScore,
  percentileRank,
  activityTierFor,
  buildActivityRatings,
  divisionChangeKind,
  tierChangeKind,
  peerPercentileFromRank,
  buildAssessment,
};
