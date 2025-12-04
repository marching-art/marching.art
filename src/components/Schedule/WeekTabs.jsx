// WeekTabs - Week navigation for schedule (Stadium HUD Timeline)
import React from 'react';
import { motion } from 'framer-motion';
import { BrutalistTimeline } from '../ui';

const WeekTabs = ({
  selectedWeek,
  currentWeek,
  onSelectWeek,
  allShows,
  getWeekRegistrationCount
}) => {
  const getWeekStatus = (weekNumber) => {
    if (weekNumber < currentWeek) return 'complete';
    if (weekNumber === currentWeek) return 'active';
    return 'upcoming';
  };

  // Transform week data into timeline items
  const timelineItems = [1, 2, 3, 4, 5, 6, 7].map(weekNum => ({
    id: weekNum,
    label: weekNum.toString(),
    status: selectedWeek === weekNum ? 'active' : getWeekStatus(weekNum),
    badge: getWeekRegistrationCount(weekNum),
    onClick: () => onSelectWeek(weekNum),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 mb-6"
    >
      {/* Glass panel container for timeline */}
      <div className="glass-panel p-4 md:p-6">
        <div className="text-[10px] text-yellow-50/50 uppercase tracking-widest font-bold mb-4 text-center">
          Season Timeline
        </div>
        <BrutalistTimeline
          items={timelineItems}
          className="overflow-x-auto scrollbar-hide px-2"
        />
      </div>
    </motion.div>
  );
};

export default WeekTabs;
