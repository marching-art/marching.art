import React, { useState, useEffect } from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import NewUserSetup from '../components/dashboard/NewUserSetup';
import StaffManagement from '../components/dashboard/StaffManagement';
import ShowSelection from '../components/dashboard/ShowSelection';
import LoadingScreen from '../components/common/LoadingScreen';
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
  Settings, 
  PlusCircle,
  TrendingUp,
  Calendar,
  Award,
  Coins,
  Crown,
  Zap,
  Star,
  Target,
  Clock,
  ChevronRight
} from 'lucide-react';

// Placeholder components for future features
const UniformBuilder = ({ userProfile }) => (
  <div className="bg-surface-dark p-8 rounded-theme text-center">
    <Palette className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary-dark mb-2">Uniform Builder</h3>
    <p className="text-text-secondary-dark mb-4">Design your corps uniforms and color schemes</p>
    <div className="text-sm text-text-secondary-dark bg-background-dark px-3 py-2 rounded-theme">
      Premium Feature - Coming Soon
    </div>
  </div>
);

const AnalysisTools = ({ userProfile }) => (
  <div className="bg-surface-dark p-8 rounded-theme text-center">
    <BarChart3 className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary-dark mb-2">Score Analysis Tools</h3>
    <p className="text-text-secondary-dark mb-4">Comprehensive historical DCI data analysis</p>
    <div className="text-sm text-text-secondary-dark bg-background-dark px-3 py-2 rounded-theme">
      Premium Feature - Coming Soon
    </div>
  </div>
);

const CorpsRegistration = ({ userProfile }) => {
  const getUnlockRequirements = (className) => {
    const requirements = {
      'A Class': { xp: 500, description: 'Complete first season activities' },
      'Open Class': { xp: 2000, description: 'Demonstrate consistent engagement' },
      'World Class': { xp: 5000, description: 'Master competitive excellence' }
    };
    return requirements[className];
  };

  const isClassUnlocked = (className) => {
    return userProfile.unlockedClasses?.includes(className);
  };

  const getCurrentSeasonWeek = () => {
    const seasonStart = new Date('2025-06-01');
    const now = new Date();
    const weeksDiff = Math.ceil((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(10, weeksDiff));
  };

  const getRegistrationStatus = (className) => {
    const week = getCurrentSeasonWeek();
    const cutoffs = {
      'A Class': 6,
      'Open Class': 5,
      'World Class': 4
    };
    
    return week <= cutoffs[className] ? 'open' : 'closed';
  };

  const classes = [
    {
      name: 'SoundSport',
      description: 'Entry-level competition for all directors',
      pointLimit: 90,
      unlocked: true,
      color: 'blue'
    },
    {
      name: 'A Class',
      description: 'Competitive division for developing corps',
      pointLimit: 60,
      unlocked: isClassUnlocked('A Class'),
      color: 'green'
    },
    {
      name: 'Open Class',
      description: 'Advanced competition with elite scoring',
      pointLimit: 120,
      unlocked: isClassUnlocked('Open Class'),
      color: 'purple'
    },
    {
      name: 'World Class',
      description: 'Premier division for championship corps',
      pointLimit: 150,
      unlocked: isClassUnlocked('World Class'),
      color: 'gold'
    }
  ];

  const colorClasses = {
    blue: 'bg-blue-900 bg-opacity-20 border-blue-500',
    green: 'bg-green-900 bg-opacity-20 border-green-500',
    purple: 'bg-purple-900 bg-opacity-20 border-purple-500',
    gold: 'bg-yellow-900 bg-opacity-20 border-yellow-500'
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary-dark mb-2">Corps Registration</h2>
        <p className="text-text-secondary-dark">
          Register your corps for different class levels as you unlock them
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.map(cls => {
          const requirements = getUnlockRequirements(cls.name);
          const registrationStatus = getRegistrationStatus(cls.name);
          
          return (
            <div
              key={cls.name}
              className={`p-6 rounded-theme border-2 ${colorClasses[cls.color]} ${
                !cls.unlocked ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-text-primary-dark mb-1">
                    {cls.name}
                  </h3>
                  <p className="text-sm text-text-secondary-dark">
                    {cls.description}
                  </p>
                </div>
                {cls.unlocked ? (
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                ) : (
                  <Lock className="w-6 h-6 text-red-400 flex-shrink-0" />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary-dark">Point Limit:</span>
                  <span className="font-bold text-text-primary-dark">{cls.pointLimit}</span>
                </div>

                {!cls.unlocked && requirements && (
                  <div className="bg-background-dark rounded p-3">
                    <p className="text-xs text-text-secondary-dark mb-2">
                      Unlock Requirements:
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-primary-dark">
                        {requirements.xp} XP
                      </span>
                      <span className="text-xs text-text-secondary-dark">
                        Current: {userProfile.xp || 0} XP
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((userProfile.xp || 0) / requirements.xp) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {cls.unlocked && (
                  <div className="pt-3 border-t border-accent-dark">
                    {registrationStatus === 'open' ? (
                      <button className="w-full bg-primary hover:bg-primary-dark text-on-primary py-2 px-4 rounded-theme font-medium transition-colors">
                        Register for {cls.name}
                      </button>
                    ) : (
                      <div className="text-center text-sm text-red-400">
                        Registration closed for this season
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!currentUser || !profile) {
    return (
      <div className="text-center py-12">
        <div className="text-text-primary-dark text-xl">Please log in to view your dashboard.</div>
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
      id: 'registration', 
      label: 'Corps Registration', 
      icon: PlusCircle, 
      component: CorpsRegistration,
      description: 'Register for new seasons and classes'
    },
    { 
      id: 'uniforms', 
      label: 'Uniform Builder', 
      icon: Palette, 
      component: UniformBuilder,
      description: 'Design your corps uniforms'
    },
    { 
      id: 'analysis', 
      label: 'Score Analysis', 
      icon: BarChart3, 
      component: AnalysisTools,
      description: 'Analyze DCI scores and trends'
    }
  ];

  const getCurrentSeasonInfo = () => {
    const currentSeason = profile.activeSeasonId || '2025';
    const seasonStart = new Date('2025-06-01');
    const now = new Date();
    const weekNumber = Math.ceil((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return { currentSeason, weekNumber: Math.max(1, Math.min(10, weekNumber)) };
  };

  const { currentSeason, weekNumber } = getCurrentSeasonInfo();
  const ActiveComponent = dashboardTabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-dark to-accent-dark rounded-theme p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {profile.displayName || 'Director'}!
        </h1>
        <p className="text-lg opacity-90">
          {profile.corps?.corpsName} • {profile.corps?.corpsClass} • Week {weekNumber}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface-dark rounded-theme p-2 shadow-theme-dark">
        <div className="flex flex-wrap gap-2">
          {dashboardTabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-theme transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary shadow-lg'
                    : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-background-dark'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-dark p-4 rounded-theme">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary-dark text-sm">Current Score</p>
                  <p className="text-2xl font-bold text-text-primary-dark">
                    {profile.totalSeasonScore || 0}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-primary-dark" />
              </div>
            </div>
            
            <div className="bg-surface-dark p-4 rounded-theme">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary-dark text-sm">Staff Members</p>
                  <p className="text-2xl font-bold text-text-primary-dark">
                    {profile.activeStaffCount || 0}/8
                  </p>
                </div>
                <Award className="w-8 h-8 text-primary-dark" />
              </div>
            </div>
            
            <div className="bg-surface-dark p-4 rounded-theme">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary-dark text-sm">Season Rank</p>
                  <p className="text-2xl font-bold text-text-primary-dark">
                    {profile.seasonRank || '-'}
                  </p>
                </div>
                <Crown className="w-8 h-8 text-primary-dark" />
              </div>
            </div>
            
            <div className="bg-surface-dark p-4 rounded-theme">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary-dark text-sm">Shows Remaining</p>
                  <p className="text-2xl font-bold text-text-primary-dark">
                    {Math.max(0, 10 - weekNumber)}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-primary-dark" />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-dark p-6 rounded-theme">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('lineup')}
                className="flex items-center justify-between p-4 bg-background-dark rounded-theme hover:bg-accent-dark transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Users className="w-6 h-6 text-primary-dark" />
                  <div className="text-left">
                    <p className="font-medium text-text-primary-dark">Edit Lineup</p>
                    <p className="text-sm text-text-secondary-dark">Select captions</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary-dark" />
              </button>

              <button
                onClick={() => setActiveTab('shows')}
                className="flex items-center justify-between p-4 bg-background-dark rounded-theme hover:bg-accent-dark transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Calendar className="w-6 h-6 text-primary-dark" />
                  <div className="text-left">
                    <p className="font-medium text-text-primary-dark">Register for Shows</p>
                    <p className="text-sm text-text-secondary-dark">Join competitions</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary-dark" />
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className="flex items-center justify-between p-4 bg-background-dark rounded-theme hover:bg-accent-dark transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Award className="w-6 h-6 text-primary-dark" />
                  <div className="text-left">
                    <p className="font-medium text-text-primary-dark">Manage Staff</p>
                    <p className="text-sm text-text-secondary-dark">Hire legends</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary-dark" />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-dark p-6 rounded-theme">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-background-dark rounded">
                <Calendar className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-text-primary-dark">Season {currentSeason} in progress</p>
                  <p className="text-sm text-text-secondary-dark">Week {weekNumber} of 10</p>
                </div>
              </div>
              {profile.corps?.lastEdit && (
                <div className="flex items-center space-x-3 p-3 bg-background-dark rounded">
                  <Users className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-text-primary-dark">Lineup updated</p>
                    <p className="text-sm text-text-secondary-dark">
                      Last modified {new Date(profile.corps.lastEdit.seconds * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
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