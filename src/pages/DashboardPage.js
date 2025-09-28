import React, { useState } from 'react';
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
  Award
} from 'lucide-react';

// Placeholder components for missing features
const UniformBuilder = ({ userProfile }) => (
  <div className="bg-surface-dark p-8 rounded-theme text-center">
    <Palette className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary-dark mb-2">Uniform Builder</h3>
    <p className="text-text-secondary-dark mb-4">Design your corps uniforms and color schemes</p>
    <div className="text-sm text-text-secondary-dark">Coming Soon</div>
  </div>
);

const CorpsRegistration = ({ userProfile }) => (
  <div className="bg-surface-dark p-8 rounded-theme text-center">
    <PlusCircle className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary-dark mb-2">Corps Registration</h3>
    <p className="text-text-secondary-dark mb-4">Register for new seasons and unlock class tiers</p>
    <div className="text-sm text-text-secondary-dark">Coming Soon</div>
  </div>
);

const AnalysisTools = ({ userProfile }) => (
  <div className="bg-surface-dark p-8 rounded-theme text-center">
    <BarChart3 className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
    <h3 className="text-xl font-medium text-text-primary-dark mb-2">Score Analysis</h3>
    <p className="text-text-secondary-dark mb-4">Analyze DCI scores and performance trends</p>
    <div className="text-sm text-text-secondary-dark">Coming Soon</div>
  </div>
);

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, isLoading, fetchUserProfile } = useUserStore();
  const [activeTab, setActiveTab] = useState('lineup');

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
  
  // Check if the user's corps name is still the default value.
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
      id: 'lineup', 
      label: 'Caption Selection', 
      icon: Users, 
      component: LineupEditor,
      description: 'Select corps for each caption'
    },
    { 
      id: 'registration', 
      label: 'Corps Registration', 
      icon: PlusCircle, 
      component: CorpsRegistration,
      description: 'Register for new seasons and classes'
    },
    { 
      id: 'staff', 
      label: 'Staff Management', 
      icon: Award, 
      component: StaffManagement,
      description: 'Hire and manage staff members'
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
    const weekNumber = Math.ceil((new Date() - new Date('2025-06-01')) / (7 * 24 * 60 * 60 * 1000));
    return { currentSeason, weekNumber: Math.max(1, Math.min(10, weekNumber)) };
  };

  const { currentSeason, weekNumber } = getCurrentSeasonInfo();
  const ActiveComponent = dashboardTabs.find(tab => tab.id === activeTab)?.component || LineupEditor;

  return (
    <div className="space-y-6">
      {/* Corps Header */}
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {/* Corps Color Indicator */}
            <div 
              className="w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl font-bold"
              style={{ 
                backgroundColor: profile.uniforms?.primaryColor || '#8B4513',
                borderColor: profile.uniforms?.secondaryColor || '#F7941D',
                color: profile.uniforms?.textColor || '#FFFFFF'
              }}
            >
              {profile.corps.corpsName.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary-dark">{profile.corps.corpsName}</h1>
              <p className="text-text-secondary-dark text-lg">
                {profile.corps.alias} • {profile.corps.class || 'SoundSport'} • {currentSeason} Season
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary-dark">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Week {weekNumber} of 10</span>
                </div>
                {profile.corps.lastScore && (
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>Last Score: {profile.corps.lastScore.toFixed(3)}</span>
                  </div>
                )}
                {profile.corps.seasonRank && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>Season Rank: #{profile.corps.seasonRank}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-background-dark p-3 rounded-theme">
              <div className="text-2xl font-bold text-primary-dark">{profile.corpsCoin || 0}</div>
              <div className="text-xs text-text-secondary-dark">CorpsCoin</div>
            </div>
            <div className="bg-background-dark p-3 rounded-theme">
              <div className="text-2xl font-bold text-primary-dark">{profile.xp || 0}</div>
              <div className="text-xs text-text-secondary-dark">Experience</div>
            </div>
            <div className="bg-background-dark p-3 rounded-theme">
              <div className="text-2xl font-bold text-primary-dark">{profile.staff?.length || 0}</div>
              <div className="text-xs text-text-secondary-dark">Staff</div>
            </div>
            <div className="bg-background-dark p-3 rounded-theme">
              <div className="text-2xl font-bold text-primary-dark">{profile.leagues?.length || 0}</div>
              <div className="text-xs text-text-secondary-dark">Leagues</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-surface-dark rounded-theme p-2 shadow-theme-dark">
        <div className="flex flex-wrap gap-2">
          {dashboardTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-theme font-medium transition-colors flex-1 min-w-0 ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary shadow-lg'
                  : 'text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
              }`}
            >
              <tab.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
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

      {/* Quick Actions Footer */}
      <div className="bg-surface-dark rounded-theme p-4 shadow-theme-dark">
        <h3 className="font-semibold text-text-primary-dark mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <button
            onClick={() => window.location.href = '/schedule'}
            className="flex items-center gap-2 p-3 bg-background-dark hover:bg-accent-dark rounded-theme transition-colors text-left"
          >
            <Calendar className="w-5 h-5 text-primary-dark" />
            <div>
              <div className="font-medium text-text-primary-dark">View Schedule</div>
              <div className="text-sm text-text-secondary-dark">Upcoming shows</div>
            </div>
          </button>
          
          <button
            onClick={() => window.location.href = '/leaderboard'}
            className="flex items-center gap-2 p-3 bg-background-dark hover:bg-accent-dark rounded-theme transition-colors text-left"
          >
            <Trophy className="w-5 h-5 text-primary-dark" />
            <div>
              <div className="font-medium text-text-primary-dark">Leaderboard</div>
              <div className="text-sm text-text-secondary-dark">Current rankings</div>
            </div>
          </button>
          
          <button
            onClick={() => window.location.href = '/leagues'}
            className="flex items-center gap-2 p-3 bg-background-dark hover:bg-accent-dark rounded-theme transition-colors text-left"
          >
            <Users className="w-5 h-5 text-primary-dark" />
            <div>
              <div className="font-medium text-text-primary-dark">Join League</div>
              <div className="text-sm text-text-secondary-dark">Compete with friends</div>
            </div>
          </button>
          
          <button
            onClick={() => window.location.href = '/scores'}
            className="flex items-center gap-2 p-3 bg-background-dark hover:bg-accent-dark rounded-theme transition-colors text-left"
          >
            <BarChart3 className="w-5 h-5 text-primary-dark" />
            <div>
              <div className="font-medium text-text-primary-dark">Latest Scores</div>
              <div className="text-sm text-text-secondary-dark">Competition results</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;