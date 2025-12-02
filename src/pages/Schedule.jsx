// src/pages/Schedule.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, MapPin, ChevronRight, Check, Clock,
  Trophy, Users, AlertCircle, Music, ExternalLink,
  Plus, X, Info
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
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);

  // Calculate actual calendar date from season start date and day number
  // Day 1 starts the day after the season start date
  const getActualDate = (dayNumber) => {
    if (!seasonData?.schedule?.startDate) return null;
    const startDate = seasonData.schedule.startDate.toDate();
    const actualDate = new Date(startDate);
    actualDate.setDate(startDate.getDate() + dayNumber);
    return actualDate;
  };

  // Format date for display
  const formatDate = (dayNumber) => {
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

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">
          Season Schedule
        </h1>
        <p className="text-cream-300">
          {seasonData?.name || 'Current Season'} - Complete show schedule and registration
        </p>
      </motion.div>

      {/* Season Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-dark rounded-xl p-6 border border-cream-500/10"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-gold-500" />
            <div>
              <p className="text-sm text-cream-500/60">Current Week</p>
              <p className="text-xl font-bold text-cream-100">Week {currentWeek}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-blue-500" />
            <div>
              <p className="text-sm text-cream-500/60">Total Shows</p>
              <p className="text-xl font-bold text-cream-100">{allShows.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-purple-500" />
            <div>
              <p className="text-sm text-cream-500/60">Season Length</p>
              <p className="text-xl font-bold text-cream-100">7 Weeks</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info Banner */}
      <div className="card bg-blue-500/10 border-2 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-cream-300">
            <p className="font-semibold text-blue-400 mb-2">How to Register:</p>
            <ul className="space-y-1 text-cream-400">
              <li>• Click "Register Corps" on any show to select which of your corps will attend</li>
              <li>• Each corps can attend up to 4 shows per week</li>
              <li>• You cannot register for shows in past weeks</li>
              <li>• Past shows display results - click "View Scores" to see them</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Shows by Week */}
      {[1, 2, 3, 4, 5, 6, 7].map(weekNumber => {
        const weekShows = allShows.filter(show => show.week === weekNumber);
        const status = getWeekStatus(weekNumber);

        if (weekShows.length === 0) return null;

        return (
          <div key={weekNumber} className="space-y-4">
            {/* Week Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-display font-bold text-cream-100">
                  Week {weekNumber}
                </h2>
                {status === 'current' && (
                  <span className="px-3 py-1 bg-gradient-gold text-charcoal-900 rounded-full text-xs font-semibold">
                    Current Week
                  </span>
                )}
                {status === 'past' && (
                  <span className="px-3 py-1 bg-charcoal-700 text-cream-500/60 rounded-full text-xs font-semibold">
                    Completed
                  </span>
                )}
              </div>
              <span className="text-sm text-cream-500/60">
                {weekShows.length} show{weekShows.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Show Cards */}
            <div className="grid grid-cols-1 gap-3">
              {weekShows.map((show, index) => {
                const myCorps = getMyCorpsAtShow(show);
                // Check if show date has passed (compare with today)
                const showDate = getActualDate(show.day);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = showDate && showDate < today;

                return (
                  <motion.div
                    key={`${show.eventName}-${show.day}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`card ${isPast ? 'opacity-75' : ''}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Show Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${
                            isPast ? 'bg-charcoal-700' : 'bg-gold-500/20'
                          }`}>
                            <Music className={`w-5 h-5 ${
                              isPast ? 'text-cream-500/60' : 'text-gold-500'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-cream-100 mb-1">
                              {show.eventName || show.name}
                            </h3>
                            <div className="flex flex-wrap gap-3 text-sm text-cream-500/80">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{formatDate(show.day)}</span>
                              </div>
                              {show.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{show.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* My Corps Attending */}
                        {myCorps.length > 0 && (
                          <div className="ml-11 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <p className="text-xs font-semibold text-green-400 mb-2">
                              <Check className="w-3 h-3 inline mr-1" />
                              Your Corps Registered:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {myCorps.map((corps, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium"
                                >
                                  {corps.corpsName} ({corps.corpsClass === 'worldClass' ? 'World' :
                                   corps.corpsClass === 'openClass' ? 'Open' :
                                   corps.corpsClass === 'aClass' ? 'A' : 'SoundSport'})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 min-w-[160px]">
                        {isPast ? (
                          <Link
                            to="/scores"
                            className="btn-outline flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Scores
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleRegisterCorps(show)}
                            className="btn-primary flex items-center justify-center gap-2"
                            disabled={isPast}
                          >
                            <Plus className="w-4 h-4" />
                            Register Corps
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Registration Modal */}
      <AnimatePresence>
        {registrationModal && selectedShow && (
          <ShowRegistrationModal
            show={selectedShow}
            userProfile={userProfile}
            formattedDate={formatDate(selectedShow.day)}
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
