// src/pages/Schedule.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, MapPin, ChevronRight, Check, Clock,
  Trophy, Star, Users, AlertCircle, Lock, Music
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import ShowSelectionModal from '../components/ShowSelection/ShowSelectionModal';
import toast from 'react-hot-toast';

const Schedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [seasonData, setSeasonData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);

  // Get all user's corps classes
  const userCorpsClasses = userProfile?.corps ? Object.keys(userProfile.corps) : [];

  // Set default corps class to first available
  useEffect(() => {
    if (userCorpsClasses.length > 0 && !selectedCorpsClass) {
      setSelectedCorpsClass(userCorpsClasses[0]);
    }
  }, [userCorpsClasses, selectedCorpsClass]);

  const activeCorps = selectedCorpsClass ? userProfile?.corps[selectedCorpsClass] : null;

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

  const getWeekData = (weekNumber) => {
    if (!seasonData?.events) return { shows: [], days: [] };

    const weekStart = (weekNumber - 1) * 7 + 1;
    const weekEnd = weekNumber * 7;

    const weekShows = [];
    const days = new Set();

    seasonData.events.forEach(dayEvent => {
      const day = dayEvent.offSeasonDay || dayEvent.day || 0;
      if (day >= weekStart && day <= weekEnd && dayEvent.shows) {
        days.add(day);
        dayEvent.shows.forEach(show => {
          weekShows.push({
            ...show,
            day: day,
            offSeasonDay: day
          });
        });
      }
    });

    return { shows: weekShows, days: Array.from(days).sort((a, b) => a - b) };
  };

  const getUserSelectedShows = (weekNumber) => {
    if (!activeCorps?.selectedShows) return [];
    return activeCorps.selectedShows[`week${weekNumber}`] || [];
  };

  const getWeekStatus = (weekNumber) => {
    if (weekNumber < currentWeek) return 'past';
    if (weekNumber === currentWeek) return 'current';
    return 'future';
  };

  const getWeekDates = (weekNumber) => {
    if (!seasonData?.schedule?.startDate) return 'TBD';

    const startDate = seasonData.schedule.startDate.toDate();
    const weekStartDay = (weekNumber - 1) * 7;
    const weekEndDay = weekStartDay + 6;

    const weekStartDate = new Date(startDate.getTime() + weekStartDay * 24 * 60 * 60 * 1000);
    const weekEndDate = new Date(startDate.getTime() + weekEndDay * 24 * 60 * 60 * 1000);

    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return `${formatDate(weekStartDate)} - ${formatDate(weekEndDate)}`;
  };

  const handleWeekClick = (weekNumber) => {
    const status = getWeekStatus(weekNumber);

    if (status === 'past') {
      toast.error('Cannot modify shows for past weeks');
      return;
    }

    if (!selectedCorpsClass) {
      toast.error('Please select a corps class first');
      return;
    }

    if (!activeCorps) {
      toast.error(`Please register a ${selectedCorpsClass} corps first`);
      return;
    }

    // Check if lineup is complete (all 8 captions selected)
    const lineup = activeCorps?.lineup;
    if (!lineup || Object.keys(lineup).length !== 8) {
      toast.error('Please select your 8 captions before choosing shows');
      return;
    }

    setSelectedWeek(weekNumber);
    setShowSelectionModal(true);
  };

  const handleShowSelectionSubmit = async (shows) => {
    await loadUserProfile(); // Refresh user profile to show updated selections
    setShowSelectionModal(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'past':
        return (
          <span className="px-3 py-1 bg-charcoal-700 text-cream-500/60 rounded-full text-xs font-semibold">
            Completed
          </span>
        );
      case 'current':
        return (
          <span className="px-3 py-1 bg-gradient-gold text-charcoal-900 rounded-full text-xs font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Active
          </span>
        );
      case 'future':
        return (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Upcoming
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  // Show error state if no season exists
  if (!seasonData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-display font-bold text-cream-100">No Active Season</h2>
        <p className="text-cream-500/80 text-center max-w-md">
          There is currently no active season. Please check back later or contact support if this issue persists.
        </p>
      </div>
    );
  }

  const weeks = [1, 2, 3, 4, 5, 6, 7];

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
          {seasonData?.name ? `${seasonData.name} - ` : ''}
          View and select shows for each week
        </p>
      </motion.div>

      {/* Corps Class Selector */}
      {userCorpsClasses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-cream-100 mb-1">Select Corps</h3>
              <p className="text-sm text-cream-500/60">Choose which corps to manage</p>
            </div>
            <select
              value={selectedCorpsClass || ''}
              onChange={(e) => setSelectedCorpsClass(e.target.value)}
              className="px-4 py-2 bg-charcoal-900 border border-cream-500/20 rounded-lg text-cream-100 focus:border-gold-500 focus:outline-none min-w-[200px]"
            >
              {userCorpsClasses.map((corpsClass) => (
                <option key={corpsClass} value={corpsClass}>
                  {corpsClass === 'worldClass' ? 'World Class' :
                   corpsClass === 'openClass' ? 'Open Class' :
                   corpsClass === 'aClass' ? 'A Class' :
                   corpsClass === 'soundSport' ? 'SoundSport' :
                   corpsClass}
                  {activeCorps && corpsClass === selectedCorpsClass ? ` - ${userProfile.corps[corpsClass]?.corpsName || 'Unnamed'}` : ''}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Season Info Banner */}
      {seasonData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-dark rounded-xl p-6 border border-cream-500/10"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Calendar className="w-8 h-8 text-gold-500" />
              <div>
                <h3 className="text-lg font-semibold text-cream-100">Current Week: Week {currentWeek}</h3>
                <p className="text-sm text-cream-500/60">
                  {getWeekDates(currentWeek)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge('current')}
            </div>
          </div>
        </motion.div>
      )}

      {/* Week Cards */}
      <div className="space-y-4">
        {weeks.map((weekNumber, index) => {
          const weekData = getWeekData(weekNumber);
          const selectedShows = getUserSelectedShows(weekNumber);
          const status = getWeekStatus(weekNumber);
          const isClickable = status !== 'past';

          return (
            <motion.div
              key={weekNumber}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => isClickable && handleWeekClick(weekNumber)}
              className={`card border-2 transition-all ${
                status === 'current'
                  ? 'border-gold-500/50 bg-gold-500/5'
                  : status === 'past'
                  ? 'border-charcoal-700 opacity-60 cursor-not-allowed'
                  : 'border-cream-500/10 hover:border-cream-500/30 cursor-pointer hover:shadow-glow'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Week Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-display font-bold text-cream-100">
                      Week {weekNumber}
                    </h3>
                    {getStatusBadge(status)}
                  </div>

                  <p className="text-cream-500/80 mb-4">
                    {getWeekDates(weekNumber)}
                  </p>

                  {/* Shows Info */}
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gold-500" />
                      <span className="text-sm text-cream-300">
                        <span className="font-semibold">{weekData.shows.length}</span> shows available
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-cream-300">
                        <span className="font-semibold">{weekData.days.length}</span> competition days
                      </span>
                    </div>
                    {selectedShows.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-semibold">
                          {selectedShows.length} show{selectedShows.length > 1 ? 's' : ''} selected
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Selected Shows Preview */}
                  {selectedShows.length > 0 ? (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-400 mb-2">Your Selected Shows:</p>
                      <div className="space-y-1">
                        {selectedShows.slice(0, 3).map((show, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-cream-300">
                            <Music className="w-3 h-3 text-gold-500" />
                            <span className="truncate">{show.eventName}</span>
                          </div>
                        ))}
                        {selectedShows.length > 3 && (
                          <p className="text-xs text-cream-500/60 ml-5">
                            +{selectedShows.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  ) : status !== 'past' && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-400">
                          {status === 'current'
                            ? 'Click to select shows for this week (up to 4 shows)'
                            : 'Shows can be selected when this week begins'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Championship Week Badge */}
                  {weekNumber === 7 && (
                    <div className="mt-3 flex items-center gap-2 text-gold-500">
                      <Trophy className="w-5 h-5" />
                      <span className="text-sm font-semibold">Championship Week - All Corps Compete</span>
                    </div>
                  )}
                </div>

                {/* Action Icon */}
                {isClickable && (
                  <ChevronRight className={`w-6 h-6 flex-shrink-0 transition-transform ${
                    status === 'current' ? 'text-gold-500' : 'text-cream-500/40'
                  } group-hover:translate-x-1`} />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="card bg-charcoal-800/50"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-cream-300 space-y-2">
            <p className="font-semibold text-cream-100">Schedule Information:</p>
            <ul className="list-disc list-inside space-y-1 text-cream-500/80">
              <li>The season runs for <strong className="text-cream-300">7 weeks</strong> (49 days)</li>
              <li>Select up to <strong className="text-cream-300">4 shows per week</strong> to compete in</li>
              <li>You can only modify selections for the <strong className="text-cream-300">current week</strong></li>
              <li>Week 7 is <strong className="text-gold-500">Championship Week</strong> - all corps automatically compete</li>
              <li>Shows are based on real DCI historical performances</li>
              <li>Your performance at each show contributes to your season score</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Show Selection Modal */}
      <AnimatePresence>
        {showSelectionModal && selectedWeek && selectedCorpsClass && (
          <ShowSelectionModal
            onClose={() => setShowSelectionModal(false)}
            onSubmit={handleShowSelectionSubmit}
            corpsClass={selectedCorpsClass}
            currentWeek={selectedWeek}
            seasonId={seasonData?.seasonUid}
            currentSelections={getUserSelectedShows(selectedWeek)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Schedule;
