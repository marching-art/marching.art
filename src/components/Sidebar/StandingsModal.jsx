// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
import React from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Activity, TrendingUp, TrendingDown, X, Play } from 'lucide-react';

const StandingsModal = ({ show, liveScores, displayDay, onClose, onYoutubeClick }) => {
  useEscapeKey(onClose, !!show);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Full standings"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-md bg-surface-card border border-line rounded-none max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-interactive" />
              Full Standings
            </h2>
            {displayDay && (
              <p className="text-[10px] font-data text-muted mt-0.5">Season Day {displayDay}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-white hover:bg-white/10 rounded-none transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Standings List */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-line/50">
            {liveScores.map((row) => {
              const changeValue = row.change;
              const hasChange = changeValue !== null;
              const changeDisplay = hasChange
                ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}`
                : '—';

              return (
                <div
                  key={`modal-${row.sourceYear}-${row.corpsName}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center text-xs font-bold font-data tabular-nums rounded-none ${
                        row.rank <= 3 ? 'bg-interactive text-white' : 'bg-surface-raised text-muted'
                      }`}
                    >
                      {row.rank}
                    </span>
                    <div className="min-w-0">
                      <span
                        className="text-sm text-white block"
                        title={`${row.sourceYear} ${row.corpsName}`}
                      >
                        <span className="text-muted font-data">{row.sourceYear}</span>{' '}
                        {row.corpsName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-data text-white tabular-nums">
                      {row.score.toFixed(3)}
                    </span>
                    <span
                      className={`flex items-center gap-0.5 text-xs font-bold font-data tabular-nums w-12 justify-end ${
                        row.direction === 'up'
                          ? 'text-green-500'
                          : row.direction === 'down'
                            ? 'text-red-500'
                            : 'text-muted'
                      }`}
                    >
                      {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                      {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                      {changeDisplay}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onYoutubeClick(row.sourceYear, row.corpsName);
                      }}
                      className="p-1 text-muted hover:text-red-500 transition-colors"
                      title={`Watch ${row.sourceYear} ${row.corpsName} on YouTube`}
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-line bg-surface-sunken flex-shrink-0">
          <p className="text-[10px] font-data text-muted text-center">
            {liveScores.length} of 25 corps with scores
          </p>
        </div>
      </div>
    </div>
  );
};

export default StandingsModal;
