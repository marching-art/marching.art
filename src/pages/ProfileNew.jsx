// src/pages/ProfileNew.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, MapPin, Edit, Save, X, Trophy, Star, Award,
  Calendar, TrendingUp, DollarSign, Users, Target, Heart
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const ProfileNew = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
    purple: 'bg-purple-500/20 text-purple-400'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8"
      >
        <div className="flex items-start gap-6 mb-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-gradient-gold rounded-2xl flex items-center justify-center flex-shrink-0">
            <User className="w-12 h-12 text-charcoal-900" />
          </div>

          {/* Info */}
          <div className="flex-1">
            {!editing ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-display font-bold text-gradient">
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
                  <div className="flex items-center gap-2 text-cream-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}

                {profile.favoriteCorps && (
                  <div className="flex items-center gap-2 text-cream-400 mb-3">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span>Favorite Corps: {profile.favoriteCorps}</span>
                  </div>
                )}

                {profile.bio && (
                  <p className="text-cream-300 mt-4">{profile.bio}</p>
                )}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>
      </motion.div>

      {/* Achievements */}
      {profile.achievements && profile.achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-gold-400" />
            Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.achievements.map((achievement, idx) => (
              <div key={idx} className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-cream-100">{achievement.name}</p>
                    <p className="text-sm text-cream-400 mt-1">{achievement.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Corps */}
      {profile.corps && Object.keys(profile.corps).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Active Corps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(profile.corps).map(([classKey, corps]) => (
              <div key={classKey} className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
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
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Career Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-green-400" />
          Career Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-gold-400 mb-2">{profile.stats?.championships || 0}</p>
            <p className="text-cream-400">Championships</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-400 mb-2">{profile.stats?.topTenFinishes || 0}</p>
            <p className="text-cream-400">Top 10 Finishes</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-400 mb-2">{profile.stats?.seasonsPlayed || 0}</p>
            <p className="text-cream-400">Seasons Played</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileNew;
