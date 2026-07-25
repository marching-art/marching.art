// Client mirror of the Legacy Endowment catalog.
//
// Prices and thresholds here are display-only — the makeLegacyEndowment
// callable validates against functions/src/helpers/legacyCatalog.js, and
// legacy.test.ts fails CI if this mirror drifts from it. Same contract as
// src/utils/prestige.js.
//
// Legacy Endowments are the game's recurring sink: every other sink is bought
// once, so an active director exhausts the whole catalogue in about a year and
// every coin after that is dead surplus. See the header comment on the server
// catalog for the full rationale and the pricing anchors.

export interface EndowmentTier {
  rank: number;
  price: number;
  name: string;
}

export interface LegacyTitle {
  threshold: number;
  itemId: string;
  name: string;
}

export const ENDOWMENT_TIERS: Record<string, EndowmentTier> = {
  music_library: { rank: 1, price: 5000, name: 'Music Library Fund' },
  instrument_fund: { rank: 2, price: 12500, name: 'Instrument Endowment' },
  tour_fund: { rank: 3, price: 25000, name: 'Tour Fund' },
  scholarship: { rank: 4, price: 50000, name: 'Marcher Scholarship' },
  facility: { rank: 5, price: 100000, name: 'Rehearsal Facility' },
};

export const LEGACY_TITLES: LegacyTitle[] = [
  { threshold: 5000, itemId: 'title_legacy_patron', name: 'Patron' },
  { threshold: 25000, itemId: 'title_legacy_benefactor', name: 'Benefactor' },
  { threshold: 100000, itemId: 'title_legacy_guarantor', name: 'Guarantor' },
  { threshold: 250000, itemId: 'title_legacy_cornerstone', name: 'Cornerstone' },
  { threshold: 1000000, itemId: 'title_legacy_founding', name: 'Founding Legacy' },
];

export const DEDICATION_MAX_LENGTH = 80;

/**
 * What each tier funds, in the game's voice. Display-only copy, so it lives
 * here rather than in the server catalog the mirror test compares.
 */
export const ENDOWMENT_BLURBS: Record<string, string> = {
  music_library: 'Commission charts the corps will play for years.',
  instrument_fund: 'Put horns and drums in the hands of the next line.',
  tour_fund: 'Send the corps down the road for one more summer.',
  scholarship: 'Pay a marcher’s way. Someone always needed it.',
  facility: 'A rehearsal hall with your name over the door.',
};

// =============================================================================
// HELPERS (mirrors of the server logic, for display)
// =============================================================================

/** Tiers in display order, cheapest first. */
export function endowmentTiersInOrder(): Array<EndowmentTier & { id: string }> {
  return Object.entries(ENDOWMENT_TIERS)
    .map(([id, tier]) => ({ id, ...tier }))
    .sort((a, b) => a.rank - b.rank);
}

/** The highest milestone title earned at a cumulative total, or null. */
export function highestLegacyTitle(total: number | null | undefined): LegacyTitle | null {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let earned: LegacyTitle | null = null;
  for (const title of LEGACY_TITLES) {
    if (amount >= title.threshold) earned = title;
  }
  return earned;
}

/** The next milestone above a total and the gap to it. Null past the top. */
export function nextLegacyTitle(
  total: number | null | undefined
): (LegacyTitle & { remaining: number }) | null {
  const amount = Number(total) || 0;
  const next = LEGACY_TITLES.find((title) => amount < title.threshold);
  return next ? { ...next, remaining: next.threshold - amount } : null;
}

/**
 * Progress toward the next milestone, 0–1, measured across the current band
 * rather than from zero — otherwise a director at 249,999 shows 25% toward
 * Cornerstone, which reads as no progress at all. Returns 1 past the top.
 */
export function legacyBandProgress(total: number | null | undefined): number {
  const amount = Number(total) || 0;
  const next = nextLegacyTitle(amount);
  if (!next) return 1;
  const current = highestLegacyTitle(amount);
  const floor = current ? current.threshold : 0;
  const span = next.threshold - floor;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (amount - floor) / span));
}

/** A director's cumulative legacy total, tolerant of a missing/corrupt field. */
export function legacyTotal(profile: unknown): number {
  const legacy = (profile as { legacy?: { total?: unknown } } | null)?.legacy;
  const total = Number(legacy?.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** How many endowments a director has made. */
export function legacyCount(profile: unknown): number {
  const legacy = (profile as { legacy?: { count?: unknown } } | null)?.legacy;
  const count = Number(legacy?.count);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export interface LegacyEntry {
  tierId?: string;
  name?: string;
  amount?: number;
  dedication?: string;
  seasonUid?: string | null;
  at?: unknown;
}

/** Recorded endowments, newest first. Always an array. */
export function legacyEntries(profile: unknown): LegacyEntry[] {
  const legacy = (profile as { legacy?: { entries?: unknown } } | null)?.legacy;
  return Array.isArray(legacy?.entries) ? (legacy.entries as LegacyEntry[]) : [];
}

/** True when the director can afford a tier. */
export function canAfford(balance: number | null | undefined, tierId: string): boolean {
  const tier = ENDOWMENT_TIERS[tierId];
  if (!tier) return false;
  return (Number(balance) || 0) >= tier.price;
}
