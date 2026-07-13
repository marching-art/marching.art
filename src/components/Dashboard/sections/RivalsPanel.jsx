// RivalsPanel - Sidebar widget showing the user's closest competitors
// Replaces the LeagueStatus widget. Reads from profile.rivals[corpsClass]
// which is populated daily by the scheduledRivalsUpdate cloud function.

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Swords, ChevronUp, ChevronDown, Minus, Medal } from 'lucide-react';
import { CLASS_SHORT_LABELS } from './constants';

const formatScore = (score) => {
  if (score == null) return '—';
  const n = Number(score);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(3);
};

const formatDelta = (delta) => {
  if (delta == null) return null;
  const n = Number(delta);
  if (Number.isNaN(n)) return null;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(3)}`;
};

const MEDAL_COLORS = {
  Gold: 'text-yellow-400',
  Silver: 'text-stone-300',
  Bronze: 'text-orange-300',
  Participation: 'text-muted',
};

const RivalsPanel = memo(({ rivals, corpsClass }) => {
  if (!corpsClass) return null;
  const list = Array.isArray(rivals) ? rivals : [];

  return (
    <div className="bg-surface-card border border-line overflow-hidden">
      <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-red-500" />
          Rivals
        </h3>
        <span className="text-[10px] text-muted">
          {CLASS_SHORT_LABELS[corpsClass] || corpsClass}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="px-4 py-5 text-xs text-muted text-center">
          No rivals yet — once other directors compete in your class, the closest scores will show
          up here.
        </div>
      ) : (
        <div className="divide-y divide-line-subtle">
          {list.map((rival) => {
            const isSoundSport = corpsClass === 'soundSport' || rival.corpsClass === 'soundSport';
            const crossClass = rival.corpsClass && rival.corpsClass !== corpsClass;

            // SoundSport: render medal tier instead of numeric score, and a
            // relative arrow based on medal rank rather than score delta.
            if (isSoundSport) {
              const medalColor = MEDAL_COLORS[rival.medal] || 'text-secondary';
              const rankDelta = (rival.medalRank ?? 0) - (rival.userMedalRank ?? 0);
              const tied = rankDelta === 0;
              const ahead = rankDelta > 0;
              const RankIcon = tied ? Minus : ahead ? ChevronUp : ChevronDown;
              const rankColor = tied ? 'text-muted' : ahead ? 'text-red-400' : 'text-green-400';
              const rankLabel = tied
                ? `Tied at ${rival.medal || 'Participation'}`
                : ahead
                  ? `Higher tier`
                  : `Lower tier`;

              return (
                <Link
                  key={`${rival.uid}:${rival.corpsClass}`}
                  to={`/profile/${rival.uid}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-raised transition-colors gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{rival.corpsName}</div>
                    <div className="text-[10px] text-muted truncate">
                      {rival.username}
                      {crossClass && (
                        <span className="ml-1 text-muted">
                          · {CLASS_SHORT_LABELS[rival.corpsClass] || rival.corpsClass}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className={`text-sm font-bold flex items-center justify-end gap-1 ${medalColor}`}
                    >
                      <Medal className="w-3.5 h-3.5" />
                      {rival.medal || 'Participation'}
                    </div>
                    <div
                      className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${rankColor}`}
                    >
                      <RankIcon className="w-3 h-3" />
                      {rankLabel}
                    </div>
                  </div>
                </Link>
              );
            }

            const delta = formatDelta(rival.scoreDelta);
            const ahead = (rival.scoreDelta || 0) > 0;
            const tied = (rival.scoreDelta || 0) === 0;
            const DeltaIcon = tied ? Minus : ahead ? ChevronUp : ChevronDown;
            const deltaColor = tied ? 'text-muted' : ahead ? 'text-red-400' : 'text-green-400';

            return (
              <Link
                key={`${rival.uid}:${rival.corpsClass}`}
                to={`/profile/${rival.uid}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-raised transition-colors gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{rival.corpsName}</div>
                  <div className="text-[10px] text-muted truncate">
                    {rival.username}
                    {crossClass && (
                      <span className="ml-1 text-muted">
                        · {CLASS_SHORT_LABELS[rival.corpsClass] || rival.corpsClass}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white font-data tabular-nums">
                    {formatScore(rival.score)}
                  </div>
                  {delta && (
                    <div
                      className={`text-[10px] font-bold font-data tabular-nums flex items-center justify-end gap-0.5 ${deltaColor}`}
                    >
                      <DeltaIcon className="w-3 h-3" />
                      {delta}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
});

RivalsPanel.displayName = 'RivalsPanel';

export default RivalsPanel;
