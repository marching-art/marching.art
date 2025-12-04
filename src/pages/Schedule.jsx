// src/pages/Schedule.jsx
// Night Mode Stadium HUD - Schedule Page
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Info, Zap } from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';
import { useSeasonStore } from '../store/seasonStore';

// Import modular components
import {
  ShowRegistrationModal,
  WeekTabs,
  ShowsGrid,
  SchedulePageHeader,
  SelectedWeekHeader
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

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (!seasonData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black/40 backdrop-blur-md border border-red-500/20 rounded-2xl p-8 text-center max-w-md"
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
          <h2 className="text-2xl font-display font-bold text-yellow-50 uppercase tracking-wide">No Active Season</h2>
          <p className="text-yellow-50/50 mt-2">
            There is currently no active season. Please check back later.
          </p>
        </motion.div>
      </div>
    );
  }

  const allShows = getAllShows();
  const selectedWeekShows = allShows.filter(show => show.week === selectedWeek);
  const weekStatus = getWeekStatus(selectedWeek);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 lg:gap-4">
      {/* Page Header - Compact */}
      <div className="flex-shrink-0">
        <SchedulePageHeader
          totalShows={allShows.length}
          currentWeek={currentWeek}
        />
      </div>

      {/* Week Tabs - Compact */}
      <div className="flex-shrink-0">
        <WeekTabs
          selectedWeek={selectedWeek}
          currentWeek={currentWeek}
          onSelectWeek={setSelectedWeek}
          allShows={allShows}
          getWeekRegistrationCount={getWeekRegistrationCount}
        />
      </div>

      {/* Selected Week Header - Compact */}
      <div className="flex-shrink-0">
        <SelectedWeekHeader
          selectedWeek={selectedWeek}
          weekStatus={weekStatus}
          onPrevWeek={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
          onNextWeek={() => setSelectedWeek(Math.min(7, selectedWeek + 1))}
        />
      </div>

      {/* Shows Grid - Fills remaining space with internal scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto hud-scroll">
        <ShowsGrid
          shows={selectedWeekShows}
          selectedWeek={selectedWeek}
          getActualDate={getActualDate}
          formatDateCompact={formatDateCompact}
          getMyCorpsAtShow={getMyCorpsAtShow}
          onRegisterCorps={handleRegisterCorps}
        />
      </div>

      {/* Quick Tip - Stadium HUD - Fixed at bottom */}
      <div className="flex-shrink-0">
        <div className="bg-black/30 backdrop-blur-sm border border-yellow-500/10 rounded-xl px-3 lg:px-4 py-2 lg:py-3 flex items-center gap-3">
          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
          </div>
          <p className="text-xs lg:text-sm text-yellow-50/70">
            Each corps can attend up to <span className="text-yellow-400 font-medium">4 shows</span> per week. Tap a show to register.
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

export default Schedule;
