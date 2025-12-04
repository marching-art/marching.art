// src/pages/Profile.jsx
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { User, Trophy, History, BarChart3, Star, TrendingUp, Calendar, Crown, DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../App';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';

// Import modular Profile components
import { ProfileHeader, OverviewTab, AchievementsTab, HistoryTab, StatsTab } from '../components/Profile';

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);

  const isOwnProfile = !userId || userId === user?.uid;
  const profileUserId = userId || user?.uid;

  // React Query hooks
  const { data: profile, isLoading: loading, error, isError, refetch } = useProfile(profileUserId);
  const updateProfileMutation = useUpdateProfile(profileUserId || '');

  // Calculate streak data
  const currentStreak = useMemo(() => {
    if (!profile?.lastRehearsal) return 0;
    const lastRehearsal = profile.lastRehearsal?.toDate?.() || new Date(profile.lastRehearsal);
    const now = new Date();
    const diffHours = (now - lastRehearsal) / (1000 * 60 * 60);
    if (diffHours > 48) return 0;
    return profile.currentStreak || 1;
  }, [profile]);

  // Calculate XP progress to next level
  const xpProgress = useMemo(() => {
    if (!profile) return { progress: 0, needed: 1000, percentage: 0 };
    const currentXP = profile.xp || 0;
    const currentLevel = profile.xpLevel || 1;
    const xpForCurrentLevel = (currentLevel - 1) * 1000;
    const xpForNextLevel = currentLevel * 1000;
    const progress = currentXP - xpForCurrentLevel;
    const needed = xpForNextLevel - xpForCurrentLevel;
    return { progress, needed, percentage: Math.min((progress / needed) * 100, 100) };
  }, [profile]);

  // Get season history from corps
  const seasonHistory = useMemo(() => {
    if (!profile?.corps) return [];
    const history = [];
    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          history.push({
            ...season,
            corpsName: corps.name,
            classKey
          });
        });
      }
    });
    return history.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0)).slice(0, 10);
  }, [profile]);

  // Define milestone achievements
  const milestones = useMemo(() => {
    if (!profile) return [];
    return [
      { name: 'First Steps', description: 'Reach Level 2', requirement: 2, current: profile.xpLevel || 1, type: 'level', icon: Star },
      { name: 'Rising Director', description: 'Reach Level 5', requirement: 5, current: profile.xpLevel || 1, type: 'level', icon: TrendingUp },
      { name: 'Veteran Director', description: 'Reach Level 10', requirement: 10, current: profile.xpLevel || 1, type: 'level', icon: Crown },
      { name: 'Season Starter', description: 'Complete 1 season', requirement: 1, current: profile.stats?.seasonsPlayed || 0, type: 'seasons', icon: Calendar },
      { name: 'Season Regular', description: 'Complete 5 seasons', requirement: 5, current: profile.stats?.seasonsPlayed || 0, type: 'seasons', icon: Calendar },
      { name: 'First Victory', description: 'Win a championship', requirement: 1, current: profile.stats?.championships || 0, type: 'championships', icon: Trophy },
      { name: 'Dynasty Builder', description: 'Win 3 championships', requirement: 3, current: profile.stats?.championships || 0, type: 'championships', icon: Crown },
      { name: 'Coin Collector', description: 'Earn 1,000 CorpsCoin', requirement: 1000, current: profile.corpsCoin || 0, type: 'corpsCoin', icon: DollarSign },
    ];
  }, [profile]);

  const handleSave = async (editData) => {
    setSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        displayName: editData.displayName,
        location: editData.location,
        bio: editData.bio,
        favoriteCorps: editData.favoriteCorps
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (isError) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-cream-100 mb-2">Error Loading Profile</h2>
        <p className="text-slate-500 dark:text-cream-400 mb-6">{error?.message || 'Something went wrong. Please try again.'}</p>
        <button
          onClick={() => refetch()}
          className="btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <User className="w-16 h-16 text-slate-400 dark:text-cream-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-cream-100 mb-2">Profile Not Found</h2>
        <p className="text-slate-500 dark:text-cream-400">This profile doesn't exist or hasn't been set up yet.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
    { id: 'stats', label: 'Analytics', icon: BarChart3 }
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 lg:gap-5">
      {/* Header - Compact on desktop */}
      <div className="flex-shrink-0">
        <ProfileHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          onSave={handleSave}
          saving={saving}
          xpProgress={xpProgress}
          currentStreak={currentStreak}
        />
      </div>

      {/* Tab Navigation - Compact */}
      <div className="flex-shrink-0 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm ${
                activeTab === tab.id
                  ? 'bg-primary text-text-inverse'
                  : 'bg-stone-200 dark:bg-charcoal-800 text-slate-700 dark:text-cream-300 hover:bg-stone-300 dark:hover:bg-charcoal-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content - Fills remaining space with internal scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto hud-scroll">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab profile={profile} milestones={milestones} />
          )}
          {activeTab === 'achievements' && (
            <AchievementsTab profile={profile} milestones={milestones} />
          )}
          {activeTab === 'history' && (
            <HistoryTab profile={profile} seasonHistory={seasonHistory} />
          )}
          {activeTab === 'stats' && (
            <StatsTab profile={profile} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Profile;
