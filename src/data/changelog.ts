// =============================================================================
// GAME UPDATES — CHANGELOG & ROADMAP (single source of truth)
// =============================================================================
// The player-facing record of what's shipping and what's coming. This is a
// repo-committed data module on purpose: a changelog is about shipped code, so
// the honest, sustainable place to write it is the same PR that ships the
// change — no backend, no admin queue, no way for the log to drift from the
// build. Add a CHANGELOG entry at the top of the array whenever a change is
// worth a director's attention; move ROADMAP items up as they ship.
//
// Why this exists: the game it descends from (see docs/FMA_LESSONS.md) slowly
// lost its players to *silence* — long gaps with no visible sign the game was
// still being worked on, and a Suggestions forum full of "is this still alive?"
// marching.art ships constantly; this surface makes that cadence visible.
//
// Entries are user-facing: describe the change the way it affects a director,
// not the commit. Keep summaries to a sentence or two; use `highlights` for the
// specifics.
//
// The CHANGELOG lives in changelogEntries.json (not inline here) so a new entry
// is a one-line-per-field edit to a plain data file, not a rewrite of a
// TypeScript module. Entries are written by hand in the same PR that ships the
// change — newest first, at the top of the array — whenever the change is
// something a director would notice. See CLAUDE.md ("Player-facing changelog")
// for when and how to add one. The ROADMAP below is likewise hand-authored.
//
// The entries are loaded via a dynamic import (loadChangelog) rather than a
// static one on purpose: the full log would otherwise be bundled into the main
// app chunk, because the unseen-updates badge (in the header on every page)
// depends on this module. Dynamic-importing keeps the changelog content out of
// the initial bundle — it's fetched lazily, off the critical path, and only the
// /updates page ever renders it. The ROADMAP is small and stays inline.

export type UpdateCategory = 'feature' | 'improvement' | 'fix' | 'balance';

export interface ChangelogEntry {
  /** Stable, unique id — also the watermark the "unseen" badge compares against.
   *  Never reuse or renumber; the badge and any deep links depend on it. */
  id: string;
  /** ISO date (yyyy-mm-dd) the change went live. */
  date: string;
  title: string;
  category: UpdateCategory;
  summary: string;
  /** Optional bullet specifics shown when the entry is expanded. */
  highlights?: string[];
}

export type RoadmapStatus = 'in_progress' | 'planned' | 'exploring';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
}

/** Presentation metadata per category. Kept as plain strings (design tokens)
 *  so this module stays free of component/icon imports and unit-testable. */
export const UPDATE_CATEGORY_META: Record<
  UpdateCategory,
  { label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  feature: {
    label: 'New',
    textClass: 'text-teal-400',
    bgClass: 'bg-teal-500/15',
    borderClass: 'border-teal-500/40',
  },
  improvement: {
    label: 'Improved',
    textClass: 'text-interactive',
    bgClass: 'bg-interactive/15',
    borderClass: 'border-interactive/40',
  },
  balance: {
    label: 'Balance',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-500/15',
    borderClass: 'border-purple-500/40',
  },
  fix: {
    label: 'Fixed',
    textClass: 'text-muted',
    bgClass: 'bg-charcoal-500/20',
    borderClass: 'border-line',
  },
};

export const ROADMAP_STATUS_META: Record<RoadmapStatus, { label: string; textClass: string }> = {
  in_progress: { label: 'In progress', textClass: 'text-teal-400' },
  planned: { label: 'Planned', textClass: 'text-interactive' },
  exploring: { label: 'Exploring', textClass: 'text-muted' },
};

// -----------------------------------------------------------------------------
// CHANGELOG — newest first. Add new entries at the TOP of changelogEntries.json.
// -----------------------------------------------------------------------------

/** Cached across calls so the changelog chunk is fetched and parsed at most once
 *  per session, no matter how many consumers ask for it. */
let changelogPromise: Promise<ChangelogEntry[]> | null = null;

/** Lazily load the changelog entries. The dynamic import puts them in their own
 *  chunk, keeping the (potentially long) log out of the main bundle. */
export function loadChangelog(): Promise<ChangelogEntry[]> {
  if (!changelogPromise) {
    changelogPromise = import('./changelogEntries.json').then(
      (module) => module.default as ChangelogEntry[]
    );
  }
  return changelogPromise;
}

// -----------------------------------------------------------------------------
// ROADMAP — what's coming. Honest, not a promise of dates. Ordered by nearness.
// -----------------------------------------------------------------------------

export const ROADMAP: RoadmapItem[] = [
  {
    id: 'corps-identity',
    title: 'Deeper corps identity & cosmetics',
    description:
      'The Uniform Studio, Design Exchange, Showcase, design houses, and public program pages have landed — next up is more cosmetic flair beyond the uniform.',
    status: 'in_progress',
  },
  {
    id: 'league-formats',
    title: 'More ways for leagues to compete',
    description:
      'Caption Wars and One-Night Slate are live. Survivor- and pick’em-style formats are on the drawing board next.',
    status: 'exploring',
  },
];

// -----------------------------------------------------------------------------
// PURE HELPERS — drive the "unseen updates" badge. Unit-tested.
// -----------------------------------------------------------------------------

/** The id of the most recent update, or null when the log is empty. */
export function latestUpdateId(entries: ChangelogEntry[]): string | null {
  return entries.length > 0 ? entries[0].id : null;
}

/**
 * How many updates are newer than the one the director last saw. Entries are
 * newest-first, so everything above `lastSeenId` is unseen. A null watermark
 * (never visited) counts the whole log; an unrecognized watermark — the entry
 * scrolled off, or ids changed — is treated as "never seen" rather than
 * silently showing zero.
 */
export function countUnseenUpdates(lastSeenId: string | null, entries: ChangelogEntry[]): number {
  if (!lastSeenId) return entries.length;
  const index = entries.findIndex((e) => e.id === lastSeenId);
  return index === -1 ? entries.length : index;
}
