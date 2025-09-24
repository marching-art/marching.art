// src/pages/DashboardPage.js - UPDATED: With Uniform Builder moved to main dashboard
import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SoundSportDisplay } from '../utils/soundSportSystem';
import { 
  getAllUserCorps, 
  hasJoinedSeason, 
  CORPS_CLASSES,
  canCreateCorps,
  calculateWeeksRemaining,
  getRegistrationDeadline,
  hasAnyCorps
} from '../utils/profileCompatibility';
import LoadingScreen from '../components/ui/LoadingScreen';
import SeasonSignup from '../components/dashboard/SeasonSignup';
import LeagueManager from '../components/dashboard/LeagueManager';
import MyStatus from '../components/dashboard/MyStatus';
import CorpsSelector from '../components/dashboard/CorpsSelector';
import UniformManager from '../components/profile/UniformManager';
import Icon from '../components/ui/Icon';

// SoundSport Performance Card
const SoundSportPerformanceCard = ({ performance, onViewDetails }) => {
  const displayData = SoundSportDisplay.formatRating(performance.score);
  
  return (
    <div
      className={`p-4 rounded-lg border ${displayData.colorClass} cursor-pointer transition-all hover:shadow-lg`}
      onClick={() => onViewDetails && onViewDetails(performance)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{displayData.icon}</div>
          <div>
            <h4 className="font-bold text-lg">{displayData.primaryDisplay}</h4>
            <p className="text-sm opacity-75">{displayData.secondaryDisplay}</p>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {new Date(performance.date).toLocaleDateString()}
        </div>
      </div>
      
      <p className="text-sm mb-3">{performance.feedback}</p>
      
      <div className="text-xs opacity-75">
        {performance.competition} • {performance.venue}
      </div>
      
      <div className="mt-2 text-xs italic opacity-60">
        Ratings based on DCI SoundSport Challenge Class criteria
      </div>
    </div>
  );
};

// Registration deadline component
const RegistrationDeadlineBar = ({ profile, seasonSettings }) => {
  const { weekNumber, weeksRemaining } = calculateWeeksRemaining(seasonSettings);
  const registrationDeadline = getRegistrationDeadline(seasonSettings);
  const isRegistrationOpen = canCreateCorps(seasonSettings, weekNumber);
  const hasJoined = hasJoinedSeason(profile, seasonSettings?.seasonUid);
  
  if (!registrationDeadline || hasJoined) return null;

  return (
    <div className={`p-4 rounded-theme border-2 border-dashed mb-6 ${
      isRegistrationOpen 
        ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700' 
        : 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {isRegistrationOpen ? '⏰' : '🚫'}
          </div>
          <div>
            <h3 className={`font-bold ${
              isRegistrationOpen ? 'text-yellow-800 dark:text-yellow-200' : 'text-red-800 dark:text-red-200'
            }`}>
              {isRegistrationOpen ? 'Registration Still Open' : 'Registration Closed'}
            </h3>
            <p className={`text-sm ${
              isRegistrationOpen ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {isRegistrationOpen 
                ? `Deadline: ${registrationDeadline} (${weeksRemaining} weeks remaining)`
                : `Registration closed on ${registrationDeadline}`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Uniform Builder Dashboard Section
const UniformBuilderSection = ({ profile, onOpenUniformManager }) => {
  const userCorps = getAllUserCorps(profile);
  const corpsWithData = Object.entries(userCorps).filter(([_, corps]) => corps && corps.corpsName);
  
  if (corpsWithData.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-theme border border-purple-200 dark:border-purple-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark flex items-center gap-3">
            <div className="text-3xl">🎨</div>
            Uniform Designer
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
            Create legendary uniform designs for your corps
          </p>
        </div>
      </div>

      {/* Corps Grid for Uniform Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {corpsWithData.map(([corpsClass, corps]) => {
          const classConfig = CORPS_CLASSES[corpsClass];
          const uniformCount = corps.uniforms ? Object.keys(corps.uniforms).length : 0;
          
          return (
            <div
              key={corpsClass}
              className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-4 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => onOpenUniformManager(corpsClass)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-full ${classConfig?.color || 'bg-gray-400'} opacity-80`}></div>
                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  {uniformCount}/4 uniforms
                </span>
              </div>
              
              <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-1">
                {corps.corpsName}
              </h3>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3">
                {classConfig?.name || 'Unknown Class'}
              </p>
              
              <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-2 px-4 rounded-theme transition-all text-sm">
                <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" className="w-4 h-4 inline mr-2" />
                Design Uniforms
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 bg-purple-100 dark:bg-purple-900/30 rounded-theme">
        <p className="text-sm text-purple-800 dark:text-purple-200">
          <strong>🆕 New Feature:</strong> Create up to 4 unique uniform designs per corps with comprehensive DCI-inspired options including legendary presets from Blue Devils, Santa Clara Vanguard, and more!
        </p>
      </div>
    </div>
  );
};

const DashboardPage = ({ profile, userId }) => {
  const [seasonSettings, setSeasonSettings] = useState(null);
  const [seasonEvents, setSeasonEvents] = useState([]);
  const [corpsData, setCorpsData] = useState({});
  const [soundSportPerformances, setSoundSportPerformances] = useState([]);
  const [isLoadingSeason, setIsLoadingSeason] = useState(true);
  const [showUniformManager, setShowUniformManager] = useState(false);
  const [uniformManagerCorpsClass, setUniformManagerCorpsClass] = useState(null);

  // Real-time season data
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'game-settings', 'season'), (doc) => {
      if (doc.exists()) {
        setSeasonSettings(doc.data());
      }
      setIsLoadingSeason(false);
    });

    return () => unsubscribe();
  }, []);

  // Load season events
  useEffect(() => {
    const fetchSeasonEvents = async () => {
      try {
        const eventsDoc = await getDoc(doc(db, 'game-settings', 'season-events'));
        if (eventsDoc.exists()) {
          setSeasonEvents(eventsDoc.data().events || []);
        }
      } catch (error) {
        console.error("Error fetching season events:", error);
      }
    };

    fetchSeasonEvents();
  }, []);

  // Load user's corps data
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(doc(db, 'fantasy-rosters', userId), (doc) => {
      if (doc.exists()) {
        setCorpsData(doc.data());
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Load SoundSport performances
  useEffect(() => {
    if (!userId) return;

    const fetchPerformances = async () => {
      try {
        const performanceDoc = await getDoc(doc(db, 'soundsport-performances', userId));
        if (performanceDoc.exists()) {
          const data = performanceDoc.data();
          setSoundSportPerformances(data.performances || []);
        }
      } catch (error) {
        console.error("Error fetching SoundSport performances:", error);
      }
    };

    fetchPerformances();
  }, [userId]);

  const handleOpenUniformManager = (corpsClass) => {
    setUniformManagerCorpsClass(corpsClass);
    setShowUniformManager(true);
  };

  const currentOffSeasonDay = useMemo(() => {
    if (!seasonSettings?.startDate) return 1;
    const start = seasonSettings.startDate.toDate();
    const now = new Date();
    const daysDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, daysDiff + 1);
  }, [seasonSettings]);

  // Debug season recognition
  console.log('Dashboard Debug:', {
    profileActiveSeasonId: profile?.activeSeasonId,
    seasonSettingsUid: seasonSettings?.seasonUid,
    seasonSettingsExists: !!seasonSettings,
    profileExists: !!profile,
    hasJoinedResult: seasonSettings ? hasJoinedSeason(profile, seasonSettings.seasonUid) : 'no seasonSettings'
  });

  if (isLoadingSeason) {
    return <LoadingScreen />;
  }

  if (!seasonSettings) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Season Configuration Error</h2>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Unable to load season settings. Please contact support.
        </p>
      </div>
    );
  }

  const hasJoined = hasJoinedSeason(profile, seasonSettings.seasonUid);
  const hasCorps = hasAnyCorps(profile);

  // Show season signup if user hasn't joined current season
  if (!hasJoined) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <SeasonSignup profile={profile} seasonSettings={seasonSettings} userId={userId} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Uniform Manager Modal */}
      {showUniformManager && (
        <UniformManager
          userId={userId}
          corpsClass={uniformManagerCorpsClass}
          corpsData={getAllUserCorps(profile)[uniformManagerCorpsClass]}
          onClose={() => {
            setShowUniformManager(false);
            setUniformManagerCorpsClass(null);
          }}
        />
      )}

      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Director Dashboard
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
          Manage your drum corps empire
        </p>
      </div>

      {/* Registration Deadline Warning */}
      <RegistrationDeadlineBar profile={profile} seasonSettings={seasonSettings} />

      {/* Status Overview */}
      <MyStatus 
        profile={profile} 
        seasonSettings={seasonSettings}
        seasonEvents={seasonEvents}
        currentOffSeasonDay={currentOffSeasonDay}
      />

      {/* Uniform Builder Section - MOVED HERE */}
      {hasCorps && (
        <UniformBuilderSection 
          profile={profile}
          onOpenUniformManager={handleOpenUniformManager}
        />
      )}

      {/* Corps Management */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Corps Management
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Create and manage your drum corps lineups
            </p>
          </div>
        </div>

        <CorpsSelector
          profile={profile}
          corpsData={corpsData}
          seasonSettings={seasonSettings}
          seasonEvents={seasonEvents}
          currentOffSeasonDay={currentOffSeasonDay}
          seasonStartDate={seasonSettings?.startDate?.toDate()}
        />
      </div>

      {/* League Management */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              League Management
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Join or create competitive leagues
            </p>
          </div>
        </div>

        <LeagueManager profile={profile} />
      </div>

      {/* SoundSport Performances */}
      {soundSportPerformances.length > 0 && (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                🎵 SoundSport Performances
              </h2>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                Your recent SoundSport Challenge performances
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {soundSportPerformances.slice(0, 6).map((performance, index) => (
              <SoundSportPerformanceCard 
                key={index} 
                performance={performance}
                onViewDetails={(perf) => console.log('View details:', perf)}
              />
            ))}
          </div>

          {soundSportPerformances.length > 6 && (
            <div className="text-center mt-4">
              <button className="bg-primary hover:bg-primary-hover text-on-primary font-medium py-2 px-4 rounded-theme transition-colors">
                View All Performances ({soundSportPerformances.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;