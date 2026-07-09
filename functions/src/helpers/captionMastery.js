// Caption mastery v1 (WS5.5) — lifetime per-caption craft progression.
//
// Every scored show accumulates each lineup caption's (capped) points into
// the profile's server-only `captionStats.{caption}` counters (written as
// FieldValue.increments in commitDailyScoring, so repeat runs are guarded by
// the scoring-run lease like every other award). Mastery tiers are derived
// lazily from those counters at display time — nothing is stored beyond the
// raw lifetime points, so tier thresholds can be rebalanced freely.
//
// Pure module (no firebase imports): the vitest client-mirror test imports
// it directly and fails CI if src/utils/captionMastery.js drifts.
//
// Scale: a single caption earns up to 20 points per scored show, ~12-18
// typically. An engaged director's corps plays ~25 shows a season, so one
// corps banks roughly 350-450 points per caption per season (more with
// multiple corps). Bronze lands within a first full season; Platinum is a
// multi-year body of work.

const MASTERY_CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const CAPTION_MASTERY_TIERS = [
  { id: "bronze", name: "Bronze", min: 500 },
  { id: "silver", name: "Silver", min: 1500 },
  { id: "gold", name: "Gold", min: 4000 },
  { id: "platinum", name: "Platinum", min: 10000 },
];

/**
 * Resolve lifetime caption points to a mastery state.
 * @returns {{ points: number, tier: Object|null, next: Object|null, progress: number }}
 *   tier: highest tier reached (null below Bronze); next: the tier being
 *   worked toward (null at Platinum); progress: 0..1 toward `next` measured
 *   from the previous threshold.
 */
function getCaptionMastery(rawPoints) {
  const points = Math.max(0, Number(rawPoints) || 0);
  let tier = null;
  let next = CAPTION_MASTERY_TIERS[0];
  for (const t of CAPTION_MASTERY_TIERS) {
    if (points >= t.min) tier = t;
  }
  const tierIndex = tier ? CAPTION_MASTERY_TIERS.indexOf(tier) : -1;
  next = CAPTION_MASTERY_TIERS[tierIndex + 1] || null;
  const floor = tier ? tier.min : 0;
  const progress = next ? Math.min(1, (points - floor) / (next.min - floor)) : 1;
  return { points, tier, next, progress };
}

module.exports = {
  MASTERY_CAPTIONS,
  CAPTION_MASTERY_TIERS,
  getCaptionMastery,
};
