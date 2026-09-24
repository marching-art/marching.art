// Presentation constants for the Hall of Champions, outside the component
// files so those only export components (react-refresh/only-export-components).
//
// The Hall shows BOTH divisions, each with its own classes — the same keys the
// backend writes to `season_champions/{seasonUid}.classes`
// (functions/src/helpers/hallOfChampions.js is the server twin):
//
//   Fantasy Division  worldClass · openClass · aClass · soundSport
//   Podium Division   podiumClass · podiumOpenClass · podiumAClass
//
// The two "World" keys are World CHAMPIONSHIP podiums: the top three of the
// whole Finals field, whatever class each corps competed in (one field, one
// title — see utils/worldChampionship). They are billed as the championship,
// not as a class. Open / A are class titles. SoundSport is rating-based (not
// placement-based): its top-scoring ensemble at each season's SoundSport
// International Music & Food Festival earns "Best in Show".

import { Crown, Trophy, Award, Music } from 'lucide-react';

/** @typedef {'fantasy' | 'podium'} HallDivisionId */

/**
 * @typedef {object} HallClassConfig
 * @property {string} name      Full billing ("Podium Open Class").
 * @property {string} short     Tab label inside the division ("Open").
 * @property {HallDivisionId} division
 * @property {import('lucide-react').LucideIcon} icon
 */

/**
 * Every Hall class key, keyed by the `season_champions.classes` key. Order
 * within a division is tab order.
 * @type {Record<string, HallClassConfig>}
 */
export const CLASS_CONFIG = {
  worldClass: { name: 'World Championship', short: 'World', division: 'fantasy', icon: Crown },
  openClass: { name: 'Open Class', short: 'Open', division: 'fantasy', icon: Trophy },
  aClass: { name: 'A Class', short: 'A Class', division: 'fantasy', icon: Award },
  soundSport: { name: 'SoundSport', short: 'Sound', division: 'fantasy', icon: Music },
  // `podiumClass` keeps its historical key (every archived season, trophy-case
  // medal, record and share card already carries it) and is the Podium World
  // Championship. The two division keys were added later — seasons archived
  // before them only carry the World podium.
  podiumClass: {
    name: 'Podium World Championship',
    short: 'World',
    division: 'podium',
    icon: Crown,
  },
  podiumOpenClass: { name: 'Podium Open Class', short: 'Open', division: 'podium', icon: Trophy },
  podiumAClass: { name: 'Podium A Class', short: 'A Class', division: 'podium', icon: Award },
};

/**
 * @typedef {object} HallDivisionConfig
 * @property {HallDivisionId} id
 * @property {string} name
 * @property {string} short
 * @property {string[]} classes  Hall class keys, tab order.
 */

/** The two divisions and their classes, in display order. @type {HallDivisionConfig[]} */
export const HALL_DIVISIONS = [
  {
    id: 'fantasy',
    name: 'Fantasy Division',
    short: 'Fantasy',
    classes: ['worldClass', 'openClass', 'aClass', 'soundSport'],
  },
  {
    id: 'podium',
    name: 'Podium Division',
    short: 'Podium',
    classes: ['podiumClass', 'podiumOpenClass', 'podiumAClass'],
  },
];

/** The default landing class. */
export const DEFAULT_HALL_CLASS = 'worldClass';

/** @param {string} classKey */
export const isHallClassKey = (classKey) =>
  Object.prototype.hasOwnProperty.call(CLASS_CONFIG, classKey);

/**
 * The division a Hall class key belongs to (fantasy when unknown, so a stale
 * deep link still lands somewhere sensible).
 * @param {string} classKey
 * @returns {HallDivisionConfig}
 */
export const divisionOfClass = (classKey) => {
  const id = CLASS_CONFIG[classKey]?.division;
  return HALL_DIVISIONS.find((d) => d.id === id) || HALL_DIVISIONS[0];
};

/**
 * SoundSport recognizes a "Best in Show" ensemble rather than a champion, so
 * its plaque, table, and season rows swap the champion framing for the
 * blue-ribbon / rating presentation used elsewhere for SoundSport.
 * @param {string} classKey
 */
export const isSoundSportClass = (classKey) => classKey === 'soundSport';

/**
 * Rank framing for the finalists table (1st/2nd/3rd).
 * @type {Record<number, { label: string, badge: string, accent: string, border: string, medalColor: string }>}
 */
export const RANK_META = {
  1: {
    label: 'CHAMPION',
    badge: 'bg-yellow-500 text-black',
    accent: 'text-yellow-500',
    border: 'border-yellow-500/60',
    medalColor: 'text-yellow-500',
  },
  2: {
    label: 'RUNNER-UP',
    badge: 'bg-charcoal-300 text-black',
    accent: 'text-secondary',
    border: 'border-charcoal-400/40',
    medalColor: 'text-secondary',
  },
  3: {
    label: 'THIRD',
    badge: 'bg-orange-400 text-black',
    accent: 'text-orange-400',
    border: 'border-orange-500/40',
    medalColor: 'text-orange-400',
  },
};

// =============================================================================
// FORMATTING HELPERS (pure; shared by the page and its table/plaque parts)
// =============================================================================

/**
 * "live_2025" → { type: "Live", year: "2025" }; "starlight_2025_2026" →
 * { type: "Starlight", year: "2025-26" }.
 * @param {string | undefined | null} name
 * @returns {{ type: string, year: string }}
 */
export const parseSeasonName = (name) => {
  if (!name) return { type: 'Unknown', year: '' };
  const parts = name.split('_');
  if (parts.length < 2) return { type: name, year: '' };
  const type = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const yearParts = parts.slice(1);
  // "2025-26" — collapse trailing 4-digit year to 2-digit suffix
  let year = yearParts.join('-');
  if (yearParts.length === 2 && /^\d{4}$/.test(yearParts[0]) && /^\d{4}$/.test(yearParts[1])) {
    year = `${yearParts[0]}-${yearParts[1].slice(2)}`;
  }
  return { type, year };
};

/** @param {Date | null | undefined} date */
export const formatDate = (date) => {
  if (!date) return '—';
  try {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
};

/** @param {unknown} score */
export const formatScore = (score) => (typeof score === 'number' ? score.toFixed(3) : '—');

/** @param {unknown} delta */
export const formatDelta = (delta) => {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
};
