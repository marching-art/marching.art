/**
 * Podium divisions — the three-class rise (design §5.7, decision 26).
 *
 * A Class → Open Class → World Class, the FMA progression players loved:
 * every corps starts in A, climbs on results, and the field re-seats at
 * every season boundary from PUBLISHED, formula-derived cutoffs — never a
 * hand-picked list.
 *
 * The rules, exactly as decided:
 *   - Everyone's first season is A Class. Promotion is one division per
 *     season, earned by finishing at/above the next division's cutoff.
 *   - Cutoffs are percentiles of the veteran pool's finals totals
 *     (population-balanced thirds by default), recomputed each boundary and
 *     published with the season archive. Higher divisions only form once
 *     the pool can sustain them (minPool gates).
 *   - Demotion is slow, like old DCI: a corps that finishes below its
 *     division's cutoff keeps its seat for one grace season; a second
 *     consecutive below-cutoff season drops it ONE division. Hitting the
 *     cutoff again resets the clock.
 *   - Absence: one missed season is grace (seat kept). Beyond that a returning
 *     corps re-enters at the division its DECAYED reputation supports — a
 *     gradual erosion by time away (§5.13 dormancy decay), NOT a hard reset to
 *     A. A champion who takes a season or two off comes back near the top; only
 *     a long absence, having decayed reputation all the way down, re-enters low.
 *
 * Divisions group and award — they never touch the scoring engine.
 * Reputation tiers (§5.13) remain the only ceiling mechanism.
 */

const DIVISIONS = ["aClass", "openClass", "worldClass"]; // ascending
const DIVISION_LABELS = {
  aClass: "A Class",
  openClass: "Open Class",
  worldClass: "World Class",
};

function divisionRank(division) {
  const index = DIVISIONS.indexOf(division);
  return index === -1 ? 0 : index;
}

function normalizeDivision(division) {
  return DIVISIONS.includes(division) ? division : "aClass";
}

/** Nearest-rank percentile of a sorted-ascending score array. */
function percentileValue(sortedScores, percentile) {
  if (sortedScores.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sortedScores.length);
  return sortedScores[Math.min(sortedScores.length, Math.max(1, rank)) - 1];
}

/**
 * The highest division a given (already dormancy-decayed) reputation supports.
 * Reputation is the persistent career-strength measure that erodes with time
 * away, so a returning corps' seat degrades WITH it rather than by a season
 * count. Thresholds are reputation-tier gates (cfg.divisions.reentryMinRepTier)
 * read against the reputation ladder (cfg.reputation.tierThresholds). Pure.
 */
function divisionForReputation(reputation, cfg) {
  const thresholds = cfg.reputation.tierThresholds;
  const gates = cfg.divisions.reentryMinRepTier || { worldClass: 5, openClass: 3 };
  const rep = reputation || 0;
  if (rep >= (thresholds[String(gates.worldClass)] ?? Infinity)) return "worldClass";
  if (rep >= (thresholds[String(gates.openClass)] ?? Infinity)) return "openClass";
  return "aClass";
}

/**
 * The division a corps registers into this season, given its career, how many
 * seasons it missed, and its current (already dormancy-decayed) reputation.
 * Within the grace window the seat is kept outright; beyond it, the corps
 * re-enters at the division its decayed reputation supports — never above the
 * seat it last held. Pure.
 */
function divisionForRegistration(careerData, missedSeasons, cfg, reputation) {
  const last = normalizeDivision(careerData && careerData.division);
  const grace = cfg.divisions.demotionGraceSeasons ?? 1;
  if (!missedSeasons || missedSeasons <= grace) return last;
  if (reputation == null) return last;
  const repCap = divisionForReputation(reputation, cfg);
  return DIVISIONS[Math.min(divisionRank(last), divisionRank(repCap))];
}

/**
 * Season-boundary assessment (pure). `pool` is every corps swept from the
 * just-ended season: { uid, division, finalsTotal, underCutoffSeasons }.
 * Returns published cutoffs plus each corps' next-season seat.
 */
function assessDivisions(pool, cfg) {
  const rules = cfg.divisions;
  const scored = pool.filter((entry) => entry.finalsTotal != null);
  const scores = scored.map((entry) => entry.finalsTotal).sort((a, b) => a - b);

  // Cutoffs from the whole veteran pool — one published number per seat.
  // Higher divisions form only when the pool can sustain them.
  const openActive = scores.length >= rules.minPoolForOpen;
  const worldActive = scores.length >= rules.minPoolForWorld;
  const cutoffs = {
    openClass: openActive ? percentileValue(scores, rules.cutoffPercentiles.openClass) : null,
    worldClass: worldActive ? percentileValue(scores, rules.cutoffPercentiles.worldClass) : null,
  };

  const provisionalFor = (finalsTotal) => {
    if (finalsTotal == null) return "aClass";
    if (cutoffs.worldClass != null && finalsTotal >= cutoffs.worldClass) return "worldClass";
    if (cutoffs.openClass != null && finalsTotal >= cutoffs.openClass) return "openClass";
    return "aClass";
  };

  const next = {};
  for (const entry of pool) {
    const current = normalizeDivision(entry.division);
    const provisional = provisionalFor(entry.finalsTotal);
    const currentRank = divisionRank(current);
    const provisionalRank = divisionRank(provisional);
    let division = current;
    let underCutoffSeasons = 0;
    if (provisionalRank > currentRank) {
      // Earned the seat above: rise exactly one division (the FMA climb —
      // no corps skips Open on the way to World).
      division = DIVISIONS[currentRank + 1];
    } else if (provisionalRank < currentRank) {
      // Below the seat: grace first, then a one-division drop — DCI kept
      // corps in World until they fell out of competitive comparity.
      underCutoffSeasons = (entry.underCutoffSeasons || 0) + 1;
      if (underCutoffSeasons > rules.demotionGraceSeasons) {
        division = DIVISIONS[currentRank - 1];
        underCutoffSeasons = 0;
      }
    }
    next[entry.uid] = { division, underCutoffSeasons };
  }

  const counts = { aClass: 0, openClass: 0, worldClass: 0 };
  for (const seat of Object.values(next)) counts[seat.division] += 1;

  return { cutoffs, next, counts };
}

module.exports = {
  DIVISIONS,
  DIVISION_LABELS,
  divisionRank,
  normalizeDivision,
  percentileValue,
  divisionForReputation,
  divisionForRegistration,
  assessDivisions,
};
