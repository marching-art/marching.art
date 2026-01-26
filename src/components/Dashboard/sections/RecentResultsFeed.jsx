// RecentResultsFeed - Sidebar showing recent competition results
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Activity, Medal } from 'lucide-react';
import { getSoundSportRating } from './constants';

const RecentResultsFeed = memo(({ results, loading, corpsClass }) => {
  const isSoundSport = corpsClass === 'soundSport';

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-purple-500" />
          Recent Results
        </h3>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="w-32 h-4 bg-[#333] animate-pulse" />
              <div className="w-16 h-4 bg-[#333] animate-pulse" />
            </div>
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div className="divide-y divide-[#222]">
          {results.slice(0, 5).map((result, idx) => {
            // For SoundSport, get the medal rating
            const rating = isSoundSport && result.score ? getSoundSportRating(result.score) : null;

            return (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{result.eventName}</p>
                  <p className="text-[10px] text-gray-500">{result.date || 'Recent'}</p>
                </div>
                <div className="text-right ml-3">
                  {isSoundSport && rating ? (
                    // SoundSport: Display medal badge
                    <div className={`inline-flex items-center gap-1 px-2 py-1 ${rating.color} rounded-sm`}>
                      <Medal className={`w-3 h-3 ${rating.textColor}`} />
                      <span className={`text-xs font-bold ${rating.textColor}`}>
                        {rating.rating}
                      </span>
                    </div>
                  ) : (
                    // Other classes: Display numeric score
                    <>
                      <p className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                        {result.score?.toFixed(2)}
                      </p>
                      {result.placement && (
                        <p className="text-[10px] text-gray-500">#{result.placement}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center">
          <Activity className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No results yet</p>
          <p className="text-[10px] text-gray-600 mt-1">Compete in shows to see results</p>
        </div>
      )}
    </div>
  );
});

export default RecentResultsFeed;
