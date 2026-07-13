// Client mirror of the prestige-sink catalog (WS5.6). Prices and limits are
// display-only here — the purchaseRetirementPlaque / purchaseHallBanner
// callables validate against functions/src/helpers/prestigeCatalog.js, and
// prestige.test.js fails CI if this mirror drifts from it.

export const PLAQUE_TIERS = {
  bronze: { rank: 1, price: 2500, name: 'Bronze Plaque' },
  silver: { rank: 2, price: 7500, name: 'Silver Plaque' },
  gold: { rank: 3, price: 15000, name: 'Gold Plaque' },
};

export const HALL_BANNER_PRICE = 10000;
export const HALL_BANNER_MAX_LENGTH = 60;

// Presentation for the gallery card badge + purchase modal.
export const PLAQUE_STYLES = {
  bronze: {
    text: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/40',
  },
  silver: {
    text: 'text-secondary',
    bg: 'bg-charcoal-300/10',
    border: 'border-charcoal-300/40',
  },
  gold: {
    text: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/50',
  },
};

/** Tiers a retired corps can still be upgraded to (strictly finer only). */
export function availablePlaqueUpgrades(entry) {
  const currentRank = entry?.plaque ? PLAQUE_TIERS[entry.plaque.tier]?.rank || 0 : 0;
  return Object.entries(PLAQUE_TIERS)
    .filter(([, tier]) => tier.rank > currentRank)
    .map(([id, tier]) => ({ id, ...tier }));
}
