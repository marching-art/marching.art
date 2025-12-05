// src/pages/Schedule.jsx
// Command Console Layout: Top Week Rail + Bottom Split (Show List | Show Details)
import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Zap, Calendar, MapPin, Music, Users, Clock, ChevronRight, Trophy, Star, Check, Info } from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';
import { useSeasonStore } from '../store/seasonStore';

// Import modular components
import {
  ShowRegistrationModal,
  TourStrip,
} from '../components/Schedule';

const Schedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);

  // Use global season store instead of fetching independently
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

  // Format date for display - compact version
  const formatDateCompact = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format date for detail view
  const formatDateFull = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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

  // Update loading state based on season store and user profile
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

  // Class display helpers
  const getClassColor = (corpsClass) => {
    const colors = {
      worldClass: 'text-gold-400 bg-gold-500/20',
      openClass: 'text-purple-400 bg-purple-500/20',
      aClass: 'text-blue-400 bg-blue-500/20',
      soundSport: 'text-green-400 bg-green-500/20'
    };
    return colors[corpsClass] || 'text-cream-400 bg-cream-500/20';
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
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
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          COMMAND CONSOLE LAYOUT
          ================================================================ */}

      {/* ============================================================
          TOP RAIL: Week Selector
          ============================================================ */}
      <div className="flex-shrink-0 border-b border-cream-500/10 bg-charcoal-950/50">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-500/10">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gold-400" />
            <div>
              <h1 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
                Tour Schedule
              </h1>
              <p className="text-xs text-cream-500/60">
                Week {currentWeek} Active • {allShows.length} Shows Total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-gold-500/20 border border-gold-500/30 text-gold-400 text-xs font-mono font-bold">
              {getWeekRegistrationCount(selectedWeek)} Registered
            </span>
          </div>
        </div>

        {/* Week Tabs - Horizontal Scroll */}
        <div className="flex gap-1 p-2 overflow-x-auto hud-scroll">
          {[1, 2, 3, 4, 5, 6, 7].map((week) => {
            const status = getWeekStatus(week);
            const regCount = getWeekRegistrationCount(week);
            const showCount = allShows.filter(s => s.week === week).length;
            const isSelected = selectedWeek === week;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`relative flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[80px] ${
                  isSelected
                    ? 'bg-gold-500/20 border-gold-500/50 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                    : status === 'current'
                    ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
                    : status === 'past'
                    ? 'bg-charcoal-900/30 border-cream-500/10 opacity-60 hover:opacity-80'
                    : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30'
                }`}
              >
                <span className={`text-xs font-display uppercase tracking-wider ${
                  isSelected ? 'text-gold-400' : status === 'current' ? 'text-purple-400' : 'text-cream-500/60'
                }`}>
                  Week
                </span>
                <span className={`text-xl font-mono font-bold ${
                  isSelected ? 'text-gold-400' : status === 'current' ? 'text-purple-300' : 'text-cream-300'
                }`}>
                  {week}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-cream-500/40">{showCount} shows</span>
                  {regCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400">
                      {regCount}
                    </span>
                  )}
                </div>
                {status === 'current' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          BOTTOM SPLIT: Show List + Show Detail
          ============================================================ */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT: Show List */}
        <div className={`flex flex-col min-h-0 border-r border-cream-500/10 bg-charcoal-950/30 ${
          selectedShow ? 'hidden lg:flex lg:w-96' : 'w-full lg:w-96'
        }`}>
          {/* Week Status Bar */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-cream-500/10 bg-charcoal-900/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  weekStatus === 'current' ? 'bg-purple-500/20 text-purple-400' :
                  weekStatus === 'past' ? 'bg-charcoal-700 text-cream-500/40' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {weekStatus === 'current' ? 'Active' : weekStatus === 'past' ? 'Completed' : 'Upcoming'}
                </span>
                <span className="text-sm font-display text-cream-300">
                  Week {selectedWeek}
                </span>
              </div>
              <span className="text-xs text-cream-500/60">
                {selectedWeekShows.length} Shows
              </span>
            </div>
          </div>

          {/* Show List */}
          <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-3 space-y-2">
            {selectedWeekShows.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-cream-500/20 mx-auto mb-3" />
                <p className="text-sm text-cream-500/60">No shows scheduled for this week</p>
              </div>
            ) : (
              selectedWeekShows.map((show, idx) => {
                const myCorps = getMyCorpsAtShow(show);
                const isSelected = selectedShow?.eventName === show.eventName && selectedShow?.day === show.day;

                return (
                  <button
                    key={`${show.eventName}-${show.day}-${idx}`}
                    onClick={() => setSelectedShow(show)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'bg-gold-500/20 border-gold-500/50 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                        : myCorps.length > 0
                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                        : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30 hover:bg-charcoal-900/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-gold-500/30' : myCorps.length > 0 ? 'bg-green-500/20' : 'bg-charcoal-800'
                      }`}>
                        <MapPin className={`w-5 h-5 ${
                          isSelected ? 'text-gold-400' : myCorps.length > 0 ? 'text-green-400' : 'text-cream-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-display font-bold text-sm truncate ${
                          isSelected ? 'text-gold-400' : 'text-cream-100'
                        }`}>
                          {show.eventName}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-cream-500/60 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDateCompact(show.day)}</span>
                        </div>
                        {myCorps.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {myCorps.map(c => (
                              <span
                                key={c.corpsClass}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getClassColor(c.corpsClass)}`}
                              >
                                {c.corpsName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? 'text-gold-400' : 'text-cream-500/40'
                      }`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Show Detail */}
        <div className={`flex-1 flex flex-col min-h-0 ${!selectedShow ? 'hidden lg:flex' : 'flex'}`}>
          {selectedShow ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Back Button */}
              <div className="lg:hidden flex-shrink-0 p-3 border-b border-cream-500/10 bg-charcoal-950/50">
                <button
                  onClick={() => setSelectedShow(null)}
                  className="flex items-center gap-2 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span className="text-sm font-display">Back to Shows</span>
                </button>
              </div>

              {/* Show Detail Content */}
              <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 lg:p-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Show Header */}
                  <div className="bg-gradient-to-br from-charcoal-900/80 to-charcoal-900/40 border-2 border-cream-500/10 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-8 h-8 text-gold-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                          {selectedShow.eventName}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-cream-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-gold-400" />
                            {formatDateFull(selectedShow.day)}
                          </span>
                          {selectedShow.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-purple-400" />
                              {selectedShow.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* My Corps at Show */}
                  {getMyCorpsAtShow(selectedShow).length > 0 && (
                    <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Check className="w-5 h-5 text-green-400" />
                        <h3 className="font-display font-bold text-green-400 uppercase text-sm tracking-wide">
                          Your Corps Attending
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {getMyCorpsAtShow(selectedShow).map(c => (
                          <div
                            key={c.corpsClass}
                            className="flex items-center gap-3 p-3 bg-charcoal-900/50 rounded-lg"
                          >
                            <Music className="w-5 h-5 text-green-400" />
                            <div>
                              <p className="font-display font-bold text-cream-100">{c.corpsName}</p>
                              <p className="text-xs text-cream-500/60 capitalize">{c.corpsClass.replace(/([A-Z])/g, ' $1').trim()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-gold-400" />
                        <span className="text-xs text-cream-500/60 uppercase tracking-wide">Competition</span>
                      </div>
                      <p className="text-lg font-mono font-bold text-cream-100">
                        {selectedShow.type || 'Standard'}
                      </p>
                    </div>
                    <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-cream-500/60 uppercase tracking-wide">Classes</span>
                      </div>
                      <p className="text-lg font-mono font-bold text-cream-100">
                        {selectedShow.classes?.join(', ') || 'All Classes'}
                      </p>
                    </div>
                  </div>

                  {/* Tip Box */}
                  <div className="flex items-start gap-3 p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl">
                    <Info className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-cream-300">
                      <p className="font-semibold text-gold-400 mb-1">Pro Tip</p>
                      <p className="text-cream-400">Each corps can attend up to 4 shows per week. Choose strategically to maximize your season score!</p>
                    </div>
                  </div>

                  {/* Register Button */}
                  <button
                    onClick={() => handleRegisterCorps(selectedShow)}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-charcoal-900 font-display font-bold uppercase tracking-wide hover:from-gold-400 hover:to-amber-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)]"
                  >
                    Register Corps for Show
                  </button>
                </motion.div>
              </div>
            </div>
          ) : (
            /* Empty State - No Show Selected */
            <div className="flex-1 flex items-center justify-center bg-charcoal-950/30">
              <div className="text-center px-6">
                <div className="w-20 h-20 rounded-2xl bg-charcoal-900/50 border border-cream-500/10 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-cream-500/20" />
                </div>
                <h3 className="text-lg font-display font-bold text-cream-300 mb-2">Select a Show</h3>
                <p className="text-sm text-cream-500/60 max-w-xs mx-auto">
                  Choose a show from the list to view details and register your corps.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Tip Bar - Fixed at bottom */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-cream-500/10 bg-charcoal-950/50">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3 h-3 text-gold-400" />
          </div>
          <p className="text-xs text-cream-500/60">
            Each corps can attend up to <span className="text-gold-400 font-medium">4 shows</span> per week. Select shows to register.
          </p>
        </div>
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
