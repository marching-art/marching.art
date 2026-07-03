// Import the guest-preview draft into the onboarding lineup, fulfilling the
// registration gate's "your preview progress will be saved" promise.
//
// Each pick is validated against the current season's corps list (the season
// may have rotated since the demo was drafted) and the starter budget;
// invalid, duplicate, or unaffordable picks are dropped rather than blocking
// the import.

import { CAPTIONS, SOUNDSPORT_POINT_LIMIT } from '../pages/onboardingConstants';

/**
 * @param {Array<{corpsName: string, sourceYear: number|string, points: number}>} availableCorps
 * @param {Object|null} guestLineup - Stored guest picks keyed by caption id,
 *   values "corpsName|sourceYear|points"
 * @returns {{lineup: Object, count: number}}
 */
export function importGuestLineup(availableCorps, guestLineup) {
  if (!guestLineup || typeof guestLineup !== 'object') return { lineup: {}, count: 0 };

  const imported = {};
  let total = 0;
  for (const caption of CAPTIONS) {
    const value = guestLineup[caption.id];
    if (!value || typeof value !== 'string') continue;
    const [name, year] = value.split('|');
    const match = (availableCorps || []).find(
      (c) => c.corpsName === name && String(c.sourceYear) === String(year)
    );
    if (!match) continue;
    if (total + match.points > SOUNDSPORT_POINT_LIMIT) continue;
    if (Object.values(imported).some((v) => v.startsWith(match.corpsName + '|'))) continue;
    imported[caption.id] = `${match.corpsName}|${match.sourceYear}|${match.points}`;
    total += match.points;
  }
  return { lineup: imported, count: Object.keys(imported).length };
}
