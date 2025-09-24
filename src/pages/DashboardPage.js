// src/pages/DashboardPage.js - FIXED: Compatible with Existing Backend
import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SoundSportDisplay } from '../utils/soundSportSystem';
import { 
  getAllUserCorps, 
  hasJoinedSeason, 
  CORPS_CLASSES 
} from '../utils/profileCompatibility';
import LoadingScreen from '../components/ui/LoadingScreen';
import SeasonSignup from '../components/dashboard/SeasonSignup';
import LeagueManager from '../components/dashboard/LeagueManager';
import MyStatus from '../components/dashboard/MyStatus';
import CorpsSelector from '../components/dashboard/CorpsSelector';

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

// Corps Class Card Component
const CorpsClassCard = ({ classInfo, registrationStatus, onAction }) => {
  const isSoundSport = classInfo.className === 'soundSport';
  const classConfig = CORPS_CLASSES[classInfo.className];
  
  if (!classConfig) return null;

  const getStatusColor = (status, registrationOpen) => {
    if (!registrationOpen && !isSoundSport) return 'border-red-300 bg-red-50 dark:bg-red-900/20';
    
    switch (status) {
      case 'active': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'available': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';  
      case 'locked': return 'border-gray-300 bg-gray-50 dark:bg-gray-800/20';
      default: return 'border-accent dark:border-accent-dark';
    }
  };

  return (
    <div
      className={`relative rounded-2xl p-6 border-2 transition-all duration-300 hover:scale-105 cursor-pointer ${getStatusColor(classInfo.status, registrationStatus?.canRegister)}`}
      onClick={() => registrationStatus?.canRegister && onAction(classInfo.className)}
    >
      {/* Class Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${classConfig.color} flex items-center justify-center text-white text-xl font-bold`}>
            {isSoundSport ? '🎺' : classInfo.className === 'aClass' ? '🌱' : classInfo.className === 'openClass' ? '🎯' : '👑'}
          </div>
          <div>
            <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark">
              {classConfig.name}
            </h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {classConfig.pointCap} points
              {isSoundSport && ' • Medal Ratings'}
            </p>
            {isSoundSport && (
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Challenge Class
              </p>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl mb-1">
            {classInfo.hasCorps ? '✅' : registrationStatus?.canRegister ? '🎯' : '🔒'}
          </div>
          {isSoundSport && (
            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              Always Open
            </div>
          )}
        </div>
      </div>

      {/* SoundSport Information */}
      {isSoundSport && (
        <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm">
              Official DCI SoundSport™ Features:
            </span>
          </div>
          <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1">
            <li>• Medal ratings: Gold, Silver, Bronze (no numerical scores announced)</li>
            <li>• 5 official judging criteria per DCI Challenge Class</li>
            <li>• All ages, all instruments welcome</li>
            <li>• 5-7 minute performances with amplification allowed</li>
            <li>• Always open registration throughout season</li>
            <li>• Focus on creativity, entertainment, and audience engagement</li>
          </ul>
        </div>
      )}

      {/* Corps Information Display */}
      {classInfo.hasCorps && classInfo.corps && (
        <div className="mb-4 p-3 bg-surface/50 dark:bg-surface-dark/50 rounded-lg">
          <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
            {classInfo.corps.corpsName}
          </h4>
          
          {/* SoundSport Rating Display */}
          {isSoundSport && classInfo.corps.totalSeasonScore > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-2">
                <div className={`px-3 py-2 rounded-lg font-bold text-lg ${
                  SoundSportDisplay.scoreToMedal(classInfo.corps.totalSeasonScore) === 'Gold' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                  SoundSportDisplay.scoreToMedal(classInfo.corps.totalSeasonScore) === 'Silver' ? 'bg-gray-100 text-gray-800 border border-gray-300' :
                  'bg-orange-100 text-orange-800 border border-orange-300'
                }`}>
                  {SoundSportDisplay.scoreToMedal(classInfo.corps.totalSeasonScore) === 'Gold' ? '🥇' : 
                   SoundSportDisplay.scoreToMedal(classInfo.corps.totalSeasonScore) === 'Silver' ? '🥈' : '🥉'} 
                  {SoundSportDisplay.scoreToMedal(classInfo.corps.totalSeasonScore)}
                </div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  {SoundSportDisplay.formatRating(classInfo.corps.totalSeasonScore).label}
                </div>
              </div>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark italic">
                "{SoundSportDisplay.generatePerformanceFeedback(classInfo.corps.totalSeasonScore)}"
              </p>
              <div className="text-xs text-gray-500 mt-1">
                Per DCI SoundSport Challenge Class evaluation
              </div>
            </div>
          )}
          
          {/* Numerical Score Display for Competitive Classes */}
          {!isSoundSport && (
            <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary dark:text-text-secondary-dark mb-2">
              <div>Season Score: {(classInfo.corps.totalSeasonScore || 0).toFixed(1)}</div>
              <div>Last Updated: {classInfo.corps.lastScoredDay || 'N/A'}</div>
            </div>
          )}
          
          {/* Lineup Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Lineup: {Object.keys(classInfo.corps.lineup || {}).length}/8</span>
              <span>Shows: {Object.keys(classInfo.corps.selectedShows || {}).length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${(Object.keys(classInfo.corps.lineup || {}).length / 8) * 100}%` }}
                />
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min((Object.keys(classInfo.corps.selectedShows || {}).length / 4) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
          (!registrationStatus?.canRegister && !classInfo.hasCorps && !isSoundSport)
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : classInfo.hasCorps
            ? 'bg-secondary text-on-secondary hover:bg-secondary/90'
            : isSoundSport 
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-primary text-on-primary hover:bg-primary/90'
        }`}
        disabled={!registrationStatus?.canRegister && !classInfo.hasCorps && !isSoundSport}
        onClick={(e) => {
          e.stopPropagation();
          if (registrationStatus?.canRegister || classInfo.hasCorps || isSoundSport) {
            onAction(classInfo.className);
          }
        }}
      >
        {classInfo.hasCorps 
          ? 'Manage Corps'
          : isSoundSport
          ? 'Create SoundSport Team'
          : registrationStatus?.canRegister
          ? `Create ${classConfig.name} Corps`
          : 'Registration Closed'
        }
      </button>
    </div>
  );
};

// Main Dashboard Component - COMPATIBLE WITH EXISTING BACKEND
const DashboardPage = ({ profile, userId }) => {
  const [seasonSettings, setSeasonSettings] = useState(null);
  const [corpsData, setCorpsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCorpsSelector, setShowCorpsSelector] = useState(false);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);

  // Use existing Firebase integration (from original DashboardPage)
  useEffect(() => {
    const seasonSettingsRef = doc(db, 'game-settings', 'season');
    
    const unsubscribe = onSnapshot(seasonSettingsRef, async (docSnap) => {
      if (docSnap.exists()) {
        const settings = { id: docSnap.id, ...docSnap.data() };
        setSeasonSettings(settings);

        if (settings.dataDocId) {
          const corpsDataRef = doc(db, 'dci-data', settings.dataDocId);
          const corpsDocSnap = await getDoc(corpsDataRef);
          if (corpsDocSnap.exists()) {
            setCorpsData(corpsDocSnap.data().corpsValues || []);
          } else {
            console.error(`Corps data document not found: ${settings.dataDocId}`);
            setCorpsData([]);
          }
        }
      } else {
        setSeasonSettings(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching season settings:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const userCorps = getAllUserCorps(profile);
  const hasAnyCorps = Object.keys(userCorps).length > 0;
  const hasJoinedCurrentSeason = seasonSettings ? hasJoinedSeason(profile, seasonSettings.seasonUid) : false;

  // Create corps cards with existing data structure
  const corpsCards = useMemo(() => {
    const availableClasses = ['soundSport', 'aClass', 'openClass', 'worldClass'];
    const userLevel = profile?.level || 1;
    
    return availableClasses.map(className => {
      const classConfig = CORPS_CLASSES[className];
      if (!classConfig) return null;
      
      const hasCorps = !!userCorps[className];
      const canUnlock = userLevel >= 1; // Simplified - all classes available for now
      const canRegister = className === 'soundSport' || canUnlock;
      
      return {
        className,
        hasCorps,
        corps: userCorps[className],
        status: hasCorps ? 'active' : (canRegister ? 'available' : 'locked'),
        registrationStatus: { 
          canRegister,
          deadline: className === 'soundSport' ? 'Always Open' : 'Season Dependent'
        }
      };
    }).filter(Boolean).filter(classInfo => classInfo.status !== 'locked');
  }, [profile, userCorps]);

  const handleCorpsAction = (corpsClass) => {
    // For all corps classes (including SoundSport) - show the CorpsSelector
    setSelectedCorpsClass(corpsClass);
    setShowCorpsSelector(true);
  };

  if (isLoading || !seasonSettings) {
    return <LoadingScreen message="Loading your director dashboard..." />;
  }

  // Show season signup if user hasn't joined current season
  if (!hasJoinedCurrentSeason && hasAnyCorps) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <SeasonSignup
          profile={profile}
          userId={userId}
          seasonSettings={seasonSettings}
          corpsData={corpsData}
        />
      </div>
    );
  }

  // Main dashboard view (existing users)
  if (hasJoinedCurrentSeason) {
    // If showing CorpsSelector for management
    if (showCorpsSelector && selectedCorpsClass) {
      const seasonStartDate = seasonSettings.schedule?.startDate?.toDate();
      let currentOffSeasonDay = 0;
      if (seasonSettings.status === 'off-season' && seasonStartDate) {
        const logicalNow = new Date();
        logicalNow.setHours(logicalNow.getHours() - 24);
        const todayForLogic = new Date(logicalNow.getFullYear(), logicalNow.getMonth(), logicalNow.getDate());
        const startDayForLogic = new Date(seasonStartDate.getFullYear(), seasonStartDate.getMonth(), seasonStartDate.getDate());
        const diff = todayForLogic.getTime() - startDayForLogic.getTime();
        currentOffSeasonDay = Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
      }

      return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => setShowCorpsSelector(false)}
              className="text-primary dark:text-primary-dark hover:underline"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
              Manage {CORPS_CLASSES[selectedCorpsClass]?.name || 'Corps'}
            </h1>
          </div>
          
          <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <CorpsSelector 
              profile={profile}  
              corpsData={corpsData}
              seasonSettings={seasonSettings}
              seasonEvents={seasonSettings.events || []}
              currentOffSeasonDay={currentOffSeasonDay}
              seasonStartDate={seasonStartDate}
              initialActiveCorps={selectedCorpsClass}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <MyStatus username={profile?.username || 'Director'} profile={profile} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Corps Management with SoundSport */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
              <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Your Corps Empire</h2>
              
              {corpsCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {corpsCards.map(classInfo => (
                    <CorpsClassCard
                      key={classInfo.className}
                      classInfo={classInfo}
                      registrationStatus={classInfo.registrationStatus}
                      onAction={handleCorpsAction}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    No corps classes available at your current level.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Side Column */}
          <div className="space-y-8">
            <LeagueManager profile={profile} />
          </div>
        </div>
      </div>
    );
  }

  // Getting started experience (new users)
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Welcome to marching.art, Director {profile?.username || 'Champion'}!
          </h1>
          <p className="text-xl text-text-secondary dark:text-text-secondary-dark">
            Create your drum corps empire with official DCI SoundSport™ and competitive classes
          </p>
        </div>

        {/* SoundSport Promotion */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-2xl p-8 border border-orange-200 dark:border-orange-800 mb-8">
          <div className="flex items-start gap-6">
            <div className="text-8xl">🎉</div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                Official DCI SoundSport™ Challenge Class
              </h3>
              <p className="text-lg text-text-secondary dark:text-text-secondary-dark mb-4">
                Experience the official DCI SoundSport format with medal-based ratings instead of numerical scores.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Perfect For:</h4>
                  <ul className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                    <li>• Learning drum corps fundamentals</li>
                    <li>• Experimenting with creative concepts</li>
                    <li>• Community-based music making</li>
                    <li>• All ages and skill levels</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Official Features:</h4>
                  <ul className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                    <li>• Gold/Silver/Bronze medal ratings</li>
                    <li>• 5 official DCI judging criteria</li>
                    <li>• No numerical scores announced</li>
                    <li>• Always open registration</li>
                    <li>• All instruments welcome</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleCorpsAction('soundSport')}
                  className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  🎺 Create SoundSport Team
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Available Classes */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Available Corps Classes
            </h2>
            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {corpsCards.length} classes available
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {corpsCards.map(classInfo => (
              <CorpsClassCard
                key={classInfo.className}
                classInfo={classInfo}
                registrationStatus={classInfo.registrationStatus}
                onAction={handleCorpsAction}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;