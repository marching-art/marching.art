// @ts-nocheck -- matches the surrounding league JSX; typed when the folder is
// LeagueHallOfFame - the league's permanent record.
//
// Season archival has always written a `champions[]` entry onto every league:
// the winner, their corps, their score, the season. Nothing ever showed it to
// anybody. It is the single best piece of clubhouse content already sitting in
// the database — a league with three seasons behind it has a history, and a
// history is most of what makes a place feel like somewhere you belong.
//
// New entries also carry the record, the seed, and how the title was decided
// (helpers/leagueChampion.js). Older ones don't, so every field below degrades.

import React, { useMemo, useState } from 'react';
import { Crown, Trophy, ChevronDown, Flame } from 'lucide-react';

/** Newest first, tolerating legacy entries with no archivedAt. */
function sortChampions(champions) {
  return [...champions].sort((a, b) => {
    const aTime = a.archivedAt?.toMillis?.() ?? a.archivedAt?.seconds ?? 0;
    const bTime = b.archivedAt?.toMillis?.() ?? b.archivedAt?.seconds ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return String(b.seasonId || '').localeCompare(String(a.seasonId || ''));
  });
}

/**
 * Titles per director, and the longest run of consecutive titles — the two
 * numbers a league argues about.
 */
function buildDynasties(ordered) {
  const counts = new Map();
  ordered.forEach((c) => {
    if (!c.winnerId) return;
    counts.set(c.winnerId, (counts.get(c.winnerId) || 0) + 1);
  });

  // `ordered` is newest-first, so walk it as-is; a run is a run either way.
  let bestStreak = { uid: null, name: null, length: 0 };
  let runUid = null;
  let runLength = 0;
  ordered.forEach((c) => {
    if (c.winnerId && c.winnerId === runUid) {
      runLength += 1;
    } else {
      runUid = c.winnerId;
      runLength = c.winnerId ? 1 : 0;
    }
    if (runLength > bestStreak.length) {
      bestStreak = { uid: runUid, name: c.winnerUsername, length: runLength };
    }
  });

  return { counts, bestStreak };
}

const RecordLine = ({ champion }) => {
  const record = champion.record;
  const parts = [];
  if (record) {
    parts.push(`${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`);
  }
  if (champion.seed) parts.push(`#${champion.seed} seed`);
  if (champion.decidedBy === 'finals') parts.push('won at Finals');
  else if (champion.decidedBy === 'standings') parts.push('won the regular season');

  if (parts.length === 0) return null;
  return <span className="text-[10px] text-muted">{parts.join(' · ')}</span>;
};

const LeagueHallOfFame = ({ league, userProfile }) => {
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(() => sortChampions(league?.champions || []), [league?.champions]);
  const { counts, bestStreak } = useMemo(() => buildDynasties(ordered), [ordered]);

  // A league in its first season has no history yet, and an empty trophy case
  // is worse than no trophy case — say what earns a place in it instead.
  if (ordered.length === 0) {
    return (
      <div className="bg-surface-card border border-line">
        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
          <Trophy className="w-4 h-4 text-brand" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Hall of Champions
          </span>
        </div>
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-muted">No champion crowned yet.</p>
          <p className="text-[10px] text-muted mt-1">
            The top seeds reach Finals, and Finals night decides the first name on this list.
          </p>
        </div>
      </div>
    );
  }

  const visible = expanded ? ordered : ordered.slice(0, 3);

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-brand" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Hall of Champions
          </span>
        </div>
        <span className="text-[10px] font-data tabular-nums text-muted">
          {ordered.length} {ordered.length === 1 ? 'season' : 'seasons'}
        </span>
      </div>

      {bestStreak.length > 1 && (
        <div className="px-4 py-2 bg-surface-sunken border-b border-line-subtle flex items-center gap-2">
          <Flame className="w-3 h-3 text-brand flex-shrink-0" />
          <span className="text-[10px] text-muted">
            Longest dynasty:{' '}
            <span className="text-white font-bold">{bestStreak.name || 'Unknown'}</span>,{' '}
            {bestStreak.length} straight
          </span>
        </div>
      )}

      <div className="divide-y divide-line-subtle">
        {visible.map((champion, index) => {
          const isYou = champion.winnerId && champion.winnerId === userProfile?.uid;
          const titles = counts.get(champion.winnerId) || 1;
          return (
            <div
              key={`${champion.seasonId || champion.seasonName}-${champion.winnerId || index}`}
              className="px-4 py-3 flex items-center gap-3"
            >
              <div
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border ${
                  index === 0 && !expanded
                    ? 'bg-brand/10 border-brand/40'
                    : 'bg-surface-raised border-line'
                }`}
              >
                <Crown className={`w-4 h-4 ${index === 0 ? 'text-brand' : 'text-muted'}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate">
                    {isYou ? 'You' : champion.winnerUsername || 'Unknown'}
                  </span>
                  {titles > 1 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand bg-surface-raised flex-shrink-0">
                      ×{titles}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted truncate">
                    {champion.seasonName || champion.seasonId}
                    {champion.winnerCorpsName ? ` — ${champion.winnerCorpsName}` : ''}
                  </span>
                </div>
                <RecordLine champion={champion} />
              </div>

              {typeof champion.score === 'number' && champion.score > 0 && (
                <span className="text-sm font-bold font-data tabular-nums text-brand flex-shrink-0">
                  {champion.score.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {ordered.length > 3 && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full py-2.5 min-h-touch border-t border-line text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white transition-colors flex items-center justify-center gap-1.5"
        >
          {expanded ? 'Show less' : `Show all ${ordered.length} seasons`}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};

export default LeagueHallOfFame;
