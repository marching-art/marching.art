import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';

const FantasyTrendingBox = ({
  trendingPlayers,
  loading,
  dayLabel
}) => {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-3.5 h-3.5" />
          Fantasy Trending
        </h3>
        <span className="text-[10px] font-data text-gray-500">{dayLabel || '24h'}</span>
      </div>

      {/* Trending List */}
      <div className="divide-y divide-[#333]/50">
        {loading ? (
          /* Skeleton loading state - mimics content structure */
          <div className="divide-y divide-[#333]/50">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 skeleton rounded-sm" />
                  <div className="h-4 w-24 skeleton rounded-sm" />
                </div>
                <div className="h-4 w-12 skeleton rounded-sm" />
              </div>
            ))}
          </div>
        ) : trendingPlayers.length > 0 ? (
          trendingPlayers.map((player, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${
                idx >= 2 ? 'hidden lg:flex' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center text-xs font-bold font-data text-gray-500 tabular-nums">
                  {idx + 1}
                </span>
                <span className="text-sm text-white">{player.name}</span>
              </div>
              <div className={`flex items-center gap-1 text-sm font-bold font-data tabular-nums ${
                player.direction === 'up' ? 'text-green-500' : 'text-red-500'
              }`}>
                {player.direction === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {player.change}
              </div>
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-gray-500">No trending data available</p>
          </div>
        )}
      </div>

      {/* Footer - 44px touch target */}
      <div className="px-2 py-1.5 border-t border-[#333] bg-[#111]">
        <Link
          to="/scores"
          className="min-h-[44px] px-2 text-xs text-orange-400 hover:text-orange-300 active:text-orange-500 font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 press-feedback rounded-sm"
        >
          View All Trends
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default FantasyTrendingBox;
