import React, { useState, useEffect } from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import NewUserSetup from '../components/dashboard/NewUserSetup';
import StaffManagement from '../components/dashboard/StaffManagement';
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
    // Calculate current week based on season start (June 1st)
    const seasonStart = new Date('2025-06-01');
    const now = new Date();
    const weeksDiff = Math.ceil((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(10, weeksDiff));
  };

  const getRegistrationStatus = (className) => {
    const week = getCurrentSeasonWeek();
    const cutoffs = {
      'A Class': 6, // 4 weeks remaining
      'Open Class': 5, // 5 weeks remaining  
      'World Class': 4 // 6 weeks remaining
    };
    
    return week <= cutoffs[className] ? 'open' : 'closed';
  };

  const classes = ['SoundSport', 'A Class', 'Open Class', 'World Class'];

  return (
    <div className="space-y-4">
      <div className="bg-surface-dark p-6 rounded-theme">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-text-primary-dark">Corps Registration</h3>
          <div className="text-sm text-text-secondary-dark">
            Season 2025 • Week {getCurrentSeasonWeek()}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classes.map(className => {
            const unlocked = isClassUnlocked(className);
            const requirements = getUnlockRequirements(className);
            const registrationOpen = getRegistrationStatus(className) === 'open';
            const userXP = userProfile.xp || 0;

            return (
              <div key={className} className="bg-background-dark p-4 rounded-theme border border-accent-dark">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-text-primary-dark">{className}</h4>
                  <div className="flex items-center space-x-2">
                    {className === 'World Class' && <Crown className="w-4 h-4 text-purple-500" />}
                    {className === 'Open Class' && <Zap className="w-4 h-4 text-blue-500" />}
                    {className === 'A Class' && <Trophy className="w-4 h-4 text-green-500" />}
                    {className === 'SoundSport' && <Star className="w-4 h-4 text-orange-500" />}
                  </div>
                </div>

                {unlocked ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-400">✓ Unlocked</span>
                      <span className={registrationOpen ? 'text-green-400' : 'text-red-400'}>
                        {registrationOpen ? 'Registration Open' : 'Registration Closed'}
                      </span>
                    </div>
                    {registrationOpen && (
                      <button className="w-full bg-primary hover:bg-primary-dark text-on-primary py-2 px-4 rounded text-sm font-medium transition-colors">
                        Register for {className}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-text-secondary-dark">
                      Requires {requirements?.xp.toLocaleString()} XP
                    </div>
                    <div className="w-full bg-accent-dark rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (userXP / requirements?.xp) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-text-secondary-dark">
                      {userXP.toLocaleString()} / {requirements?.xp.toLocaleString()} XP
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AnalysisTools = ({ userProfile }) => (
  <div className="bg-surface-dark p-8 rounded-theme text-center">
    <BarChart3 className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary-dark mb-2">Score Analysis</h3>
    <p className="text-text-secondary-dark mb-4">Analyze DCI scores and performance trends</p>
    <div className="text-sm text-text-secondary-dark bg-background-dark px-3 py-2 rounded-theme">
      Premium Feature - Coming Soon
    </div>
  </div>
);

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, isLoading, fetchUserProfile } = useUserStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState([]);

  // Check for class unlocks when component mounts
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
        // Refresh profile to get updated class unlocks
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
  
  // Check if the user's corps name is still the default value
  const isNewUser = profile.corps?.corpsName === 'New Corps';

  const handleSetupComplete = () => {
    // Re-fetch the user profile to get the updated corps name
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

  const getHighestClass = () => {
    const classOrder = ['SoundSport', 'A Class', 'Open Class', 'World Class'];
    const unlockedClasses = profile.unlockedClasses || ['SoundSport'];
    return unlockedClasses.reduce((highest, current) => {
      return classOrder.indexOf(current) > classOrder.indexOf(highest) ? current : highest;
    });
  };

  const getSeasonProgress = () => {
    // Calculate season progress based on week
    const totalWeeks = 10;
    const progress = Math.min(100, (weekNumber / totalWeeks) * 100);
    return progress;
  };

  return (
    <div className="space-y-6">
      {/* Corps Header */}
      <div className="bg-gradient-to-r from-surface-dark to-background-dark p-6 rounded-theme shadow-theme-dark">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl font-bold text-text-primary-dark mb-2">
              {profile.corps.corpsName}
            </h1>
            <p className="text-text-secondary-dark mb-2">
              Directed by {profile.corps.alias} • Season {currentSeason}, Week {weekNumber}
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <Trophy className="w-4 h-4 text-primary-dark" />
                <span className="text-text-primary-dark">{getHighestClass()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-text-primary-dark">{profile.xp?.toLocaleString() || 0} XP</span>
              </div>
              <div className="flex items-center space-x-1">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="text-text-primary-dark">{profile.corpsCoin?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="text-right">
              <div className="text-sm text-text-secondary-dark">Season Progress</div>
              <div className="w-48 bg-accent-dark rounded-full h-2 mt-1">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getSeasonProgress()}%` }}
                />
              </div>
              <div className="text-xs text-text-secondary-dark mt-1">
                Week {weekNumber} of 10
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface-dark p-1 rounded-theme shadow-theme-dark">
        <div className="flex overflow-x-auto space-x-1">
          {dashboardTabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-theme transition-colors whitespace-nowrap ${
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
                    <p className="text-sm text-text-secondary-dark">Manage caption selections</p>
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
                    <p className="text-sm text-text-secondary-dark">Hire legendary instructors</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary-dark" />
              </button>

              <button
                onClick={() => setActiveTab('registration')}
                className="flex items-center justify-between p-4 bg-background-dark rounded-theme hover:bg-accent-dark transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <PlusCircle className="w-6 h-6 text-primary-dark" />
                  <div className="text-left">
                    <p className="font-medium text-text-primary-dark">Register Corps</p>
                    <p className="text-sm text-text-secondary-dark">Join competitions</p>
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
                  <p className="text-text-primary-dark">Season 2025 started</p>
                  <p className="text-sm text-text-secondary-dark">Welcome to the new competitive season!</p>
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