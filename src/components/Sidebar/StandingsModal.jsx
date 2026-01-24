import React from 'react';
import { Activity, TrendingUp, TrendingDown, X, Play } from 'lucide-react';

const StandingsModal = ({
  show,
  liveScores,
  displayDay,
  onClose,
  onYoutubeClick
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0057B8]" />
              Full Standings
            </h2>
            {displayDay && (
              <p className="text-[10px] font-data text-gray-500 mt-0.5">Season Day {displayDay}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Standings List */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-[#333]/50">
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
                    <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold font-data tabular-nums rounded-sm ${
                      row.rank <= 3 ? 'bg-[#0057B8] text-white' : 'bg-[#222] text-gray-500'
                    }`}>
                      {row.rank}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm text-white block" title={`${row.sourceYear} ${row.corpsName}`}>
                        <span className="text-gray-400 font-data">{row.sourceYear}</span> {row.corpsName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-data text-white tabular-nums">
                      {row.score.toFixed(3)}
                    </span>
                    <span className={`flex items-center gap-0.5 text-xs font-bold font-data tabular-nums w-12 justify-end ${
                      row.direction === 'up' ? 'text-green-500' :
                      row.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                      {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                      {changeDisplay}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onYoutubeClick(row.sourceYear, row.corpsName);
                      }}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
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
        <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex-shrink-0">
          <p className="text-[10px] font-data text-gray-500 text-center">
            {liveScores.length} of 25 corps with scores
          </p>
        </div>
      </div>
    </div>
  );
};

export default StandingsModal;
