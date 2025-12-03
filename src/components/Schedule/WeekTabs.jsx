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
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 md:p-6 border border-stone-200 dark:border-[#2A2A2A] shadow-sm dark:shadow-none">
        <div
          ref={weekTabsRef}
          className="relative flex items-center justify-between overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Horizontal Connecting Line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-200 dark:bg-[#2A2A2A] -translate-y-1/2 z-0" />
          {/* Progress Line - shows completed weeks */}
          <div
            className="absolute top-1/2 left-0 h-1 bg-amber-500 dark:bg-gold-500 -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((currentWeek - 1) / 6) * 100}%` }}
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
                  flex flex-col items-center justify-center rounded-full transition-all duration-200
                  ${isSelected
                    ? 'w-20 h-20 md:w-24 md:h-24 bg-amber-500 dark:bg-gold-500 shadow-lg shadow-amber-500/30 dark:shadow-gold-500/30 ring-4 ring-amber-200 dark:ring-gold-500/30'
                    : status === 'past'
                    ? 'w-14 h-14 md:w-16 md:h-16 bg-stone-300 dark:bg-[#2A2A2A] hover:bg-stone-400 dark:hover:bg-[#3A3A3A]'
                    : status === 'current'
                    ? 'w-16 h-16 md:w-18 md:h-18 bg-amber-100 dark:bg-gold-500/20 border-2 border-amber-500 dark:border-gold-500 hover:bg-amber-200 dark:hover:bg-gold-500/30'
                    : 'w-14 h-14 md:w-16 md:h-16 bg-white dark:bg-[#0D0D0D] border-2 border-stone-300 dark:border-[#3A3A3A] hover:border-stone-400 dark:hover:border-[#4A4A4A]'
                  }
                `}>
                  {/* Week Number */}
                  <div className={`font-display font-black ${
                    isSelected
                      ? 'text-2xl md:text-3xl text-[#1A1A1A]'
                      : status === 'past'
                      ? 'text-lg md:text-xl text-slate-500 dark:text-[#FAF6EA]/40'
                      : status === 'current'
                      ? 'text-lg md:text-xl text-amber-600 dark:text-gold-400'
                      : 'text-lg md:text-xl text-slate-600 dark:text-[#FAF6EA]/60'
                  }`}>
                    {weekNum}
                  </div>

                  {/* Show Count (only on selected) */}
                  {isSelected && (
                    <div className="text-[10px] font-display font-bold text-[#1A1A1A]/70 uppercase tracking-wider">
                      {weekShows.length} show{weekShows.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Status Label Below */}
                <div className={`mt-2 text-center ${isSelected ? 'opacity-100' : 'opacity-70'}`}>
                  <div className={`text-[10px] font-display font-bold uppercase tracking-wider ${
                    isSelected
                      ? 'text-amber-600 dark:text-gold-400'
                      : status === 'past'
                      ? 'text-slate-400 dark:text-[#FAF6EA]/30'
                      : status === 'current'
                      ? 'text-amber-500 dark:text-gold-400'
                      : 'text-slate-500 dark:text-[#FAF6EA]/50'
                  }`}>
                    {status === 'current' ? 'Now' : status === 'past' ? 'Done' : `Week`}
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
