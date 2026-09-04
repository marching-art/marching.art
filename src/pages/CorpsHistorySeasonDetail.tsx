// Season detail (score, weekly breakdown, lineup) for one archived season.
// Rendered in the desktop side panel of Corps History and, on mobile, inside a
// full-screen sheet (hence the optional `onClose`). `detail` is the
// lazily-loaded detail doc; legacy rows carry the heavy fields inline on
// `season` itself. Split from CorpsHistory.jsx (max-lines guardrail).

import React from 'react';
import { Trophy, Target, BarChart3, X } from 'lucide-react';
import { getSoundSportRating } from '../utils/scoresUtils';
import SeasonUniformSection, {
  type SeasonUniformCompact,
  type SeasonUniformSnapshot,
} from '../components/uniform/SeasonUniformSection';

/** One archived season row, as much of it as this panel reads. */
export interface ArchivedSeasonRow {
  seasonName?: string;
  archivedAt?: { seconds: number } | null;
  totalSeasonScore?: number;
  highestWeeklyScore?: number;
  showsAttended?: number;
  /** Legacy rows carry the weekly scores and lineup inline. */
  weeklyScores?: Record<string, number> | null;
  lineup?: Record<string, string> | null;
  uniform?: SeasonUniformCompact | null;
  uniformGuard?: SeasonUniformCompact | null;
}

/** The lazily-loaded seasonDetail doc for that season. */
export interface ArchivedSeasonDetail {
  weeklyScores?: Record<string, number> | null;
  lineup?: Record<string, string> | null;
  uniformSnapshot?: SeasonUniformSnapshot | null;
  uniformGuardSnapshot?: SeasonUniformSnapshot | null;
}

export default function SeasonDetail({
  season,
  detail,
  isSoundSportView,
  onClose,
}: {
  season: ArchivedSeasonRow;
  detail: ArchivedSeasonDetail;
  isSoundSportView: boolean;
  onClose?: () => void;
}) {
  const weeklyScores: Record<string, number> =
    Object.keys(season.weeklyScores || {}).length > 0
      ? season.weeklyScores || {}
      : detail.weeklyScores || {};
  const lineup = season.lineup || detail.lineup || null;
  const weeks = Object.keys(weeklyScores).sort();
  const totalSeasonScore = season.totalSeasonScore || 0;
  const highestWeeklyScore = season.highestWeeklyScore || 0;

  return (
    <>
      {/* Panel Header */}
      <div className="flex-shrink-0 p-4 border-b border-line flex items-center gap-3">
        <div className="w-10 h-10 rounded-none bg-surface-raised flex items-center justify-center flex-shrink-0">
          <Trophy className="w-5 h-5 text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white truncate">{season.seasonName}</h3>
          <p className="text-xs text-muted/60">
            {season.archivedAt
              ? new Date(season.archivedAt.seconds * 1000).toLocaleDateString()
              : 'Unknown date'}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close season details"
            className="w-9 h-9 rounded-none bg-surface-raised flex items-center justify-center text-muted hover:text-white flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 space-y-4">
        {/* Final Score / Rating */}
        <div className="bg-surface-raised border border-line rounded-none p-4 text-center">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            {isSoundSportView ? 'Rating' : 'Final Score'}
          </p>
          <p className="text-3xl font-bold text-white font-mono">
            {isSoundSportView
              ? totalSeasonScore > 0
                ? getSoundSportRating(totalSeasonScore)
                : '—'
              : totalSeasonScore.toFixed(3)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-sunken border border-line rounded-none p-3 text-center">
            <p className="text-[10px] text-muted/60 uppercase tracking-wide mb-1">Best Week</p>
            <p className="text-xl font-mono font-bold text-white">
              {isSoundSportView
                ? highestWeeklyScore > 0
                  ? getSoundSportRating(highestWeeklyScore)
                  : '—'
                : highestWeeklyScore.toFixed(3)}
            </p>
          </div>
          <div className="bg-surface-sunken border border-line rounded-none p-3 text-center">
            <p className="text-[10px] text-muted/60 uppercase tracking-wide mb-1">Shows</p>
            <p className="text-xl font-mono font-bold text-white">{season.showsAttended || 0}</p>
          </div>
        </div>

        {/* Uniform History (docs/UNIFORM_STUDIO.md §6) */}
        <SeasonUniformSection
          compact={season.uniform}
          snapshot={detail.uniformSnapshot}
          guardCompact={season.uniformGuard}
          guardSnapshot={detail.uniformGuardSnapshot}
        />

        {/* Weekly Performance */}
        {weeks.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Weekly Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {weeks.map((week) => (
                <div
                  key={week}
                  className="bg-surface-raised rounded-none p-2 flex items-center justify-between"
                >
                  <span className="text-xs text-muted/60">{week}</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {isSoundSportView
                      ? weeklyScores[week] > 0
                        ? getSoundSportRating(weeklyScores[week])
                        : '—'
                      : (weeklyScores[week] || 0).toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lineup */}
        {lineup && Object.keys(lineup).length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Season Lineup
            </h4>
            <div className="space-y-2">
              {Object.entries(lineup).map(([caption, value]) => {
                const [corpsName] = (value || '').split('|');
                return (
                  <div key={caption} className="bg-surface-raised rounded-none p-2">
                    <div className="text-[10px] text-muted/60 uppercase">{caption}</div>
                    <div className="text-sm font-semibold text-white truncate">
                      {corpsName || 'Not Set'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
