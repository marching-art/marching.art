// ProfileHeader - Profile header with avatar, info, and edit functionality
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, Edit, Save, X, Heart, Star, TrendingUp, DollarSign, Calendar, Flame } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfileHeader = ({
  profile,
  isOwnProfile,
  onSave,
  saving,
  xpProgress,
  currentStreak
}) => {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: profile.displayName || '',
    location: profile.location || '',
    bio: profile.bio || '',
    favoriteCorps: profile.favoriteCorps || ''
  });

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
    await onSave(editData);
    setEditing(false);
  };

  const stats = [
    { label: 'Level', value: profile.xpLevel || 1, icon: Star, color: 'gold' },
    { label: 'XP', value: profile.xp || 0, icon: TrendingUp, color: 'blue' },
    { label: 'CorpsCoin', value: profile.corpsCoin || 0, icon: DollarSign, color: 'green' },
    { label: 'Seasons', value: profile.stats?.seasonsPlayed || 0, icon: Calendar, color: 'purple' }
  ];

  const colorClasses = {
    gold: 'bg-gold-500/20 text-gold-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-8"
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6">
        {/* Avatar */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-gold rounded-2xl flex items-center justify-center flex-shrink-0 relative">
          <User className="w-10 h-10 sm:w-12 sm:h-12 text-charcoal-900" />
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
  );
};

export default ProfileHeader;
