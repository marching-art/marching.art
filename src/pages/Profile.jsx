// src/pages/Profile.jsx
// Dossier Layout: Left Fixed Identity Card + Right Flexible Tabbed Content
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User, Trophy, History, BarChart3, Star, TrendingUp, Calendar, Crown,
  DollarSign, AlertTriangle, RefreshCw, Zap, Flame, MapPin, Edit, Check, X
} from 'lucide-react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

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

  const handleStartEdit = () => {
    setEditData({
      displayName: profile?.displayName || '',
      location: profile?.location || '',
      bio: profile?.bio || '',
      favoriteCorps: profile?.favoriteCorps || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        displayName: editData.displayName,
        location: editData.location,
        bio: editData.bio,
        favoriteCorps: editData.favoriteCorps
      });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
    { id: 'stats', label: 'Analytics', icon: BarChart3 }
  ];

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-charcoal-900/50 border border-red-500/20 rounded-xl max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-cream-100 mb-2">Error Loading Profile</h2>
          <p className="text-cream-500/60 mb-6">{error?.message || 'Something went wrong. Please try again.'}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <User className="w-16 h-16 text-cream-500/30 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-cream-100 mb-2">Profile Not Found</h2>
          <p className="text-cream-500/60">This profile doesn't exist or hasn't been set up yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          DOSSIER LAYOUT: Fixed Identity Card + Tabbed Content
          ================================================================ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* ============================================================
            LEFT: Identity Card (Fixed on Desktop, Collapsible on Mobile)
            ============================================================ */}
        <div className="flex-shrink-0 lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-cream-500/10 bg-charcoal-950/50">
          <div className="p-4 lg:p-6 lg:sticky lg:top-0">
            {/* Avatar & Name */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-4">
                <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl bg-gradient-to-br from-gold-500/30 to-purple-500/30 border-2 border-gold-500/50 flex items-center justify-center">
                  {profile.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt={profile.displayName}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 lg:w-16 lg:h-16 text-gold-400" />
                  )}
                </div>
                {/* Level Badge */}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gold-500 border-2 border-charcoal-900 flex items-center justify-center">
                  <span className="text-sm font-mono font-black text-charcoal-900">
                    {profile.xpLevel || 1}
                  </span>
                </div>
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editData.displayName}
                  onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                  className="text-xl lg:text-2xl font-display font-bold text-center bg-charcoal-800 border border-cream-500/20 rounded-lg px-3 py-1 text-cream-100 focus:outline-none focus:border-gold-500"
                />
              ) : (
                <h1 className="text-xl lg:text-2xl font-display font-bold text-cream-100 mb-1">
                  {profile.displayName || 'Anonymous Director'}
                </h1>
              )}

              {isEditing ? (
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  placeholder="Location"
                  className="text-sm bg-charcoal-800 border border-cream-500/20 rounded-lg px-3 py-1 text-cream-400 focus:outline-none focus:border-gold-500 mt-2"
                />
              ) : profile.location && (
                <div className="flex items-center gap-1 text-sm text-cream-500/60">
                  <MapPin className="w-3 h-3" />
                  <span>{profile.location}</span>
                </div>
              )}

              {/* Edit/Save Buttons */}
              {isOwnProfile && (
                <div className="flex items-center gap-2 mt-4">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-sm font-bold hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {saving ? (
                          <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-charcoal-800 border border-cream-500/20 text-cream-400 rounded-lg text-sm font-bold hover:bg-charcoal-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-charcoal-800 border border-cream-500/20 text-cream-400 rounded-lg text-sm font-bold hover:bg-charcoal-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Profile
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* XP Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1 text-gold-400 font-bold">
                  <Zap className="w-3 h-3" />
                  Level {profile.xpLevel || 1}
                </span>
                <span className="text-cream-500/60">
                  {xpProgress.progress} / {xpProgress.needed} XP
                </span>
              </div>
              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-gold-500 to-amber-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress.percentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-orange-400 mb-1">
                  <Flame className="w-4 h-4" />
                  <span className="text-lg font-mono font-bold">{currentStreak}</span>
                </div>
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Day Streak</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-gold-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-lg font-mono font-bold">{(profile.corpsCoin || 0).toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">CorpsCoin</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
                  <Trophy className="w-4 h-4" />
                  <span className="text-lg font-mono font-bold">{profile.stats?.championships || 0}</span>
                </div>
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Championships</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-lg font-mono font-bold">{profile.stats?.seasonsPlayed || 0}</span>
                </div>
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Seasons</p>
              </div>
            </div>

            {/* Bio */}
            {isEditing ? (
              <textarea
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={3}
                className="w-full bg-charcoal-800 border border-cream-500/20 rounded-lg px-3 py-2 text-sm text-cream-300 focus:outline-none focus:border-gold-500 resize-none"
              />
            ) : profile.bio && (
              <div className="bg-charcoal-900/30 border border-cream-500/10 rounded-xl p-4">
                <p className="text-sm text-cream-400 italic">"{profile.bio}"</p>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================
            RIGHT: Tabbed Content Area
            ============================================================ */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tab Navigation */}
          <div className="flex-shrink-0 border-b border-cream-500/10 bg-charcoal-950/30">
            <div className="flex gap-1 p-2 overflow-x-auto hud-scroll">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-display font-bold text-sm uppercase tracking-wide transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-cream-500/60 hover:text-cream-300 hover:bg-charcoal-900/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="profileTab"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-gold-400 rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 lg:p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <OverviewTab profile={profile} milestones={milestones} />
                </motion.div>
              )}
              {activeTab === 'achievements' && (
                <motion.div
                  key="achievements"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <AchievementsTab profile={profile} milestones={milestones} />
                </motion.div>
              )}
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <HistoryTab profile={profile} seasonHistory={seasonHistory} />
                </motion.div>
              )}
              {activeTab === 'stats' && (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <StatsTab profile={profile} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
