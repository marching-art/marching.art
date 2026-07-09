// Client mirror of caption mastery (WS5.5). The lifetime points live in the
// server-only profile field `captionStats.{caption}`, banked nightly by the
// scoring run; tiers here are display-only and captionMastery.test.js fails
// CI if this mirror drifts from functions/src/helpers/captionMastery.js.

export const MASTERY_CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

export const CAPTION_MASTERY_TIERS = [
  { id: 'bronze', name: 'Bronze', min: 500 },
  { id: 'silver', name: 'Silver', min: 1500 },
  { id: 'gold', name: 'Gold', min: 4000 },
  { id: 'platinum', name: 'Platinum', min: 10000 },
];

export const MASTERY_TIER_STYLES = {
  bronze: { text: 'text-orange-400', bar: 'bg-orange-400' },
  silver: { text: 'text-gray-300', bar: 'bg-gray-300' },
  gold: { text: 'text-yellow-500', bar: 'bg-yellow-500' },
  platinum: { text: 'text-cyan-300', bar: 'bg-cyan-300' },
};

/** Mirror of the backend tier resolution — see helpers/captionMastery.js. */
export function getCaptionMastery(rawPoints) {
  const points = Math.max(0, Number(rawPoints) || 0);
  let tier = null;
  for (const t of CAPTION_MASTERY_TIERS) {
    if (points >= t.min) tier = t;
  }
  const tierIndex = tier ? CAPTION_MASTERY_TIERS.indexOf(tier) : -1;
  const next = CAPTION_MASTERY_TIERS[tierIndex + 1] || null;
  const floor = tier ? tier.min : 0;
  const progress = next ? Math.min(1, (points - floor) / (next.min - floor)) : 1;
  return { points, tier, next, progress };
}

/** True once any caption has banked points — gates the profile panel. */
export function hasCaptionStats(captionStats) {
  return MASTERY_CAPTIONS.some((c) => (captionStats?.[c] || 0) > 0);
}
