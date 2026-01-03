// SchedulePanel - Weekly schedule display
import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight } from 'lucide-react';

// Memoized show row to prevent re-renders
const ShowRow = React.memo(({ show }) => (
  <div className="px-4 sm:px-3 py-3 sm:py-2 flex items-center gap-3 hover:bg-[#222] active:bg-[#222]">
    <Calendar className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
    <div className="min-w-0 flex-1">
      <div className="text-sm text-white truncate">
        {show.eventName || show.name || 'Show'}
      </div>
      <div className="text-[11px] sm:text-[10px] text-gray-500 truncate">
        {show.location || show.date || ''}
      </div>
    </div>
  </div>
));
ShowRow.displayName = 'ShowRow';

const SchedulePanel = React.memo(({
  shows,
  currentWeek,
  seasonName,
  isMobile = false
}) => {
  const hasShows = shows && shows.length > 0;

  return (
    <div className="bg-[#1a1a1a]">
      {/* Header - hidden on mobile since we have tabs */}
      <div className="hidden lg:flex bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] items-center justify-between">
        <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Week {currentWeek} Schedule
        </span>
        <Link to="/schedule" className="text-[11px] sm:text-[10px] text-[#F5A623] hover:text-[#FFB84D] transition-colors flex items-center gap-0.5 py-1">
          Full Schedule <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
        </Link>
      </div>

      {hasShows ? (
        <div className="divide-y divide-[#333]">
          {shows.map((show, idx) => (
            <ShowRow key={show.id || idx} show={show} />
          ))}
        </div>
      ) : (
        <div className="p-5 sm:p-4 text-center">
          <Calendar className="w-8 h-8 sm:w-6 sm:h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm sm:text-xs text-gray-500 mb-3 sm:mb-2">No shows selected</p>
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1 text-sm sm:text-xs text-[#F5A623] hover:text-[#FFB84D] transition-colors py-1"
          >
            Select Shows <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Season Info - desktop only */}
      {!isMobile && seasonName && (
        <div className="hidden lg:block px-4 sm:px-3 py-3 sm:py-2 border-t border-[#333] bg-[#222]">
          <div className="text-[11px] sm:text-[10px] text-gray-500">
            {seasonName} • Week {currentWeek}
          </div>
        </div>
      )}

      {/* Mobile View All link */}
      {isMobile && (
        <Link
          to="/schedule"
          className="flex items-center justify-center gap-1 py-4 text-sm font-medium text-[#F5A623] hover:text-[#FFB84D] transition-colors border-t border-[#333] bg-[#222]"
        >
          View Full Schedule <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
});

SchedulePanel.displayName = 'SchedulePanel';

export default SchedulePanel;
