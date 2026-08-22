// =============================================================================
// GAME UPDATES PAGE — /updates
// =============================================================================
// The player-facing "what's new & what's coming" surface. Public and crawlable
// on purpose: it answers "is this game still being worked on?" for returning
// directors AND prospective players, the exact question the predecessor game
// lost its community to (docs/FMA_LESSONS.md, lesson 2). Content is the
// repo-committed log in src/data/changelog.ts; opening this page clears the
// unseen-updates badge.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Wrench, Scale, Bug, Hammer, CalendarClock, Compass } from 'lucide-react';
import { Heading } from '../components/ui';
import { useSEO } from '../hooks/useSEO';
import { useUnseenUpdates } from '../hooks/useUnseenUpdates';
import {
  CHANGELOG,
  ROADMAP,
  UPDATE_CATEGORY_META,
  ROADMAP_STATUS_META,
  type ChangelogEntry,
  type RoadmapItem,
  type UpdateCategory,
  type RoadmapStatus,
} from '../data/changelog';

// How many changelog cards to render before the reader has to scroll for more.
// The list grows without bound (a new entry per merged, player-facing PR), but a
// director almost never needs the whole history — so we render an initial batch
// and reveal the rest lazily as they scroll toward the bottom. The initial batch
// stays comfortably large so recent updates (and the SEO-relevant content) are in
// the DOM on first paint.
const INITIAL_VISIBLE = 8;
const LOAD_BATCH = 8;

const CATEGORY_ICON: Record<UpdateCategory, typeof Sparkles> = {
  feature: Sparkles,
  improvement: Wrench,
  balance: Scale,
  fix: Bug,
};

const STATUS_ICON: Record<RoadmapStatus, typeof Sparkles> = {
  in_progress: Hammer,
  planned: CalendarClock,
  exploring: Compass,
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const CategoryBadge: React.FC<{ category: UpdateCategory }> = ({ category }) => {
  const meta = UPDATE_CATEGORY_META[category];
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${meta.textClass} ${meta.bgClass} ${meta.borderClass}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const ChangelogCard: React.FC<{ entry: ChangelogEntry }> = ({ entry }) => (
  <article className="bg-surface-card border border-line rounded-none p-4">
    <div className="flex items-center justify-between gap-3 mb-2">
      <CategoryBadge category={entry.category} />
      <time className="text-[11px] text-muted tabular-nums" dateTime={entry.date}>
        {formatDate(entry.date)}
      </time>
    </div>
    <Heading level="section" as="h3" className="mb-1">
      {entry.title}
    </Heading>
    <p className="text-sm text-secondary">{entry.summary}</p>
    {entry.highlights && entry.highlights.length > 0 && (
      <ul className="mt-3 space-y-1.5">
        {entry.highlights.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted">
            <span className="mt-1.5 w-1 h-1 bg-interactive shrink-0" aria-hidden="true" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    )}
  </article>
);

const RoadmapCard: React.FC<{ item: RoadmapItem }> = ({ item }) => {
  const meta = ROADMAP_STATUS_META[item.status];
  const Icon = STATUS_ICON[item.status];
  return (
    <article className="bg-surface-card border border-line rounded-none p-4 flex items-start gap-3">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.textClass}`} aria-hidden="true" />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3 mb-1">
          <Heading level="section" as="h3">
            {item.title}
          </Heading>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.textClass}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-sm text-secondary">{item.description}</p>
      </div>
    </article>
  );
};

const Updates: React.FC = () => {
  useSEO({
    title: 'What’s New in marching.art — Updates & Roadmap',
    description:
      'The latest updates to marching.art and what’s coming next: new features, improvements, balance changes, and the road ahead for the year-round fantasy drum corps game.',
    path: '/updates',
  });

  const { markAllSeen } = useUnseenUpdates();

  // Opening the page is the "I've seen these" signal — clear the badge.
  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  // Lazy-load the changelog: render an initial batch, reveal more as the reader
  // approaches the end of the list.
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const hasMore = visibleCount < CHANGELOG.length;
  const visibleEntries = CHANGELOG.slice(0, visibleCount);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(count + LOAD_BATCH, CHANGELOG.length));
  }, []);

  // Auto-reveal the next batch when the sentinel scrolls into view. Guarded so it
  // degrades to the "Show more" button where IntersectionObserver is unavailable
  // (older browsers, the SSR/first-paint path, jsdom in tests).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleCount]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Heading level="display" as="h1" className="leading-tight mb-3">
          What’s New
        </Heading>
        <p className="text-secondary">
          marching.art is built in the open, all year. Here’s what’s shipped recently — and what’s
          on the horizon.
        </p>
      </header>

      <section aria-labelledby="updates-recent" className="mb-12">
        <Heading level="title" as="h2" id="updates-recent" className="mb-4">
          Recent updates
        </Heading>
        <div className="space-y-3">
          {visibleEntries.map((entry) => (
            <ChangelogCard key={entry.id} entry={entry} />
          ))}
        </div>
        {hasMore && (
          <>
            {/* Scroll sentinel: crossing into view reveals the next batch. */}
            <div ref={sentinelRef} aria-hidden="true" className="h-px" />
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-interactive border border-interactive/40 bg-interactive/10 rounded-none hover:bg-interactive/20 transition-colors"
              >
                Show more updates
              </button>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="updates-roadmap">
        <Heading level="title" as="h2" id="updates-roadmap" className="mb-1">
          On the horizon
        </Heading>
        <p className="text-xs text-muted mb-4">
          Where we’re headed next. Directions, not dated promises.
        </p>
        <div className="space-y-3">
          {ROADMAP.map((item) => (
            <RoadmapCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Updates;
