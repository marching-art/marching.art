// SeasonScorecard - Sidebar scorecard showing season stats
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Medal, Palette } from 'lucide-react';
import { CLASS_LABELS, getSoundSportRating } from './constants';

// Blue Ribbon icon for Best in Show awards
const BlueRibbonIcon = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Ribbon circle/badge */}
    <circle cx="12" cy="9" r="7" fill="#0057B8" stroke="#003d82" strokeWidth="1" />
    {/* Inner circle highlight */}
    <circle cx="12" cy="9" r="4" fill="#0066d6" />
    {/* Star in center */}
    <path
      d="M12 5.5l1.09 2.21 2.44.35-1.77 1.72.42 2.43L12 11.1l-2.18 1.15.42-2.43-1.77-1.72 2.44-.35L12 5.5z"
      fill="#FFD700"
    />
    {/* Ribbon tails */}
    <path d="M8 15l-2 7 4-2.5V15H8z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
    <path d="M16 15l2 7-4-2.5V15h2z" fill="#0057B8" stroke="#003d82" strokeWidth="0.5" />
  </svg>
);

const SeasonScorecard = memo(({
  score,
  rank,
  rankChange,
  corpsName,
  corpsClass,
  loading,
  avatarUrl,
  onDesignUniform,
  bestInShowCount = 0
}) => {
  const isSoundSport = corpsClass === 'soundSport';
  const rating = isSoundSport && score ? getSoundSportRating(score) : null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          Season Scorecard
        </h3>
      </div>

      <div className="p-4">
        {/* Corps Identity */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#333]">
          <button
            onClick={onDesignUniform}
            className="relative w-14 h-14 bg-[#222] border border-[#444] overflow-hidden flex items-center justify-center hover:border-[#0057B8] transition-colors group"
            title="Design Uniform"
          >
            {/* OPTIMIZATION #7: Added lazy loading for avatar */}
            {avatarUrl ? (
              <img src={avatarUrl} alt={corpsName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <Trophy className="w-7 h-7 text-yellow-500" />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Palette className="w-4 h-4 text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">{corpsName || 'My Corps'}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              {CLASS_LABELS[corpsClass] || corpsClass}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Score / Medal Rating */}
          <div className="bg-[#222] p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              {isSoundSport ? 'Medal Rating' : 'Season Score'}
            </p>
            {loading ? (
              <div className="h-8 w-20 bg-[#333] animate-pulse" />
            ) : isSoundSport && rating ? (
              // SoundSport: Display medal badge
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 ${rating.color} rounded-sm`}>
                <Medal className={`w-4 h-4 ${rating.textColor}`} />
                <span className={`text-lg font-bold ${rating.textColor}`}>
                  {rating.rating}
                </span>
              </div>
            ) : isSoundSport ? (
              <p className="text-2xl font-bold text-gray-500 font-data tabular-nums">
                —
              </p>
            ) : (
              <p className="text-2xl font-bold text-white font-data tabular-nums">
                {score?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>

          {/* Rank / Best in Show */}
          <div className="bg-[#222] p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              {isSoundSport ? 'Best in Show' : 'Rank'}
            </p>
            {loading ? (
              <div className="h-8 w-16 bg-[#333] animate-pulse" />
            ) : isSoundSport ? (
              // SoundSport: Display Best in Show count with blue ribbon
              <div className="flex items-center gap-2">
                <BlueRibbonIcon className="w-6 h-6" />
                <span className="text-2xl font-bold text-[#0057B8] font-data tabular-nums">
                  {bestInShowCount}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-white font-data tabular-nums">
                  #{rank || '-'}
                </p>
                {rankChange !== null && rankChange !== 0 && (
                  <span className={`text-xs font-bold flex items-center gap-0.5 ${
                    rankChange > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {rankChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(rankChange)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SeasonScorecard;
