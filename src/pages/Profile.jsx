// src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, MapPin, Edit, Save, X, Trophy, Star, Award,
  Calendar, TrendingUp, DollarSign, Users, Target, Heart,
  Flame, Clock, Medal, Crown, History, ChevronRight,
  BarChart3, Zap, Gift, Lock, CheckCircle, Circle
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editData, setEditData] = useState({
    displayName: '',
    location: '',
    bio: '',
    favoriteCorps: ''
  });

  const isOwnProfile = !userId || userId === user?.uid;
  const profileUserId = userId || user?.uid;

  // Load profile data
  useEffect(() => {
    if (!profileUserId) {
      setLoading(false);
      return;
    }

    const profileRef = doc(db, `artifacts/marching-art/users/${profileUserId}/profile/data`);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setProfile(data);
        setEditData({
          displayName: data.displayName || '',
          location: data.location || '',
          bio: data.bio || '',
          favoriteCorps: data.favoriteCorps || ''
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profileUserId]);

  const handleEdit = () => {
    setEditData({
      displayName: profile.displayName || '',
      location: profile.location || '',
      bio: profile.bio || '',
      favoriteCorps: profile.favoriteCorps || ''
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditData({
      displayName: profile.displayName || '',
      location: profile.location || '',
      bio: profile.bio || '',
      favoriteCorps: profile.favoriteCorps || ''
    });
  };

  const handleSave = async () => {
    if (!editData.displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const functions = getFunctions();
      const updateProfile = httpsCallable(functions, 'updateProfile');

      await updateProfile({
        displayName: editData.displayName,
        location: editData.location,
        bio: editData.bio,
        favoriteCorps: editData.favoriteCorps
      });

      toast.success('Profile updated successfully!');
      setEditing(false);
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

  if (!profile) {
    return (
      <div className="text-center py-20">
        <User className="w-16 h-16 text-cream-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-cream-100 mb-2">Profile Not Found</h2>
        <p className="text-cream-400">This profile doesn't exist or hasn't been set up yet.</p>
      </div>
    );
  }

  // Calculate streak data
  const calculateStreak = () => {
    if (!profile.lastRehearsal) return 0;
    const lastRehearsal = profile.lastRehearsal?.toDate?.() || new Date(profile.lastRehearsal);
    const now = new Date();
    const diffHours = (now - lastRehearsal) / (1000 * 60 * 60);
    if (diffHours > 48) return 0;
    return profile.currentStreak || 1;
  };

  // Calculate XP progress to next level
  const calculateXPProgress = () => {
    const currentXP = profile.xp || 0;
    const currentLevel = profile.xpLevel || 1;
    const xpForCurrentLevel = (currentLevel - 1) * 1000;
    const xpForNextLevel = currentLevel * 1000;
    const progress = currentXP - xpForCurrentLevel;
    const needed = xpForNextLevel - xpForCurrentLevel;
    return { progress, needed, percentage: Math.min((progress / needed) * 100, 100) };
  };

  // Get season history from corps
  const getSeasonHistory = () => {
    const history = [];
    if (profile.corps) {
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
    }
    return history.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0)).slice(0, 10);
  };

  // Define milestone achievements
  const milestones = [
    { name: 'First Steps', description: 'Reach Level 2', requirement: 2, current: profile.xpLevel || 1, type: 'level', icon: Star },
    { name: 'Rising Director', description: 'Reach Level 5', requirement: 5, current: profile.xpLevel || 1, type: 'level', icon: TrendingUp },
    { name: 'Veteran Director', description: 'Reach Level 10', requirement: 10, current: profile.xpLevel || 1, type: 'level', icon: Crown },
    { name: 'Season Starter', description: 'Complete 1 season', requirement: 1, current: profile.stats?.seasonsPlayed || 0, type: 'seasons', icon: Calendar },
    { name: 'Season Regular', description: 'Complete 5 seasons', requirement: 5, current: profile.stats?.seasonsPlayed || 0, type: 'seasons', icon: Calendar },
    { name: 'First Victory', description: 'Win a championship', requirement: 1, current: profile.stats?.championships || 0, type: 'championships', icon: Trophy },
    { name: 'Dynasty Builder', description: 'Win 3 championships', requirement: 3, current: profile.stats?.championships || 0, type: 'championships', icon: Crown },
    { name: 'Coin Collector', description: 'Earn 1,000 CorpsCoin', requirement: 1000, current: profile.corpsCoin || 0, type: 'corpsCoin', icon: DollarSign },
  ];

  const stats = [
    {
      label: 'Level',
      value: profile.xpLevel || 1,
      icon: Star,
      color: 'gold'
    },
    {
      label: 'XP',
      value: profile.xp || 0,
      icon: TrendingUp,
      color: 'blue'
    },
    {
      label: 'CorpsCoin',
      value: profile.corpsCoin || 0,
      icon: DollarSign,
      color: 'green'
    },
    {
      label: 'Seasons',
      value: profile.stats?.seasonsPlayed || 0,
      icon: Calendar,
      color: 'purple'
    }
  ];

  const colorClasses = {
    gold: 'bg-gold-500/20 text-gold-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
    orange: 'bg-orange-500/20 text-orange-400'
  };

  const xpProgress = calculateXPProgress();
  const currentStreak = calculateStreak();
  const seasonHistory = getSeasonHistory();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
    { id: 'stats', label: 'Analytics', icon: BarChart3 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-gold rounded-2xl flex items-center justify-center flex-shrink-0 relative">
            <User className="w-10 h-10 sm:w-12 sm:h-12 text-charcoal-900" />
            {/* Level Badge */}
            <div className="absolute -bottom-2 -right-2 bg-gold-500 text-charcoal-900 text-xs font-bold px-2 py-1 rounded-full">
              Lv.{profile.xpLevel || 1}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left w-full">
            {!editing ? (
              <>
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-gradient">
                    {profile.displayName || 'Unknown Director'}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={handleEdit}
                      className="p-2 text-cream-300 hover:text-gold-400 hover:bg-charcoal-700 rounded-lg transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {profile.location && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-cream-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}

                {profile.favoriteCorps && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-cream-400 mb-3">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span>Favorite Corps: {profile.favoriteCorps}</span>
                  </div>
                )}

                {profile.bio && (
                  <p className="text-cream-300 mt-4">{profile.bio}</p>
                )}

                {/* XP Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-cream-400">Level {profile.xpLevel || 1}</span>
                    <span className="text-cream-400">{xpProgress.progress.toLocaleString()} / {xpProgress.needed.toLocaleString()} XP</span>
                  </div>
                  <div className="w-full bg-charcoal-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${xpProgress.percentage}%` }}
                      className="bg-gradient-to-r from-gold-500 to-gold-400 h-2 rounded-full"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Director Name *</label>
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="input"
                    maxLength={50}
                    placeholder="Your director name"
                  />
                </div>

                <div>
                  <label className="label">Location</label>
                  <input
                    type="text"
                    value={editData.location}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    className="input"
                    maxLength={100}
                    placeholder="e.g., Indianapolis, IN"
                  />
                </div>

                <div>
                  <label className="label">Favorite Corps</label>
                  <input
                    type="text"
                    value={editData.favoriteCorps}
                    onChange={(e) => setEditData({ ...editData, favoriteCorps: e.target.value })}
                    className="input"
                    maxLength={100}
                    placeholder="e.g., Blue Devils"
                  />
                </div>

                <div>
                  <label className="label">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="textarea"
                    rows="4"
                    maxLength={500}
                    placeholder="Tell the community about yourself..."
                  />
                  <p className="text-xs text-cream-400 mt-1">
                    {editData.bio.length}/500 characters
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="btn-outline flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats with Streak */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[stat.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-cream-400 text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold text-cream-100">{stat.value.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Streak Display */}
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentStreak > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-charcoal-600/50 text-charcoal-400'}`}>
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-cream-400 text-sm">Streak</p>
                <p className="text-2xl font-bold text-cream-100">{currentStreak}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gold-500 text-charcoal-900'
                  : 'bg-charcoal-800 text-cream-300 hover:bg-charcoal-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Active Corps */}
            {profile.corps && Object.keys(profile.corps).length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-400" />
                  Active Corps
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(profile.corps).map(([classKey, corps]) => (
                    <div key={classKey} className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 hover:border-gold-500/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs text-cream-400 uppercase tracking-wide">{classKey}</p>
                          <h3 className="font-bold text-cream-100 text-lg">{corps.name || 'Unnamed Corps'}</h3>
                        </div>
                        {corps.totalSeasonScore !== undefined && (
                          <div className="text-right">
                            <p className="text-xs text-cream-400">Score</p>
                            <p className="text-xl font-bold text-gold-400">{corps.totalSeasonScore.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                      {corps.location && (
                        <p className="text-sm text-cream-400">{corps.location}</p>
                      )}
                      {/* Shows Completed */}
                      {corps.selectedShows && (
                        <div className="mt-3 pt-3 border-t border-charcoal-700">
                          <p className="text-xs text-cream-400">
                            Shows: {Object.keys(corps.selectedShows).length} selected
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Career Stats */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-green-400" />
                Career Stats
              </h2>
              <div className="grid grid-cols-3 gap-3 md:gap-6">
                <div className="text-center">
                  <p className="text-2xl md:text-4xl font-bold text-gold-400 mb-1 md:mb-2">{profile.stats?.championships || 0}</p>
                  <p className="text-cream-400 text-xs md:text-base">Championships</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl md:text-4xl font-bold text-blue-400 mb-1 md:mb-2">{profile.stats?.topTenFinishes || 0}</p>
                  <p className="text-cream-400 text-xs md:text-base">Top 10</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl md:text-4xl font-bold text-purple-400 mb-1 md:mb-2">{profile.stats?.seasonsPlayed || 0}</p>
                  <p className="text-cream-400 text-xs md:text-base">Seasons</p>
                </div>
              </div>
            </div>

            {/* Milestone Progress */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-400" />
                Milestone Progress
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {milestones.slice(0, 6).map((milestone, idx) => {
                  const Icon = milestone.icon;
                  const isComplete = milestone.current >= milestone.requirement;
                  const progress = Math.min((milestone.current / milestone.requirement) * 100, 100);

                  return (
                    <div
                      key={idx}
                      className={`bg-charcoal-800/50 border rounded-lg p-3 ${
                        isComplete ? 'border-gold-500/50' : 'border-charcoal-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isComplete ? 'bg-gold-500/20 text-gold-400' : 'bg-charcoal-700 text-cream-400'
                        }`}>
                          {isComplete ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isComplete ? 'text-gold-400' : 'text-cream-100'}`}>
                            {milestone.name}
                          </p>
                          <p className="text-xs text-cream-400">{milestone.description}</p>
                        </div>
                      </div>
                      <div className="w-full bg-charcoal-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${isComplete ? 'bg-gold-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-cream-400 mt-1 text-right">
                        {milestone.current} / {milestone.requirement}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Earned Achievements */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-gold-400" />
                Earned Achievements ({profile.achievements?.length || 0})
              </h2>
              {profile.achievements && profile.achievements.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {profile.achievements.map((achievement, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-3 md:p-4"
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <Trophy className="w-4 h-4 md:w-5 md:h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-cream-100 text-sm md:text-base">{achievement.name}</p>
                          <p className="text-xs md:text-sm text-cream-400 mt-1">{achievement.description}</p>
                          {achievement.unlockedAt && (
                            <p className="text-xs text-cream-500 mt-2">
                              {new Date(achievement.unlockedAt?.toDate?.() || achievement.unlockedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-charcoal-600 mx-auto mb-3" />
                  <p className="text-cream-400">No achievements earned yet</p>
                  <p className="text-sm text-cream-500 mt-1">Keep playing to unlock achievements!</p>
                </div>
              )}
            </div>

            {/* Trophy Case */}
            {profile.trophies && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Crown className="w-6 h-6 text-gold-400" />
                  Trophy Case
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-4 text-center">
                    <Trophy className="w-10 h-10 text-gold-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gold-400">{profile.trophies.championships?.length || 0}</p>
                    <p className="text-cream-400 text-sm">Championships</p>
                  </div>
                  <div className="bg-charcoal-800/50 border border-blue-500/30 rounded-lg p-4 text-center">
                    <Medal className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-400">{profile.trophies.regionals?.length || 0}</p>
                    <p className="text-cream-400 text-sm">Regional Wins</p>
                  </div>
                  <div className="bg-charcoal-800/50 border border-purple-500/30 rounded-lg p-4 text-center">
                    <Star className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{profile.trophies.finalistMedals?.length || 0}</p>
                    <p className="text-cream-400 text-sm">Finalist Medals</p>
                  </div>
                </div>
              </div>
            )}

            {/* All Milestones */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-400" />
                All Milestones
              </h2>
              <div className="space-y-3">
                {milestones.map((milestone, idx) => {
                  const Icon = milestone.icon;
                  const isComplete = milestone.current >= milestone.requirement;
                  const progress = Math.min((milestone.current / milestone.requirement) * 100, 100);

                  return (
                    <div
                      key={idx}
                      className={`bg-charcoal-800/50 border rounded-lg p-4 ${
                        isComplete ? 'border-gold-500/50' : 'border-charcoal-700'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isComplete ? 'bg-gold-500/20 text-gold-400' : 'bg-charcoal-700 text-cream-400'
                        }`}>
                          {isComplete ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`font-semibold ${isComplete ? 'text-gold-400' : 'text-cream-100'}`}>
                              {milestone.name}
                            </p>
                            <p className="text-sm text-cream-400">
                              {milestone.current} / {milestone.requirement}
                            </p>
                          </div>
                          <p className="text-sm text-cream-400 mb-2">{milestone.description}</p>
                          <div className="w-full bg-charcoal-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isComplete ? 'bg-gold-500' : 'bg-blue-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Season History Timeline */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <History className="w-6 h-6 text-purple-400" />
                Season History
              </h2>
              {seasonHistory.length > 0 ? (
                <div className="space-y-4">
                  {seasonHistory.map((season, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-4"
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          season.placement === 1 ? 'bg-gold-500/20 text-gold-400' :
                          season.placement <= 3 ? 'bg-blue-500/20 text-blue-400' :
                          'bg-charcoal-700 text-cream-400'
                        }`}>
                          {season.placement === 1 ? <Trophy className="w-5 h-5" /> :
                           season.placement ? `#${season.placement}` : <Calendar className="w-5 h-5" />}
                        </div>
                        {idx < seasonHistory.length - 1 && (
                          <div className="w-0.5 h-12 bg-charcoal-700 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-cream-100">{season.corpsName || 'Corps'}</p>
                            <p className="text-xs text-cream-400 uppercase">{season.classKey}</p>
                          </div>
                          {season.finalScore && (
                            <p className="text-lg font-bold text-gold-400">{season.finalScore.toFixed(2)}</p>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          {season.showsCompleted && (
                            <p className="text-cream-400">Shows: {season.showsCompleted}</p>
                          )}
                          {season.seasonNumber && (
                            <p className="text-cream-400">Season {season.seasonNumber}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-charcoal-600 mx-auto mb-3" />
                  <p className="text-cream-400">No season history yet</p>
                  <p className="text-sm text-cream-500 mt-1">Complete seasons to build your history!</p>
                </div>
              )}
            </div>

            {/* Retired Corps Hall of Fame */}
            {profile.retiredCorps && profile.retiredCorps.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Medal className="w-6 h-6 text-gold-400" />
                  Hall of Fame - Retired Corps
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.retiredCorps.map((corps, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-cream-100 text-lg">{corps.corpsName}</h3>
                          <p className="text-xs text-cream-400 uppercase">{corps.corpsClass}</p>
                          {corps.location && (
                            <p className="text-sm text-cream-400 mt-1">{corps.location}</p>
                          )}
                        </div>
                        <Trophy className="w-6 h-6 text-gold-400" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-charcoal-700">
                        <div>
                          <p className="text-lg font-bold text-blue-400">{corps.totalSeasons || 0}</p>
                          <p className="text-xs text-cream-400">Seasons</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gold-400">{corps.bestSeasonScore?.toFixed(1) || '-'}</p>
                          <p className="text-xs text-cream-400">Best</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-400">{corps.totalShows || 0}</p>
                          <p className="text-xs text-cream-400">Shows</p>
                        </div>
                      </div>
                      {corps.retiredAt && (
                        <p className="text-xs text-cream-500 mt-3 text-center">
                          Retired {new Date(corps.retiredAt?.toDate?.() || corps.retiredAt).toLocaleDateString()}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Class Progression */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                Class Progression
              </h2>
              <div className="space-y-3">
                {[
                  { key: 'soundSport', name: 'SoundSport', unlockLevel: 1, color: 'green' },
                  { key: 'aClass', name: 'A Class', unlockLevel: 3, color: 'blue' },
                  { key: 'open', name: 'Open Class', unlockLevel: 5, color: 'purple' },
                  { key: 'world', name: 'World Class', unlockLevel: 10, color: 'gold' }
                ].map((classInfo) => {
                  const isUnlocked = profile.unlockedClasses?.includes(classInfo.key) ||
                                     (profile.xpLevel || 1) >= classInfo.unlockLevel;
                  return (
                    <div
                      key={classInfo.key}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        isUnlocked
                          ? 'bg-charcoal-800/50 border border-charcoal-700'
                          : 'bg-charcoal-900/50 border border-charcoal-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isUnlocked ? colorClasses[classInfo.color] : 'bg-charcoal-800 text-charcoal-500'
                        }`}>
                          {isUnlocked ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className={`font-semibold ${isUnlocked ? 'text-cream-100' : 'text-cream-500'}`}>
                            {classInfo.name}
                          </p>
                          <p className={`text-sm ${isUnlocked ? 'text-cream-400' : 'text-cream-600'}`}>
                            Unlocks at Level {classInfo.unlockLevel}
                          </p>
                        </div>
                      </div>
                      {isUnlocked && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                          Unlocked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Performance Summary */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                Performance Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-gold-400">{profile.stats?.championships || 0}</p>
                  <p className="text-cream-400 text-sm mt-1">Championships</p>
                </div>
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-400">{profile.stats?.topTenFinishes || 0}</p>
                  <p className="text-cream-400 text-sm mt-1">Top 10 Finishes</p>
                </div>
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-purple-400">{profile.stats?.seasonsPlayed || 0}</p>
                  <p className="text-cream-400 text-sm mt-1">Seasons Played</p>
                </div>
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">
                    {profile.stats?.championships && profile.stats?.seasonsPlayed
                      ? ((profile.stats.championships / profile.stats.seasonsPlayed) * 100).toFixed(0)
                      : 0}%
                  </p>
                  <p className="text-cream-400 text-sm mt-1">Win Rate</p>
                </div>
              </div>
            </div>

            {/* Score Breakdown by Class */}
            {profile.corps && Object.keys(profile.corps).length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Target className="w-6 h-6 text-green-400" />
                  Current Season Scores
                </h2>
                <div className="space-y-4">
                  {Object.entries(profile.corps).map(([classKey, corps]) => {
                    const maxScore = 100;
                    const scorePercentage = ((corps.totalSeasonScore || 0) / maxScore) * 100;
                    return (
                      <div key={classKey}>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <p className="font-semibold text-cream-100">{corps.name}</p>
                            <p className="text-xs text-cream-400 uppercase">{classKey}</p>
                          </div>
                          <p className="text-xl font-bold text-gold-400">{(corps.totalSeasonScore || 0).toFixed(2)}</p>
                        </div>
                        <div className="w-full bg-charcoal-700 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-gold-500 h-3 rounded-full transition-all"
                            style={{ width: `${Math.min(scorePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Account Stats */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-purple-400" />
                Account Statistics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                  <p className="text-cream-400 text-sm">Total XP Earned</p>
                  <p className="text-2xl font-bold text-blue-400">{(profile.xp || 0).toLocaleString()}</p>
                </div>
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                  <p className="text-cream-400 text-sm">Total CorpsCoin</p>
                  <p className="text-2xl font-bold text-green-400">{(profile.corpsCoin || 0).toLocaleString()}</p>
                </div>
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                  <p className="text-cream-400 text-sm">Active Corps</p>
                  <p className="text-2xl font-bold text-purple-400">{Object.keys(profile.corps || {}).length}</p>
                </div>
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                  <p className="text-cream-400 text-sm">Retired Corps</p>
                  <p className="text-2xl font-bold text-orange-400">{profile.retiredCorps?.length || 0}</p>
                </div>
                {profile.createdAt && (
                  <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 md:col-span-2">
                    <p className="text-cream-400 text-sm">Member Since</p>
                    <p className="text-xl font-bold text-cream-100">
                      {new Date(profile.createdAt?.toDate?.() || profile.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
