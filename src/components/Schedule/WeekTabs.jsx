// WeekTabs - Tour Timeline with pulsating active week indicator
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Check, Clock } from 'lucide-react';

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

  const getWeekShowCount = (weekNumber) => {
    return allShows.filter(show => show.week === weekNumber).length;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0"
    >
      {/* Glass panel container */}
      <div className="bg-charcoal-950/60 backdrop-blur-xl border border-white/5 p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] text-cream/50 uppercase tracking-widest font-display font-bold">
            Season Timeline
          </div>
          <div className="text-[10px] text-gold-400 uppercase tracking-wider font-display font-bold">
            Week {currentWeek} of 7
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Background Track */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-charcoal-800 rounded-sm -translate-y-1/2" />

          {/* Progress Track */}
          <div
            className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-gold-500 to-gold-400 rounded-sm -translate-y-1/2 transition-all duration-500"
            style={{ width: `${((currentWeek - 0.5) / 7) * 100}%` }}
          />

          {/* Week Nodes */}
          <div className="relative flex justify-between">
            {[1, 2, 3, 4, 5, 6, 7].map((weekNum) => {
              const status = getWeekStatus(weekNum);
              const isSelected = selectedWeek === weekNum;
              const showCount = getWeekShowCount(weekNum);
              const regCount = getWeekRegistrationCount(weekNum);

              return (
                <button
                  key={weekNum}
                  onClick={() => onSelectWeek(weekNum)}
                  className="relative flex flex-col items-center group"
                >
                  {/* Pulsating Glow Ring (Active Week Only) */}
                  {status === 'active' && (
                    <>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-sm bg-gold-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-sm bg-gold-500/10 animate-pulse" style={{ animationDuration: '1.5s' }} />
                    </>
                  )}

                  {/* Node */}
                  <div className={`
                    relative z-10 w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center
                    font-display font-bold text-lg lg:text-xl
                    transition-all duration-300
                    ${status === 'active'
                      ? 'bg-gradient-to-br from-gold-400 to-gold-600 text-charcoal-950 shadow-[0_0_25px_rgba(234,179,8,0.5)]'
                      : status === 'complete'
                        ? 'bg-charcoal-800 text-gold-400 border-2 border-gold-500/30'
                        : 'bg-charcoal-900 text-cream/40 border-2 border-charcoal-700'
                    }
                    ${isSelected && status !== 'active'
                      ? 'ring-2 ring-gold-500/50 ring-offset-2 ring-offset-charcoal-950'
                      : ''
                    }
                    group-hover:scale-110
                  `}>
                    {status === 'complete' ? (
                      <Check className="w-5 h-5" />
                    ) : status === 'active' ? (
                      <Zap className="w-5 h-5" />
                    ) : (
                      weekNum
                    )}
                  </div>

                  {/* Week Label */}
                  <div className={`
                    mt-2 text-[10px] font-display font-bold uppercase tracking-wider
                    ${status === 'active'
                      ? 'text-gold-400'
                      : status === 'complete'
                        ? 'text-cream/50'
                        : 'text-cream/30'
                    }
                  `}>
                    Week {weekNum}
                  </div>

                  {/* Show Count Badge */}
                  {showCount > 0 && (
                    <div className={`
                      mt-1 px-2 py-0.5 text-[9px] font-bold
                      ${status === 'active'
                        ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                        : status === 'complete'
                          ? 'bg-charcoal-800 text-cream/50 border border-charcoal-700'
                          : 'bg-charcoal-900 text-cream/30 border border-charcoal-800'
                      }
                    `}>
                      {showCount} {showCount === 1 ? 'show' : 'shows'}
                    </div>
                  )}

                  {/* Registration Badge */}
                  {regCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-sm bg-gold-500 text-charcoal-950 text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                      {regCount}
                    </div>
                  )}

                  {/* Active Week Indicator Label */}
                  {status === 'active' && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="text-[9px] font-display font-bold text-gold-400 uppercase tracking-wider animate-pulse">
                        Current
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-charcoal-800">
          <div className="flex items-center gap-2">
            <Check className="w-3 h-3 text-gold-400" />
            <span className="text-[10px] text-cream/40 font-display uppercase tracking-wider">Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-gold-400" />
            <span className="text-[10px] text-cream/40 font-display uppercase tracking-wider">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-cream/40" />
            <span className="text-[10px] text-cream/40 font-display uppercase tracking-wider">Upcoming</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WeekTabs;
