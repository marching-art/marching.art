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

export const ROADMAP_STATUS_META: Record<
  RoadmapStatus,
  { label: string; textClass: string }
> = {
  in_progress: { label: 'In progress', textClass: 'text-teal-400' },
  planned: { label: 'Planned', textClass: 'text-interactive' },
  exploring: { label: 'Exploring', textClass: 'text-muted' },
};

// -----------------------------------------------------------------------------
// CHANGELOG — newest first. Add new entries at the TOP.
// -----------------------------------------------------------------------------

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-08-11-press-releases',
    date: '2026-08-11',
    title: 'Post press releases for your corps',
    category: 'feature',
    summary:
      'Your organization now has a voice. Publish press releases about your own corps — instantly, no review — and they land in the news feed under your byline.',
    highlights: [
      'Share reveals, staff moves, results, and rivalries from your corps’ point of view.',
      'Publishes the moment you post it, with a PRESS RELEASE badge in the feed.',
      'Distinct from Submit an Article, which covers the wider circuit and is reviewed.',
      'You can remove your own releases at any time.',
    ],
  },
  {
    id: '2026-08-11-podium-veteran-head-start',
    date: '2026-08-11',
    title: 'Podium veterans start closer to form',
    category: 'balance',
    summary:
      'A returning Podium corps now opens the season with a head start scaled to how engaged it was last season, so continuity is rewarded without erasing the climb.',
  },
  {
    id: '2026-08-10-daily-loop',
    date: '2026-08-10',
    title: 'A sharper daily loop',
    category: 'improvement',
    summary:
      'The daily challenges were rebuilt around real same-day actions, with clearer XP and a weekly streak that pays out as you go.',
    highlights: [
      'Challenges now track genuine actions you take that day.',
      'Tiered XP: 10 for a core challenge, 20 for the daily stretch.',
      'The weekly arc is a graduated ladder — rewards at 3, 5, and 7 active days.',
    ],
  },
  {
    id: '2026-08-10-podium-hosting-schedule',
    date: '2026-08-10',
    title: 'Director-hosted shows, clearer schedules',
    category: 'improvement',
    summary:
      'Podium hosting and the schedule got a polish pass: director-hosted shows are called out and detailed, venues resolve to standardized "City, ST" locations, and Podium scores nightly at 9 PM ET year-round.',
    highlights: [
      'Hosted shows show the hosting director and full rosters, Podium corps included.',
      'Schedule locations standardized to two-letter state codes.',
      'Podium divisions are seated at the reset so promotions reach scoring.',
    ],
  },
  {
    id: '2026-08-09-podium-season-lifecycle',
    date: '2026-08-09',
    title: 'Podium: season assessment & a feature-length Report',
    category: 'feature',
    summary:
      'Podium gained a season-start assessment and corps-lifecycle decisions at registration, and the daily Podium Report was rewritten as a full power-rankings column.',
  },
  {
    id: '2026-08-09-finals-reveal',
    date: '2026-08-09',
    title: 'Finals night scores now reveal',
    category: 'fix',
    summary:
      'Day 49 finals scores in the Fantasy classes now reveal correctly, so the season closes on the result it should.',
  },
  {
    id: '2026-07-retention-growth',
    date: '2026-07-28',
    title: 'Score-drop alerts & shareable score cards',
    category: 'feature',
    summary:
      'The nightly score drop finally reaches you: a morning push when results land, a Discord embed, and shareable score cards with public, crawlable results pages behind every link.',
    highlights: [
      'Morning notification when the night’s scores publish.',
      'Share a score and it opens a public results page for that day.',
      'Legacy Endowments added a lasting, commemorative way to spend CorpsCoin.',
    ],
  },
];

// -----------------------------------------------------------------------------
// ROADMAP — what's coming. Honest, not a promise of dates. Ordered by nearness.
// -----------------------------------------------------------------------------

export const ROADMAP: RoadmapItem[] = [
  {
    id: 'profile-newsroom',
    title: 'A newsroom on your profile',
    description:
      'Every press release your corps has published, gathered on your director profile as your organization’s ongoing story.',
    status: 'in_progress',
  },
  {
    id: 'community-feed',
    title: 'A community feed across leagues',
    description:
      'A shared, site-wide place for the whole community to talk — not siloed inside individual league chats.',
    status: 'planned',
  },
  {
    id: 'staff-writers',
    title: 'Credited community writers',
    description:
      'A masthead of directors who cover the circuit, with a byline and a place on the news team.',
    status: 'planned',
  },
  {
    id: 'corps-identity',
    title: 'Deeper corps identity & cosmetics',
    description:
      'More ways to make your corps unmistakably yours — uniform design, program pages, and cosmetic flair.',
    status: 'exploring',
  },
];

// -----------------------------------------------------------------------------
// PURE HELPERS — drive the "unseen updates" badge. Unit-tested.
// -----------------------------------------------------------------------------

/** The id of the most recent update, or null when the log is empty. */
export function latestUpdateId(entries: ChangelogEntry[] = CHANGELOG): string | null {
  return entries.length > 0 ? entries[0].id : null;
}

/**
 * How many updates are newer than the one the director last saw. Entries are
 * newest-first, so everything above `lastSeenId` is unseen. A null watermark
 * (never visited) counts the whole log; an unrecognized watermark — the entry
 * scrolled off, or ids changed — is treated as "never seen" rather than
 * silently showing zero.
 */
export function countUnseenUpdates(
  lastSeenId: string | null,
  entries: ChangelogEntry[] = CHANGELOG
): number {
  if (!lastSeenId) return entries.length;
  const index = entries.findIndex((e) => e.id === lastSeenId);
  return index === -1 ? entries.length : index;
}
