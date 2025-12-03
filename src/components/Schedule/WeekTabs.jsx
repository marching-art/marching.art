// WeekTabs - Week navigation for schedule (Tactical Luxury: Dark Toolbar Style)
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
      {/* Light/Dark Toolbar Container */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-2 border border-stone-200 dark:border-[#2A2A2A] shadow-sm dark:shadow-none">
        <div
          ref={weekTabsRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide"
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
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl transition-all min-w-[90px] ${
                  isSelected
                    ? 'bg-amber-500 dark:bg-gold-500 text-[#1A1A1A] shadow-lg'
                    : status === 'past'
                    ? 'bg-stone-100 dark:bg-[#0D0D0D]/50 text-slate-400 dark:text-[#FAF6EA]/40 hover:bg-stone-200 dark:hover:bg-[#2A2A2A] hover:text-slate-500 dark:hover:text-[#FAF6EA]/60'
                    : status === 'current'
                    ? 'bg-amber-500/20 dark:bg-gold-500/20 text-amber-600 dark:text-gold-400 hover:bg-amber-500/30 dark:hover:bg-gold-500/30'
                    : 'bg-stone-100 dark:bg-[#0D0D0D]/50 text-slate-600 dark:text-[#FAF6EA]/60 hover:bg-stone-200 dark:hover:bg-[#2A2A2A] hover:text-slate-700 dark:hover:text-[#FAF6EA]'
                }`}
              >
                <div className="text-center">
                  <div className={`text-[10px] font-display font-bold uppercase tracking-wider mb-0.5 ${
                    isSelected ? 'text-[#1A1A1A]/70' : ''
                  }`}>
                    {status === 'current' ? 'Now' : status === 'past' ? 'Done' : `Week`}
                  </div>
                  <div className={`text-xl font-display font-bold ${
                    isSelected ? 'text-[#1A1A1A]' : ''
                  }`}>
                    {weekNum}
                  </div>
                  <div className={`text-[10px] mt-0.5 font-display ${
                    isSelected ? 'text-[#1A1A1A]/70' : 'opacity-60'
                  }`}>
                    {weekShows.length} show{weekShows.length !== 1 ? 's' : ''}
                  </div>
                  {registrations > 0 && (
                    <div className="mt-1">
                      <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full ${
                        isSelected
                          ? 'bg-[#1A1A1A]/20 text-[#1A1A1A]'
                          : 'bg-green-500/30 text-green-600 dark:text-green-400'
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
