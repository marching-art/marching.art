// Shared shapes and display config for the league Matchups tab. Kept in a
// non-component module so the component files stay Fast Refresh-friendly.

import type React from 'react';
import { Zap, Trophy, Award, Star, Medal } from 'lucide-react';
import type { CaptionsBlock } from '../../../utils/captionWars';

export interface MemberProfiles {
  [uid: string]: { displayName?: string; username?: string } | undefined;
}

/** One pairing as the matchup documents store it, flattened for a week. */
export interface TabMatchup {
  pair?: [string, string | null];
  week?: number;
  corpsClass?: string;
  status?: string;
  completed?: boolean;
  isBye?: boolean;
  winner?: string | null;
  scores?: Record<string, number>;
  captions?: CaptionsBlock;
  /** Per-side classes on a cross-class matchup (the leftovers a class could
   *  not seat, paired across classes and decided on class percentile). */
  classes?: Record<string, string>;
  crossClass?: boolean;
  /** Each side's best single show, on a league running One-Night Slate. */
  best?: Record<string, { score?: number; showName?: string | null } | undefined>;
  /** Each side's weekly finish against its own class, 0–100. */
  normalized?: Record<string, number>;
  /** Each side's per-show average — what the default format decided on;
   *  `scores` is the weekly total the record book reads. */
  averages?: Record<string, number>;
  /** Synthetic React key, attached when a week is flattened for render. */
  id?: string;
}

/** A standings row, as much of one as these parts read. */
export interface TabStanding {
  uid: string;
  wins: number;
  losses: number;
}

// Corps class display configuration
export const CORPS_CLASS_CONFIG: Record<
  string,
  {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  worldClass: {
    name: 'World Class',
    icon: Trophy,
    color: 'text-secondary',
    bgColor: 'bg-surface-raised',
    borderColor: 'border-line',
  },
  openClass: {
    name: 'Open Class',
    icon: Award,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  aClass: {
    name: 'A Class',
    icon: Star,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  soundSport: {
    name: 'SoundSport',
    icon: Zap,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  // Podium corps join league matchups once the class registry enables the
  // class (Phase 7.4) — the matchup doc arrays are registry-driven server-side.
  podiumClass: {
    name: 'Podium Division',
    icon: Medal,
    color: 'text-brand',
    bgColor: 'bg-brand/10',
    borderColor: 'border-brand/30',
  },
};
