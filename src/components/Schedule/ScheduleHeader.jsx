// ScheduleHeader - Header component for schedule page (Brutalist Architecture)
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BrutalistHeader,
  BrutalistButton,
  MetricBadge,
  BrutalistCard
} from '../ui';

export const SchedulePageHeader = ({ totalShows, currentWeek }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex-shrink-0 mb-4"
  >
    <div className="flex items-center justify-between flex-wrap gap-3">
      <BrutalistHeader size="lg" as="h1">
        The Tour
      </BrutalistHeader>
      <div className="flex items-center gap-3">
        <MetricBadge variant="info" icon={Music}>
          {totalShows} shows
        </MetricBadge>
        <MetricBadge variant="primary" icon={Calendar}>
          Week {currentWeek}/7
        </MetricBadge>
      </div>
    </div>
  </motion.div>
);

export const SelectedWeekHeader = ({
  selectedWeek,
  weekStatus,
  onPrevWeek,
  onNextWeek
}) => (
  <motion.div
    key={`header-${selectedWeek}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex-shrink-0 flex items-center justify-between mb-3"
  >
    <div className="flex items-center gap-3">
      <BrutalistHeader size="sm">
        Week {selectedWeek}
      </BrutalistHeader>
      {weekStatus === 'current' && (
        <MetricBadge variant="primary" size="sm">
          Active
        </MetricBadge>
      )}
      {weekStatus === 'past' && (
        <MetricBadge variant="muted" size="sm">
          Complete
        </MetricBadge>
      )}
    </div>
    <div className="flex items-center gap-2">
      <BrutalistButton
        variant="outline"
        size="sm"
        onClick={onPrevWeek}
        disabled={selectedWeek === 1}
        className="p-2"
      >
        <ChevronLeft className="w-5 h-5" />
      </BrutalistButton>
      <BrutalistButton
        variant="outline"
        size="sm"
        onClick={onNextWeek}
        disabled={selectedWeek === 7}
        className="p-2"
      >
        <ChevronRight className="w-5 h-5" />
      </BrutalistButton>
    </div>
  </motion.div>
);

export default SchedulePageHeader;
