// =============================================================================
// DIRECTORS — the player directory: every director, searchable
// =============================================================================
// Deliberately basic. One search box, one alphabetical list. Every row links
// to the director's in-app profile (/profile/{uid}). The whole directory
// arrives in one call (src/api/directors.ts — signed-in only, built from each
// director's public profile projection, so nothing here can show more than a
// profile page already does) and search filters it locally, matching
// username, display name and corps names.

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, X, MapPin, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { listDirectors, type DirectorSearchEntry } from '../api/directors';
import { filterDirectors, toDirectorQuery } from '../utils/directorSearch';
import { avatarHue, avatarInitials } from '../utils/chatFormat';
import { CORPS_CLASS_SHORT_LABELS } from '../utils/corps';

const DIRECTORY_QUERY_KEY = ['directors'] as const;

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

const DirectorRow: React.FC<{ entry: DirectorSearchEntry; isViewer: boolean }> = ({
  entry,
  isViewer,
}) => (
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

const Directors: React.FC = () => {
  const user = useAuth()?.user;
  const [input, setInput] = useState('');

  const directory = useQuery({
    queryKey: DIRECTORY_QUERY_KEY,
    queryFn: async () => (await listDirectors()).data,
    staleTime: 5 * 60 * 1000,
  });

  const all = useMemo(() => directory.data?.directors ?? [], [directory.data]);
  const query = toDirectorQuery(input);
  const shown = useMemo(() => filterDirectors(all, input), [all, input]);
  const searching = query !== '';

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <PageHeader
        icon={Users}
        title="Directors"
        subtitle="Find another director and open their profile"
        stats={
          all.length > 0
            ? searching
              ? [
                  { label: 'Matches', value: shown.length },
                  { label: 'Directors', value: all.length },
                ]
              : [{ label: 'Directors', value: all.length }]
            : undefined
        }
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
          Matches usernames, display names and corps names. Leave it empty to browse everyone A–Z.
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {directory.isPending ? (
          <div
            className="flex items-center justify-center gap-2 py-12 text-sm text-muted"
            role="status"
          >
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading directors…
          </div>
        ) : directory.isError ? (
          <div className="py-12 px-4 text-center text-sm text-muted" role="alert">
            <p>Couldn&apos;t load directors right now.</p>
            <button
              type="button"
              onClick={() => directory.refetch()}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-surface-card text-secondary border border-line hover:text-white hover:bg-white/5 transition-colors"
            >
              Try again
            </button>
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
          <ul className="max-w-3xl">
            {shown.map((entry) => (
              <DirectorRow key={entry.uid} entry={entry} isViewer={entry.uid === user?.uid} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Directors;
