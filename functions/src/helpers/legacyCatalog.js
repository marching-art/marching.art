/**
 * Legacy Endowments — the recurring CorpsCoin sink (server source of truth).
 *
 * WHY THIS EXISTS
 *
 * Every other sink in the game is terminal. Class unlocks (8,500 CC), director
 * titles (18,500), profile frames (12,750) and card themes (16,500) are bought
 * once and owned forever — about 56,250 CC of total inventory. Plaques and Hall
 * banners are gated on retiring a corps or winning a championship, and the only
 * true consumable is the 300 CC streak freeze.
 *
 * An active World Class director earns 800–1,200 CC/week
 * (GAMIFICATION.md "Faucets"), so the entire purchasable catalog is exhausted in
 * roughly 11–16 months. After that, 100% of income is dead surplus, forever —
 * and that lands on the most-retained cohort in a game whose whole premise is a
 * decades-long director career. The faucets are perpetual; the sinks were not.
 *
 * THE DESIGN TEST
 *
 * GAMIFICATION.md: "does it feed the Career? XP that vanishes into an odometer
 * fails; XP that advances your season ladder and stamps a line in your
 * biography passes." An endowment converts surplus coin into a permanent, dated
 * line in the director's record and a cumulative legacy total that never caps.
 * Repeatable forever, so the sink cannot be exhausted; purely commemorative, so
 * it can never become pay-to-win — which matters especially here, because CC is
 * earned by playing and any advantage bought with it would be grind-to-win.
 *
 * Pure module (no firebase imports) so the vitest client-mirror test can import
 * it directly and fail CI if src/utils/legacy.js drifts. Same contract as
 * prestigeCatalog.js.
 */

/**
 * Endowment tiers. Each is repeatable — a director may fund as many music
 * libraries as they like, and each one adds its full amount to the legacy total.
 *
 * Prices are anchored to weeks of surplus income at ~1,000 CC/week, and start
 * above the shop's top shelf (the 10,000 CC Corps Legend title) because this is
 * where coin goes once the shop is finished: ~5 weeks at the entry tier to ~100
 * weeks at the top. Ordered cheapest-first; `rank` is display order.
 */
/**
 * @typedef {Object} EndowmentTier
 * @property {number} rank - Display order, cheapest first.
 * @property {number} price - CorpsCoin cost.
 * @property {string} name
 */

/** @type {Record<string, EndowmentTier>} */
const ENDOWMENT_TIERS = {
  music_library: { rank: 1, price: 5000, name: "Music Library Fund" },
  instrument_fund: { rank: 2, price: 12500, name: "Instrument Endowment" },
  tour_fund: { rank: 3, price: 25000, name: "Tour Fund" },
  scholarship: { rank: 4, price: 50000, name: "Marcher Scholarship" },
  facility: { rank: 5, price: 100000, name: "Rehearsal Facility" },
};

/**
 * Milestone titles granted at cumulative legacy thresholds, ascending.
 *
 * These are the progression the endowments feed, and the reason the sink holds
 * a director's interest for years rather than weeks: at ~400 CC/week of surplus
 * directed here, Cornerstone is roughly a twelve-year goal and Founding Legacy
 * is a career's work. Each id must also exist in shopCatalog.js as a grantOnly
 * title — that is what lets the existing equip flow display it.
 */
/**
 * @typedef {Object} LegacyTitle
 * @property {number} threshold - Cumulative total at which the title is earned.
 * @property {string} itemId - Must also exist in shopCatalog.js as grantOnly.
 * @property {string} name
 */

/** @type {LegacyTitle[]} */
const LEGACY_TITLES = [
  { threshold: 5000, itemId: "title_legacy_patron", name: "Patron" },
  { threshold: 25000, itemId: "title_legacy_benefactor", name: "Benefactor" },
  { threshold: 100000, itemId: "title_legacy_guarantor", name: "Guarantor" },
  { threshold: 250000, itemId: "title_legacy_cornerstone", name: "Cornerstone" },
  { threshold: 1000000, itemId: "title_legacy_founding", name: "Founding Legacy" },
];

/**
 * How many recent endowment entries to keep on the profile.
 *
 * `legacy.total` and `legacy.count` are independent scalars, so trimming the
 * list loses no aggregate — and the full audit trail already lives in the
 * corpsCoinHistory subcollection. This only bounds the profile doc, which every
 * dashboard read pays for, against a decades-long career of entries.
 */
const MAX_LEGACY_ENTRIES = 50;

/** Longest dedication a director may attach to an endowment. */
const DEDICATION_MAX_LENGTH = 80;

/**
 * @param {string} tierId
 * @returns {EndowmentTier|null}
 */
function getEndowmentTier(tierId) {
  return Object.prototype.hasOwnProperty.call(ENDOWMENT_TIERS, tierId)
    ? ENDOWMENT_TIERS[tierId]
    : null;
}

/**
 * The highest milestone title earned at a given cumulative total, or null.
 * Titles are cumulative honors — reaching Guarantor does not revoke Patron.
 *
 * @param {unknown} total
 * @returns {LegacyTitle|null}
 */
function highestLegacyTitle(total) {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let earned = null;
  for (const title of LEGACY_TITLES) {
    if (amount >= title.threshold) earned = title;
  }
  return earned;
}

/**
 * Milestone titles a director has earned at `newTotal` but does not yet hold.
 *
 * Returns every threshold reached, not just the highest: a director who jumps
 * from 0 to 100,000 in one endowment has genuinely earned Patron, Benefactor
 * and Guarantor, and granting only the top one would silently eat two honors.
 *
 * Eligibility is decided by `owned` alone rather than by which thresholds this
 * particular endowment crossed. That makes the function idempotent under a
 * transaction retry, and it also back-fills honors for any director whose total
 * already sits above a threshold that was added to the ladder later.
 *
 * @param {unknown} newTotal - cumulative legacy total after the endowment
 * @param {string[]|Set<string>} [owned] - cosmetics.owned
 * @returns {LegacyTitle[]}
 */
function newlyEarnedLegacyTitles(newTotal, owned = []) {
  const after = Number(newTotal) || 0;
  const held = owned instanceof Set ? owned : new Set(owned);
  return LEGACY_TITLES.filter((title) => after >= title.threshold && !held.has(title.itemId));
}

/**
 * The next milestone above a total, with how much remains. Null past the top.
 * Drives the "X CC to Benefactor" progress line in the shop.
 *
 * @param {unknown} total
 * @returns {(LegacyTitle & {remaining: number})|null}
 */
function nextLegacyTitle(total) {
  const amount = Number(total) || 0;
  const next = LEGACY_TITLES.find((title) => amount < title.threshold);
  return next ? { ...next, remaining: next.threshold - amount } : null;
}

/**
 * Normalize a director's dedication text: strip control characters, collapse
 * whitespace, trim. Returns null when nothing displayable remains or the text
 * is over length — same contract as prestigeCatalog.sanitizeBannerMessage, so
 * the caller can treat null as "no dedication" rather than an error.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
function sanitizeDedication(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > DEDICATION_MAX_LENGTH) return null;
  return cleaned;
}

module.exports = {
  ENDOWMENT_TIERS,
  LEGACY_TITLES,
  MAX_LEGACY_ENTRIES,
  DEDICATION_MAX_LENGTH,
  getEndowmentTier,
  highestLegacyTitle,
  newlyEarnedLegacyTitles,
  nextLegacyTitle,
  sanitizeDedication,
};
