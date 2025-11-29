// WeekTabs - Week navigation for schedule
import React, { useRef } from 'react';
import { motion } from 'framer-motion';

const WeekTabs = ({
  selectedWeek,
  currentWeek,
  onSelectWeek,
  allShows,
  getWeekRegistrationCount
}) => {
  const weekTabsRef = useRef(null);

  const getWeekStatus = (weekNumber) => {
    if (weekNumber < currentWeek) return 'past';
    if (weekNumber === currentWeek) return 'current';
    return 'future';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 mb-4"
    >
      <div
        ref={weekTabsRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {[1, 2, 3, 4, 5, 6, 7].map(weekNum => {
          const status = getWeekStatus(weekNum);
          const weekShows = allShows.filter(s => s.week === weekNum);
          const registrations = getWeekRegistrationCount(weekNum);
          const isSelected = selectedWeek === weekNum;

          return (
            <button
              key={weekNum}
              onClick={() => onSelectWeek(weekNum)}
              className={`flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all min-w-[100px] ${
                isSelected
                  ? 'border-gold-500 bg-gold-500/20 text-gold-400'
                  : status === 'past'
                  ? 'border-cream-500/10 bg-charcoal-800/50 text-cream-500/60 hover:border-cream-500/30'
                  : status === 'current'
                  ? 'border-gold-500/30 bg-gold-500/10 text-cream-200 hover:border-gold-500/50'
                  : 'border-cream-500/10 bg-charcoal-800/50 text-cream-300 hover:border-cream-500/30'
              }`}
            >
              <div className="text-center">
                <div className="text-xs uppercase tracking-wide mb-1 opacity-70">
                  {status === 'current' ? 'Now' : status === 'past' ? 'Done' : `Wk ${weekNum}`}
                </div>
                <div className="font-bold text-lg">
                  {weekNum}
                </div>
                <div className="text-xs mt-1 opacity-70">
                  {weekShows.length} shows
                </div>
                {registrations > 0 && (
                  <div className="mt-1">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-green-500/30 text-green-400">
                      {registrations}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default WeekTabs;
