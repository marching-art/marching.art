// src/pages/Schedule.jsx
// Command Console Layout: Top Week Rail + Bottom Split (Show List | Show Details)
import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Zap, Calendar, MapPin, Music, Users, Clock, ChevronRight, Trophy, Star, Check, Info } from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SystemLoader, ConsoleEmptyState } from '../components/ui/CommandConsole';
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
          TOP BAR: Week Selector (Fixed Height, Compact)
          ================================================================ */}
      <div className="shrink-0 border-b border-white/5 bg-black/30 backdrop-blur-md">
        {/* Header Bar - Compact */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold-400" />
            <h1 className="text-sm font-display font-bold text-cream uppercase tracking-wide">Tour Schedule</h1>
            <span className="text-[9px] text-data-muted">
              Wk <span className="text-data-gold">{currentWeek}</span> • <span className="text-data">{allShows.length}</span> shows
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-gold-500/20 border border-gold-500/30 text-[10px] font-bold text-data-gold">
              {getWeekRegistrationCount(selectedWeek)} Reg
            </span>
          </div>
        </div>

        {/* Week Tabs - Compact Horizontal Scroll */}
        <div className="flex gap-1 py-1.5 overflow-x-auto hud-scroll">
          {[1, 2, 3, 4, 5, 6, 7].map((week) => {
            const status = getWeekStatus(week);
            const regCount = getWeekRegistrationCount(week);
            const showCount = allShows.filter(s => s.week === week).length;
            const isSelected = selectedWeek === week;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`relative flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded transition-all ${
                  isSelected
                    ? 'bg-gold-500/20 border border-gold-500/50'
                    : status === 'current'
                    ? 'bg-purple-500/10 border border-purple-500/30 hover:border-purple-500/50'
                    : status === 'past'
                    ? 'bg-white/5 border border-white/5 opacity-50 hover:opacity-70'
                    : 'bg-white/5 border border-white/10 hover:border-white/20'
                }`}
              >
                <span className={`text-sm font-bold ${
                  isSelected ? 'text-data-gold' : status === 'current' ? 'text-data-purple' : 'text-data-muted'
                }`}>
                  {week}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-data-muted">{showCount}</span>
                  {regCount > 0 && (
                    <span className="px-1 py-0.5 rounded text-[8px] font-bold text-data-success bg-green-500/20">
                      {regCount}
                    </span>
                  )}
                </div>
                {status === 'current' && (
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          WORK SURFACE: Show List + Show Detail (Split View)
          ============================================================ */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Show List - High Density Table */}
        <div className={`flex flex-col overflow-hidden border-r border-white/5 bg-black/20 ${
          selectedShow ? 'hidden lg:flex lg:w-[400px]' : 'w-full lg:w-[400px]'
        }`}>
          {/* Week Status Bar - Compact */}
          <div className="shrink-0 px-2 py-1.5 border-b border-white/5 bg-black/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                weekStatus === 'current' ? 'bg-purple-500/20 text-data-purple' :
                weekStatus === 'past' ? 'bg-white/5 text-data-muted' :
                'bg-blue-500/20 text-data-blue'
              }`}>
                {weekStatus === 'current' ? 'Active' : weekStatus === 'past' ? 'Past' : 'Soon'}
              </span>
              <span className="text-xs text-data-muted">Week <span className="text-data">{selectedWeek}</span></span>
            </div>
            <span className="text-[9px] text-data-muted"><span className="text-data">{selectedWeekShows.length}</span> shows</span>
          </div>

          {/* Show Table - High Density with internal scroll */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedWeekShows.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <ConsoleEmptyState
                  variant="minimal"
                  title="NO SHOWS DETECTED"
                  subtitle={`Week ${selectedWeek} has no scheduled events.`}
                />
              </div>
            ) : (
              <>
                {/* Table Header - Sticky */}
                <div className="shrink-0 border-b border-white/10 bg-black/60">
                  <div className="grid grid-cols-[1fr_80px_60px] gap-2 px-2 py-1">
                    <span className="text-[9px] font-mono text-cream/40 uppercase">Event</span>
                    <span className="text-[9px] font-mono text-cream/40 uppercase text-center">Date</span>
                    <span className="text-[9px] font-mono text-cream/40 uppercase text-right">Action</span>
                  </div>
                </div>

                {/* Scrollable Show Rows */}
                <div className="flex-1 overflow-y-auto hud-scroll">
                  {selectedWeekShows.map((show, idx) => {
                    const myCorps = getMyCorpsAtShow(show);
                    const isSelected = selectedShow?.eventName === show.eventName && selectedShow?.day === show.day;

                    return (
                      <div
                        key={`${show.eventName}-${show.day}-${idx}`}
                        onClick={() => setSelectedShow(show)}
                        className={`
                          grid grid-cols-[1fr_80px_60px] gap-2 px-2 py-2 cursor-pointer
                          transition-colors duration-100 border-b border-white/5
                          ${idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}
                          ${isSelected ? 'bg-gold-500/15' : 'hover:bg-white/[0.08]'}
                        `}
                      >
                        {/* Event Name + Corps badges */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <MapPin className={`w-3 h-3 shrink-0 ${
                              myCorps.length > 0 ? 'text-green-400' : 'text-cream/40'
                            }`} />
                            <span className={`text-xs font-display font-bold truncate ${
                              isSelected ? 'text-gold-400' : 'text-cream'
                            }`}>
                              {show.eventName}
                            </span>
                          </div>
                          {myCorps.length > 0 && (
                            <div className="flex gap-1 mt-1 ml-4">
                              {myCorps.slice(0, 2).map(c => (
                                <span
                                  key={c.corpsClass}
                                  className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold ${getClassColor(c.corpsClass)}`}
                                >
                                  {c.corpsName.slice(0, 8)}
                                </span>
                              ))}
                              {myCorps.length > 2 && (
                                <span className="text-[8px] text-cream/40">+{myCorps.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Date - Monospace */}
                        <div className="flex items-center justify-center">
                          <span className="text-[10px] text-data-muted">{formatDateCompact(show.day)}</span>
                        </div>

                        {/* Action Button - Fixed Right */}
                        <div className="flex items-center justify-end">
                          {myCorps.length > 0 ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRegisterCorps(show); }}
                              className="px-2 py-1 text-[8px] font-mono font-bold uppercase bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 border border-gold-500/30 rounded"
                            >
                              Reg
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Show Detail - Compact */}
        <div className={`flex-1 flex flex-col overflow-hidden ${!selectedShow ? 'hidden lg:flex' : 'flex'}`}>
          {selectedShow ? (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Mobile Back Button - Compact */}
              <div className="lg:hidden shrink-0 px-2 py-1.5 border-b border-white/5 bg-black/30">
                <button
                  onClick={() => setSelectedShow(null)}
                  className="flex items-center gap-1.5 text-cream/60 hover:text-cream text-xs"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                  <span>Back</span>
                </button>
              </div>

              {/* Show Detail Content - Internal Scroll */}
              <div className="flex-1 overflow-y-auto hud-scroll p-3">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {/* Show Header - Compact */}
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-gold-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-display font-bold text-cream truncate">
                          {selectedShow.eventName}
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-cream/60 mt-1">
                          <span className="flex items-center gap-1 text-data-muted">
                            <Calendar className="w-3 h-3 text-gold-400" />
                            {formatDateFull(selectedShow.day)}
                          </span>
                          {selectedShow.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-purple-400" />
                              {selectedShow.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* My Corps at Show - Compact */}
                  {getMyCorpsAtShow(selectedShow).length > 0 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-[10px] font-mono font-bold text-green-400 uppercase">Attending</span>
                      </div>
                      <div className="space-y-1">
                        {getMyCorpsAtShow(selectedShow).map(c => (
                          <div key={c.corpsClass} className="flex items-center gap-2 px-2 py-1.5 bg-black/30 rounded">
                            <Music className="w-3 h-3 text-green-400" />
                            <span className="text-xs font-display font-bold text-cream">{c.corpsName}</span>
                            <span className="text-[9px] text-cream/40 capitalize ml-auto">{c.corpsClass.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show Info - Compact Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                      <span className="text-[9px] text-data-muted uppercase">Type</span>
                      <p className="text-sm font-bold text-data text-cream">{selectedShow.type || 'Standard'}</p>
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                      <span className="text-[9px] text-data-muted uppercase">Classes</span>
                      <p className="text-sm font-bold text-data text-cream">{selectedShow.classes?.join(', ') || 'All'}</p>
                    </div>
                  </div>

                  {/* Register Button */}
                  <button
                    onClick={() => handleRegisterCorps(selectedShow)}
                    className="w-full py-3 rounded-lg bg-gold-500 text-charcoal-900 font-display font-bold uppercase text-sm tracking-wide hover:bg-gold-400 transition-colors"
                  >
                    Register Corps
                  </button>

                  {/* Tip - Compact */}
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-gold-500/10 border border-gold-500/20 rounded text-[10px] text-cream/60">
                    <Info className="w-3 h-3 text-gold-400 shrink-0" />
                    <span>Max <span className="font-bold text-data-gold">4</span> shows/week per corps</span>
                  </div>
                </motion.div>
              </div>
            </div>
          ) : (
            /* Empty State - No Show Selected */
            <div className="h-full flex items-center justify-center bg-black/20">
              <div className="text-center p-4">
                <MapPin className="w-10 h-10 text-cream/20 mx-auto mb-2" />
                <h3 className="text-sm font-display font-bold text-cream/60 mb-1">Select a Show</h3>
                <p className="text-[10px] text-cream/40">Click a show to view details</p>
              </div>
            </div>
          )}
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
