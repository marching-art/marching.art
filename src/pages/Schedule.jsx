// src/pages/Schedule.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, MapPin, ChevronRight, Check,
  AlertCircle, Music, ExternalLink,
  Plus, X, Info, ChevronLeft
} from 'lucide-react';
import { useAuth } from '../App';
import { db, functions } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';
import Portal from '../components/Portal';

const Schedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [seasonData, setSeasonData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);
  const weekTabsRef = useRef(null);

  // Calculate actual calendar date from season start date and day number
  // Day 1 starts the day after the season start date
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

  useEffect(() => {
    if (user) {
      loadScheduleData();
      loadUserProfile();
    }
  }, [user]);

  // Set selectedWeek to currentWeek once data loads
  useEffect(() => {
    if (currentWeek) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      const seasonRef = doc(db, 'game-settings/season');
      const seasonSnap = await getDoc(seasonRef);

      if (seasonSnap.exists()) {
        const data = seasonSnap.data();
        setSeasonData(data);

        // Calculate current week based on season start date
        if (data.schedule?.startDate) {
          const startDate = data.schedule.startDate.toDate();
          const now = new Date();
          const diffInMillis = now.getTime() - startDate.getTime();
          const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
          const calculatedWeek = Math.max(1, Math.min(7, Math.ceil((diffInDays + 1) / 7)));
          setCurrentWeek(calculatedWeek);
        }
      } else {
        toast.error('No active season found');
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (!seasonData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-display font-bold text-cream-100">No Active Season</h2>
        <p className="text-cream-500/80 text-center max-w-md">
          There is currently no active season. Please check back later.
        </p>
      </div>
    );
  }

  const allShows = getAllShows();
  const selectedWeekShows = allShows.filter(show => show.week === selectedWeek);
  const weekStatus = getWeekStatus(selectedWeek);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 mb-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gradient">
            Season Schedule
          </h1>
          <div className="flex items-center gap-4 text-sm text-cream-400">
            <span className="flex items-center gap-1">
              <Music className="w-4 h-4 text-blue-400" />
              {allShows.length} shows
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gold-500" />
              Week {currentWeek} of 7
            </span>
          </div>
        </div>
      </motion.div>

      {/* Week Tabs - Sticky Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 mb-4"
      >
        <div
          ref={weekTabsRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {[1, 2, 3, 4, 5, 6, 7].map(weekNum => {
            const status = getWeekStatus(weekNum);
            const weekShows = allShows.filter(s => s.week === weekNum);
            const registrations = getWeekRegistrationCount(weekNum);
            const isSelected = selectedWeek === weekNum;

            return (
              <button
                key={weekNum}
                onClick={() => setSelectedWeek(weekNum)}
                className={`flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all min-w-[100px] ${
                  isSelected
                    ? 'border-gold-500 bg-gold-500/20 text-gold-400'
                    : status === 'past'
                    ? 'border-cream-500/10 bg-charcoal-800/50 text-cream-500/60 hover:border-cream-500/30'
                    : status === 'current'
                    ? 'border-gold-500/30 bg-gold-500/10 text-cream-200 hover:border-gold-500/50'
                    : 'border-cream-500/10 bg-charcoal-800/50 text-cream-300 hover:border-cream-500/30'
                }`}
              >
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wide mb-1 opacity-70">
                    {status === 'current' ? 'Now' : status === 'past' ? 'Done' : `Wk ${weekNum}`}
                  </div>
                  <div className="font-bold text-lg">
                    {weekNum}
                  </div>
                  <div className="text-xs mt-1 opacity-70">
                    {weekShows.length} shows
                  </div>
                  {registrations > 0 && (
                    <div className="mt-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-green-500/30 text-green-400">
                        {registrations}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Selected Week Header */}
      <motion.div
        key={`header-${selectedWeek}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-shrink-0 flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display font-bold text-cream-100">
            Week {selectedWeek}
          </h2>
          {weekStatus === 'current' && (
            <span className="px-2 py-0.5 bg-gradient-gold text-charcoal-900 rounded-full text-xs font-semibold">
              Current
            </span>
          )}
          {weekStatus === 'past' && (
            <span className="px-2 py-0.5 bg-charcoal-700 text-cream-500/60 rounded-full text-xs font-semibold">
              Completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
            disabled={selectedWeek === 1}
            className="p-1.5 rounded-lg bg-charcoal-800 text-cream-400 hover:bg-charcoal-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedWeek(Math.min(7, selectedWeek + 1))}
            disabled={selectedWeek === 7}
            className="p-1.5 rounded-lg bg-charcoal-800 text-cream-400 hover:bg-charcoal-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Shows Grid - Scrollable Area */}
      <motion.div
        key={`shows-${selectedWeek}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto min-h-0"
      >
        {selectedWeekShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="w-12 h-12 text-cream-500/30 mb-3" />
            <p className="text-cream-400">No shows scheduled for Week {selectedWeek}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
            {selectedWeekShows.map((show, index) => {
              const myCorps = getMyCorpsAtShow(show);
              const showDate = getActualDate(show.day);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isPast = showDate && showDate < today;

              return (
                <motion.div
                  key={`${show.eventName}-${show.day}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`glass-dark rounded-xl p-4 border border-cream-500/10 ${
                    isPast ? 'opacity-70' : ''
                  } ${myCorps.length > 0 ? 'ring-1 ring-green-500/30' : ''}`}
                >
                  {/* Show Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-cream-100 truncate text-sm">
                        {show.eventName || show.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-cream-500/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateCompact(show.day)}
                        </span>
                      </div>
                      {show.location && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-cream-500/60 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{show.location}</span>
                        </div>
                      )}
                    </div>
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                      isPast ? 'bg-charcoal-700' : 'bg-gold-500/20'
                    }`}>
                      <Music className={`w-4 h-4 ${
                        isPast ? 'text-cream-500/60' : 'text-gold-500'
                      }`} />
                    </div>
                  </div>

                  {/* Registered Corps */}
                  {myCorps.length > 0 && (
                    <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
                        <Check className="w-3 h-3" />
                        <span className="font-medium">Registered</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {myCorps.map((corps, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs"
                          >
                            {corps.corpsName.length > 12
                              ? corps.corpsName.substring(0, 12) + '...'
                              : corps.corpsName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {isPast ? (
                    <Link
                      to="/scores"
                      className="btn-outline w-full text-sm py-2 flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Scores
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleRegisterCorps(show)}
                      className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {myCorps.length > 0 ? 'Edit Registration' : 'Register Corps'}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Quick Tip - Collapsible Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-shrink-0 mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"
      >
        <div className="flex items-center gap-2 text-xs text-cream-400">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>
            Each corps can attend up to 4 shows per week. Tap a show to register your corps.
          </span>
        </div>
      </motion.div>

      {/* Registration Modal */}
      <AnimatePresence>
        {registrationModal && selectedShow && (
          <ShowRegistrationModal
            show={selectedShow}
            userProfile={userProfile}
            formattedDate={formatDateCompact(selectedShow.day)}
            onClose={() => {
              setRegistrationModal(false);
              setSelectedShow(null);
            }}
            onSuccess={() => {
              loadUserProfile();
              setRegistrationModal(false);
              setSelectedShow(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Show Registration Modal Component
const ShowRegistrationModal = ({ show, userProfile, formattedDate, onClose, onSuccess }) => {
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [saving, setSaving] = useState(false);

  // Sort corps classes in hierarchy order: World, Open, A, SoundSport
  const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
  const userCorpsClasses = userProfile?.corps
    ? Object.keys(userProfile.corps).sort((a, b) => (classOrder[a] ?? 99) - (classOrder[b] ?? 99))
    : [];

  // Check which corps are already registered
  useEffect(() => {
    const alreadyRegistered = [];
    userCorpsClasses.forEach(corpsClass => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];

      const isRegistered = selectedShows.some(
        s => s.eventName === show.eventName && s.date === show.date
      );

      if (isRegistered) {
        alreadyRegistered.push(corpsClass);
      }
    });
    setSelectedCorps(alreadyRegistered);
  }, []);

  const toggleCorps = (corpsClass) => {
    if (selectedCorps.includes(corpsClass)) {
      setSelectedCorps(selectedCorps.filter(c => c !== corpsClass));
    } else {
      // Check if this corps already has 4 shows this week
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];

      if (currentShows.length >= 4 && !selectedCorps.includes(corpsClass)) {
        toast.error(`This corps already has 4 shows registered for week ${show.week}`);
        return;
      }

      setSelectedCorps([...selectedCorps, corpsClass]);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const selectUserShows = httpsCallable(functions, 'selectUserShows');

      // For each corps class, update their show selection
      for (const corpsClass of userCorpsClasses) {
        const corpsData = userProfile.corps[corpsClass];
        const weekKey = `week${show.week}`;
        const currentShows = corpsData.selectedShows?.[weekKey] || [];

        // Remove this show from the list if it exists
        const filteredShows = currentShows.filter(
          s => !(s.eventName === show.eventName && s.date === show.date)
        );

        // Add it back if selected
        const newShows = selectedCorps.includes(corpsClass)
          ? [...filteredShows, {
              eventName: show.eventName,
              date: show.date,
              location: show.location,
              day: show.day
            }]
          : filteredShows;

        await selectUserShows({
          week: show.week,
          shows: newShows,
          corpsClass
        });
      }

      toast.success('Registration updated successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error updating registration:', error);
      toast.error(error.message || 'Failed to update registration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-dark rounded-2xl p-8 max-w-2xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <h2 className="text-2xl font-display font-bold text-gradient mb-2">
            Register Corps for Show
          </h2>
        <p className="text-cream-400 mb-6">
          {show.eventName}
        </p>

        {/* Show Details */}
        <div className="card bg-charcoal-900/50 mb-6">
          <div className="flex flex-wrap gap-3 text-sm text-cream-300">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gold-500" />
              <span>{formattedDate}</span>
            </div>
            {show.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span>{show.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Corps Selection */}
        {userCorpsClasses.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
            <p className="text-cream-300">You don't have any corps yet.</p>
            <p className="text-cream-500/60 text-sm mt-2">Register a corps from the Dashboard first.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-cream-100 mb-3">
              Select which of your corps will attend:
            </h3>
            {userCorpsClasses.map(corpsClass => {
              const corpsData = userProfile.corps[corpsClass];
              const isSelected = selectedCorps.includes(corpsClass);
              const weekKey = `week${show.week}`;
              const currentShows = corpsData.selectedShows?.[weekKey] || [];

              return (
                <div
                  key={corpsClass}
                  onClick={() => toggleCorps(corpsClass)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-cream-100">
                        {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                      </p>
                      <p className="text-sm text-cream-500/80">
                        {corpsClass === 'worldClass' ? 'World Class' :
                         corpsClass === 'openClass' ? 'Open Class' :
                         corpsClass === 'aClass' ? 'A Class' : 'SoundSport'}
                        {' • '}
                        {currentShows.length}/4 shows this week
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500'
                        : 'border-cream-500/30'
                    }`}>
                      {isSelected && <Check className="w-4 h-4 text-charcoal-900" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-ghost flex-1"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={saving || userCorpsClasses.length === 0}
            >
              {saving ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Save Registration
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default Schedule;
