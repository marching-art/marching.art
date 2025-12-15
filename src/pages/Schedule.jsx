// src/pages/Schedule.jsx
// Streamlined Schedule - Simple week selector + card-based show list
import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, Calendar, MapPin, Check, Star,
  ChevronLeft, ChevronRight, CalendarDays, List,
  CheckCircle2, Users
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SystemLoader } from '../components/ui/CommandConsole';
import { useSeasonStore } from '../store/seasonStore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import toast from 'react-hot-toast';

// Import modular components
import { ShowRegistrationModal } from '../components/Schedule';

// Class display colors
const CLASS_COLORS = {
  worldClass: 'text-gold-400 bg-gold-500/20 border-gold-500/30',
  openClass: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  aClass: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  soundSport: 'text-green-400 bg-green-500/20 border-green-500/30'
};

// DCI-style recommended show days (weekends are typically bigger shows)
const isRecommendedShow = (dayNumber, getActualDate) => {
  const date = getActualDate(dayNumber);
  if (!date) return false;
  const dayOfWeek = date.getDay();
  // Saturday (6) and Sunday (0) are recommended - these align with real DCI shows
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const Schedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [registeringAll, setRegisteringAll] = useState(false);

  // Use global season store
  const seasonData = useSeasonStore((state) => state.seasonData);
  const currentWeek = useSeasonStore((state) => state.currentWeek);
  const seasonLoading = useSeasonStore((state) => state.loading);

  // Calculate actual calendar date from season start date and day number
  const getActualDate = (dayNumber) => {
    if (!seasonData?.schedule?.startDate) return null;
    const startDate = seasonData.schedule.startDate.toDate();
    const actualDate = new Date(startDate);
    actualDate.setDate(startDate.getDate() + dayNumber);
    return actualDate;
  };

  // Format date for display
  const formatDateCompact = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateFull = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get day of week name
  const getDayName = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Set selectedWeek to currentWeek once data loads
  useEffect(() => {
    if (currentWeek) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek]);

  // Update loading state
  useEffect(() => {
    if (!seasonLoading && userProfile !== null) {
      setLoading(false);
    } else if (!seasonLoading && !user) {
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
      console.error('Error loading user profile:', error);
    }
  };

  const getWeekStatus = (weekNumber) => {
    if (weekNumber < currentWeek) return 'past';
    if (weekNumber === currentWeek) return 'current';
    return 'future';
  };

  const getAllShows = () => {
    if (!seasonData?.events) return [];

    const allShows = [];
    seasonData.events.forEach(dayEvent => {
      const day = dayEvent.offSeasonDay || dayEvent.day || 0;
      if (dayEvent.shows) {
        dayEvent.shows.forEach(show => {
          allShows.push({
            ...show,
            day: day,
            offSeasonDay: day,
            week: Math.ceil(day / 7)
          });
        });
      }
    });

    return allShows.sort((a, b) => a.day - b.day);
  };

  const getMyCorpsAtShow = (show) => {
    if (!userProfile?.corps) return [];

    const attendingCorps = [];
    Object.entries(userProfile.corps).forEach(([corpsClass, corpsData]) => {
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];

      const isAttending = selectedShows.some(
        s => s.eventName === show.eventName && s.date === show.date
      );

      if (isAttending) {
        attendingCorps.push({
          corpsClass,
          corpsName: corpsData.corpsName || corpsData.name || 'Unnamed Corps'
        });
      }
    });

    return attendingCorps;
  };

  const handleRegisterCorps = (show) => {
    setSelectedShow(show);
    setRegistrationModal(true);
  };

  // Register All - register all user's corps for all shows in the week
  const handleRegisterAll = async () => {
    if (!userProfile?.corps || selectedWeekShows.length === 0) {
      toast.error('No corps or shows available');
      return;
    }

    const corpsClasses = Object.keys(userProfile.corps);
    if (corpsClasses.length === 0) {
      toast.error('You need to register a corps first');
      return;
    }

    setRegisteringAll(true);

    try {
      const selectUserShows = httpsCallable(functions, 'selectUserShows');

      // For each corps, register for shows (up to 4 per week)
      for (const corpsClass of corpsClasses) {
        const corpsData = userProfile.corps[corpsClass];
        const weekKey = `week${selectedWeek}`;
        const currentShows = corpsData.selectedShows?.[weekKey] || [];

        // Calculate how many more shows we can add
        const slotsAvailable = 4 - currentShows.length;
        if (slotsAvailable <= 0) continue;

        // Get shows not already registered for
        const unregisteredShows = selectedWeekShows.filter(show =>
          !currentShows.some(s => s.eventName === show.eventName && s.date === show.date)
        );

        // Add up to slotsAvailable shows
        const showsToAdd = unregisteredShows.slice(0, slotsAvailable);
        if (showsToAdd.length === 0) continue;

        const newShows = [
          ...currentShows,
          ...showsToAdd.map(show => ({
            eventName: show.eventName,
            date: show.date,
            location: show.location,
            day: show.day
          }))
        ];

        await selectUserShows({
          week: selectedWeek,
          shows: newShows,
          corpsClass
        });
      }

      toast.success('Registered for all available shows!');
      await loadUserProfile();
    } catch (error) {
      console.error('Error registering for all:', error);
      toast.error('Failed to register for all shows');
    } finally {
      setRegisteringAll(false);
    }
  };

  // Get count of user's registrations for a week
  const getWeekRegistrationCount = (weekNumber) => {
    if (!userProfile?.corps) return 0;
    let count = 0;
    Object.values(userProfile.corps).forEach(corpsData => {
      const weekKey = `week${weekNumber}`;
      const shows = corpsData.selectedShows?.[weekKey] || [];
      count += shows.length;
    });
    return count;
  };

  // Get shows for selected week
  const allShows = useMemo(() => getAllShows(), [seasonData]);
  const selectedWeekShows = useMemo(() =>
    allShows.filter(show => show.week === selectedWeek),
    [allShows, selectedWeek]
  );

  // Check if all shows in week are registered
  const allShowsRegistered = useMemo(() => {
    if (!userProfile?.corps || selectedWeekShows.length === 0) return false;
    return selectedWeekShows.every(show => getMyCorpsAtShow(show).length > 0);
  }, [userProfile, selectedWeekShows]);

  // Get shows organized by day for calendar view
  const showsByDay = useMemo(() => {
    const grouped = {};
    selectedWeekShows.forEach(show => {
      const dayKey = show.day;
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(show);
    });
    return grouped;
  }, [selectedWeekShows]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <SystemLoader
          messages={[
            'LOADING SCHEDULE DATA...',
            'RETRIEVING TOUR DATES...',
            'SYNCING REGISTRATION STATUS...',
          ]}
          showProgress={true}
        />
      </div>
    );
  }

  if (!seasonData) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-charcoal-900/50 backdrop-blur-md border border-red-500/20 rounded-xl p-8 text-center max-w-md"
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-cream-100 uppercase tracking-wide">No Active Season</h2>
          <p className="text-cream-500/60 mt-2">
            There is currently no active season. Please check back later.
          </p>
        </motion.div>
      </div>
    );
  }

  const weekStatus = getWeekStatus(selectedWeek);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* ================================================================
          HEADER: Title + Week indicator + View toggle
          ================================================================ */}
      <div className="shrink-0 border-b border-white/5 bg-black/30 backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gold-400" />
            <h1 className="text-xl font-display font-bold text-cream uppercase tracking-wide">Schedule</h1>
            <span className="px-2 py-1 rounded bg-gold-500/20 border border-gold-500/30 text-xs font-bold text-gold-400">
              Week {currentWeek} of 7
            </span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'text-cream/60 hover:text-cream'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'text-cream/60 hover:text-cream'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================
          WEEK SELECTOR: Horizontal scroll week tabs
          ================================================================ */}
      <div className="shrink-0 border-b border-white/5 bg-black/20 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto hud-scroll pb-1">
          {[1, 2, 3, 4, 5, 6, 7].map((week) => {
            const status = getWeekStatus(week);
            const regCount = getWeekRegistrationCount(week);
            const showCount = allShows.filter(s => s.week === week).length;
            const isSelected = selectedWeek === week;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`
                  relative flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-lg transition-all
                  ${isSelected
                    ? 'bg-gold-500/20 border-2 border-gold-500/50'
                    : status === 'current'
                    ? 'bg-purple-500/10 border border-purple-500/30 hover:border-purple-500/50'
                    : status === 'past'
                    ? 'bg-white/5 border border-white/5 opacity-60 hover:opacity-80'
                    : 'bg-white/5 border border-white/10 hover:border-white/20'
                  }
                `}
              >
                {/* Current week indicator */}
                {status === 'current' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                )}

                {/* Week number with star for selected */}
                <div className="flex items-center gap-1">
                  {isSelected && <Star className="w-3 h-3 text-gold-400 fill-gold-400" />}
                  <span className={`text-base font-bold ${
                    isSelected ? 'text-gold-400' : status === 'current' ? 'text-purple-400' : 'text-cream/70'
                  }`}>
                    Wk {week}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-cream/50">{showCount} shows</span>
                  {regCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                      <Check className="w-2.5 h-2.5" />{regCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================
          WEEK HEADER: Status + Register All button
          ================================================================ */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5 bg-black/10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-display font-bold text-cream">
              Week {selectedWeek} Shows
            </h2>
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
              weekStatus === 'current' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              weekStatus === 'past' ? 'bg-white/10 text-cream/50' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {weekStatus === 'current' ? 'Active' : weekStatus === 'past' ? 'Past' : 'Upcoming'}
            </span>
            <span className="text-sm text-cream/50">
              {selectedWeekShows.length} {selectedWeekShows.length === 1 ? 'show' : 'shows'} available
            </span>
          </div>

          {/* Register All Button */}
          {weekStatus !== 'past' && selectedWeekShows.length > 0 && userProfile?.corps && (
            <button
              onClick={handleRegisterAll}
              disabled={registeringAll || allShowsRegistered}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                allShowsRegistered
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                  : 'bg-gold-500 text-charcoal-900 hover:bg-gold-400 disabled:opacity-50'
              }`}
            >
              {registeringAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                  Registering...
                </>
              ) : allShowsRegistered ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  All Registered
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Register All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ================================================================
          SHOW LIST / CALENDAR VIEW
          ================================================================ */}
      <div className="flex-1 overflow-y-auto hud-scroll p-4">
        {selectedWeekShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Calendar className="w-16 h-16 text-cream/20 mb-4" />
            <h3 className="text-lg font-display font-bold text-cream/60 mb-2">No Shows This Week</h3>
            <p className="text-sm text-cream/40">Week {selectedWeek} has no scheduled events.</p>
          </div>
        ) : viewMode === 'list' ? (
          /* LIST VIEW */
          <div className="space-y-3">
            {selectedWeekShows.map((show, idx) => {
              const myCorps = getMyCorpsAtShow(show);
              const isRegistered = myCorps.length > 0;
              const recommended = isRecommendedShow(show.day, getActualDate);
              const showDate = getActualDate(show.day);
              const isPast = showDate && showDate < new Date();

              return (
                <motion.div
                  key={`${show.eventName}-${show.day}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`
                    relative bg-black/30 border rounded-xl overflow-hidden
                    ${isRegistered
                      ? 'border-green-500/40 bg-green-500/5'
                      : isPast
                        ? 'border-white/10 opacity-60'
                        : 'border-white/10 hover:border-gold-500/30'
                    }
                  `}
                >
                  {/* Recommended Badge */}
                  {recommended && !isPast && (
                    <div className="absolute top-3 right-3">
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-gold-500/20 border border-gold-500/30 text-[10px] font-bold text-gold-400">
                        <Star className="w-3 h-3 fill-gold-400" />
                        Recommended
                      </span>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Show Header */}
                    <div className="flex items-start gap-4">
                      {/* Location Icon */}
                      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isRegistered ? 'bg-green-500/20' : 'bg-gold-500/20'
                      }`}>
                        <MapPin className={`w-5 h-5 ${isRegistered ? 'text-green-400' : 'text-gold-400'}`} />
                      </div>

                      {/* Show Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-display font-bold text-cream truncate pr-24">
                          {show.eventName}
                        </h3>
                        <p className="text-sm text-cream/60 mt-0.5">
                          {formatDateFull(show.day)}
                        </p>
                        {show.location && (
                          <p className="text-xs text-cream/40 mt-1">{show.location}</p>
                        )}
                      </div>
                    </div>

                    {/* Registration Status */}
                    <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                      {isRegistered ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 text-sm text-green-400 font-bold">
                            <Check className="w-4 h-4" />
                            Registered
                          </span>
                          <span className="text-cream/30">—</span>
                          <div className="flex flex-wrap gap-1.5">
                            {myCorps.map((c, i) => (
                              <span
                                key={i}
                                className={`px-2 py-0.5 rounded text-xs font-bold border ${CLASS_COLORS[c.corpsClass] || 'text-cream/60 bg-white/10 border-white/20'}`}
                              >
                                {c.corpsName}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : isPast ? (
                        <span className="text-sm text-cream/40">Show completed</span>
                      ) : (
                        <span className="text-sm text-cream/50">Not registered</span>
                      )}

                      {/* Action Button */}
                      {!isPast && (
                        <button
                          onClick={() => handleRegisterCorps(show)}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                            ${isRegistered
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                              : 'bg-gold-500 text-charcoal-900 hover:bg-gold-400'
                            }
                          `}
                        >
                          {isRegistered ? (
                            <>
                              <Check className="w-4 h-4" />
                              Edit
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-4 h-4" />
                              Register
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* CALENDAR VIEW - Monthly Overview */
          <div>
            <div className="grid grid-cols-7 gap-2">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center py-2 text-xs font-bold text-cream/50 uppercase">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {(() => {
                const weekStart = (selectedWeek - 1) * 7 + 1;
                const weekEnd = selectedWeek * 7;
                const days = [];

                // Get the starting day of week for proper calendar alignment
                const firstDayDate = getActualDate(weekStart);
                const startDayOfWeek = firstDayDate ? firstDayDate.getDay() : 0;

                // Add empty cells for alignment
                for (let i = 0; i < startDayOfWeek; i++) {
                  days.push(<div key={`empty-${i}`} className="h-32" />);
                }

                // Add actual days
                for (let day = weekStart; day <= weekEnd; day++) {
                  const dayShows = showsByDay[day] || [];
                  const hasShows = dayShows.length > 0;
                  const isToday = getActualDate(day)?.toDateString() === new Date().toDateString();
                  const allRegistered = hasShows && dayShows.every(s => getMyCorpsAtShow(s).length > 0);
                  const someRegistered = hasShows && dayShows.some(s => getMyCorpsAtShow(s).length > 0);
                  const isPast = getActualDate(day) < new Date();

                  days.push(
                    <div
                      key={day}
                      className={`
                        h-32 rounded-lg border p-2 overflow-hidden
                        ${isToday ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/10 bg-black/20'}
                        ${hasShows && !isPast ? 'hover:border-gold-500/30 cursor-pointer' : ''}
                        ${isPast ? 'opacity-50' : ''}
                      `}
                    >
                      {/* Day Number */}
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-lg font-bold ${isToday ? 'text-purple-400' : 'text-cream/70'}`}>
                          {getActualDate(day)?.getDate()}
                        </span>
                        {allRegistered && <Check className="w-4 h-4 text-green-400" />}
                        {someRegistered && !allRegistered && <div className="w-2 h-2 rounded-full bg-gold-400" />}
                      </div>

                      {/* Shows */}
                      <div className="space-y-1">
                        {dayShows.slice(0, 2).map((show, i) => {
                          const isReg = getMyCorpsAtShow(show).length > 0;
                          return (
                            <div
                              key={i}
                              onClick={() => !isPast && handleRegisterCorps(show)}
                              className={`
                                text-[10px] px-1.5 py-1 rounded truncate
                                ${isReg
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                  : 'bg-gold-500/10 text-cream/70 border border-gold-500/20'
                                }
                              `}
                            >
                              {show.eventName}
                            </div>
                          );
                        })}
                        {dayShows.length > 2 && (
                          <span className="text-[10px] text-cream/40">+{dayShows.length - 2} more</span>
                        )}
                      </div>
                    </div>
                  );
                }

                return days;
              })()}
            </div>

            {/* Calendar Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
                <span className="text-xs text-cream/50">Registered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gold-500/20 border border-gold-500/30" />
                <span className="text-xs text-cream/50">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border border-purple-500/50 bg-purple-500/20" />
                <span className="text-xs text-cream/50">Today</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {registrationModal && selectedShow && (
          <ShowRegistrationModal
            show={selectedShow}
            userProfile={userProfile}
            formattedDate={formatDateCompact(selectedShow.day)}
            onClose={() => {
              setRegistrationModal(false);
            }}
            onSuccess={() => {
              loadUserProfile();
              setRegistrationModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Schedule;
