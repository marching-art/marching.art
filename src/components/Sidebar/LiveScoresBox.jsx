import React from 'react';
import { Activity, TrendingUp, TrendingDown, ChevronRight, Youtube } from 'lucide-react';

const LiveScoresBox = ({
  liveScores,
  displayDay,
  loading,
  hasData,
  onYoutubeClick,
  onShowStandings
}) => {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#0057B8]" />
          Live Scores
        </h3>
        <div className="flex items-center gap-1.5">
          {hasData && (
            <>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-data text-gray-500">Day {displayDay}</span>
            </>
          )}
        </div>
      </div>

      {/* Score List - Shows top 12 corps */}
      <div className="divide-y divide-[#333]/50">
        {loading ? (
          <div className="px-3 py-6 text-center">
            <div className="inline-block w-5 h-5 border-2 border-[#0057B8]/30 border-t-[#0057B8] rounded-full animate-spin" />
          </div>
        ) : hasData ? (
          liveScores.slice(0, 12).map((row) => {
            const changeValue = row.change;
            const hasChange = changeValue !== null;
            const changeDisplay = hasChange
              ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}`
              : '—';

            return (
              <div
                key={`${row.sourceYear}-${row.corpsName}`}
                className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 flex items-center justify-center bg-[#222] text-xs font-bold font-data text-gray-500 tabular-nums rounded-sm">
                    {row.rank}
                  </span>
                  <span className="text-sm text-white" title={`${row.sourceYear} ${row.corpsName}`}>
                    <span className="text-gray-400 font-data">{row.sourceYear}</span> {row.corpsName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                    <Youtube className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-gray-500">No scores available yet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
        <button
          onClick={onShowStandings}
          className="text-[10px] text-[#0057B8] hover:text-[#0066d6] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
        >
          Full Standings
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default LiveScoresBox;
