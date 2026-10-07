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

import type { CorpsClass, League, LeagueGameMode, RoleplayLevel } from '../types';

/** The identity fields of any league-shaped object (a doc, a form, a card). */
export type IdentityLike = {
  tag?: string | null;
  roleplay?: League['roleplay'];
  lore?: string;
  abbreviation?: string;
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

// -----------------------------------------------------------------------------
// League tag — the bold acronym members wear on their profiles
// -----------------------------------------------------------------------------

/** Matches MIN/MAX_ABBREVIATION_LENGTH server-side. */
export const MIN_LEAGUE_TAG = 2;
export const MAX_LEAGUE_TAG = 5;

/**
 * What the tag input keeps as a director types: letters and digits only,
 * uppercase, capped. The server applies the same rules and rejects the rest.
 */
export function normalizeLeagueTagInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_LEAGUE_TAG);
}

/** A complete tag (or blank, which clears it). */
export function isValidLeagueTag(tag: string): boolean {
  return tag === '' || (tag.length >= MIN_LEAGUE_TAG && /^[A-Z0-9]+$/.test(tag));
}

/** The league's tag, or null when its commissioner hasn't set one. */
export function getLeagueAbbreviation(league: IdentityLike): string | null {
  const tag = league?.abbreviation;
  return typeof tag === 'string' && tag.length >= MIN_LEAGUE_TAG ? tag : null;
}

/**
 * A starting suggestion from the league name: the initials of a multi-word
 * name ("Drum Corps Fantasy League" → "DCFL"), or the head of a one-word name.
 */
export function suggestLeagueTag(name: string): string {
  const words = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const candidate = words.length === 1 ? words[0].slice(0, 4) : words.map((w) => w[0]).join('');
  const tag = candidate.slice(0, MAX_LEAGUE_TAG);
  return tag.length >= MIN_LEAGUE_TAG ? tag : '';
}

/**
 * Whether a league of this game mode pairs a corps of this class — Podium is
 * its own game; every other class is Fantasy. Mirrors gameModeOfClass in
 * functions/src/helpers/leagueIdentity.js.
 */
export function gameModeCoversClass(mode: LeagueGameMode, classKey: CorpsClass): boolean {
  if (mode === 'both') return true;
  return (classKey === 'podiumClass' ? 'podium' : 'fantasy') === mode;
}

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
