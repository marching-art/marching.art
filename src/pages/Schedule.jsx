// src/pages/Schedule.jsx
// Brutalist Architecture - Schedule Page
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';
import { useSeasonStore } from '../store/seasonStore';
import { BrutalistCard, BrutalistHeader, BrutalistTip } from '../components/ui';

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
        <BrutalistCard variant="danger" padding="lg" className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
          <BrutalistHeader size="default">No Active Season</BrutalistHeader>
          <p className="text-text-muted mt-2">
            There is currently no active season. Please check back later.
          </p>
        </BrutalistCard>
      </div>
    );
  }

  const allShows = getAllShows();
  const selectedWeekShows = allShows.filter(show => show.week === selectedWeek);
  const weekStatus = getWeekStatus(selectedWeek);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Page Header */}
      <SchedulePageHeader
        totalShows={allShows.length}
        currentWeek={currentWeek}
      />

      {/* Week Tabs */}
      <WeekTabs
        selectedWeek={selectedWeek}
        currentWeek={currentWeek}
        onSelectWeek={setSelectedWeek}
        allShows={allShows}
        getWeekRegistrationCount={getWeekRegistrationCount}
      />

      {/* Selected Week Header */}
      <SelectedWeekHeader
        selectedWeek={selectedWeek}
        weekStatus={weekStatus}
        onPrevWeek={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
        onNextWeek={() => setSelectedWeek(Math.min(7, selectedWeek + 1))}
      />

      {/* Shows Grid */}
      <ShowsGrid
        shows={selectedWeekShows}
        selectedWeek={selectedWeek}
        getActualDate={getActualDate}
        formatDateCompact={formatDateCompact}
        getMyCorpsAtShow={getMyCorpsAtShow}
        onRegisterCorps={handleRegisterCorps}
      />

      {/* Quick Tip */}
      <div className="flex-shrink-0 mt-3">
        <BrutalistTip icon={Info} variant="info">
          Each corps can attend up to 4 shows per week. Tap a show to register your corps.
        </BrutalistTip>
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
