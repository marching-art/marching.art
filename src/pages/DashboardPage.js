import React, { useState, useEffect } from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import NewUserSetup from '../components/dashboard/NewUserSetup';
import StaffManagement from '../components/dashboard/StaffManagement';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';
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
  Crown,
  Zap,
  Target,
  Star,
  MapPin,
  Clock,
  Coins,
  ChevronRight,
  Play,
  RotateCcw
} from 'lucide-react';

// Enhanced Placeholder Components
const UniformBuilder = ({ userProfile }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Uniform Preview */}
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-text-primary-dark mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary-dark" />
          Uniform Preview
        </h3>
        <div className="flex justify-center mb-6">
          <div 
            className="w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl font-bold shadow-xl float-animation"
            style={{ 
              backgroundColor: userProfile?.uniforms?.primaryColor || '#8B4513',
              borderColor: userProfile?.uniforms?.secondaryColor || '#F7941D',
              color: userProfile?.uniforms?.textColor || '#FFFFFF'
            }}
          >
            {userProfile?.corps?.corpsName?.charAt(0) || 'C'}
          </div>
        </div>
        <div className="text-center">
          <h4 className="text-lg font-semibold text-text-primary-dark">{userProfile?.corps?.corpsName}</h4>
          <p className="text-text-secondary-dark">{userProfile?.corps?.alias}</p>
        </div>
      </div>

      {/* Color Customization */}
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Color Scheme</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary-dark mb-2">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" defaultValue="#8B4513" className="w-12 h-12 rounded-lg border-2 border-accent-dark/30" />
              <span className="text-text-primary-dark">#8B4513</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary-dark mb-2">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" defaultValue="#F7941D" className="w-12 h-12 rounded-lg border-2 border-accent-dark/30" />
              <span className="text-text-primary-dark">#F7941D</span>
            </div>
          </div>
          <button className="btn-primary w-full">
            Save Uniform
          </button>
        </div>
      </div>
    </div>
  </div>
);

const CorpsRegistration = ({ userProfile }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Registration Cards */}
      {[
        { class: 'SoundSport', points: 90, unlocked: true, color: 'from-orange-600 to-red-600', icon: '🎵' },
        { class: 'A Class', points: 60, unlocked: true, color: 'from-green-600 to-emerald-600', icon: '🥉' },
        { class: 'Open Class', points: 120, unlocked: userProfile?.level >= 5, color: 'from-blue-600 to-cyan-600', icon: '🥈' },
        { class: 'World Class', points: 150, unlocked: userProfile?.level >= 10, color: 'from-purple-600 to-pink-600', icon: '👑' }
      ].map((classInfo) => (
        <div key={classInfo.class} className={`card p-6 text-center ${classInfo.unlocked ? 'card-interactive' : 'opacity-50'}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${classInfo.color} flex items-center justify-center text-2xl`}>
            {classInfo.icon}
          </div>
          <h3 className="font-bold text-text-primary-dark mb-2">{classInfo.class}</h3>
          <p className="text-sm text-text-secondary-dark mb-3">{classInfo.points} points available</p>
          <button 
            className={`btn-primary w-full ${!classInfo.unlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!classInfo.unlocked}
          >
            {classInfo.unlocked ? 'Register' : `Level ${classInfo.class === 'Open Class' ? 5 : 10} Required`}
          </button>
        </div>
      ))}
    </div>

    {/* Season Information */}
    <div className="card p-6">
      <h3 className="text-xl font-semibold text-text-primary-dark mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary-dark" />
        Season 2025 Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-dark">Week 5</div>
          <div className="text-sm text-text-secondary-dark">Current Week</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-dark">45</div>
          <div className="text-sm text-text-secondary-dark">Days Remaining</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-dark">Finals</div>
          <div className="text-sm text-text-secondary-dark">Aug 9, 2025</div>
        </div>
      </div>
    </div>
  </div>
);

const AnalysisTools = ({ userProfile }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Score Trends */}
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-text-primary-dark mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-dark" />
          Performance Trends
        </h3>
        <div className="space-y-4">
          <div className="bg-background-dark/30 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-text-secondary-dark">General Effect</span>
              <span className="text-sm font-bold text-primary-dark">18.5</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '85%' }}></div>
            </div>
          </div>
          <div className="bg-background-dark/30 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-text-secondary-dark">Visual</span>
              <span className="text-sm font-bold text-primary-dark">25.2</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '78%' }}></div>
            </div>
          </div>
          <div className="bg-background-dark/30 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-text-secondary-dark">Music</span>
              <span className="text-sm font-bold text-primary-dark">24.8</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '82%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Comparison */}
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-text-primary-dark mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-dark" />
          Historical Analysis
        </h3>
        <div className="text-center py-8">
          <Target className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
          <p className="text-text-secondary-dark mb-4">Advanced analytics tools for performance optimization</p>
          <button className="btn-secondary">
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  </div>
);

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, isLoading, fetchUserProfile } = useUserStore();
  const [activeTab, setActiveTab] = useState('lineup');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-text-secondary-dark">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !profile) {
    return (
      <div className="card p-12 text-center">
        <Crown className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h2 className="text-2xl font-bold text-text-primary-dark mb-2">Welcome to marching.art</h2>
        <p className="text-text-secondary-dark">Please log in to access your dashboard and begin your fantasy drum corps journey.</p>
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
      id: 'lineup', 
      label: 'Caption Selection', 
      icon: Users, 
      component: LineupEditor,
      description: 'Select corps for each caption to build your competitive lineup'
    },
    { 
      id: 'registration', 
      label: 'Corps Registration', 
      icon: PlusCircle, 
      component: CorpsRegistration,
      description: 'Register for new seasons and unlock higher competition classes'
    },
    { 
      id: 'staff', 
      label: 'Staff Management', 
      icon: Award, 
      component: StaffManagement,
      description: 'Hire and manage Hall of Fame staff members to boost performance'
    },
    { 
      id: 'uniforms', 
      label: 'Uniform Builder', 
      icon: Palette, 
      component: UniformBuilder,
      description: 'Design your corps uniforms and color schemes'
    },
    { 
      id: 'analysis', 
      label: 'Score Analysis', 
      icon: BarChart3, 
      component: AnalysisTools,
      description: 'Analyze DCI scores and performance trends to optimize strategy'
    }
  ];

  const getCurrentSeasonInfo = () => {
    const currentSeason = profile.activeSeasonId || '2025';
    const weekNumber = Math.ceil((new Date() - new Date('2025-06-01')) / (7 * 24 * 60 * 60 * 1000));
    return { currentSeason, weekNumber: Math.max(1, Math.min(10, weekNumber)) };
  };

  const { currentSeason, weekNumber } = getCurrentSeasonInfo();
  const ActiveComponent = dashboardTabs.find(tab => tab.id === activeTab)?.component || LineupEditor;

  const getClassIcon = (className) => {
    switch(className) {
      case 'World Class': return <Crown className="w-5 h-5 text-purple-500" />;
      case 'Open Class': return <Zap className="w-5 h-5 text-blue-500" />;
      case 'A Class': return <Trophy className="w-5 h-5 text-green-500" />;
      default: return <Star className="w-5 h-5 text-orange-500" />;
    }
  };

  const getClassBadge = (className) => {
    const badges = {
      'World Class': 'class-world',
      'Open Class': 'class-open', 
      'A Class': 'class-a',
      'SoundSport': 'class-soundsport'
    };
    return badges[className] || 'class-soundsport';
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Corps Header */}
      <div className="card-glow p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Corps Visual & Info */}
          <div className="flex items-center gap-6">
            <div 
              className="w-20 h-20 lg:w-24 lg:h-24 rounded-full border-4 flex items-center justify-center text-2xl lg:text-3xl font-bold shadow-xl float-animation"
              style={{ 
                backgroundColor: profile?.uniforms?.primaryColor || '#8B4513',
                borderColor: profile?.uniforms?.secondaryColor || '#F7941D',
                color: profile?.uniforms?.textColor || '#FFFFFF'
              }}
            >
              {profile?.corps?.corpsName?.charAt(0) || 'C'}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gradient-primary">{profile.corps?.corpsName}</h1>
                <div className={getClassBadge(profile.corps?.class)}>
                  {profile.corps?.class}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-text-secondary-dark">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location || 'Location not set'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Season {currentSeason} • Week {weekNumber}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {profile.corps?.showConcept && (
                <div className="mt-3">
                  <p className="text-text-primary-dark italic">"{profile.corps.showConcept}"</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Enhanced Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:min-w-80">
            <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-4 rounded-xl text-center">
              <Coins className="w-6 h-6 mx-auto text-primary-dark mb-2" />
              <div className="text-2xl font-bold text-primary-dark">{profile.corpsCoin || 0}</div>
              <div className="text-xs text-text-secondary-dark">CorpsCoin</div>
            </div>
            <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 p-4 rounded-xl text-center">
              <Zap className="w-6 h-6 mx-auto text-secondary-dark mb-2" />
              <div className="text-2xl font-bold text-secondary-dark">{profile.xp || 0}</div>
              <div className="text-xs text-text-secondary-dark">Experience</div>
            </div>
            <div className="bg-gradient-to-br from-accent/30 to-accent/20 p-4 rounded-xl text-center">
              <Award className="w-6 h-6 mx-auto text-accent mb-2" />
              <div className="text-2xl font-bold text-text-primary-dark">{profile.staff?.length || 0}</div>
              <div className="text-xs text-text-secondary-dark">Staff</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/10 p-4 rounded-xl text-center">
              <Users className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold text-purple-500">{profile.leagues?.length || 0}</div>
              <div className="text-xs text-text-secondary-dark">Leagues</div>
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        {profile.corps?.lastScore && (
          <div className="mt-6 pt-6 border-t border-accent-dark/20">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="score-display">{profile.corps.lastScore.toFixed(3)}</div>
                <div className="text-sm text-text-secondary-dark">Latest Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-text-primary-dark">#{profile.corps.seasonRank || '--'}</div>
                <div className="text-sm text-text-secondary-dark">Season Rank</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">+{(Math.random() * 2).toFixed(3)}</div>
                <div className="text-sm text-text-secondary-dark">Weekly Gain</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{Math.floor(Math.random() * 5) + 3}</div>
                <div className="text-sm text-text-secondary-dark">Shows Left</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2">
          {dashboardTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-200 flex-1 min-w-0 group ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary shadow-xl glow-primary scale-102'
                  : 'text-text-secondary-dark hover:bg-accent-dark/20 hover:text-text-primary-dark hover:scale-102'
              }`}
            >
              <tab.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
              {activeTab === tab.id && <ChevronRight className="w-4 h-4 ml-auto animate-pulse" />}
            </button>
          ))}
        </div>
      </div>

      {/* Active Tab Description */}
      <div className="text-center">
        <p className="text-text-secondary-dark">
          {dashboardTabs.find(tab => tab.id === activeTab)?.description}
        </p>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        <ActiveComponent userProfile={profile} />
      </div>

      {/* Enhanced Quick Actions Footer */}
      <div className="card p-6">
        <h3 className="font-semibold text-text-primary-dark mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary-dark" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => window.location.href = '/schedule'}
            className="btn-ghost flex items-center justify-center gap-2 h-16 group"
          >
            <Calendar className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>View Schedule</span>
          </button>
          
          <button
            onClick={() => window.location.href = '/scores'}
            className="btn-ghost flex items-center justify-center gap-2 h-16 group"
          >
            <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Latest Scores</span>
          </button>
          
          <button
            onClick={() => window.location.href = '/leaderboard'}
            className="btn-ghost flex items-center justify-center gap-2 h-16 group"
          >
            <Trophy className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Leaderboard</span>
          </button>
          
          <button
            onClick={() => window.location.href = '/leagues'}
            className="btn-ghost flex items-center justify-center gap-2 h-16 group"
          >
            <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>My Leagues</span>
          </button>
        </div>
      </div>

      {/* Season Progress Indicator */}import React, { useState, useEffect } from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import NewUserSetup from '../components/dashboard/NewUserSetup';
import StaffManagement from '../components/dashboard/StaffManagement';
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
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
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
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary-dark flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-dark" />
            Season Progress
          </h3>
          <span className="text-sm text-text-secondary-dark">Week {weekNumber} of 10</span>
        </div>
        <div className="progress-bar mb-4">
          <div className="progress-fill" style={{ width: `${(weekNumber / 10) * 100}%` }}></div>
        </div>
        <div className="flex justify-between text-sm text-text-secondary-dark">
          <span>Season Start</span>
          <span>Championships</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;