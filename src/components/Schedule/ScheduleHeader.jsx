// ScheduleHeader - Header component for schedule page
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, ChevronLeft, ChevronRight } from 'lucide-react';

export const SchedulePageHeader = ({ totalShows, currentWeek }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex-shrink-0 mb-4"
  >
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-gradient">
        Season Schedule
      </h1>
      <div className="flex items-center gap-4 text-sm text-cream-400">
        <span className="flex items-center gap-1">
          <Music className="w-4 h-4 text-blue-400" />
          {totalShows} shows
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4 text-gold-500" />
          Week {currentWeek} of 7
        </span>
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
      <h2 className="text-xl font-display font-bold text-cream-100">
        Week {selectedWeek}
      </h2>
      {weekStatus === 'current' && (
        <span className="px-2 py-0.5 bg-gradient-gold text-charcoal-900 rounded-full text-xs font-semibold">
          Current
        </span>
      )}
      {weekStatus === 'past' && (
        <span className="px-2 py-0.5 bg-charcoal-700 text-cream-500/60 rounded-full text-xs font-semibold">
          Completed
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        disabled={selectedWeek === 1}
        className="p-1.5 rounded-lg bg-charcoal-800 text-cream-400 hover:bg-charcoal-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={onNextWeek}
        disabled={selectedWeek === 7}
        className="p-1.5 rounded-lg bg-charcoal-800 text-cream-400 hover:bg-charcoal-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  </motion.div>
);

export default SchedulePageHeader;
