/**
 * League identity on the client: which game a league plays and how roleplay
 * fits into it.
 *
 * Mirrors functions/src/helpers/leagueIdentity.js — the server validates and
 * enforces (a Fantasy-only league's generator never pairs Podium corps); these
 * helpers are the one place the client reads the fields, so the discovery
 * card, the create modal, the settings form and the League tab all describe a
 * league the same way.
 */

import type { League, LeagueGameMode, RoleplayLevel } from '../types';

/** The identity fields of any league-shaped object (a doc, a form, a card). */
export type IdentityLike = {
  tag?: string | null;
  roleplay?: League['roleplay'];
  lore?: string;
  description?: string;
  settings?: { gameMode?: LeagueGameMode };
} | null;

export interface IdentityOption<T extends string> {
  id: T;
  /** Full name, used in pickers and the League tab. */
  label: string;
  /** Badge-length name for cards. */
  short: string;
  /** One line on what joining means. */
  hint: string;
}

export const GAME_MODE_OPTIONS: IdentityOption<LeagueGameMode>[] = [
  {
    id: 'fantasy',
    label: 'Fantasy only',
    short: 'Fantasy',
    hint: 'Caption lineups — World, Open, A Class and SoundSport matchups.',
  },
  {
    id: 'podium',
    label: 'Podium only',
    short: 'Podium',
    hint: 'Run-your-own-corps Podium Division matchups only.',
  },
  {
    id: 'both',
    label: 'Fantasy + Podium',
    short: 'Fantasy + Podium',
    hint: 'Matchups in every class a member fields, in either game.',
  },
];

export const ROLEPLAY_LEVEL_OPTIONS: IdentityOption<RoleplayLevel>[] = [
  {
    id: 'none',
    label: 'No roleplay',
    short: 'No RP',
    hint: 'Scores, strategy and banter. Nobody posts in character.',
  },
  {
    id: 'optional',
    label: 'Roleplay welcome',
    short: 'RP welcome',
    hint: 'Storylines happen now and then. Join in if you like — never required.',
  },
  {
    id: 'encouraged',
    label: 'Roleplay encouraged',
    short: 'RP encouraged',
    hint: 'Regular storylines. Directors are expected to play along some of the time.',
  },
  {
    id: 'immersive',
    label: 'Immersive roleplay',
    short: 'Immersive RP',
    hint: 'Directors play in character and the league runs as a living world.',
  },
];

/** Matches MAX_ROLEPLAY_EXPECTATIONS_LENGTH / MAX_LORE_LENGTH server-side. */
export const MAX_ROLEPLAY_EXPECTATIONS = 500;
export const MAX_LORE = 2000;

/** Absent or unknown reads as `both` — every league before the field existed. */
export function getLeagueGameMode(league: IdentityLike): LeagueGameMode {
  const mode = league?.settings?.gameMode;
  return mode === 'fantasy' || mode === 'podium' || mode === 'both' ? mode : 'both';
}

/**
 * The roleplay level a league runs at, or null when its commissioner never
 * said. The retired `roleplay` vibe tag reads as `encouraged`, exactly as the
 * server reads it.
 */
export function getLeagueRoleplayLevel(league: IdentityLike): RoleplayLevel | null {
  const level = league?.roleplay?.level;
  if (ROLEPLAY_LEVEL_OPTIONS.some((o) => o.id === level)) return level as RoleplayLevel;
  return league?.tag === 'roleplay' ? 'encouraged' : null;
}

export function gameModeOption(mode: LeagueGameMode) {
  return GAME_MODE_OPTIONS.find((o) => o.id === mode) ?? GAME_MODE_OPTIONS[2];
}

export function roleplayOption(level: RoleplayLevel | null) {
  return level ? (ROLEPLAY_LEVEL_OPTIONS.find((o) => o.id === level) ?? null) : null;
}

// -----------------------------------------------------------------------------
// Discovery filters
// -----------------------------------------------------------------------------

export type GameFilter = 'fantasy' | 'podium';
/** Grouped for browsing: "none", "light" (welcome), "heavy" (encouraged/immersive). */
export type RoleplayFilter = 'none' | 'light' | 'heavy';

export const GAME_FILTERS: Array<{ id: GameFilter; label: string }> = [
  { id: 'fantasy', label: 'Plays Fantasy' },
  { id: 'podium', label: 'Plays Podium' },
];

export const ROLEPLAY_FILTERS: Array<{ id: RoleplayFilter; label: string }> = [
  { id: 'none', label: 'No RP' },
  { id: 'light', label: 'RP welcome' },
  { id: 'heavy', label: 'RP-focused' },
];

/** A both-games league plays Fantasy AND Podium, so it matches either filter. */
export function matchesGameFilter(league: IdentityLike, filter: GameFilter | null): boolean {
  if (!filter) return true;
  const mode = getLeagueGameMode(league);
  return mode === 'both' || mode === filter;
}

/**
 * A league that never stated a level matches no roleplay filter: "No RP" is a
 * promise, and the commissioner hasn't made it.
 */
export function matchesRoleplayFilter(
  league: IdentityLike,
  filter: RoleplayFilter | null
): boolean {
  if (!filter) return true;
  const level = getLeagueRoleplayLevel(league);
  if (!level) return false;
  if (filter === 'none') return level === 'none';
  if (filter === 'light') return level === 'optional';
  return level === 'encouraged' || level === 'immersive';
}
