// TourStrip - Horizontal tour route with connected event "stops"
// Features: Visual route line connecting events, horizontal scroll, weekend emphasis
import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import TicketStub from './TicketStub';
import EmptyState from '../EmptyState';
import { isEventPast } from '../../utils/scheduleUtils';

const TourStrip = ({
  shows,
  selectedWeek,
  getActualDate,
  formatDateCompact,
  getMyCorpsAtShow,
  onRegisterCorps
}) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position
  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
    }
    return () => {
      if (ref) {
        ref.removeEventListener('scroll', updateScrollButtons);
      }
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [shows]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Check if a day is weekend (Sat/Sun)
  const isWeekend = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return false;
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  if (shows.length === 0) {
    return (
      <EmptyState
        title="NO SHOWS SCHEDULED"
        subtitle={`No shows scheduled for Week ${selectedWeek}...`}
      />
    );
  }

  return (
    <motion.div
      key={`tour-${selectedWeek}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex-1 flex flex-col min-h-0"
    >
      {/* Tour Route Header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-gold-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-cream uppercase tracking-wide">
              Tour Route
            </h3>
            <p className="text-xs text-cream/50">
              {shows.length} {shows.length === 1 ? 'stop' : 'stops'} this week
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-4 ml-auto text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-400 animate-pulse" style={{ animationDuration: '2s' }} />
            <span className="text-cream/50">Open</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gold-400" />
            <span className="text-cream/50">Registered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-charcoal-600" />
            <span className="text-cream/50">Closed</span>
          </div>
        </div>
      </div>

      {/* Scroll Container with Route */}
      <div className="relative flex-1 min-h-0">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-gray-400 hover:bg-[#222] hover:border-[#444] transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-gray-400 hover:bg-[#222] hover:border-[#444] transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Horizontal Scroll Area */}
        <div
          ref={scrollRef}
          className="h-full overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="inline-flex items-stretch gap-0 py-4 px-2 min-w-full">
            {shows.map((show, index) => {
              const myCorps = getMyCorpsAtShow(show);
              const showDate = getActualDate(show.day);
              const isPast = isEventPast(showDate);
              const isRegistered = myCorps.length > 0;
              const isLocked = show.locked || isPast;
              const weekend = isWeekend(show.day);
              const isLast = index === shows.length - 1;

              return (
                <div key={`${show.eventName}-${show.day}`} className="flex items-center">
                  {/* Route Connector (before each card except first) */}
                  {index > 0 && (
                    <div className="flex items-center h-full mx-[-1px]">
                      {/* Horizontal Route Line */}
                      <div className={`
                        w-8 lg:w-12 h-1 relative
                        ${isLocked
                          ? 'bg-charcoal-700'
                          : 'bg-gradient-to-r from-gold-500/50 to-gold-500/30'
                        }
                      `}>
                        {/* Animated pulse on route if next show is open */}
                        {!isLocked && (
                          <div className="absolute inset-0 bg-gradient-to-r from-gold-400/0 via-gold-400/60 to-gold-400/0 animate-pulse" style={{ animationDuration: '2s' }} />
                        )}
                      </div>
                      {/* Route Dot */}
                      <div className={`
                        w-3 h-3 rounded-sm border-2 mx-[-6px] z-10
                        ${isLocked
                          ? 'bg-charcoal-800 border-charcoal-600'
                          : isRegistered
                            ? 'bg-gold-400 border-gold-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                            : 'bg-charcoal-900 border-gold-500/50'
                        }
                      `} />
                    </div>
                  )}

                  {/* Starting Marker (first card only) */}
                  {index === 0 && (
                    <div className="flex items-center mr-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gold-500/20 border border-gold-500/30">
                        <div className="w-2 h-2 rounded-sm bg-gold-400" />
                        <span className="text-[10px] font-display font-bold text-gold-400 uppercase">Start</span>
                      </div>
                      <div className="w-4 h-0.5 bg-gold-500/30" />
                    </div>
                  )}

                  {/* Ticket Stub */}
                  <TicketStub
                    show={show}
                    index={index}
                    myCorps={myCorps}
                    formattedDate={formatDateCompact(show.day)}
                    isPast={isPast}
                    onRegister={onRegisterCorps}
                    isWeekend={weekend}
                  />

                  {/* End Marker (last card only) */}
                  {isLast && (
                    <div className="flex items-center ml-2">
                      <div className="w-4 h-0.5 bg-gold-500/30" />
                      <div className="flex items-center gap-1 px-2 py-1 bg-gold-500/20 border border-gold-500/30">
                        <span className="text-[10px] font-display font-bold text-gold-400 uppercase">End</span>
                        <div className="w-2 h-2 rounded-sm bg-gold-400" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gradient Fade Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-stadium-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-stadium-black to-transparent pointer-events-none" />
      </div>

      {/* Bottom Route Summary */}
      <div className="flex items-center justify-center gap-2 mt-4 py-2 border-t border-charcoal-800">
        <span className="text-xs text-cream/40 font-display uppercase tracking-wider">
          Scroll to explore all tour stops
        </span>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-sm bg-cream/20" />
          <div className="w-1 h-1 rounded-sm bg-cream/30" />
          <div className="w-1 h-1 rounded-sm bg-cream/20" />
        </div>
      </div>
    </motion.div>
  );
};

export default TourStrip;
