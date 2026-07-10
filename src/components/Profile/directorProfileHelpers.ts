// =============================================================================
// DIRECTOR PROFILE - Shared constants, types, and helper functions
// =============================================================================
// Extracted from DirectorProfileParts.tsx so that file only exports components,
// which keeps Vite's fast refresh working (react-refresh/only-export-components).

import React from 'react';
import { Trophy, Crown, Medal, Shield } from 'lucide-react';
import type { UserProfile, CorpsClass, CompetitionTrophy } from '../../types';
import {
  CORPS_CLASS_ORDER,
  CORPS_CLASS_LABELS,
  resolveCorpsForClass,
  isCorpsClassUnlocked,
} from '../../utils/corps';
import { toCanonicalClassKey } from '../../utils/classUnlocks';
import { formatSeasonName } from '../../utils/season';
import { getSoundSportRating } from '../../utils/scoresUtils';

export interface SeasonHistoryEntry {
  seasonId: string;
  seasonName?: string;
  corpsName: string;
  classKey: CorpsClass;
  placement?: number;
  finalScore?: number;
  totalSeasonScore?: number;
  previousPlacement?: number;
  showTitle?: string;
  repertoire?: string[];
  /** Archived per-season show concept (legacy seasons may carry a string) */
  showConcept?:
    | { showName?: string | null; theme: string; musicSource: string; drillStyle: string }
    | string
    | null;
  showsAttended?: number;
  circuitPoints?: number;
}

export interface TrophyData {
  id: string;
  title: string;
  description: string;
  tier: 'gold' | 'silver' | 'bronze' | 'special';
  season?: string;
  icon: React.ElementType;
  earnedAt?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Keyed by canonical class keys ('worldClass'/'openClass'), which is what the
// data layer stores. Look up via getClassDisplay() so legacy short keys
// ('world'/'open') still resolve.
export const CLASS_DISPLAY = {
  worldClass: {
    name: 'World Class',
    short: 'WC',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  openClass: { name: 'Open Class', short: 'OC', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  aClass: { name: 'A Class', short: 'A', color: 'text-green-400', bg: 'bg-green-500/10' },
  soundSport: { name: 'SoundSport', short: 'SS', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  podiumClass: {
    name: 'Podium Class',
    short: 'POD',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
} as const;

export type ClassDisplayConfig = (typeof CLASS_DISPLAY)[keyof typeof CLASS_DISPLAY];

export function getClassDisplay(classKey: string): ClassDisplayConfig {
  const canonical = toCanonicalClassKey(classKey) as keyof typeof CLASS_DISPLAY;
  return CLASS_DISPLAY[canonical] || CLASS_DISPLAY.soundSport;
}

export const TIER_STYLES = {
  gold: {
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-500/40',
    text: 'text-yellow-400',
    icon: 'text-yellow-500',
  },
  silver: {
    bg: 'bg-gray-300/10',
    border: 'border-gray-400/40',
    text: 'text-gray-300',
    icon: 'text-gray-400',
  },
  bronze: {
    bg: 'bg-orange-600/15',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    icon: 'text-orange-500',
  },
  special: {
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/40',
    text: 'text-purple-400',
    icon: 'text-purple-500',
  },
};

export const STATUS_INDICATORS = {
  active: { label: 'Active', color: 'bg-green-500', pulse: true },
  onTour: { label: 'On Tour', color: 'bg-blue-500', pulse: true },
  offseason: { label: 'Off-Season', color: 'bg-gray-500', pulse: false },
  retired: { label: 'Retired', color: 'bg-red-500/50', pulse: false },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getDirectorStatus(profile: UserProfile): keyof typeof STATUS_INDICATORS {
  const hasActiveCorps =
    profile.corps && Object.values(profile.corps).some((c) => c && c.corpsName);
  const hasActiveSeasonId = !!profile.activeSeasonId;

  if (!hasActiveCorps) return 'retired';
  if (hasActiveSeasonId) return 'onTour';
  if (hasActiveCorps) return 'active';
  return 'offseason';
}

// -----------------------------------------------------------------------------
// STANDING — "how good are you right now", one honest number.
//
// Replaces the retired "Influence" and "Rating" aggregates: both were opaque
// re-blends of inputs (XP, level, streak, championships, seasons) that every
// other profile surface already shows directly, so they double-counted the
// journey and legacy axes while explaining nothing. Standing is instead the
// number players actually chase: the flagship corps' live class rank, written
// nightly by the scoring run (corps.{class}.seasonRank). SoundSport keeps its
// ratings-only framing — a medal, never a placement.
// -----------------------------------------------------------------------------

const STANDING_CLASS_ORDER: CorpsClass[] = ['worldClass', 'openClass', 'aClass'];

export interface StandingDisplay {
  /** Class shown as the pill label, e.g. "World Class" */
  label: string;
  /** "#14" for ranked corps, a medal rating for SoundSport, "—" pre-score */
  value: string;
  /** Field size for context ("of 43"), null when unranked/SoundSport */
  of: number | null;
  soundSport: boolean;
}

export function getStandingDisplay(profile: UserProfile): StandingDisplay | null {
  const corpsMap = profile.corps || {};

  // Flagship = highest competitive class the director fields.
  for (const classKey of STANDING_CLASS_ORDER) {
    const corps = corpsMap[classKey];
    if (!corps?.corpsName) continue;
    const rank = typeof corps.seasonRank === 'number' ? corps.seasonRank : null;
    return {
      label: CORPS_CLASS_LABELS[classKey] || classKey,
      value: rank ? `#${rank}` : '—',
      of: rank && typeof corps.seasonRankOf === 'number' ? corps.seasonRankOf : null,
      soundSport: false,
    };
  }

  // SoundSport-only directors: ratings, never placements.
  const ss = corpsMap.soundSport;
  if (ss?.corpsName) {
    const score = ss.totalSeasonScore || 0;
    return {
      label: CORPS_CLASS_LABELS.soundSport || 'SoundSport',
      value: score > 0 ? getSoundSportRating(score) : '—',
      of: null,
      soundSport: true,
    };
  }

  return null;
}

// This season's show title from the per-season concept (legacy free-text
// concepts don't count).
export function getShowTitle(corps: { showConcept?: unknown }): string | null {
  const concept = corps?.showConcept;
  if (!concept || typeof concept !== 'object') return null;
  const name = (concept as { showName?: string | null }).showName;
  return typeof name === 'string' && name.trim() ? name : null;
}

// Kept in sync with functions/src/helpers/xpCalculations.js getLevelTitle.
// Extended tiers past Level 10: 15 Icon, 20 Hall of Famer, 25 Immortal, 30 Eternal.
const LEVEL_TITLES: Record<number, string> = {
  1: 'Rookie',
  2: 'Trainee',
  3: 'Assistant',
  4: 'Coordinator',
  5: 'Instructor',
  6: 'Caption Head',
  7: 'Program Director',
  8: 'Director',
  9: 'Executive Director',
  10: 'Legend',
  15: 'Icon',
  20: 'Hall of Famer',
  25: 'Immortal',
  30: 'Eternal',
};

const EXTENDED_TITLE_TIERS = [30, 25, 20, 15, 10];

function titleForLevel(level: number): string {
  const lvl = Math.max(1, Math.floor(level || 1));
  if (lvl >= 10) {
    const tier = EXTENDED_TITLE_TIERS.find((t) => lvl >= t) ?? 10;
    return LEVEL_TITLES[tier];
  }
  return LEVEL_TITLES[lvl] || 'Rookie';
}

// Prefer the stored title, but if it's stale ("Rookie" while level > 1), fall
// back to the title computed from xpLevel so existing profiles heal on view.
export function getDisplayTitle(profile: UserProfile): string {
  const level = profile.xpLevel || 1;
  const computed = titleForLevel(level);
  const stored = profile.userTitle;
  if (!stored) return computed;
  if (stored === 'Rookie' && level > 1) return computed;
  return stored;
}

// Get primary corps avatar URL - respects profileAvatarCorps selection
export function getCorpsAvatarUrl(profile: UserProfile): {
  url: string | null;
  corpsClass: CorpsClass | null;
} {
  if (!profile.corps) return { url: null, corpsClass: null };

  // If user has selected a specific corps for their profile avatar, use that
  if (profile.profileAvatarCorps) {
    const selectedCorps = resolveCorpsForClass(profile.corps, profile.profileAvatarCorps);
    if (selectedCorps?.avatarUrl) {
      return { url: selectedCorps.avatarUrl, corpsClass: profile.profileAvatarCorps };
    }
  }

  // Fallback: Priority order world > open > aClass > soundSport
  for (const classKey of CORPS_CLASS_ORDER) {
    const corps = resolveCorpsForClass(profile.corps, classKey);
    if (corps?.avatarUrl) return { url: corps.avatarUrl, corpsClass: classKey as CorpsClass };
  }
  return { url: null, corpsClass: null };
}

// Get all corps with avatars for selection
export function getCorpsWithAvatars(
  profile: UserProfile
): { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[] {
  if (!profile.corps) return [];
  const result: { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[] = [];

  for (const classKey of CORPS_CLASS_ORDER) {
    const corps = resolveCorpsForClass(profile.corps, classKey);
    if (corps?.avatarUrl && corps?.corpsName) {
      result.push({
        corpsClass: classKey as CorpsClass,
        corpsName: corps.corpsName,
        avatarUrl: corps.avatarUrl,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Trophy Case — competition-based awards only (NOT achievements).
// Reads the REAL server-awarded trophy arrays (profile.trophies.*, written
// nightly by functions scoringAwards.js: regionals, class championships,
// finals championships, finalist medals). The old implementation fabricated
// placeholder rows from stats counters and never read this data — the game's
// best-earned hardware was displayed nowhere. The synthetic rows remain only
// as a fallback for profiles with no real trophies yet.
// ---------------------------------------------------------------------------

const rankTier = (rank?: number): TrophyData['tier'] =>
  rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';

const medalWord = (rank?: number): string =>
  rank === 1
    ? 'Champion'
    : rank === 2
      ? 'Silver Medalist'
      : rank === 3
        ? 'Bronze Medalist'
        : `${rank}th Place`;

const classLabel = (key?: string): string =>
  (key && CORPS_CLASS_LABELS[toCanonicalClassKey(key) as CorpsClass]) || '';

const trophyDescription = (t: CompetitionTrophy): string =>
  [t.eventName, t.seasonName ? formatSeasonName(t.seasonName) : null].filter(Boolean).join(' · ') ||
  'Competition award';

export function getCompetitionTrophies(profile: UserProfile): TrophyData[] {
  const real = [...getRealTrophies(profile), ...getPodiumMedalTrophies(profile)];
  return real.length > 0 ? real : getLegacySyntheticTrophies(profile);
}

function getRealTrophies(profile: UserProfile): TrophyData[] {
  const t = profile.trophies;
  if (!t) return [];
  const out: TrophyData[] = [];

  (t.championships || []).forEach((trophy, i) =>
    out.push({
      id: `championship-${i}`,
      title: `Finals ${medalWord(trophy.rank)}`,
      description: trophyDescription(trophy),
      tier: rankTier(trophy.rank),
      season: trophy.seasonName,
      icon: Crown,
    })
  );
  (t.classChampionships || []).forEach((trophy, i) =>
    out.push({
      id: `class-championship-${i}`,
      title: `${classLabel(trophy.corpsClass)} ${medalWord(trophy.rank)}`.trim(),
      description: trophyDescription(trophy),
      tier: rankTier(trophy.rank),
      season: trophy.seasonName,
      icon: Trophy,
    })
  );
  (t.regionals || []).forEach((trophy, i) =>
    out.push({
      id: `regional-${i}`,
      title: `Regional ${medalWord(trophy.rank)}`,
      description: trophyDescription(trophy),
      tier: rankTier(trophy.rank),
      season: trophy.seasonName,
      icon: Medal,
    })
  );
  (t.finalistMedals || []).forEach((trophy, i) =>
    out.push({
      id: `finalist-${i}`,
      title: trophy.type === 'soundsport_finalist' ? 'Festival Finalist' : 'Finals Finalist',
      description: trophyDescription(trophy),
      tier: 'special',
      season: trophy.seasonName,
      icon: Shield,
    })
  );

  return out;
}

// -----------------------------------------------------------------------------
// Podium Class show medals — the FMA "70+ regular-season golds" collector hook.
// Lifetime = archived seasons' medal counts (corps.podiumClass.seasonHistory,
// written at each rollover) plus the current season's running counters
// (corps.podiumClass.medals, written nightly). One trophy row per metal.
// -----------------------------------------------------------------------------

interface PodiumMedalCounts {
  gold?: number;
  silver?: number;
  bronze?: number;
}

interface PodiumCorpsShape {
  medals?: PodiumMedalCounts;
  seasonHistory?: Array<{ medals?: PodiumMedalCounts }>;
}

export function getPodiumMedalTrophies(profile: UserProfile): TrophyData[] {
  const podiumCorps = (profile.corps as Record<string, unknown> | undefined)?.podiumClass as
    PodiumCorpsShape | undefined;
  if (!podiumCorps) return [];

  const lifetime: Required<PodiumMedalCounts> = { gold: 0, silver: 0, bronze: 0 };
  const addCounts = (medals?: PodiumMedalCounts) => {
    if (!medals) return;
    lifetime.gold += medals.gold || 0;
    lifetime.silver += medals.silver || 0;
    lifetime.bronze += medals.bronze || 0;
  };
  (podiumCorps.seasonHistory || []).forEach((row) => addCounts(row?.medals));
  addCounts(podiumCorps.medals);

  const metals = [
    { key: 'gold' as const, label: 'Gold' },
    { key: 'silver' as const, label: 'Silver' },
    { key: 'bronze' as const, label: 'Bronze' },
  ];
  return metals
    .filter(({ key }) => lifetime[key] > 0)
    .map(({ key, label }) => ({
      id: `podium-medals-${key}`,
      title: `Podium ${label} ×${lifetime[key]}`,
      description: 'Podium Class show medals (lifetime)',
      tier: key,
      icon: Medal,
    }));
}

// Legacy placeholder rows, shown only while a profile has no real hardware.
function getLegacySyntheticTrophies(profile: UserProfile): TrophyData[] {
  const trophies: TrophyData[] = [];
  const stats = profile.stats;

  if (stats?.championships && stats.championships > 0) {
    for (let i = 0; i < Math.min(stats.championships, 5); i++) {
      trophies.push({
        id: `champ-${i}`,
        title: 'League Champion',
        description: 'Captured a league championship',
        tier: 'gold',
        icon: Trophy,
      });
    }
  }

  if (stats?.topTenFinishes && stats.topTenFinishes > (stats?.championships || 0)) {
    const topTenCount = Math.min(stats.topTenFinishes - (stats?.championships || 0), 3);
    for (let i = 0; i < topTenCount; i++) {
      trophies.push({
        id: `top10-${i}`,
        title: 'Top 10 Finish',
        description: 'Finished in the top 10',
        tier: 'silver',
        icon: Medal,
      });
    }
  }

  if (isCorpsClassUnlocked(profile.unlockedClasses, 'worldClass')) {
    trophies.push({
      id: 'world-unlock',
      title: 'World Class',
      description: 'Achieved World Class status',
      tier: 'special',
      icon: Crown,
    });
  }

  if (stats?.seasonsPlayed && stats.seasonsPlayed >= 5) {
    trophies.push({
      id: 'veteran',
      title: 'Veteran',
      description: `${stats.seasonsPlayed} seasons`,
      tier: 'bronze',
      icon: Shield,
    });
  }

  return trophies;
}
