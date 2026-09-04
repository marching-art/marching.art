// Per-show Podium medals, as the CLIENT derives them — mirrors
// functions/src/helpers/podium/showRanking.js (the server's one rule) so the
// medal beside a placement is always the one that placement earns.
//
// A Podium show is ranked WITHIN EACH DIVISION: every division crowns its own
// winner (docs/PODIUM.md §5.7), so a corps' place is its rank among its
// division-mates that night, and its medal (§14.1.3) is that division's
// podium — top three — at any show of at least PODIUM_MEDAL_MIN_FIELD_SIZE
// corps in total. The gate is the show's size, not the division's: a
// two-corps Open Class at a ten-corps show is a contest, a one-corps "show" is
// not. Deriving the icon from the place on screen (rather than trusting a
// stored flag) is what keeps the ledger honest for recaps written before the
// server ranked per division, which medalled the mixed field and put a silver
// next to a "1/3".

export type PodiumMedal = 'gold' | 'silver' | 'bronze';

/**
 * Minimum corps at a show (all divisions together) before it awards medals. Mirrors
 * `balance.medals.minFieldSize` in
 * functions/src/helpers/podium/balanceConfig.json — kept in sync by
 * podiumMedals.test.ts.
 */
export const PODIUM_MEDAL_MIN_FIELD_SIZE = 4;

const MEDAL_NAMES: readonly PodiumMedal[] = ['gold', 'silver', 'bronze'];

/** Tailwind text class per medal — one palette across the ledger and the recap sheet. */
export const MEDAL_TEXT_CLASS: Record<PodiumMedal, string> = {
  gold: 'text-brand',
  silver: 'text-secondary',
  bronze: 'text-amber-700',
};

/**
 * The medal a placement earns, or null.
 * @param place 1-based rank within the division that night.
 * @param showFieldSize Corps at the whole show that night, every division together.
 */
export function podiumMedalForPlace(
  place: number | null | undefined,
  showFieldSize: number | null | undefined,
  minFieldSize: number = PODIUM_MEDAL_MIN_FIELD_SIZE
): PodiumMedal | null {
  if (!Number.isInteger(place) || (place as number) < 1 || (place as number) > MEDAL_NAMES.length) {
    return null;
  }
  if (!Number.isFinite(showFieldSize) || (showFieldSize as number) < minFieldSize) return null;
  return MEDAL_NAMES[(place as number) - 1];
}
