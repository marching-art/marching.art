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

      {/* Season Progress Indicator */}
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