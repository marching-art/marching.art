// ScheduleHeader - Header component for schedule page (Night Mode Stadium HUD)
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

export const SchedulePageHeader = ({ totalShows, currentWeek }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex-shrink-0 mb-4"
  >
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h1 className="sports-header text-2xl md:text-3xl text-yellow-50">
        The Tour
      </h1>
      <div className="flex items-center gap-2">
        {/* Shows Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg">
          <Music className="w-4 h-4 text-yellow-50/60" />
          <span className="text-sm font-display font-medium text-yellow-50">{totalShows} shows</span>
        </div>
        {/* Week Badge - Glowing Gold */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 backdrop-blur-sm border border-yellow-500/20 rounded-lg shadow-[0_0_12px_rgba(234,179,8,0.15)]">
          <Calendar className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" />
          <span className="text-sm font-display font-bold text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]">Week {currentWeek}/7</span>
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
      <h2 className="text-lg font-display font-bold text-yellow-50 uppercase tracking-wide">
        Week {selectedWeek}
      </h2>
      {weekStatus === 'current' && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg">
          <Zap className="w-3 h-3 text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.6)]" />
          <span className="text-xs font-display font-bold text-yellow-400 uppercase tracking-wider drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]">Active</span>
        </div>
      )}
      {weekStatus === 'past' && (
        <div className="px-2 py-1 bg-black/30 border border-white/10 rounded-lg">
          <span className="text-xs font-display font-medium text-yellow-50/40 uppercase tracking-wider">Complete</span>
        </div>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        disabled={selectedWeek === 1}
        className="p-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg text-yellow-50/60 hover:text-yellow-50 hover:border-yellow-500/30 hover:shadow-[0_0_12px_rgba(234,179,8,0.15)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={onNextWeek}
        disabled={selectedWeek === 7}
        className="p-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg text-yellow-50/60 hover:text-yellow-50 hover:border-yellow-500/30 hover:shadow-[0_0_12px_rgba(234,179,8,0.15)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  </motion.div>
);

export default SchedulePageHeader;
