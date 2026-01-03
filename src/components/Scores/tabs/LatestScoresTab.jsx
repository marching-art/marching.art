// LatestScoresTab - Day-by-day show scores navigation
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SystemLoader, ConsoleEmptyState } from '../../ui/CommandConsole';
import ShowCard from '../ShowCard';

const LatestScoresTab = ({
  loading,
  allShows,
  selectedDay,
  setSelectedDay,
  availableDays,
  setSelectedShow,
  userCorpsNames = []
}) => {
  // Navigate to previous day (older)
  const goToPreviousDay = () => {
    const currentIndex = availableDays.indexOf(selectedDay);
    if (currentIndex < availableDays.length - 1) {
      setSelectedDay(availableDays[currentIndex + 1]);
    }
  };

  // Navigate to next day (newer)
  const goToNextDay = () => {
    const currentIndex = availableDays.indexOf(selectedDay);
    if (currentIndex > 0) {
      setSelectedDay(availableDays[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="py-12">
        <SystemLoader
          messages={[
            'RETRIEVING SCORE DATA...',
            'PROCESSING RESULTS...',
            'COMPILING STANDINGS...',
          ]}
          showProgress={true}
        />
      </div>
    );
  }

  // Filter shows for selected day and exclude SoundSport corps
  const dayShows = allShows
    .filter(show => show.offSeasonDay === selectedDay)
    .map(show => ({
      ...show,
      scores: show.scores?.filter(s => s.corpsClass !== 'soundSport') || []
    }))
    .filter(show => show.scores.length > 0);

  const hasShows = dayShows.length > 0;
  const currentDayIndex = availableDays.indexOf(selectedDay);
  const canGoBack = currentDayIndex < availableDays.length - 1;
  const canGoForward = currentDayIndex > 0;

  // Get the date for the selected day from the first show
  const selectedDayDate = dayShows.length > 0 ? dayShows[0].date : null;

  return (
    <div className="space-y-6">
      {/* Day Navigation Toolbar */}
      {availableDays.length > 0 && (
        <div className="bg-white dark:bg-white/5 border-y border-stone-200 dark:border-white/10 py-4 -mx-4 px-4 md:-mx-6 md:px-6">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={goToPreviousDay}
              disabled={!canGoBack}
              className={`p-2 rounded-sm transition-all ${
                canGoBack
                  ? 'text-slate-600 dark:text-cream-300 hover:text-slate-900 dark:hover:text-cream-100 hover:bg-stone-100 dark:hover:bg-charcoal-800/50'
                  : 'text-slate-300 dark:text-cream-500/30 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="text-center min-w-[200px]">
              <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-cream-100">Day {selectedDay}</p>
              {selectedDayDate && (
                <p className="text-sm text-slate-500 dark:text-cream-500/60">{selectedDayDate}</p>
              )}
            </div>

            <button
              onClick={goToNextDay}
              disabled={!canGoForward}
              className={`p-2 rounded-sm transition-all ${
                canGoForward
                  ? 'text-slate-600 dark:text-cream-300 hover:text-slate-900 dark:hover:text-cream-100 hover:bg-stone-100 dark:hover:bg-charcoal-800/50'
                  : 'text-slate-300 dark:text-cream-500/30 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Shows for Selected Day - Recap Sheet Container */}
      {hasShows ? (
        <div className="space-y-4">
          {dayShows.map((show, idx) => (
            <div key={`day-${selectedDay}-${idx}`} className="border-2 border-charcoal-900 dark:border-charcoal-700 rounded-sm overflow-hidden shadow-sm">
              <ShowCard show={show} onClick={() => setSelectedShow(show)} userCorpsNames={userCorpsNames} />
            </div>
          ))}
        </div>
      ) : availableDays.length > 0 ? (
        <ConsoleEmptyState
          variant="minimal"
          title="NO SHOWS ON THIS DAY"
          subtitle={`Day ${selectedDay} has no recorded performances. Navigate to adjacent days.`}
        />
      ) : (
        <ConsoleEmptyState
          variant="radar"
          title="NO ACTIVE SIGNALS DETECTED"
          subtitle="Scanning for DCI season data... awaiting transmission."
        />
      )}
    </div>
  );
};

export default LatestScoresTab;
