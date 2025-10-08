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
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import LoadingScreen from '../components/common/LoadingScreen';
import toast from 'react-hot-toast';

// Lazy load dashboard components
const LineupEditor = lazy(() => import('../components/dashboard/LineupEditor'));
const NewUserSetup = lazy(() => import('../components/dashboard/NewUserSetup'));
const StaffManagement = lazy(() => import('../components/dashboard/StaffManagement'));
const ShowSelection = lazy(() => import('../components/dashboard/ShowSelection'));
const UniformBuilder = lazy(() => import('../components/dashboard/UniformBuilder'));
const CorpsManager = lazy(() => import('../components/dashboard/CorpsManager'));

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

// Skeleton Loader Component
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 space-y-4">
      <div className="h-8 bg-accent dark:bg-accent-dark rounded w-1/3"></div>
      <div className="h-4 bg-accent dark:bg-accent-dark rounded w-1/2"></div>
    </div>
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 space-y-3">
      <div className="h-6 bg-accent dark:bg-accent-dark rounded w-1/4"></div>
      <div className="h-32 bg-accent dark:bg-accent-dark rounded"></div>
    </div>
  </div>
);

// Get class icon helper
const getClassIcon = (corpsClass) => {
  const icons = {
    'SoundSport': Star,
    'A Class': Award,
    'Open Class': Coins,
    'World Class': Star
  };
  const Icon = icons[corpsClass] || Star;
  return <Icon className="w-5 h-5" />;
};

// Get class color helper
const getClassColor = (corpsClass) => {
  const colors = {
    'SoundSport': 'text-blue-500',
    'A Class': 'text-green-500',
    'Open Class': 'text-purple-500',
    'World Class': 'text-yellow-500'
  };
  return colors[corpsClass] || 'text-primary dark:text-primary-dark';
};

// Corps Selector Dropdown Component
const CorpsSelector = () => {
  const { corpsList, activeCorpsId, setActiveCorps } = useUserStore();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const activeCorps = corpsList.find(c => c.id === activeCorpsId);
  
  if (corpsList.length === 0) {
    return null;
  }

  if (corpsList.length === 1) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary-dark/10 border border-primary dark:border-primary-dark rounded-theme">
        {getClassIcon(activeCorps?.corpsClass)}
        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
          {activeCorps?.corpsName}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-surface dark:bg-surface-dark border-2 border-accent dark:border-accent-dark rounded-theme hover:border-primary dark:hover:border-primary-dark transition-all min-w-[200px] sm:min-w-[250px]"
      >
        <div className="flex items-center gap-2 flex-1">
          {getClassIcon(activeCorps?.corpsClass)}
          <div className="text-left flex-1">
            <div className="font-semibold text-text-primary dark:text-text-primary-dark truncate">
              {activeCorps?.corpsName || 'Select Corps'}
            </div>
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
              {activeCorps?.corpsClass}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-text-secondary dark:text-text-secondary-dark transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface dark:bg-surface-dark border-2 border-accent dark:border-accent-dark rounded-theme shadow-xl z-20 max-h-80 overflow-y-auto">
            {corpsList.map(corps => (
              <button
                key={corps.id}
                onClick={() => {
                  setActiveCorps(corps.id);
                  setShowDropdown(false);
                  toast.success(`Switched to ${corps.corpsName}`);
                }}
                className={`w-full p-3 flex items-center gap-3 hover:bg-accent dark:hover:bg-accent-dark transition-colors text-left ${
                  corps.id === activeCorpsId ? 'bg-primary/10 dark:bg-primary-dark/10' : ''
                }`}
              >
                {getClassIcon(corps.corpsClass)}
                <div className="flex-1">
                  <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                    {corps.corpsName}
                  </div>
                  <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {corps.corpsClass} • {corps.stats?.totalShows || 0} shows
                  </div>
                </div>
                {corps.stats?.bestScore > 0 && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary dark:text-primary-dark">
                      {corps.stats.bestScore.toFixed(3)}
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      Best
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, corpsList, activeCorpsId, fetchUserProfile, getActiveCorps } = useUserStore();
  const [activeTab, setActiveTab] = useState('corps');
  const [hasFetched, setHasFetched] = useState(false);

  const activeCorps = getActiveCorps();

  // Define tabs before any logic that uses them
  const dashboardTabs = [
    { 
      id: 'corps', 
      label: 'Corps', 
      icon: Target, 
      component: CorpsManager,
      description: 'Manage your corps',
      showAlways: true
    },
    { 
      id: 'lineup', 
      label: 'Captions', 
      icon: Users, 
      component: LineupEditor,
      description: 'Select corps for each caption',
      requiresCorps: true
    },
    { 
      id: 'shows', 
      label: 'Shows', 
      icon: Calendar, 
      component: ShowSelection,
      description: 'Register for competitions',
      requiresCorps: true
    },
    { 
      id: 'staff', 
      label: 'Staff', 
      icon: Award, 
      component: StaffManagement,
      description: 'Hire legendary staff',
      requiresCorps: true
    },
    { 
      id: 'uniform', 
      label: 'Uniform', 
      icon: Palette, 
      component: UniformBuilder,
      description: 'Design your look',
      requiresCorps: true
    },
    { 
      id: 'analysis', 
      label: 'Analysis', 
      icon: BarChart3, 
      component: AnalysisTools,
      description: 'Deep dive into data',
      requiresCorps: false
    }
  ];

  const availableTabs = dashboardTabs.filter(tab => 
    tab.showAlways || !tab.requiresCorps || (tab.requiresCorps && activeCorps)
  );

  // ALL HOOKS MUST BE BEFORE ANY EARLY RETURNS
  useEffect(() => {
    if (currentUser && !hasFetched) {
      fetchUserProfile(currentUser.uid);
      setHasFetched(true);
    }
  }, [currentUser, hasFetched, fetchUserProfile]);

  useEffect(() => {
    if (!availableTabs.find(t => t.id === activeTab)) {
      setActiveTab('corps');
    }
  }, [activeCorps, activeTab, availableTabs]);

  // NOW we can do early returns after all hooks
  if (!currentUser) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (!profile && !hasFetched) {
    return <LoadingScreen fullScreen={false} />;
  }

  // Show skeleton while loading
  if (!profile) {
    return <DashboardSkeleton />;
  }

  const needsSetup = !profile.hasCompletedSetup || corpsList.length === 0;

  if (needsSetup) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Suspense fallback={<LoadingScreen fullScreen={false} />}>
          <NewUserSetup profile={profile} onComplete={async () => {
            if (currentUser) {
              setHasFetched(false);
              await fetchUserProfile(currentUser.uid);
            }
          }} />
        </Suspense>
      </div>
    );
  }

  const ActiveComponent = availableTabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Mobile-Optimized Header */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 sm:p-6 shadow-theme dark:shadow-theme-dark">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
              Dashboard
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
              <div className="flex items-center gap-2 bg-background dark:bg-background-dark px-3 py-1.5 rounded-theme">
                <TrendingUp className="w-4 h-4 text-primary dark:text-primary-dark" />
                <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                  {profile.xp || 0} XP
                </span>
              </div>
              <div className="flex items-center gap-2 bg-background dark:bg-background-dark px-3 py-1.5 rounded-theme">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                  {profile.corpsCoin?.toLocaleString() || 0}
                </span>
              </div>
              <div className="text-text-secondary dark:text-text-secondary-dark">
                {corpsList.length} Corps Active
              </div>
            </div>
          </div>

          {corpsList.length > 0 && (
            <div className="w-full sm:w-auto">
              <CorpsSelector />
            </div>
          )}
        </div>

        {activeCorps && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-accent dark:border-accent-dark">
            <div className="bg-background dark:bg-background-dark p-3 rounded-theme">
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                Class
              </div>
              <div className={`font-bold flex items-center gap-1 ${getClassColor(activeCorps.corpsClass)}`}>
                {getClassIcon(activeCorps.corpsClass)}
                <span className="text-sm">{activeCorps.corpsClass}</span>
              </div>
            </div>
            <div className="bg-background dark:bg-background-dark p-3 rounded-theme">
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                Latest Score
              </div>
              <div className="text-lg font-bold text-primary dark:text-primary-dark">
                {activeCorps.stats?.latestScore?.toFixed(3) || 'N/A'}
              </div>
            </div>
            <div className="bg-background dark:bg-background-dark p-3 rounded-theme">
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                Season Rank
              </div>
              <div className="text-lg font-bold text-secondary dark:text-secondary-dark">
                #{activeCorps.stats?.seasonRank || '--'}
              </div>
            </div>
            <div className="bg-background dark:bg-background-dark p-3 rounded-theme">
              <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                Shows
              </div>
              <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                {activeCorps.stats?.totalShows || 0}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-Optimized Tab Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme shadow-theme dark:shadow-theme-dark overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max sm:min-w-0">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-2 transition-all border-b-4 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark border-transparent'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content with optimized loading */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 sm:p-6 shadow-theme dark:shadow-theme-dark min-h-[500px]">
        <Suspense fallback={<LoadingScreen fullScreen={false} />}>
          {ActiveComponent && <ActiveComponent userProfile={profile} activeCorps={activeCorps} />}
        </Suspense>
      </div>
    </div>
  );
};

export default DashboardPage;