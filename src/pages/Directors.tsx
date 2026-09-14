// =============================================================================
// DIRECTORS — the player directory: every director, a page at a time
// =============================================================================
// One search box, one alphabetical list. Every row links to the director's
// in-app profile (/profile/{uid}). Rows come straight from the `directory`
// index (src/api/directors.ts): browsing pages through it 50 at a time as you
// scroll, a search is one indexed read of at most 50 candidates checked
// locally against every typed word, and the header total is a count()
// aggregation. Nothing here can show more than a profile page already does.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Users, Search, X, MapPin, Loader2, ChevronDown } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  fetchDirectoryCount,
  fetchDirectoryPage,
  searchDirectory,
  type DirectorSearchEntry,
  type DirectoryPage,
} from '../api/directors';
import { matchesAllWords, queryWords, searchTokenFor } from '../utils/directorSearch';
import { avatarHue, avatarInitials } from '../utils/chatFormat';
import { CORPS_CLASS_SHORT_LABELS } from '../utils/corps';

const DEBOUNCE_MS = 250;
const STALE_MS = 5 * 60 * 1000;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const DirectorAvatar: React.FC<{ entry: DirectorSearchEntry }> = ({ entry }) => {
  const [broken, setBroken] = useState(false);
  if (entry.photoURL && !broken) {
    return (
      <img
        src={entry.photoURL}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="w-10 h-10 flex-shrink-0 object-cover bg-line"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white select-none"
      style={{ backgroundColor: `hsl(${avatarHue(entry.uid)} 45% 32%)` }}
    >
      {avatarInitials(entry.displayName)}
    </div>
  );
};

const DirectorRow = React.memo(function DirectorRow({
  entry,
  isViewer,
}: {
  entry: DirectorSearchEntry;
  isViewer: boolean;
}) {
  return (
    <li>
      <Link
        to={`/profile/${entry.uid}`}
        className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-line hover:bg-surface-raised transition-colors"
      >
        <DirectorAvatar entry={entry} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{entry.displayName}</span>
            <span className="text-xs text-muted truncate">@{entry.username}</span>
            {isViewer && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-interactive/15 text-interactive border border-interactive/40">
                You
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[11px] text-muted">
            <span className="text-secondary">Lv {entry.xpLevel}</span>
            {entry.userTitle && <span>{entry.userTitle}</span>}
            {entry.location && (
              <span className="inline-flex items-center gap-0.5 truncate">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {entry.location}
              </span>
            )}
            {entry.seasonsPlayed > 0 && (
              <span>
                {entry.seasonsPlayed} {entry.seasonsPlayed === 1 ? 'season' : 'seasons'}
              </span>
            )}
          </div>
          {entry.corps.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {entry.corps.map((corps) => (
                <span
                  key={corps.classKey}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-surface-card border border-line text-secondary max-w-full"
                >
                  <span className="text-muted uppercase tracking-wider text-[9px] font-bold flex-shrink-0">
                    {CORPS_CLASS_SHORT_LABELS[corps.classKey] || corps.classKey}
                  </span>
                  <span className="truncate">{corps.corpsName}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
});

/** Fires `onVisible` whenever the sentinel scrolls into view (no-op without IntersectionObserver). */
const LoadMoreSentinel: React.FC<{ onVisible: () => void; enabled: boolean }> = ({
  onVisible,
  enabled,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onVisible();
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, onVisible]);
  return <div ref={ref} aria-hidden="true" className="h-px" />;
};

const Directors: React.FC = () => {
  const user = useAuth()?.user;
  const [input, setInput] = useState('');
  const debounced = useDebouncedValue(input, DEBOUNCE_MS);
  const words = useMemo(() => queryWords(debounced), [debounced]);
  const token = useMemo(() => searchTokenFor(debounced), [debounced]);
  const searching = input.trim() !== '';

  const browse = useInfiniteQuery({
    queryKey: ['directory', 'browse'],
    queryFn: ({ pageParam }) => fetchDirectoryPage(pageParam),
    initialPageParam: null as DirectoryPage['cursor'],
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: STALE_MS,
    enabled: !searching,
  });

  const search = useQuery({
    queryKey: ['directory', 'search', token],
    queryFn: () => searchDirectory(token),
    enabled: searching && token !== '',
    staleTime: STALE_MS,
  });

  const total = useQuery({
    queryKey: ['directory', 'count'],
    queryFn: fetchDirectoryCount,
    staleTime: STALE_MS,
  });

  const browsed = useMemo(
    () => browse.data?.pages.flatMap((page) => page.directors) ?? [],
    [browse.data]
  );
  const matches = useMemo(
    () => (search.data ?? []).filter((entry) => matchesAllWords(entry, words)),
    [search.data, words]
  );
  const shown = searching ? matches : browsed;
  // The debounce and the query both lag the keystroke; treat either as loading.
  const searchPending = searching && (debounced !== input || (token !== '' && search.isPending));
  const loading = searching ? searchPending : browse.isPending;
  const error = searching ? search.isError : browse.isError;
  const retry = searching ? search.refetch : browse.refetch;

  const stats = [];
  if (searching && !searchPending && token !== '')
    stats.push({ label: 'Matches', value: matches.length });
  if (typeof total.data === 'number') stats.push({ label: 'Directors', value: total.data });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <PageHeader
        icon={Users}
        title="Directors"
        subtitle="Find another director and open their profile"
        stats={stats.length > 0 ? stats : undefined}
      />

      {/* Search — fixed under the header */}
      <div className="flex-shrink-0 bg-surface-sunken border-b border-line px-3 py-2">
        <div className="relative max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search by username, name or corps"
            aria-label="Search directors"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full pl-9 pr-9 py-2 text-sm bg-surface-card text-white placeholder:text-muted border border-line focus:outline-none focus:border-interactive rounded-none"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted">
          Type the start of a username, a name or a corps name. Leave it empty to browse everyone
          A–Z.
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-12 text-sm text-muted"
            role="status"
          >
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {searching ? 'Searching…' : 'Loading directors…'}
          </div>
        ) : error ? (
          <div className="py-12 px-4 text-center text-sm text-muted" role="alert">
            <p>Couldn&apos;t load directors right now.</p>
            <button
              type="button"
              onClick={() => retry()}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-surface-card text-secondary border border-line hover:text-white hover:bg-white/5 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : searching && token === '' ? (
          <div className="py-12 px-4 text-center text-sm text-muted">
            Keep typing — at least two letters of a word.
          </div>
        ) : shown.length === 0 ? (
          <div className="py-12 px-4 text-center text-sm text-muted">
            {searching ? (
              <>
                No director matches <span className="text-secondary">“{input.trim()}”</span>.
              </>
            ) : (
              'No directors to show yet.'
            )}
          </div>
        ) : (
          <>
            <ul className="max-w-3xl">
              {shown.map((entry) => (
                <DirectorRow key={entry.uid} entry={entry} isViewer={entry.uid === user?.uid} />
              ))}
            </ul>
            {!searching && browse.hasNextPage && (
              <div className="max-w-3xl px-3 py-3">
                <LoadMoreSentinel
                  enabled={!browse.isFetchingNextPage}
                  onVisible={() => browse.fetchNextPage()}
                />
                <button
                  type="button"
                  onClick={() => browse.fetchNextPage()}
                  disabled={browse.isFetchingNextPage}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 min-h-touch text-[10px] font-bold uppercase tracking-wider bg-surface-card text-secondary border border-line hover:text-white hover:bg-white/5 disabled:opacity-60 transition-colors"
                >
                  {browse.isFetchingNextPage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {browse.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
            {searching && matches.length >= 50 && (
              <p className="max-w-3xl px-3 py-3 text-[10px] text-muted">
                Showing the first 50 matches — add another word to narrow it down.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Directors;
