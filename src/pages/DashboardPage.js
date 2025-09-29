import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';
import { 
  Users, 
  Palette, 
  BarChart3, 
  Calendar,
  Award,
  Coins,
  Star,
  Target,
  Lock
} from 'lucide-react';
import LoadingScreen from '../components/common/LoadingScreen';

// Lazy load heavy dashboard components
const LineupEditor = lazy(() => import('../components/dashboard/LineupEditor'));
const NewUserSetup = lazy(() => import('../components/dashboard/NewUserSetup'));
const StaffManagement = lazy(() => import('../components/dashboard/StaffManagement'));
const ShowSelection = lazy(() => import('../components/dashboard/ShowSelection'));
const UniformBuilder = lazy(() => import('../components/dashboard/UniformBuilder'));

// Lightweight placeholder for analysis
const AnalysisTools = () => (
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
  const isUnlocked = profile?.unlockedClasses?.includes(cls.name) || cls.xpRequired === 0;
  const isCurrentClass = profile?.corps?.corpsClass === cls.name;
  const currentXP = profile?.xp || 0;
  const xpNeeded = Math.max(0, cls.xpRequired - currentXP);
  
  return (
    <div className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border-2 transition-all ${
      isCurrentClass 
        ? 'border-primary dark:border-primary-dark shadow-lg' 
        : isUnlocked 
          ? 'border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark cursor-pointer' 
          : 'border-accent dark:border-accent-dark opacity-60'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <cls.icon className={`w-6 h-6 ${isCurrentClass ? 'text-primary dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark'}`} />
          <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">{cls.name}</h3>
        </div>
        {isCurrentClass && <span className="text-xs bg-primary dark:bg-primary-dark text-white px-2 py-1 rounded">Active</span>}
        {!isUnlocked && <Lock className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />}
      </div>
      <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3">{cls.description}</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary dark:text-text-secondary-dark">Point Limit:</span>
          <span className="font-medium text-text-primary dark:text-text-primary-dark">{cls.pointLimit}</span>
        </div>
        {!isUnlocked && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary dark:text-text-secondary-dark">XP Required:</span>
            <span className="font-medium text-error">{xpNeeded} more XP needed</span>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, isLoading, fetchUserProfile } = useUserStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [hasFetched, setHasFetched] = useState(false);

  const handleSetupComplete = () => {
    if (currentUser) {
      setHasFetched(false); // Allow refetch
      fetchUserProfile(currentUser.uid);
    }
  };

  // Show loading only when actively loading and no profile yet
  if (isLoading && !profile) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  // If no user, show login message
  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Dashboard
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Please log in to view your dashboard
        </p>
      </div>
    );
  }

  // If no profile after fetch attempt, show error
  if (!profile && hasFetched) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Profile Not Found
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
          We couldn't load your profile. This might be because your account is new.
        </p>
        <button 
          onClick={() => {
            setHasFetched(false);
            fetchUserProfile(currentUser.uid);
          }}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-theme"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Check if user needs setup
  const needsSetup = profile && (!profile.corps || !profile.corps.corpsName || profile.corps.corpsName === 'New Corps');

  if (needsSetup) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Suspense fallback={<LoadingScreen message="Loading setup..." />}>
          <NewUserSetup profile={profile} onComplete={handleSetupComplete} />
        </Suspense>
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
      description: 'Intermediate competition'
    },
    { 
      name: 'Open Class', 
      icon: Coins, 
      pointLimit: 120, 
      xpRequired: 2000, 
      description: 'Advanced competition'
    },
    { 
      name: 'World Class', 
      icon: Star, 
      pointLimit: 150, 
      xpRequired: 5000, 
      description: 'Elite competition'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Dashboard Header */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
            {profile?.corps?.corpsName || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-text-secondary dark:text-text-secondary-dark">XP</div>
              <div className="text-2xl font-bold text-primary dark:text-primary-dark">{profile?.xp || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-text-secondary dark:text-text-secondary-dark">CorpsCoin</div>
              <div className="text-2xl font-bold text-secondary dark:text-secondary-dark">{profile?.corpsCoin || 0}</div>
            </div>
          </div>
        </div>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          {profile?.corps?.corpsClass || 'SoundSport'} | Season {currentSeason} | Week {weekNumber}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme shadow-theme dark:shadow-theme-dark overflow-hidden">
        <div className="flex overflow-x-auto">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary dark:bg-primary-dark text-white border-b-4 border-primary dark:border-primary-dark'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark min-h-[500px]">
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Class Registration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {classInfo.map((cls) => (
                  <ClassRegistrationCard 
                    key={cls.name} 
                    cls={cls} 
                    profile={profile} 
                    isRegistrationOpen={isRegistrationOpen} 
                  />
                ))}
              </div>
            </div>
            
            {profile?.corps && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <h3 className="text-sm text-text-secondary dark:text-text-secondary-dark mb-1">Latest Score</h3>
                  <p className="text-3xl font-bold text-primary dark:text-primary-dark">
                    {profile.corps.latestScore?.toFixed(3) || 'N/A'}
                  </p>
                </div>
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <h3 className="text-sm text-text-secondary dark:text-text-secondary-dark mb-1">Season Rank</h3>
                  <p className="text-3xl font-bold text-secondary dark:text-secondary-dark">
                    #{profile.corps.seasonRank || '--'}
                  </p>
                </div>
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <h3 className="text-sm text-text-secondary dark:text-text-secondary-dark mb-1">Performances</h3>
                  <p className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                    {profile.corps.performanceCount || 0}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                  Loading {dashboardTabs.find(t => t.id === activeTab)?.label}...
                </p>
              </div>
            </div>
          }>
            {ActiveComponent && <ActiveComponent userProfile={profile} />}
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;