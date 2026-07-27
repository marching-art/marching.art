// LeagueCareerCard — one director's whole history in this league.
//
// The standings show what you have done since the last rollover. Everything
// before that was archived and never shown again, so a league in its fourth
// season could tell a member nothing about their first three: not their record,
// not their titles, and not the fact that they are 1-7 lifetime against the
// person they are drawn with again this week.
//
// Derived from the matchup weeks the Record Book already loads
// (utils/leagueCareer.ts) — no new documents, nothing to keep in sync.

import React, { useMemo, useState } from 'react';
import { ChevronDown, Crown, History, Swords, TrendingUp } from 'lucide-react';

import { computeMemberCareer, formatRecord, type CareerChampion } from '../../utils/leagueCareer';
import type { RecordWeekDoc } from '../../utils/leagueRecords';

interface LeagueCareerCardProps {
  uid: string;
  matchupDocs?: RecordWeekDoc[];
  corpsClasses: string[];
  champions?: CareerChampion[];
  getDisplayName: (uid: string) => string;
  viewerUid?: string;
  /** Season display names keyed by season uid, when the league has them. */
  seasonNames?: Record<string, string>;
}

/** How many head-to-head rows to show before the fold. */
const OPPONENTS_SHOWN = 4;

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="px-3 py-2">
    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">{label}</span>
    <span
      className={`block text-sm font-bold font-data tabular-nums ${
        accent ? 'text-brand' : 'text-white'
      }`}
    >
      {value}
    </span>
  </div>
);

const LeagueCareerCard = ({
  uid,
  matchupDocs = [],
  corpsClasses,
  champions = [],
  getDisplayName,
  viewerUid,
  seasonNames = {},
}: LeagueCareerCardProps) => {
  const [showAllOpponents, setShowAllOpponents] = useState(false);

  const career = useMemo(
    () => computeMemberCareer(matchupDocs, corpsClasses, uid, champions),
    [matchupDocs, corpsClasses, uid, champions]
  );

  // A member who has never played a resolved week has no career to show, and an
  // empty career card is worse than none.
  if (career.seasonsPlayed === 0 && career.titles === 0) return null;

  const isViewer = uid === viewerUid;
  const seasonLabel = (seasonUid: string | null) =>
    seasonUid === null ? 'This season' : seasonNames[seasonUid] || seasonUid;

  const opponents = showAllOpponents
    ? career.opponents
    : career.opponents.slice(0, OPPONENTS_SHOWN);

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
        <History className="w-4 h-4 text-muted" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {isViewer ? 'Your career here' : `${getDisplayName(uid)} in this league`}
        </span>
        {career.titles > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-brand">
            <Crown className="w-3 h-3" />
            {career.titles === 1 ? '1 title' : `${career.titles} titles`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 divide-x divide-line-subtle border-b border-line-subtle">
        <Stat label="Record" value={formatRecord(career)} />
        <Stat label="Win %" value={`${Math.round(career.winPercentage * 100)}%`} />
        <Stat label="Seasons" value={String(career.seasonsPlayed)} />
        <Stat
          label="Best week"
          value={career.bestWeek ? career.bestWeek.score.toFixed(1) : '—'}
          accent={!!career.bestWeek}
        />
      </div>

      {career.seasons.length > 1 && (
        <>
          <div className="px-4 py-1.5 bg-surface-sunken border-b border-line-subtle flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
              Season by season
            </span>
          </div>
          <div className="divide-y divide-line-subtle">
            {career.seasons.map((season) => (
              <div
                key={season.seasonUid ?? 'live'}
                className="px-4 py-2 flex items-center justify-between"
              >
                <span className="text-xs text-muted truncate">
                  {seasonLabel(season.seasonUid)}
                  {season.titles > 0 && <Crown className="inline w-3 h-3 text-brand ml-1.5" />}
                </span>
                <span className="text-xs font-bold font-data tabular-nums text-white flex-shrink-0">
                  {formatRecord(season)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {career.opponents.length > 0 && (
        <>
          <div className="px-4 py-1.5 bg-surface-sunken border-y border-line-subtle flex items-center gap-2">
            <Swords className="w-3 h-3 text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
              Head to head
            </span>
          </div>
          <div className="divide-y divide-line-subtle">
            {opponents.map((opponent) => {
              const ahead = opponent.wins > opponent.losses;
              const behind = opponent.losses > opponent.wins;
              return (
                <div
                  key={opponent.opponentUid}
                  className="px-4 py-2 flex items-center justify-between gap-3"
                >
                  <span className="text-xs text-white truncate">
                    {opponent.opponentUid === viewerUid
                      ? 'You'
                      : getDisplayName(opponent.opponentUid)}
                  </span>
                  <span
                    className={`text-xs font-bold font-data tabular-nums flex-shrink-0 ${
                      ahead ? 'text-green-500' : behind ? 'text-red-500' : 'text-muted'
                    }`}
                  >
                    {formatRecord(opponent)}
                  </span>
                </div>
              );
            })}
          </div>

          {career.opponents.length > OPPONENTS_SHOWN && (
            <button
              onClick={() => setShowAllOpponents((prev) => !prev)}
              className="w-full py-2.5 min-h-touch border-t border-line text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              {showAllOpponents ? 'Show fewer' : `All ${career.opponents.length} opponents`}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showAllOpponents ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default LeagueCareerCard;
