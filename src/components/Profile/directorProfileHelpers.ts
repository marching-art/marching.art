// =============================================================================
// DIRECTOR PROFILE - Shared constants, types, and helper functions
// =============================================================================
// Extracted from DirectorProfileParts.tsx so that file only exports components,
// which keeps Vite's fast refresh working (react-refresh/only-export-components).

import React from 'react';
import { Trophy, Crown, Medal, Shield } from 'lucide-react';
import type { UserProfile, CorpsClass } from '../../types';
import { CORPS_CLASS_ORDER, resolveCorpsForClass, isCorpsClassUnlocked } from '../../utils/corps';
import { toCanonicalClassKey } from '../../utils/classUnlockTime';

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

export function calculateInfluenceScore(profile: UserProfile): number {
  const baseXp = profile.xp || 0;
  const levelBonus = (profile.xpLevel || 1) * 100;
  const streakBonus = (profile.engagement?.loginStreak || 0) * 10;
  const champBonus = (profile.stats?.championships || 0) * 500;
  const seasonBonus = (profile.stats?.seasonsPlayed || 0) * 50;
  return baseXp + levelBonus + streakBonus + champBonus + seasonBonus;
}

export function calculateDirectorRating(profile: UserProfile): number {
  const baseRating = 1000;
  const championships = profile.stats?.championships || 0;
  const seasons = profile.stats?.seasonsPlayed || 0;
  const topTens = profile.stats?.topTenFinishes || 0;
  const rating = baseRating + championships * 150 + topTens * 50 + seasons * 10;
  return Math.min(rating, 3000);
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

// Get trophies (competition-based awards only - NOT achievements)
export function getCompetitionTrophies(profile: UserProfile): TrophyData[] {
  const trophies: TrophyData[] = [];
  const stats = profile.stats;

  // Championship trophies
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

  // Top 10 finishes (excluding championships)
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

  // Class unlock as special trophy
  if (isCorpsClassUnlocked(profile.unlockedClasses, 'worldClass')) {
    trophies.push({
      id: 'world-unlock',
      title: 'World Class',
      description: 'Achieved World Class status',
      tier: 'special',
      icon: Crown,
    });
  }

  // Veteran badge (seasons-based)
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
