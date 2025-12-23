// ShowCard - Recap Sheet style display for show results
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const ShowCard = React.memo(({ show, onClick, userCorpsNames = [] }) => {
  // Check if a corps name belongs to the user
  const isUserCorps = (corpsName) => {
    return userCorpsNames.some(name =>
      name && corpsName && name.toLowerCase() === corpsName.toLowerCase()
    );
  };

  return (
    <motion.div
      whileHover={{ scale: 1.002 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      {/* Show Header - Solid Black Bar */}
      <div className="bg-charcoal-900 dark:bg-charcoal-950 px-4 py-3 flex items-center justify-between gap-4">
        <h3 className="text-sm md:text-base font-bold uppercase text-white tracking-wide truncate">
          {show.eventName}
        </h3>
        <div className="text-right flex-shrink-0">
          <p className="text-xs md:text-sm font-mono text-white/70">
            {show.date} &bull; {show.location}
          </p>
        </div>
      </div>

      {/* Corps Results - Recap Sheet Style */}
      {show.scores && show.scores.length > 0 && (
        <div className="bg-white dark:bg-charcoal-900/50">
          {show.scores.slice(0, 5).map((score, idx) => {
            const isMyCorps = isUserCorps(score.corps);
            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-4 py-3 border-b-2 border-black dark:border-charcoal-600 ${
                  isMyCorps
                    ? 'bg-yellow-50 dark:bg-yellow-500/10'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Badge - Solid Black Box (Race Position Indicator) */}
                  <span className="w-8 h-8 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 bg-black text-white">
                    {idx + 1}
                  </span>
                  {/* Corps Name - Uppercase, Bold, Dark Grey */}
                  <span className={`font-bold uppercase text-sm md:text-base truncate ${
                    isMyCorps
                      ? 'text-charcoal-900 dark:text-cream-100'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {score.corps}
                  </span>
                </div>
                {/* Score - Hero styling: text-xl, Monospace, Bold, Right-aligned */}
                <span className="font-mono font-bold text-lg md:text-xl text-charcoal-900 dark:text-cream-100 flex-shrink-0 tabular-nums">
                  {score.score.toFixed(3)}
                </span>
              </div>
            );
          })}
          {show.scores.length > 5 && (
            <button className="w-full py-2.5 text-xs md:text-sm text-charcoal-700 dark:text-cream-400 hover:text-charcoal-900 dark:hover:text-cream-100 font-bold uppercase tracking-wide flex items-center justify-center gap-1 bg-cream-100 dark:bg-charcoal-800/50 hover:bg-cream-200 dark:hover:bg-charcoal-700/50 transition-colors border-t border-charcoal-900 dark:border-charcoal-700">
              View all {show.scores.length} corps
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
});

ShowCard.displayName = 'ShowCard';

export default ShowCard;
