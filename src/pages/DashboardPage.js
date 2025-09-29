import React, { useState, useEffect } from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import NewUserSetup from '../components/dashboard/NewUserSetup';
import StaffManagement from '../components/dashboard/StaffManagement';
import ShowSelection from '../components/dashboard/ShowSelection';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import toast from 'react-hot-toast';
import { 
  Users, 
  Palette, 
  BarChart3, 
  Trophy, 
  TrendingUp,
  Calendar,
  Award,
  Coins,
  Crown,
  Zap,
  Star,
  Target,
  Clock,
  ChevronRight,
  CheckCircle,
  Lock
} from 'lucide-react';
import LoadingScreen from '../components/common/LoadingScreen';

// Placeholder components for future features
const UniformBuilder = ({ userProfile }) => (
  <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme text-center border border-accent dark:border-accent-dark">
    <Palette className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">Uniform Builder</h3>
    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">Design your corps uniforms and color schemes</p>
    <div className="text-sm text-text-secondary dark:text-text-secondary-dark bg-background dark:bg-background-dark px-3 py-2 rounded-theme">
      Premium Feature - Coming Soon
    </div>
  </div>
);

const AnalysisTools = ({ userProfile }) => (
  <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme text-center border border-accent dark:border-accent-dark">
    <BarChart3 className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">Score Analysis Tools</h3>
    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">Comprehensive historical DCI data analysis</p>
    <div className="text-sm text-text-secondary dark:text-text-secondary-dark bg-background dark:bg-background-dark px-3 py-2 rounded-theme">
      Premium Feature - Coming Soon
    </div>
  </div>
);

// Component to handle class registration cards
const ClassRegistrationCard = ({ cls, profile, isRegistrationOpen }) => {
  const isUnlocked = profile?.unlockedClasses?.includes(cls.name) || false;
  const isCurrentClass = profile?.corps?.corpsClass === cls.name;
  
  return (
    <div className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border-2 transition-all ${
      isCurrentClass 
        ? 'border-primary dark:border-primary-dark shadow-glow' 
        : 'border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isUnlocked ? 'bg-primary dark:bg-primary-dark' : 'bg-gray-600'
          }`}>
            {React.createElement(cls.icon, { className: "w-6 h-6 text-on-primary dark:text-on-primary-dark" })}
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">{cls.name}</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{cls.pointLimit} point limit</p>
          </div>
        </div>
        {isCurrentClass && (
          <CheckCircle className="w-6 h-6 text-green-500" />
        )}
        {!isUnlocked && (
          <Lock className="w-6 h-6 text-text-secondary dark:text-text-secondary-dark" />
        )}
      </div>
      
      <p className="text-text-secondary dark:text-text-secondary-dark text-sm mb-4">
        {cls.description}
      </p>
      
      {!isUnlocked && (
        <div className="bg-background dark:bg-background-dark p-3 rounded-theme mb-4">
          <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
            Unlock Requirements:
          </p>
          <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
            <Star className="w-4 h-4 text-primary dark:text-primary-dark" />
            <span>{cls.xpRequired} XP required</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
            <Zap className="w-4 h-4 text-primary dark:text-primary-dark" />
            <span>Current XP: {profile?.xp || 0}</span>
          </div>
        </div>
      )}
      
      <div>
        {isUnlocked && isRegistrationOpen ? (
          <button className="w-full bg-primary dark:bg-primary-dark hover:bg-secondary dark:hover:bg-secondary-dark text-on-primary dark:text-on-primary-dark py-2 px-4 rounded-theme font-medium transition-colors">
            Register for {cls.name}
          </button>
        ) : isUnlocked ? (
          <div className="text-center text-sm text-error">
            Registration closed for this season
          </div>
        ) : (
          <button disabled className="w-full bg-gray-600 text-gray-400 py-2 px-4 rounded-theme font-medium cursor-not-allowed">
            Locked
          </button>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, isLoading, fetchUserProfile } = useUserStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (currentUser && profile) {
      checkForClassUnlocks();
    }
  }, [currentUser, profile]);

  const checkForClassUnlocks = async () => {
    try {
      const checkClassUnlocks = httpsCallable(functions, 'users-checkClassUnlocks');
      const result = await checkClassUnlocks();
      
      if (result.data.success && result.data.newUnlocks.length > 0) {
        toast.success(result.data.message);
        fetchUserProfile(currentUser.uid);
      }
    } catch (error) {
      console.error('Error checking class unlocks:', error);
    }
  };

  // Show loading only when actively fetching
  if (isLoading && !profile) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  if (!currentUser || !profile) {
    return (
      <div className="text-center py-12">
        <div className="text-text-primary dark:text-text-primary-dark text-xl">Please log in to view your dashboard.</div>
      </div>
    );
  }
  
  const isNewUser = profile.corps?.corpsName === 'New Corps';

  const handleSetupComplete = () => {
    fetchUserProfile(currentUser.uid);
  };

  if (isNewUser) {
    return (
      <div className="space-y-8">
        <NewUserSetup profile={profile} onComplete={handleSetupComplete} />
      </div>
    );
  }

  const dashboardTabs = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: Target, 
      description: 'Season summary and quick actions'
    },
    { 
      id: 'lineup', 
      label: 'Caption Selection', 
      icon: Users, 
      component: LineupEditor,
      description: 'Select corps for each caption'
    },
    { 
      id: 'shows', 
      label: 'Show Selection', 
      icon: Calendar, 
      component: ShowSelection,
      description: 'Register for competitions'
    },
    { 
      id: 'staff', 
      label: 'Staff Management', 
      icon: Award, 
      component: StaffManagement,
      description: 'Hire and manage legendary staff'
    },
    { 
      id: 'uniform', 
      label: 'Uniform Builder', 
      icon: Palette, 
      component: UniformBuilder,
      description: 'Design your corps look'
    },
    { 
      id: 'analysis', 
      label: 'Score Analysis', 
      icon: BarChart3, 
      component: AnalysisTools,
      description: 'Deep dive into data'
    }
  ];

  const ActiveComponent = dashboardTabs.find(tab => tab.id === activeTab)?.component;

  // Mock data for overview
  const currentSeason = '2025';
  const weekNumber = 5;
  const isRegistrationOpen = weekNumber <= 4;

  const classInfo = [
    { 
      name: 'SoundSport', 
      icon: Star, 
      pointLimit: 90, 
      xpRequired: 0, 
      description: 'Entry level competition - perfect for beginners' 
    },
    { 
      name: 'A Class', 
      icon: Award, 
      pointLimit: 60, 
      xpRequired: 500, 
      description: 'Intermediate competition with tight point limits' 
    },
    { 
      name: 'Open Class', 
      icon: Trophy, 
      pointLimit: 120, 
      xpRequired: 2000, 
      description: 'Advanced competition with expanded possibilities' 
    },
    { 
      name: 'World Class', 
      icon: Crown, 
      pointLimit: 150, 
      xpRequired: 5000, 
      description: 'Elite level competition - the pinnacle of achievement' 
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-surface dark:from-surface-dark to-background dark:to-background-dark p-6 rounded-theme shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
              {profile.corps?.corpsName || 'Your Corps'}
            </h1>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              {profile.corps?.corpsClass || 'SoundSport'} • Season {currentSeason}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-5 h-5 text-primary dark:text-primary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{profile.xp || 0}</span>
              </div>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">XP</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-5 h-5 text-primary dark:text-primary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{profile.corpsCoin || 0}</span>
              </div>
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark">CorpsCoin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
        <div className="flex overflow-x-auto">
          {dashboardTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark bg-background dark:bg-background-dark'
                    : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">Season Progress</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary dark:text-text-secondary-dark">Week</span>
                <span className="font-bold text-text-primary dark:text-text-primary-dark">{weekNumber} / 10</span>
              </div>
              <div className="w-full bg-background dark:bg-background-dark rounded-full h-2">
                <div 
                  className="bg-primary dark:bg-primary-dark h-2 rounded-full transition-all"
                  style={{ width: `${(weekNumber / 10) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary dark:text-text-secondary-dark">Best Score</span>
                <span className="font-bold text-text-primary dark:text-text-primary-dark">{profile.totalSeasonScore?.toFixed(3) || '0.000'}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-2 bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveTab('lineup')}
                className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme hover:bg-accent dark:hover:bg-accent-dark transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary dark:text-primary-dark" />
                  <div>
                    <p className="font-semibold text-text-primary dark:text-text-primary-dark">Edit Lineup</p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Select captions</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
              </button>

              <button
                onClick={() => setActiveTab('shows')}
                className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme hover:bg-accent dark:hover:bg-accent-dark transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-primary dark:text-primary-dark" />
                  <div>
                    <p className="font-semibold text-text-primary dark:text-text-primary-dark">Register Shows</p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Pick competitions</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme hover:bg-accent dark:hover:bg-accent-dark transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-primary dark:text-primary-dark" />
                  <div>
                    <p className="font-semibold text-text-primary dark:text-text-primary-dark">Hire Staff</p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Hire legends</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-3 bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">Class Registration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {classInfo.map(cls => (
                <ClassRegistrationCard 
                  key={cls.name}
                  cls={cls}
                  profile={profile}
                  isRegistrationOpen={isRegistrationOpen}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Render Active Component */}
      {ActiveComponent && (
        <ActiveComponent userProfile={profile} />
      )}
    </div>
  );
};

export default DashboardPage;