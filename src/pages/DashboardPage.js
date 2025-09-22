// pages/DashboardPage.js - Dashboard with Authentic DCI SoundSport Implementation
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { 
  SOUNDSPORT_OFFICIAL_CONFIG,
  SoundSportDisplay
} from '../utils/authenticSoundSportSystem';
import LoadingScreen from '../components/ui/LoadingScreen';
import toast from 'react-hot-toast';

// Enhanced Corps Class Configuration with Authentic SoundSport
const ENHANCED_CORPS_CLASSES = {
  soundSport: SOUNDSPORT_OFFICIAL_CONFIG,
  aClass: {
    name: 'A Class',
    pointCap: 60,
    unlockLevel: 1,
    color: 'bg-green-500',
    icon: '🌱',
    difficulty: 'Beginner',
    ratingSystem: { type: 'numerical', displayScores: true },
    registrationCutoffWeeks: 4
  },
  openClass: {
    name: 'Open Class', 
    pointCap: 120,
    unlockLevel: 5,
    color: 'bg-blue-500',
    icon: '🎯',
    difficulty: 'Intermediate',
    ratingSystem: { type: 'numerical', displayScores: true },
    registrationCutoffWeeks: 5
  },
  worldClass: {
    name: 'World Class',
    pointCap: 150, 
    unlockLevel: 10,
    color: 'bg-yellow-500',
    icon: '👑',
    difficulty: 'Elite',
    ratingSystem: { type: 'numerical', displayScores: true },
    registrationCutoffWeeks: 6
  }
};

// SoundSport Performance Display Component
const SoundSportPerformanceCard = ({ performance, onViewDetails }) => {
  const displayData = SoundSportDisplay.formatRating(performance.rating);
  
  return (
    <motion.div
      className={`p-4 rounded-lg border ${displayData.colorClass} cursor-pointer transition-all hover:scale-102`}
      whileHover={{ y: -2 }}
      onClick={() => onViewDetails(performance)}
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
      
      {/* Official DCI Note */}
      <div className="mt-2 text-xs italic opacity-60">
        Ratings based on DCI SoundSport Challenge Class criteria
      </div>
    </motion.div>
  );
};

// Enhanced Corps Class Card with SoundSport Integration
const EnhancedCorpsClassCard = ({ classInfo, registrationStatus, onAction }) => {
  const isSoundSport = classInfo.className === 'soundSport';
  const classConfig = ENHANCED_CORPS_CLASSES[classInfo.className];
  
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
    <motion.div
      className={`relative rounded-2xl p-6 border-2 transition-all duration-300 hover:scale-105 cursor-pointer ${getStatusColor(classInfo.status, registrationStatus?.canRegister)}`}
      whileHover={{ y: -4 }}
      onClick={() => registrationStatus?.canRegister && onAction(classInfo.className, classInfo.primaryAction?.action || 'view')}
    >
      {/* Class Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${classConfig.color} flex items-center justify-center text-white text-xl font-bold`}>
            {classConfig.icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark">
              {classConfig.name}
            </h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {classConfig.difficulty} • {classConfig.pointCap} points
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

      {/* SoundSport Official Information */}
      {isSoundSport && (
        <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm">
              Official DCI SoundSport™ Features:
            </span>
          </div>
          <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1">
            <li>• Medal ratings: Gold, Silver, Bronze (no numerical scores)</li>
            <li>• 5 official judging criteria per DCI Challenge Class</li>
            <li>• All ages, all instruments welcome</li>
            <li>• 5-7 minute performances with amplification allowed</li>
            <li>• Always open registration throughout season</li>
            <li>• Focus on creativity, entertainment, and audience engagement</li>
          </ul>
        </div>
      )}

      {/* Registration Status for Competitive Classes */}
      {!classInfo.hasCorps && !isSoundSport && (
        <div className="mb-4 p-3 bg-surface/50 dark:bg-surface-dark/50 rounded-lg">
          <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
            Registration Status
          </div>
          <div className={`text-sm ${registrationStatus?.canRegister ? 'text-green-600' : 'text-red-600'}`}>
            {registrationStatus?.canRegister 
              ? `Open until ${registrationStatus.deadline}`
              : registrationStatus?.reason || 'Registration requirements not met'
            }
          </div>
        </div>
      )}

      {/* Corps Information Display */}
      {classInfo.hasCorps && classInfo.corps && (
        <div className="mb-4 p-3 bg-surface/50 dark:bg-surface-dark/50 rounded-lg">
          <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
            {classInfo.corps.corpsName}
          </h4>
          
          {/* SoundSport Rating Display */}
          {isSoundSport && classInfo.corps.lastRating && (
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-2">
                <div className={`px-3 py-2 rounded-lg font-bold text-lg ${
                  classInfo.corps.lastRating.rating === 'Gold' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                  classInfo.corps.lastRating.rating === 'Silver' ? 'bg-gray-100 text-gray-800 border border-gray-300' :
                  'bg-orange-100 text-orange-800 border border-orange-300'
                }`}>
                  {classInfo.corps.lastRating.rating === 'Gold' ? '🥇' : 
                   classInfo.corps.lastRating.rating === 'Silver' ? '🥈' : '🥉'} {classInfo.corps.lastRating.rating}
                </div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  {classInfo.corps.lastRating.label}
                </div>
              </div>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark italic">
                "{classInfo.corps.lastRating.feedback}"
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
              <div>Last Updated: {new Date(classInfo.corps.lastUpdated).toLocaleDateString()}</div>
            </div>
          )}
          
          {/* Lineup Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Lineup: {Object.keys(classInfo.corps.lineup || {}).length}/8</span>
              <span>Staff: {Object.keys(classInfo.corps.staffLineup || {}).length}/8</span>
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
                  style={{ width: `${(Object.keys(classInfo.corps.staffLineup || {}).length / 8) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <motion.button
        className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
          (!registrationStatus?.canRegister && !classInfo.hasCorps && !isSoundSport)
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : classInfo.hasCorps
            ? 'bg-secondary text-on-secondary hover:bg-secondary/90'
            : isSoundSport 
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-primary text-on-primary hover:bg-primary/90'
        }`}
        whileHover={{ scale: (registrationStatus?.canRegister || classInfo.hasCorps || isSoundSport) ? 1.02 : 1 }}
        whileTap={{ scale: (registrationStatus?.canRegister || classInfo.hasCorps || isSoundSport) ? 0.98 : 1 }}
        disabled={!registrationStatus?.canRegister && !classInfo.hasCorps && !isSoundSport}
        onClick={(e) => {
          e.stopPropagation();
          if (registrationStatus?.canRegister || classInfo.hasCorps || isSoundSport) {
            onAction(classInfo.className, classInfo.hasCorps ? 'edit' : 'create');
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
      </motion.button>

      {/* Official DCI Compliance Badge for SoundSport */}
      {isSoundSport && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
            <span>✓</span> Official DCI SoundSport™ Compliant
          </div>
        </div>
      )}
    </motion.div>
  );
};

// SoundSport Promotional Component
const SoundSportPromotion = ({ onCreateSoundSport, hasOtherCorps }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-2xl p-8 border border-orange-200 dark:border-orange-800 mb-8"
    >
      <div className="flex items-start gap-6">
        <div className="text-8xl">🎉</div>
        <div className="flex-1">
          <h3 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Official DCI SoundSport™ Challenge Class
          </h3>
          <p className="text-lg text-text-secondary dark:text-text-secondary-dark mb-4">
            Experience the official DCI SoundSport format with authentic judging criteria and medal-based ratings.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Perfect For:</h4>
              <ul className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                <li>• Learning drum corps fundamentals</li>
                <li>• Experimenting with creative concepts</li>
                <li>• Community-based music making</li>
                <li>• All ages and skill levels</li>
                {hasOtherCorps && <li>• Managing alongside competitive corps</li>}
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
              onClick={onCreateSoundSport}
              className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              🎺 Create SoundSport Team
            </button>
            <a 
              href="https://www.dci.org/soundsport" 
              target="_blank" 
              rel="noopener noreferrer"
              className="border border-orange-500 text-orange-600 dark:text-orange-400 px-6 py-3 rounded-xl font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              Learn About Official SoundSport
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main Dashboard Component
const DashboardPage = () => {
  const navigate = useNavigate();
  const { 
    user,
    loggedInProfile, 
    isLoadingAuth,
    getUserCorps,
    updateUserExperience
  } = useUserStore();

  const [isLoading, setIsLoading] = useState(true);

  const userCorps = getUserCorps();
  const hasAnySoundSport = !!userCorps.soundSport;
  const hasOtherCorps = Object.keys(userCorps).some(key => key !== 'soundSport' && userCorps[key]);

  // Mock corps cards with SoundSport integration
  const corpsCards = useMemo(() => {
    const availableClasses = ['soundSport', 'aClass', 'openClass', 'worldClass'];
    const userLevel = loggedInProfile?.level || 1;
    
    return availableClasses.map(className => {
      const classConfig = ENHANCED_CORPS_CLASSES[className];
      const hasCorps = !!userCorps[className];
      const canUnlock = userLevel >= (classConfig.unlockLevel || 1);
      const canRegister = className === 'soundSport' || canUnlock; // SoundSport always available
      
      return {
        className,
        ...classConfig,
        hasCorps,
        corps: userCorps[className],
        status: hasCorps ? 'active' : (canRegister ? 'available' : 'locked'),
        registrationStatus: { canRegister }
      };
    }).filter(classInfo => classInfo.status !== 'locked');
  }, [loggedInProfile, userCorps]);

  useEffect(() => {
    if (user && loggedInProfile) {
      setIsLoading(false);
      updateUserExperience(10, 'Daily login');
    }
  }, [user, loggedInProfile, updateUserExperience]);

  const handleCorpsAction = (corpsClass, action) => {
    switch (action) {
      case 'create':
        navigate(`/enhanced-lineup/${corpsClass}`);
        break;
      case 'edit':
        navigate(`/enhanced-lineup/${corpsClass}`);
        break;
      case 'view':
        navigate(`/corps/${corpsClass}`);
        break;
      default:
        console.log(`Action ${action} for ${corpsClass}`);
    }
  };

  if (isLoadingAuth) {
    return <LoadingScreen message="Loading your director dashboard..." />;
  }

  if (!user) {
    navigate('/');
    return null;
  }

  if (isLoading) {
    return <LoadingScreen message="Preparing your corps empire..." />;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Welcome back, Director {loggedInProfile?.displayName || 'Champion'}!
          </h1>
          <p className="text-xl text-text-secondary dark:text-text-secondary-dark">
            Manage your drum corps empire with official DCI SoundSport™ and competitive classes
          </p>
        </motion.div>

        {/* SoundSport Promotion (if not registered) */}
        {!hasAnySoundSport && (
          <SoundSportPromotion 
            onCreateSoundSport={() => handleCorpsAction('soundSport', 'create')}
            hasOtherCorps={hasOtherCorps}
          />
        )}

        {/* Corps Class Management */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Available Corps Classes
            </h2>
            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
              Level {loggedInProfile?.level || 1} • {corpsCards.length} classes available
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {corpsCards.map(classInfo => (
              <EnhancedCorpsClassCard
                key={classInfo.className}
                classInfo={classInfo}
                registrationStatus={classInfo.registrationStatus}
                onAction={handleCorpsAction}
              />
            ))}
          </div>
        </div>

        {/* Getting Started Guide */}
        {Object.keys(userCorps).length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-2xl p-8 border border-green-200 dark:border-green-800"
          >
            <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Start Your Director Journey!
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
              Begin with SoundSport to learn the game or jump into competitive classes. 
              SoundSport uses the official DCI Challenge Class format with medal ratings instead of scores.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl mb-2">🎉</div>
                <div className="font-semibold">Try SoundSport</div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Official DCI format • Medal ratings
                </div>
              </div>
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl mb-2">🌱</div>
                <div className="font-semibold">A Class Competition</div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Entry-level competitive scoring
                </div>
              </div>
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl mb-2">📈</div>
                <div className="font-semibold">Progress to Elite</div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Unlock higher classes over time
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;