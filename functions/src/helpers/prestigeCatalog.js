// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Prestige sinks — server-side price catalog (WS5.6).
//
// Pure module (no firebase imports) so the vitest client-mirror test can
// import it directly and fail CI if src/utils/prestige.js drifts.
//
// Retirement plaques dress up a retired-corps card in the gallery; the Hall
// banner puts a champion's message on their season_champions entry. Both are
// purely cosmetic — late-game CorpsCoin sinks for directors who have
// everything, priced above the shop's top shelf (Corps Legend title, 10k).

const PLAQUE_TIERS = {
  bronze: { rank: 1, price: 2500, name: 'Bronze Plaque' },
  silver: { rank: 2, price: 7500, name: 'Silver Plaque' },
  gold: { rank: 3, price: 15000, name: 'Gold Plaque' },
};

const HALL_BANNER_PRICE = 10000;
const HALL_BANNER_MAX_LENGTH = 60;

/**
 * Normalize a champion's banner message: strip control characters, collapse
 * runs of whitespace, trim. Returns null when nothing displayable remains.
 */
function sanitizeBannerMessage(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > HALL_BANNER_MAX_LENGTH) return null;
  return cleaned;
}

module.exports = {
  PLAQUE_TIERS,
  HALL_BANNER_PRICE,
  HALL_BANNER_MAX_LENGTH,
  sanitizeBannerMessage,
};
