// =============================================================================
// SCHEDULE - SHOW REGISTRATION & BROWSING
// =============================================================================
// Browse all shows by week, register corps for competitions
// Laws: Dense data, ESPN aesthetic, mobile-optimized touch targets

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, MapPin, Check, ChevronRight, Trophy
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useSeasonStore } from '../store/seasonStore';
import { ShowRegistrationModal } from '../components/Schedule';

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_CONFIG = {
  worldClass: { name: 'World', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
  openClass: { name: 'Open', color: 'text-purple-400', bgColor: 'bg-purple-400/10', borderColor: 'border-purple-400/30' },
  aClass: { name: 'A Class', color: 'text-[#0057B8]', bgColor: 'bg-[#0057B8]/10', borderColor: 'border-[#0057B8]/30' },
  soundSport: { name: 'SS', color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
};

// =============================================================================
// WEEK PILLS COMPONENT
// =============================================================================

const WeekPills = ({ weeks, currentWeek, selectedWeek, onSelect, showsByWeek }) => {
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
    <div className="bg-[#1a1a1a] border-b border-[#333] px-3 py-2.5">
      <div ref={containerRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {weeks.map((week) => {
          const isSelected = selectedWeek === week;
          const isCurrent = currentWeek === week;
          const showCount = showsByWeek[week]?.length || 0;

          return (
            <button
              key={week}
              ref={isCurrent ? currentWeekRef : null}
              onClick={() => onSelect(week)}
              className={`
                relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase
                whitespace-nowrap rounded transition-all min-h-[44px]
                ${isSelected
                  ? 'bg-[#0057B8] text-white'
                  : 'bg-[#222] text-gray-400 hover:text-white active:bg-[#333]'
                }
              `}
            >
              {isCurrent && !isSelected && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#0057B8] rounded-full animate-pulse" />
              )}
              <span>Week {week}</span>
              <span className={`
                text-[10px] px-1.5 py-0.5 rounded
                ${isSelected ? 'bg-white/20' : 'bg-[#333]'}
              `}>
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

const RegistrationBadges = ({ show, userProfile }) => {
  if (!userProfile?.corps) return null;

  const registeredCorps = Object.entries(userProfile.corps)
    .filter(([corpsClass, corpsData]) => {
      if (!corpsData) return false;
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];
      return selectedShows.some(s => s.eventName === show.eventName && s.date === show.date);
    })
    .map(([corpsClass]) => corpsClass);

  if (registeredCorps.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {registeredCorps.map((corpsClass) => {
        const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400' };
        return (
          <span
            key={corpsClass}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${config.bgColor} ${config.color}`}
          >
            <Check className="w-2.5 h-2.5" />
            {config.name}
          </span>
        );
      })}
    </div>
  );
};

// =============================================================================
// SHOW CARD COMPONENT
// =============================================================================

const ShowCard = ({ show, userProfile, formattedDate, isPast, onRegister, isCompleted, seasonUid }) => {
  const isRegistered = useMemo(() => {
    if (!userProfile?.corps) return false;
    return Object.values(userProfile.corps).some(corps => {
      if (!corps) return false;
      const weekKey = `week${show.week}`;
      const selectedShows = corps.selectedShows?.[weekKey] || [];
      return selectedShows.some(s => s.eventName === show.eventName && s.date === show.date);
    });
  }, [show, userProfile]);

  return (
    <div
      onClick={() => !isPast && onRegister(show)}
      className={`
        bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden
        ${isPast ? 'opacity-60' : 'hover:border-[#444] cursor-pointer active:bg-[#222]'}
        ${isRegistered && !isPast ? 'border-l-2 border-l-green-500' : ''}
      `}
    >
      {/* Card Header */}
      <div className="px-3 py-2.5 border-b border-[#333]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white truncate leading-tight">
              {show.eventName}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
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
          </div>

          {/* Status Badge */}
          {isPast ? (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#333] text-gray-400 rounded">
              {isCompleted ? 'Scored' : 'Done'}
            </span>
          ) : isRegistered ? (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-green-500/10 text-green-400 rounded flex items-center gap-1">
              <Check className="w-3 h-3" />
              Going
            </span>
          ) : (
            <span className="flex-shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] rounded">
              Register
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-3 py-2 bg-[#111]">
        <div className="flex items-center justify-between">
          {/* Registration Badges */}
          <RegistrationBadges show={show} userProfile={userProfile} />

          {/* Results Link for Completed Shows with actual results */}
          {isCompleted && (
            <Link
              to={`/scores?show=${encodeURIComponent(show.eventName)}${seasonUid ? `&season=${seasonUid}` : ''}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs text-[#0057B8] hover:underline"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="font-bold">Results</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}

          {/* Empty State */}
          {!isRegistered && !isPast && (
            <span className="text-[10px] text-gray-600">Tap to register corps</span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DAY INDICATOR COMPONENT
// =============================================================================

const DayIndicator = ({ date, dayNumber }) => {
  if (!date) return null;

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const isPast = date < new Date();

  return (
    <div className={`
      flex-shrink-0 w-20 lg:w-24 flex flex-col items-center justify-center
      py-3 px-2 rounded-lg border
      ${isPast
        ? 'bg-[#1a1a1a] border-[#333] text-gray-500'
        : 'bg-[#0057B8]/10 border-[#0057B8]/30'
      }
    `}>
      <span className={`text-xs font-bold uppercase ${isPast ? 'text-gray-500' : 'text-[#0057B8]'}`}>
        {dayOfWeek}
      </span>
      <span className={`text-sm font-bold ${isPast ? 'text-gray-400' : 'text-white'}`}>
        {monthDay}
      </span>
    </div>
  );
};

// =============================================================================
// DAY ROW COMPONENT
// =============================================================================

const DayRow = ({ day, shows, userProfile, formatDate, getActualDate, onRegister, seasonUid }) => {
  const date = getActualDate(day);
  const isPast = date && date < new Date();

  return (
    <div className="flex gap-3 items-stretch">
      {/* Day Indicator */}
      <DayIndicator date={date} dayNumber={day} />

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
            isCompleted={isPast && show.scores?.some(s => s.score != null)}
            seasonUid={seasonUid}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// SHOWS LIST COMPONENT
// =============================================================================

const ShowsList = ({ shows, userProfile, formatDate, getActualDate, onRegister, seasonUid }) => {
  // Group shows by day
  const showsByDay = useMemo(() => {
    if (!shows || shows.length === 0) return {};

    const grouped = {};
    shows.forEach(show => {
      const day = show.day;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(show);
    });

    return grouped;
  }, [shows]);

  const days = Object.keys(showsByDay).map(Number).sort((a, b) => a - b);

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
      {days.map(day => (
        <DayRow
          key={day}
          day={day}
          shows={showsByDay[day]}
          userProfile={userProfile}
          formatDate={formatDate}
          getActualDate={getActualDate}
          onRegister={onRegister}
          seasonUid={seasonUid}
        />
      ))}
    </div>
  );
};

// =============================================================================
// MAIN SCHEDULE COMPONENT
// =============================================================================

const Schedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);

  // Season store
  const seasonData = useSeasonStore((state) => state.seasonData);
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const currentWeek = useSeasonStore((state) => state.currentWeek);
  const seasonLoading = useSeasonStore((state) => state.loading);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);

  // Initialize selected week to current week
  useEffect(() => {
    if (currentWeek && selectedWeek === null) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek, selectedWeek]);

  // Load schedule from subcollection
  useEffect(() => {
    const loadSchedule = async () => {
      if (!seasonUid) return;
      try {
        const daysRef = collection(db, `season-schedules/${seasonUid}/days`);
        const daysQuery = query(daysRef, orderBy('offSeasonDay'));
        const snapshot = await getDocs(daysQuery);
        const days = snapshot.docs.map(doc => doc.data());
        setScheduleData(days);
      } catch (error) {
        console.error('Error loading schedule:', error);
      }
    };
    loadSchedule();
  }, [seasonUid]);

  // Load user profile
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (!seasonLoading && (userProfile !== null || !user)) {
      setLoading(false);
    }
  }, [seasonLoading, userProfile, user]);

  const loadUserProfile = async () => {
    try {
      const profileRef = doc(db, `artifacts/marching-art/users/${user.uid}/profile/data`);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setUserProfile(profileSnap.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Get actual date from day number
  const getActualDate = useCallback((dayNumber) => {
    if (!seasonData?.schedule?.startDate) return null;
    const startDate = seasonData.schedule.startDate.toDate();
    const actualDate = new Date(startDate);
    actualDate.setDate(startDate.getDate() + dayNumber);
    return actualDate;
  }, [seasonData]);

  // Format date
  const formatDate = useCallback((dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [getActualDate]);

  // Get week date range
  const getWeekDateRange = useCallback((weekNumber) => {
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = weekNumber * 7;
    const startDate = getActualDate(startDay);
    const endDate = getActualDate(endDay);
    if (!startDate || !endDate) return '';
    const opts = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', opts)}`;
  }, [getActualDate]);

  // Get all shows grouped by week (from subcollection data)
  const showsByWeek = useMemo(() => {
    if (!scheduleData || scheduleData.length === 0) return {};

    const grouped = {};
    scheduleData.forEach(dayEvent => {
      const day = dayEvent.offSeasonDay || dayEvent.day || 0;
      const week = Math.ceil(day / 7);
      if (dayEvent.shows) {
        dayEvent.shows.forEach(show => {
          if (!grouped[week]) grouped[week] = [];
          grouped[week].push({
            ...show,
            day,
            week,
          });
        });
      }
    });

    // Sort shows within each week by day
    Object.keys(grouped).forEach(week => {
      grouped[week].sort((a, b) => a.day - b.day);
    });

    return grouped;
  }, [scheduleData]);

  const weeks = Object.keys(showsByWeek).map(Number).sort((a, b) => a - b);

  // Handle show click
  const handleShowClick = useCallback((show) => {
    setSelectedShow(show);
    setRegistrationModal(true);
  }, []);

  // Count registrations
  const registrationStats = useMemo(() => {
    if (!userProfile?.corps) return { total: 0, thisWeek: 0 };

    let total = 0;
    let thisWeek = 0;

    Object.values(userProfile.corps).forEach((corps) => {
      if (!corps?.selectedShows) return;
      Object.entries(corps.selectedShows).forEach(([weekKey, shows]) => {
        const count = (shows || []).length;
        total += count;
        if (weekKey === `week${currentWeek}`) {
          thisWeek += count;
        }
      });
    });

    return { total, thisWeek };
  }, [userProfile, currentWeek]);

  // Loading
  if (loading) {
    return (
      <div className="w-full py-20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading schedule...</p>
        </div>
      </div>
    );
  }

  // No season
  if (!seasonData) {
    return (
      <div className="w-full py-20 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-white mb-1">No Active Season</h2>
          <p className="text-xs text-gray-500">The schedule will appear once a season is active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HEADER - Fixed */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#0057B8]" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase">
                {formatSeasonName?.() || '2025'} Schedule
              </h1>
              <p className="text-[10px] text-gray-500">
                Week {currentWeek} of 7 • {getWeekDateRange(currentWeek)}
              </p>
            </div>
          </div>

          {/* Registration Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-gray-500">This Week</div>
              <div className="font-bold text-white tabular-nums">{registrationStats.thisWeek}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">Total</div>
              <div className="font-bold text-[#0057B8] tabular-nums">{registrationStats.total}</div>
            </div>
          </div>
        </div>
      </div>

      {/* WEEK PILLS - Fixed */}
      <div className="flex-shrink-0">
        <WeekPills
          weeks={weeks}
          currentWeek={currentWeek}
          selectedWeek={selectedWeek}
          onSelect={setSelectedWeek}
          showsByWeek={showsByWeek}
        />
      </div>

      {/* SHOWS LIST - Scrollable with momentum */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-momentum">
        <ShowsList
          shows={showsByWeek[selectedWeek] || []}
          userProfile={userProfile}
          formatDate={formatDate}
          getActualDate={getActualDate}
          onRegister={handleShowClick}
          seasonUid={seasonUid}
        />
      </div>

      {/* REGISTRATION MODAL */}
      {registrationModal && selectedShow && (
        <ShowRegistrationModal
          show={selectedShow}
          userProfile={userProfile}
          formattedDate={formatDate(selectedShow.day)}
          onClose={() => setRegistrationModal(false)}
          onSuccess={() => {
            loadUserProfile();
            setRegistrationModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Schedule;
