// ProfileHeader - Profile header with avatar, info, and edit functionality
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, Edit, Save, X, Heart, TrendingUp, DollarSign, Calendar, Flame, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { getNextClassProgress } from '../../utils/captionPricing';

const ProfileHeader = ({
  profile,
  isOwnProfile,
  onSave,
  saving,
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

  // Get highest unlocked class for display
  const getHighestClass = () => {
    const classes = profile.unlockedClasses || ['soundSport'];
    if (classes.includes('world') || classes.includes('worldClass')) return { name: 'World', color: 'gold', abbrev: 'W' };
    if (classes.includes('open') || classes.includes('openClass')) return { name: 'Open', color: 'purple', abbrev: 'O' };
    if (classes.includes('aClass')) return { name: 'A', color: 'blue', abbrev: 'A' };
    return { name: 'SS', color: 'green', abbrev: 'SS' };
  };
  const highestClass = getHighestClass();

  // Get next class progress
  const nextClassProgress = getNextClassProgress(
    profile.xp || 0,
    profile.unlockedClasses || ['soundSport'],
    profile.corpsCoin || 0
  );

  const stats = [
    { label: 'XP', value: profile.xp || 0, icon: TrendingUp, color: 'blue' },
    { label: 'CorpsCoin', value: profile.corpsCoin || 0, icon: DollarSign, color: 'gold' },
    { label: 'Seasons', value: profile.stats?.seasonsPlayed || 0, icon: Calendar, color: 'purple' },
    { label: 'Wins', value: profile.stats?.leagueWins || 0, icon: Trophy, color: 'green' }
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
      className="bg-white dark:bg-transparent dark:glass border border-cream-300 dark:border-cream-500/20 shadow-sm dark:shadow-none rounded-sm p-4"
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#333] rounded-sm flex items-center justify-center flex-shrink-0 relative">
          <User className="w-10 h-10 sm:w-12 sm:h-12 text-white dark:text-charcoal-900" />
          <div className={`absolute -bottom-2 -right-2 ${
            highestClass.color === 'gold' ? 'bg-gold-500' :
            highestClass.color === 'purple' ? 'bg-purple-500' :
            highestClass.color === 'blue' ? 'bg-blue-500' : 'bg-green-500'
          } text-white text-xs font-bold px-2 py-1 rounded-full shadow`}>
            {highestClass.abbrev}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left w-full">
          {!editing ? (
            <>
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-charcoal-950 dark:text-cream-100">
                  {profile.displayName || 'Unknown Director'}
                </h1>
                {isOwnProfile && (
                  <button
                    onClick={handleEdit}
                    className="p-2 text-slate-400 dark:text-cream-300 hover:text-amber-600 dark:hover:text-gold-400 hover:bg-stone-100 dark:hover:bg-charcoal-700 rounded-lg transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                )}
              </div>

              {profile.location && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-500 dark:text-cream-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location}</span>
                </div>
              )}

              {profile.favoriteCorps && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-500 dark:text-cream-400 mb-3">
                  <Heart className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span>Favorite Corps: {profile.favoriteCorps}</span>
                </div>
              )}

              {profile.bio && (
                <p className="text-slate-600 dark:text-cream-300 mt-4">{profile.bio}</p>
              )}

              {/* Class Progress Bar */}
              {nextClassProgress ? (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500 dark:text-cream-400">
                      Next: {nextClassProgress.className}
                    </span>
                    <span className="text-slate-500 dark:text-cream-400">
                      {nextClassProgress.currentXP.toLocaleString()} / {nextClassProgress.requiredXP.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-charcoal-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${nextClassProgress.xpProgress}%` }}
                      className={`${
                        nextClassProgress.color === 'gold' ? 'bg-gradient-to-r from-gold-500 to-gold-400' :
                        nextClassProgress.color === 'purple' ? 'bg-gradient-to-r from-purple-500 to-purple-400' :
                        'bg-gradient-to-r from-blue-500 to-blue-400'
                      } h-2 rounded-full`}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 px-3 py-2 bg-gold-500/10 border border-gold-500/20 rounded-lg">
                  <span className="text-sm font-semibold text-gold-500 dark:text-gold-400">
                    🏆 All Classes Unlocked!
                  </span>
                </div>
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

      {/* Quick Stats with Streak */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-cream-50 dark:bg-charcoal-800/50 border border-cream-200 dark:border-charcoal-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[stat.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-cream-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-cream-100">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
        {/* Streak Display */}
        <div className="bg-cream-50 dark:bg-charcoal-800/50 border border-cream-200 dark:border-charcoal-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentStreak > 0 ? 'bg-orange-500/20 text-orange-500 dark:text-orange-400' : 'bg-stone-200/50 dark:bg-charcoal-600/50 text-stone-400 dark:text-charcoal-400'}`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-slate-500 dark:text-cream-400 text-sm">Streak</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-cream-100">{currentStreak}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileHeader;
