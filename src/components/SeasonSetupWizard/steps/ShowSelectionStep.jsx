// ShowSelectionStep - Select shows for the week
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, Calendar, MapPin } from 'lucide-react';
import { getCorpsClassName } from '../constants';
import BrandLogo from '../../BrandLogo';

const ShowSelectionStep = ({
  currentCorpsClass,
  currentCorpsIndex,
  totalCorps,
  currentWeek,
  availableShows,
  selectedShows,
  selectedDay,
  loading,
  saving,
  onDayChange,
  onToggleShow,
  onBack,
  onSave
}) => {
  // Group shows by day
  const { showsByDay, availableDays, currentDayShows, selectionsPerDay } = useMemo(() => {
    const byDay = {};
    availableShows.forEach(show => {
      const day = show.day || 1;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(show);
    });

    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    const dayShows = byDay[selectedDay] || [];

    const perDay = {};
    selectedShows.forEach(show => {
      const day = show.day || 1;
      perDay[day] = (perDay[day] || 0) + 1;
    });

    return {
      showsByDay: byDay,
      availableDays: days,
      currentDayShows: dayShows,
      selectionsPerDay: perDay
    };
  }, [availableShows, selectedDay, selectedShows]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-4xl mx-auto px-2"
    >
      {/* Progress */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs md:text-sm text-cream-500/60">
            Corps {currentCorpsIndex + 1} of {totalCorps} - Shows
          </span>
          <span className="text-xs md:text-sm font-semibold text-gold-500">
            {getCorpsClassName(currentCorpsClass)}
          </span>
        </div>
        <div className="h-1.5 md:h-2 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${((currentCorpsIndex + 0.75) / totalCorps) * 100}%` }}
            className="h-full bg-gradient-gold"
          />
        </div>
      </div>

      {/* Header with selection count */}
      <div className="mb-4 md:mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl md:text-3xl font-display font-bold text-gradient mb-1 truncate">
            Select Week {currentWeek} Shows
          </h2>
          <p className="text-xs md:text-sm text-cream-300">
            Choose up to 4 shows for {getCorpsClassName(currentCorpsClass)}
          </p>
        </div>
        <div className={`text-lg md:text-2xl font-bold flex-shrink-0 ${
          selectedShows.length === 0 ? 'text-cream-500/40' :
          selectedShows.length >= 4 ? 'text-gold-500' :
          'text-blue-500'
        }`}>
          {selectedShows.length}/4
        </div>
      </div>

      {/* Day Navigation */}
      {!loading && availableDays.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {availableDays.map(day => {
              const daySelections = selectionsPerDay[day] || 0;
              const isActive = selectedDay === day;
              const showCount = showsByDay[day]?.length || 0;
              return (
                <button
                  key={day}
                  onClick={() => onDayChange(day)}
                  className={`relative flex-shrink-0 min-w-[4.5rem] px-3 py-2 rounded-sm text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#0057B8] text-white'
                      : 'bg-[#222] text-gray-300 hover:bg-[#333]'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-semibold">Day {day}</div>
                    <div className={`text-[10px] mt-0.5 ${isActive ? 'text-charcoal-900/70' : 'text-cream-500/60'}`}>
                      {showCount} show{showCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {daySelections > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                      isActive ? 'bg-charcoal-900 text-gold-500' : 'bg-gold-500 text-charcoal-900'
                    }`}>
                      {daySelections}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Shows for selected day */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-pulse mb-3">
            <BrandLogo className="w-12 h-12 mx-auto" color="text-gold-500" />
          </div>
          <p className="font-mono text-xs text-gold-500/50 uppercase tracking-wide">Loading shows...</p>
        </div>
      ) : availableShows.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
          <p className="text-cream-500/60">No shows available for Week {currentWeek}</p>
          <p className="text-xs text-cream-500/40 mt-2">
            All shows for this week may have already been adjudicated
          </p>
        </div>
      ) : currentDayShows.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-10 h-10 text-cream-500/40 mx-auto mb-2" />
          <p className="text-sm text-cream-500/60">No shows on Day {selectedDay}</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-4 max-h-[45vh] overflow-y-auto pr-1 -mr-1">
          {currentDayShows.map((show, index) => {
            const isSelected = selectedShows.some(
              s => s.eventName === (show.eventName || show.name) && s.date === show.date
            );

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => onToggleShow(show)}
                className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-gold-500 bg-gold-500/10 shadow-md shadow-gold-500/10'
                    : 'border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30 hover:bg-charcoal-900/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-cream-100 text-sm sm:text-base leading-tight line-clamp-2">
                      {show.eventName || show.name}
                    </h4>
                    {show.location && (
                      <p className="text-xs sm:text-sm text-cream-500/60 mt-1 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{show.location}</span>
                      </p>
                    )}
                  </div>
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? 'border-gold-500 bg-gold-500 scale-110'
                      : 'border-cream-500/30'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-charcoal-900" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 md:gap-3">
        <button
          onClick={onBack}
          className="btn-ghost text-xs md:text-sm px-2 md:px-4"
        >
          <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Back
        </button>
        <button
          onClick={onSave}
          disabled={selectedShows.length === 0 || saving}
          className="btn-primary flex-1 text-xs md:text-sm py-2 md:py-3"
        >
          {saving ? (
            <>
              <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
              Saving...
            </>
          ) : currentCorpsIndex < totalCorps - 1 ? (
            <>
              Save & Next Corps
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
            </>
          ) : (
            <>
              Complete Setup
              <Check className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default ShowSelectionStep;
