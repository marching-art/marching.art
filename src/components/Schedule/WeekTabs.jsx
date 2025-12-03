// WeekTabs - Week navigation for schedule (Timeline Style)
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
      className="flex-shrink-0 mb-6"
    >
      {/* Timeline Container */}
      <div className="bg-white dark:bg-surface-secondary rounded-2xl p-4 md:p-6 border border-stone-200 dark:border-border-default shadow-sm dark:shadow-none">
        <div
          ref={weekTabsRef}
          className="relative flex items-center justify-between overflow-x-auto scrollbar-hide"
        >
          {/* Horizontal Connecting Line - Thickened to 4px for itinerary feel */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-300 dark:bg-surface-tertiary -translate-y-1/2 z-0" />
          {/* Progress Line - shows completed weeks */}
          <div
            className="absolute top-1/2 left-0 bg-amber-500 dark:bg-gold-500 -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((currentWeek - 1) / 6) * 100}%`, height: '4px' }}
          />

          {[1, 2, 3, 4, 5, 6, 7].map(weekNum => {
            const status = getWeekStatus(weekNum);
            const weekShows = allShows.filter(s => s.week === weekNum);
            const registrations = getWeekRegistrationCount(weekNum);
            const isSelected = selectedWeek === weekNum;

            return (
              <button
                key={weekNum}
                onClick={() => onSelectWeek(weekNum)}
                className={`relative z-10 flex-shrink-0 transition-all duration-200 ${
                  isSelected
                    ? 'scale-110'
                    : 'hover:scale-105'
                }`}
              >
                {/* Timeline Node */}
                <div className={`
                  relative flex flex-col items-center justify-center rounded-full transition-all duration-200
                  ${isSelected
                    ? 'w-20 h-20 md:w-24 md:h-24 bg-primary shadow-lg shadow-amber-500/30 dark:shadow-gold-500/30 ring-4 ring-amber-200 dark:ring-gold-500/30'
                    : status === 'past'
                    ? 'w-12 h-12 md:w-14 md:h-14 bg-stone-300 dark:bg-surface-tertiary hover:bg-stone-400 dark:hover:bg-surface-highlight'
                    : status === 'current'
                    ? 'w-20 h-20 md:w-24 md:h-24 bg-amber-400 dark:bg-gold-500 border-4 border-amber-600 dark:border-gold-400'
                    : 'w-12 h-12 md:w-14 md:h-14 bg-white dark:bg-surface border-2 border-stone-300 dark:border-surface-highlight hover:border-stone-400'
                  }
                `}>
                  {/* Pulsing Ring for Current Week */}
                  {status === 'current' && !isSelected && (
                    <div className="absolute inset-0 rounded-full animate-ping-slow bg-amber-400 dark:bg-gold-500 opacity-40" />
                  )}
                  {/* Week Number */}
                  <div className={`font-display font-black relative z-10 ${
                    isSelected
                      ? 'text-2xl md:text-3xl text-text-inverse'
                      : status === 'past'
                      ? 'text-sm md:text-base text-text-muted'
                      : status === 'current'
                      ? 'text-2xl md:text-3xl text-text-inverse'
                      : 'text-sm md:text-base text-text-muted'
                  }`}>
                    {weekNum}
                  </div>

                  {/* Show Count (only on selected or current) */}
                  {(isSelected || status === 'current') && (
                    <div className="text-[10px] font-display font-bold uppercase tracking-wider relative z-10 text-text-inverse/70">
                      {weekShows.length} show{weekShows.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Status Label Below */}
                <div className={`mt-2 text-center ${isSelected ? 'opacity-100' : 'opacity-100'}`}>
                  <div className={`text-[10px] font-display font-bold uppercase tracking-wider ${
                    isSelected
                      ? 'text-primary'
                      : status === 'past'
                      ? 'text-text-muted'
                      : status === 'current'
                      ? 'text-primary'
                      : 'text-text-muted'
                  }`}>
                    {status === 'current' ? 'LIVE' : status === 'past' ? 'Done' : `Week`}
                  </div>

                  {/* Registration Badge */}
                  {registrations > 0 && (
                    <div className="mt-1 flex justify-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full ${
                        isSelected
                          ? 'bg-green-500 text-white'
                          : 'bg-green-500 text-white'
                      }`}>
                        {registrations}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default WeekTabs;
