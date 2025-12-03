// ScheduleHeader - Header component for schedule page (Tactical Luxury)
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, ChevronLeft, ChevronRight } from 'lucide-react';

export const SchedulePageHeader = ({ totalShows, currentWeek }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex-shrink-0 mb-4"
  >
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h1 className="sports-header text-2xl md:text-3xl text-[#FAF6EA]">
        The Tour
      </h1>
      <div className="flex items-center gap-4">
        <div className="dark-toolbar flex items-center gap-2 text-sm">
          <Music className="w-4 h-4 text-blue-400" />
          <span className="text-[#FAF6EA]/80 font-display font-medium">{totalShows} shows</span>
        </div>
        <div className="dark-toolbar flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gold-500" />
          <span className="text-[#FAF6EA]/80 font-display font-medium">Week {currentWeek}/7</span>
        </div>
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
      <h2 className="text-lg md:text-xl font-display font-bold text-[#FAF6EA] uppercase tracking-wide">
        Week {selectedWeek}
      </h2>
      {weekStatus === 'current' && (
        <span className="px-3 py-1 bg-gold-500 text-[#0D0D0D] rounded-full text-[10px] font-display font-bold uppercase tracking-wider">
          Active
        </span>
      )}
      {weekStatus === 'past' && (
        <span className="px-3 py-1 bg-[#2A2A2A] text-[#FAF6EA]/50 rounded-full text-[10px] font-display font-bold uppercase tracking-wider">
          Complete
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        disabled={selectedWeek === 1}
        className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#FAF6EA]/60 hover:bg-[#2A2A2A] hover:text-[#FAF6EA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={onNextWeek}
        disabled={selectedWeek === 7}
        className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#FAF6EA]/60 hover:bg-[#2A2A2A] hover:text-[#FAF6EA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  </motion.div>
);

export default SchedulePageHeader;
