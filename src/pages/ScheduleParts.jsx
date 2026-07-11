// Presentational sections for the Schedule page: week pills, show cards and
// day-grouped show lists, and the Championship Week display. Extracted
// verbatim from Schedule.jsx.

import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Check, ChevronRight, Trophy } from 'lucide-react';
import { isEventPast } from '../utils/scheduleUtils';
import { CLASS_CONFIG, CHAMPIONSHIP_EVENTS } from './scheduleConstants';

// =============================================================================
// WEEK PILLS COMPONENT
// =============================================================================

const WeekPills = ({ weeks, currentWeek, selectedWeek, onSelect, getShowCount }) => {
  const containerRef = useRef(null);
  const currentWeekRef = useRef(null);

  // Auto-scroll to current week on mount
  useEffect(() => {
    if (currentWeekRef.current && containerRef.current) {
      currentWeekRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentWeek]);

  return (
    <div className="bg-[#1a1a1a] border-b border-[#333] px-3 py-2">
      {/* Segmented Control Container */}
      <div
        ref={containerRef}
        className="flex items-center gap-1 p-1 bg-[#111] border border-[#333] rounded-none overflow-x-auto scrollbar-hide"
      >
        {weeks.map((week) => {
          const isSelected = selectedWeek === week;
          const isCurrent = currentWeek === week;
          const showCount = getShowCount(week);

          return (
            <button
              key={week}
              ref={isCurrent ? currentWeekRef : null}
              onClick={() => onSelect(week)}
              className={`
                relative flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider
                whitespace-nowrap transition-all
                ${
                  isSelected
                    ? 'bg-[#0057B8] text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }
              `}
            >
              {isCurrent && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#0057B8] rounded-full" />
              )}
              <span>Wk {week}</span>
              <span
                className={`
                text-[9px] px-1 py-0.5
                ${isSelected ? 'bg-white/20' : 'bg-[#222] text-gray-400'}
              `}
              >
                {showCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// REGISTRATION BADGES COMPONENT
// =============================================================================

// Podium attends a SPECIFIC show: self-picks match by eventName (one show per
// night — never every show that day); majors/championship are auto-attended and
// are single-event days, matched by day.
const podiumAttendsShow = (podiumAttendance, show) =>
  Boolean(
    podiumAttendance &&
    (podiumAttendance.events?.has(show.eventName) || podiumAttendance.autoDays?.has(show.day))
  );

const RegistrationBadges = ({ show, userProfile, podiumAttendance }) => {
  const registeredCorps = userProfile?.corps
    ? Object.entries(userProfile.corps)
        .filter(([_corpsClass, corpsData]) => {
          if (!corpsData) return false;
          const weekKey = `week${show.week}`;
          const selectedShows = corpsData.selectedShows?.[weekKey] || [];
          // Match by eventName only - dates can have type mismatches (Timestamp vs string)
          // This matches the scoring.js logic which also only checks eventName
          return selectedShows.some((s) => s.eventName === show.eventName);
        })
        .map(([corpsClass]) => corpsClass)
    : [];

  const podiumAttending = podiumAttendsShow(podiumAttendance, show);

  if (registeredCorps.length === 0 && !podiumAttending) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {registeredCorps.map((corpsClass) => {
        const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400' };
        return (
          <span
            key={corpsClass}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none ${config.bgColor} ${config.color}`}
          >
            <Check className="w-2.5 h-2.5" />
            {config.name}
          </span>
        );
      })}
      {podiumAttending && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none ${CLASS_CONFIG.podiumClass.bgColor} ${CLASS_CONFIG.podiumClass.color}`}
        >
          <Check className="w-2.5 h-2.5" />
          {CLASS_CONFIG.podiumClass.name}
        </span>
      )}
    </div>
  );
};

// =============================================================================
// SHOW CARD COMPONENT
// =============================================================================

const ShowCard = ({
  show,
  userProfile,
  formattedDate,
  isPast,
  onRegister,
  isCompleted,
  seasonUid,
  podiumAttendance,
}) => {
  const isRegistered = useMemo(() => {
    if (podiumAttendsShow(podiumAttendance, show)) return true;
    if (!userProfile?.corps) return false;
    return Object.values(userProfile.corps).some((corps) => {
      if (!corps) return false;
      const weekKey = `week${show.week}`;
      const selectedShows = corps.selectedShows?.[weekKey] || [];
      // Match by eventName only - dates can have type mismatches (Timestamp vs string)
      return selectedShows.some((s) => s.eventName === show.eventName);
    });
  }, [show, userProfile, podiumAttendance]);

  // The marching.art majors (§5.11) are the season's marquee days — the only
  // event on their day, full-field convergence. Gold treatment mirrors the
  // Championship Week styling.
  const isMajor = show.eventTier === 'regional';

  return (
    <div
      onClick={() => !isPast && onRegister(show)}
      onKeyDown={(e) => {
        if (!isPast && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onRegister(show);
        }
      }}
      role={isPast ? undefined : 'button'}
      tabIndex={isPast ? undefined : 0}
      aria-label={isPast ? undefined : `Open registration for ${show.eventName}`}
      className={`
        bg-[#1a1a1a] border rounded-none overflow-hidden
        ${isMajor ? 'border-yellow-500/40' : 'border-[#333]'}
        ${isPast ? 'opacity-60' : `${isMajor ? 'hover:border-yellow-500/70' : 'hover:border-[#444]'} cursor-pointer active:bg-[#222]`}
        ${isRegistered && !isPast ? 'border-l-2 border-l-green-500' : ''}
      `}
    >
      {/* Card Header */}
      <div
        className={`px-4 py-3 border-b border-[#333] ${
          isMajor ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isMajor && (
              <div className="flex items-center gap-1 mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-500">
                <Trophy className="w-3 h-3" /> marching.art Major
              </div>
            )}
            <h3 className="text-sm font-bold text-white truncate leading-tight">
              {show.eventName}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1 font-data">
                <Calendar className="w-3 h-3 text-[#0057B8]" />
                {formattedDate}
              </span>
              {show.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-purple-400" />
                  <span className="truncate">{show.location}</span>
                </span>
              )}
            </div>
            {show.multiNight?.nights?.length > 1 && (
              <div className="mt-1 text-[10px] text-[#c9a227]">
                Two-night event — one registration covers both nights; you perform on your assigned
                night (lineups announced Day {show.multiNight.nights[0] - 2})
              </div>
            )}
            {show.sponsor?.corpsName && (
              <div className="mt-1 text-[10px] text-yellow-500/90 truncate">
                ★ Presented by {show.sponsor.corpsName}
              </div>
            )}
          </div>

          {/* Status Badge */}
          {isPast ? (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#333] text-gray-400 rounded-none">
              {isCompleted ? 'Scored' : 'Done'}
            </span>
          ) : isRegistered ? (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-green-500/10 text-green-400 rounded-none flex items-center gap-1">
              <Check className="w-3 h-3" />
              Going
            </span>
          ) : (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] rounded-none">
              Register
            </span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 py-2 bg-[#111]">
        <div className="flex items-center justify-between">
          {/* Registration Badges */}
          <RegistrationBadges
            show={show}
            userProfile={userProfile}
            podiumAttendance={podiumAttendance}
          />

          {/* Results Link for Completed Shows with actual results */}
          {isCompleted && (
            <Link
              to={`/scores?show=${encodeURIComponent(show.eventName)}${seasonUid ? `&season=${seasonUid}` : ''}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-[#0057B8] hover:underline font-bold uppercase"
            >
              <Trophy className="w-3 h-3" />
              Results
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}

          {/* Empty State */}
          {!isRegistered && !isPast && (
            <span className="text-[10px] text-gray-600">Tap to register</span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DAY INDICATOR COMPONENT
// =============================================================================

const DayIndicator = ({ date, dayNumber, isMajorDay = false }) => {
  if (!date) return null;

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const isPast = isEventPast(date);

  return (
    <div
      className={`
      flex-shrink-0 w-20 lg:w-24 flex flex-col items-center justify-center
      py-3 px-2 rounded-none border
      ${
        isPast
          ? 'bg-[#1a1a1a] border-[#333] text-gray-500'
          : isMajorDay
            ? 'bg-yellow-500/10 border-yellow-500/40'
            : 'bg-[#0057B8]/10 border-[#0057B8]/30'
      }
    `}
    >
      <span
        className={`text-[10px] font-bold uppercase ${
          isPast ? 'text-gray-500' : isMajorDay ? 'text-yellow-500' : 'text-[#0057B8]'
        }`}
      >
        {dayOfWeek}
      </span>
      <span className={`text-sm font-bold font-data ${isPast ? 'text-gray-400' : 'text-white'}`}>
        {monthDay}
      </span>
      {dayNumber != null && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 font-data">
          Day {dayNumber}
        </span>
      )}
      {isMajorDay && !isPast && <Trophy className="w-3 h-3 text-yellow-500 mt-0.5" />}
    </div>
  );
};

// =============================================================================
// DAY ROW COMPONENT
// =============================================================================

const DayRow = ({
  day,
  shows,
  userProfile,
  formatDate,
  getActualDate,
  onRegister,
  seasonUid,
  podiumAttendance,
}) => {
  const date = getActualDate(day);
  const isPast = isEventPast(date);
  const isMajorDay = shows.some((show) => show.eventTier === 'regional');

  return (
    <div className="flex gap-3 items-stretch">
      {/* Day Indicator */}
      <DayIndicator date={date} dayNumber={day} isMajorDay={isMajorDay} />

      {/* Shows for this day - horizontal layout */}
      <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((show, idx) => (
          <ShowCard
            key={`${show.eventName}-${show.day}-${idx}`}
            show={show}
            userProfile={userProfile}
            formattedDate={formatDate(show.day)}
            isPast={isPast}
            onRegister={onRegister}
            isCompleted={isPast && show.scores?.some((s) => s.score != null)}
            seasonUid={seasonUid}
            podiumAttendance={podiumAttendance}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// SHOWS LIST COMPONENT
// =============================================================================

const ShowsList = ({
  shows,
  userProfile,
  formatDate,
  getActualDate,
  onRegister,
  seasonUid,
  podiumAttendance,
}) => {
  // Group shows by day
  const showsByDay = useMemo(() => {
    if (!shows || shows.length === 0) return {};

    const grouped = {};
    shows.forEach((show) => {
      const day = show.day;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(show);
    });

    return grouped;
  }, [shows]);

  const days = Object.keys(showsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  if (!shows || shows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Calendar className="w-12 h-12 text-gray-600 mb-3" />
        <h3 className="text-sm font-bold text-white mb-1">No Shows This Week</h3>
        <p className="text-xs text-gray-500 max-w-[280px]">
          Check other weeks for available shows.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-4">
      {days.map((day) => (
        <DayRow
          key={day}
          day={day}
          shows={showsByDay[day]}
          userProfile={userProfile}
          formatDate={formatDate}
          getActualDate={getActualDate}
          onRegister={onRegister}
          seasonUid={seasonUid}
          podiumAttendance={podiumAttendance}
        />
      ))}
    </div>
  );
};

// =============================================================================
// CHAMPIONSHIP WEEK DISPLAY COMPONENT
// =============================================================================

const ChampionshipEventCard = ({
  event,
  userProfile,
  getActualDate,
  seasonUid: _seasonUid,
  podiumAttendance,
}) => {
  const date = getActualDate(event.day);
  const isPast = isEventPast(date);
  const formattedDate = date
    ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : `Day ${event.day}`;

  // Find which of user's corps are eligible for this event
  const eligibleCorps = useMemo(() => {
    if (!userProfile?.corps) return [];
    return Object.entries(userProfile.corps)
      .filter(([corpsClass, corpsData]) => {
        if (!corpsData?.corpsName) return false;
        return event.eligibleClasses.includes(corpsClass);
      })
      .map(([corpsClass, corpsData]) => ({
        corpsClass,
        corpsName: corpsData.corpsName,
      }));
  }, [userProfile, event.eligibleClasses]);

  // The Podium corps auto-attends its division's championship days (from
  // podium/state autoDays), which the fantasy eligibleClasses don't cover.
  const podiumAttending = Boolean(podiumAttendance?.autoDays?.has(event.day));
  const hasEligibleCorps = eligibleCorps.length > 0 || podiumAttending;

  return (
    <div
      className={`
        bg-[#1a1a1a] border border-[#333] rounded-none overflow-hidden
        ${isPast ? 'opacity-60' : ''}
        ${hasEligibleCorps && !isPast ? 'border-l-2 border-l-[#0057B8]' : ''}
      `}
    >
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-[#333]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <h3 className="text-sm font-bold text-white truncate leading-tight">
                {event.eventName}
              </h3>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1 font-data">
                <Calendar className="w-3 h-3 text-[#0057B8]" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-purple-400" />
                <span className="truncate">{event.location}</span>
              </span>
              <span className="text-gray-600 font-data">Day {event.day}</span>
            </div>
          </div>

          {/* Auto-Enrolled Badge */}
          {hasEligibleCorps && !isPast ? (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] rounded-none flex items-center gap-1">
              <Check className="w-3 h-3" />
              Auto-Enrolled
            </span>
          ) : isPast ? (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#333] text-gray-400 rounded-none">
              Completed
            </span>
          ) : (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#333] text-gray-500 rounded-none">
              No Corps
            </span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 py-2 bg-[#111]">
        <div className="flex items-center justify-between">
          {/* Enrolled Corps Badges */}
          {hasEligibleCorps ? (
            <div className="flex items-center gap-1 flex-wrap">
              {eligibleCorps.map(({ corpsClass }) => {
                const config = CLASS_CONFIG[corpsClass] || {
                  name: corpsClass,
                  color: 'text-gray-400',
                  bgColor: 'bg-gray-500/10',
                };
                return (
                  <span
                    key={corpsClass}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none ${config.bgColor} ${config.color}`}
                  >
                    <Check className="w-2.5 h-2.5" />
                    {config.name}
                  </span>
                );
              })}
              {podiumAttending && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none ${CLASS_CONFIG.podiumClass.bgColor} ${CLASS_CONFIG.podiumClass.color}`}
                >
                  <Check className="w-2.5 h-2.5" />
                  {CLASS_CONFIG.podiumClass.name}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-gray-600">{event.description}</span>
          )}

          {/* Eligible Classes Info */}
          <div className="flex items-center gap-1">
            {event.eligibleClasses.map((cls) => {
              const config = CLASS_CONFIG[cls];
              if (!config) return null;
              return (
                <span
                  key={cls}
                  className={`text-[9px] px-1 py-0.5 rounded-none ${config.bgColor} ${config.color} opacity-60`}
                >
                  {config.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChampionshipWeekDisplay = ({
  userProfile,
  getActualDate,
  seasonUid,
  regularShows,
  formatDate,
  onRegister,
  podiumAttendance,
}) => {
  // Group championship events by day
  const eventsByDay = useMemo(() => {
    const grouped = {};
    CHAMPIONSHIP_EVENTS.forEach((event) => {
      if (!grouped[event.day]) grouped[event.day] = [];
      grouped[event.day].push(event);
    });
    return grouped;
  }, []);

  // Group regular shows (days 43-44) by day
  const regularShowsByDay = useMemo(() => {
    if (!regularShows || regularShows.length === 0) return {};
    const grouped = {};
    regularShows.forEach((show) => {
      // Only include days 43-44 (regular season days in week 7)
      if (show.day >= 43 && show.day <= 44) {
        if (!grouped[show.day]) grouped[show.day] = [];
        grouped[show.day].push(show);
      }
    });
    return grouped;
  }, [regularShows]);

  const regularDays = Object.keys(regularShowsByDay)
    .map(Number)
    .sort((a, b) => a - b);
  const championshipDays = Object.keys(eventsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="p-3 flex flex-col gap-4">
      {/* Regular Shows (Days 43-44) */}
      {regularDays.length > 0 && (
        <>
          {regularDays.map((day) => {
            const date = getActualDate(day);
            const isPast = isEventPast(date);
            return (
              <div key={day} className="flex gap-3 items-stretch">
                <DayIndicator date={date} dayNumber={day} />
                <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {regularShowsByDay[day].map((show, idx) => (
                    <ShowCard
                      key={`${show.eventName}-${show.day}-${idx}`}
                      show={show}
                      userProfile={userProfile}
                      formattedDate={formatDate(show.day)}
                      isPast={isPast}
                      onRegister={onRegister}
                      isCompleted={isPast && show.scores?.some((s) => s.score != null)}
                      seasonUid={seasonUid}
                      podiumAttendance={podiumAttendance}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Championship Week Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-[#0057B8]/10 border border-yellow-500/20 rounded-none px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-[10px] font-bold text-white uppercase tracking-wider">
            Championship Week
          </h3>
        </div>
        <p className="text-xs text-gray-400">
          All championship events have{' '}
          <span className="text-[#0057B8] font-bold">automatic enrollment</span> based on your corps
          class and advancement. No registration required!
        </p>
      </div>

      {/* Championship Events by Day */}
      {championshipDays.map((day) => {
        const date = getActualDate(day);
        return (
          <div key={day} className="flex gap-3 items-stretch">
            {/* Day Indicator */}
            <DayIndicator date={date} dayNumber={day} />

            {/* Events for this day */}
            <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {eventsByDay[day].map((event, idx) => (
                <ChampionshipEventCard
                  key={`${event.eventName}-${idx}`}
                  event={event}
                  userProfile={userProfile}
                  getActualDate={getActualDate}
                  seasonUid={seasonUid}
                  podiumAttendance={podiumAttendance}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { WeekPills, ShowsList, ChampionshipWeekDisplay };
