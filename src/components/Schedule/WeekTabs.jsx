// WeekTabs - Week navigation for schedule (Brutalist Timeline)
import React from 'react';
import { motion } from 'framer-motion';
import { BrutalistCard, BrutalistTimeline } from '../ui';

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
      <BrutalistCard variant="flat" padding="default">
        <BrutalistTimeline
          items={timelineItems}
          className="overflow-x-auto scrollbar-hide"
        />
      </BrutalistCard>
    </motion.div>
  );
};

export default WeekTabs;
