/**
 * Captions — the single source of truth for the eight scoring captions a corps
 * is judged on, their canonical order, display names, and grouping.
 *
 * Before this module the same list was hand-copied in ~10 places (dashboard
 * constants, the guest dashboard, onboarding, the how-to-play guide, the season
 * setup wizard, the podium/mastery/pricing/admin ID arrays, and GAME_CONFIG).
 * Adding or renaming a caption meant editing every copy and hoping none drifted.
 * Everything now derives from CAPTION_IDS / CAPTIONS here.
 *
 * Deliberately NOT centralized: the per-context editorial `description` copy and
 * per-view color palettes. Those legitimately differ between the onboarding
 * flow, the guide, and the wizard, so each keeps its own — this module owns the
 * structural facts (which captions exist, their order, names, and groups).
 */

/** Coarse scoring group each caption rolls up into. */
export type CaptionGroup = 'ge' | 'vis' | 'mus';

/**
 * The eight caption ids in canonical judging order. A readonly literal tuple so
 * `(typeof CAPTION_IDS)[number]` is the exact caption union (see CaptionId),
 * not a widened `string`.
 */
export const CAPTION_IDS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'] as const;

/** Union of the eight valid caption ids. */
export type CaptionId = (typeof CAPTION_IDS)[number];

export interface CaptionDef {
  /** Stable key used everywhere in data and lineups, e.g. 'GE1'. */
  id: CaptionId;
  /** Compact display label. Same as id except Brass/Percussion get words. */
  label: string;
  /** Human-readable full name, e.g. 'General Effect 1'. */
  fullName: string;
  /** Coarse group key. */
  group: CaptionGroup;
  /** Human-readable group name, e.g. 'General Effect' | 'Visual' | 'Music'. */
  groupLabel: string;
}

// Metadata keyed by id. Typed as Record<CaptionId, ...> so a caption added to
// CAPTION_IDS is a compile error until its metadata is filled in here — the two
// can't silently drift.
const CAPTION_META: Record<CaptionId, Omit<CaptionDef, 'id'>> = {
  GE1: { label: 'GE1', fullName: 'General Effect 1', group: 'ge', groupLabel: 'General Effect' },
  GE2: { label: 'GE2', fullName: 'General Effect 2', group: 'ge', groupLabel: 'General Effect' },
  VP: { label: 'VP', fullName: 'Visual Proficiency', group: 'vis', groupLabel: 'Visual' },
  VA: { label: 'VA', fullName: 'Visual Analysis', group: 'vis', groupLabel: 'Visual' },
  CG: { label: 'CG', fullName: 'Color Guard', group: 'vis', groupLabel: 'Visual' },
  B: { label: 'Brass', fullName: 'Brass', group: 'mus', groupLabel: 'Music' },
  MA: { label: 'MA', fullName: 'Music Analysis', group: 'mus', groupLabel: 'Music' },
  P: { label: 'Perc', fullName: 'Percussion', group: 'mus', groupLabel: 'Music' },
};

export const CAPTIONS: readonly CaptionDef[] = CAPTION_IDS.map((id) => ({
  id,
  ...CAPTION_META[id],
}));

/** id -> full name, e.g. { GE1: 'General Effect 1', ... }. */
export const CAPTION_NAMES: Record<CaptionId, string> = Object.fromEntries(
  CAPTIONS.map((c) => [c.id, c.fullName])
) as Record<CaptionId, string>;

/** Lookup a caption definition by id. */
export function getCaption(id: string): CaptionDef | undefined {
  return CAPTIONS.find((c) => c.id === id);
}
