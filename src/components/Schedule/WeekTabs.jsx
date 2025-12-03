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
      {/* Dark Toolbar Container */}
      <div className="bg-[#1A1A1A] rounded-2xl p-2 border border-[#2A2A2A]">
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
                    ? 'bg-gold-500 text-[#0D0D0D] shadow-lg'
                    : status === 'past'
                    ? 'bg-[#0D0D0D]/50 text-[#FAF6EA]/40 hover:bg-[#2A2A2A] hover:text-[#FAF6EA]/60'
                    : status === 'current'
                    ? 'bg-gold-500/20 text-gold-400 hover:bg-gold-500/30'
                    : 'bg-[#0D0D0D]/50 text-[#FAF6EA]/60 hover:bg-[#2A2A2A] hover:text-[#FAF6EA]'
                }`}
              >
                <div className="text-center">
                  <div className={`text-[10px] font-display font-bold uppercase tracking-wider mb-0.5 ${
                    isSelected ? 'text-[#0D0D0D]/70' : ''
                  }`}>
                    {status === 'current' ? 'Now' : status === 'past' ? 'Done' : `Week`}
                  </div>
                  <div className={`text-xl font-display font-bold ${
                    isSelected ? 'text-[#0D0D0D]' : ''
                  }`}>
                    {weekNum}
                  </div>
                  <div className={`text-[10px] mt-0.5 font-display ${
                    isSelected ? 'text-[#0D0D0D]/70' : 'opacity-60'
                  }`}>
                    {weekShows.length} show{weekShows.length !== 1 ? 's' : ''}
                  </div>
                  {registrations > 0 && (
                    <div className="mt-1">
                      <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full ${
                        isSelected
                          ? 'bg-[#0D0D0D]/20 text-[#0D0D0D]'
                          : 'bg-green-500/30 text-green-400'
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
