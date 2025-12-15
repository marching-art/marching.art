// src/pages/Profile.jsx
// Redesigned Profile: Sports Almanac style - clean, data-focused layout
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User, Trophy, Settings, Star, TrendingUp, Calendar, Crown,
  AlertTriangle, RefreshCw, MapPin, Edit, Check, X,
  Medal, Bell, Shield, LogOut, Gift, Coins
} from 'lucide-react';
import { useAuth } from '../App';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';

// =============================================================================
// AVATAR COLOR OPTIONS
// =============================================================================
const AVATAR_COLORS = [
  { id: 'gold', from: 'from-gold-500/30', to: 'to-amber-500/30', border: 'border-gold-500/50', icon: 'text-gold-400' },
  { id: 'purple', from: 'from-purple-500/30', to: 'to-violet-500/30', border: 'border-purple-500/50', icon: 'text-purple-400' },
  { id: 'blue', from: 'from-blue-500/30', to: 'to-cyan-500/30', border: 'border-blue-500/50', icon: 'text-blue-400' },
  { id: 'green', from: 'from-green-500/30', to: 'to-emerald-500/30', border: 'border-green-500/50', icon: 'text-green-400' },
  { id: 'red', from: 'from-red-500/30', to: 'to-orange-500/30', border: 'border-red-500/50', icon: 'text-red-400' },
  { id: 'pink', from: 'from-pink-500/30', to: 'to-rose-500/30', border: 'border-pink-500/50', icon: 'text-pink-400' },
];

// =============================================================================
// ACHIEVEMENT DEFINITIONS
// =============================================================================
const getMilestoneAchievements = (profile) => {
  const achievements = [];

  if ((profile?.stats?.championships || 0) >= 1) {
    achievements.push({
      id: 'first-champ',
      name: 'Champion',
      description: 'Won your first championship',
      icon: Trophy,
      color: 'text-gold-400',
    });
  }

  if ((profile?.stats?.championships || 0) >= 3) {
    achievements.push({
      id: 'dynasty',
      name: 'Dynasty Builder',
      description: 'Won 3+ championships',
      icon: Crown,
      color: 'text-purple-400',
    });
  }

  if ((profile?.stats?.seasonsPlayed || 0) >= 1) {
    achievements.push({
      id: 'first-season',
      name: 'Rookie Season',
      description: 'Completed your first season',
      icon: Star,
      color: 'text-blue-400',
    });
  }

  if ((profile?.stats?.seasonsPlayed || 0) >= 5) {
    achievements.push({
      id: 'veteran',
      name: 'Veteran Director',
      description: 'Completed 5+ seasons',
      icon: Medal,
      color: 'text-green-400',
    });
  }

  if ((profile?.stats?.seasonsPlayed || 0) >= 10) {
    achievements.push({
      id: 'legend',
      name: 'Living Legend',
      description: 'Completed 10+ seasons',
      icon: Star,
      color: 'text-amber-400',
    });
  }

  const unlockedClasses = profile?.unlockedClasses || [];
  if (unlockedClasses.includes('world') || unlockedClasses.includes('worldClass')) {
    achievements.push({
      id: 'world-unlock',
      name: 'World Class',
      description: 'Unlocked World Class',
      icon: TrendingUp,
      color: 'text-gold-400',
    });
  }

  return achievements;
};

// =============================================================================
// SEASON HISTORY TABLE COLUMNS
// =============================================================================
const getSeasonHistoryColumns = () => [
  {
    key: 'seasonNumber',
    header: 'Season',
    width: '5rem',
    align: 'center',
    render: (row) => (
      <span className="font-mono text-cream-300">S{row.seasonNumber || '?'}</span>
    ),
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => (
      <span className="text-cream-100 font-medium truncate">
        {row.corpsName || 'Unknown Corps'}
      </span>
    ),
  },
  {
    key: 'className',
    header: 'Class',
    width: '6.25rem',
    render: (row) => {
      const classColors = {
        worldClass: 'text-gold-400',
        openClass: 'text-purple-400',
        aClass: 'text-blue-400',
        soundSport: 'text-green-400',
      };
      const classNames = {
        worldClass: 'World',
        openClass: 'Open',
        aClass: 'A Class',
        soundSport: 'SoundSport',
      };
      return (
        <span className={classColors[row.classKey] || 'text-cream-500'}>
          {classNames[row.classKey] || row.classKey}
        </span>
      );
    },
  },
  {
    key: 'placement',
    header: 'Rank',
    width: '5rem',
    align: 'center',
    render: (row) => {
      if (!row.placement) return <span className="text-cream-500/50">—</span>;
      const isTop3 = row.placement <= 3;
      return (
        <span className={`font-mono font-bold ${isTop3 ? 'text-gold-400' : 'text-cream-300'}`}>
          #{row.placement}
        </span>
      );
    },
  },
  {
    key: 'finalScore',
    header: 'Score',
    width: '5rem',
    align: 'right',
    render: (row) => (
      <span className="font-mono font-bold text-cream-100">
        {row.finalScore ? row.finalScore.toFixed(1) : '—'}
      </span>
    ),
  },
];

// =============================================================================
// SETTINGS PANEL COMPONENT
// =============================================================================
const SettingsPanel = ({ profile, user, isOpen, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('account');
  const { signOut } = useAuth();

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: profile?.settings?.emailNotifications ?? true,
    showReminders: profile?.settings?.showReminders ?? true,
    leagueUpdates: profile?.settings?.leagueUpdates ?? true,
    weeklyRecap: profile?.settings?.weeklyRecap ?? true
  });

  const [privacySettings, setPrivacySettings] = useState({
    publicProfile: profile?.privacy?.publicProfile ?? true,
    showLocation: profile?.privacy?.showLocation ?? true,
    showStats: profile?.privacy?.showStats ?? true
  });

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        settings: notificationSettings,
        privacy: privacySettings
      });
      toast.success('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const ToggleSwitch = ({ checked, onChange, label, description }) => (
    <label className="flex items-center justify-between p-3 bg-charcoal-900/50 border border-cream-500/10 rounded-lg cursor-pointer hover:border-cream-500/20 transition-colors">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-cream-100">{label}</p>
        <p className="text-xs text-cream-500/60">{description}</p>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={onChange}
        />
        <div className="w-11 h-6 bg-charcoal-800 peer-focus:outline-none rounded-full peer peer-checked:bg-gold-500/30 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-cream-500/50 rounded-full transition-all peer-checked:translate-x-5 peer-checked:bg-gold-400" />
      </div>
    </label>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-charcoal-950 border border-cream-500/10 rounded-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-cream-500/10">
            <h2 className="text-lg font-display font-bold text-cream-100">Settings</h2>
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex border-b border-cream-500/10" role="tablist">
            {[
              { id: 'account', label: 'Account', icon: User },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'privacy', label: 'Privacy', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeSection === tab.id
                    ? 'text-gold-400 border-b-2 border-gold-400'
                    : 'text-cream-500/60 hover:text-cream-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {activeSection === 'account' && (
              <div className="space-y-4">
                <div className="p-4 bg-charcoal-900/50 border border-cream-500/10 rounded-lg">
                  <p className="text-xs text-cream-500/60 mb-1">Email</p>
                  <p className="text-cream-100 font-mono text-sm">{user?.email || 'Anonymous'}</p>
                </div>
                <div className="p-4 bg-charcoal-900/50 border border-cream-500/10 rounded-lg">
                  <p className="text-xs text-cream-500/60 mb-1">Member Since</p>
                  <p className="text-cream-100">
                    {user?.metadata?.creationTime
                      ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : 'Unknown'
                    }
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-3">
                <ToggleSwitch
                  label="Email Notifications"
                  description="Receive updates via email"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                />
                <ToggleSwitch
                  label="Show Reminders"
                  description="Get reminded about upcoming shows"
                  checked={notificationSettings.showReminders}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, showReminders: e.target.checked }))}
                />
                <ToggleSwitch
                  label="League Updates"
                  description="Notifications about league activity"
                  checked={notificationSettings.leagueUpdates}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, leagueUpdates: e.target.checked }))}
                />
                <ToggleSwitch
                  label="Weekly Recap"
                  description="Receive weekly performance summaries"
                  checked={notificationSettings.weeklyRecap}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, weeklyRecap: e.target.checked }))}
                />
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="space-y-3">
                <ToggleSwitch
                  label="Public Profile"
                  description="Allow others to view your profile"
                  checked={privacySettings.publicProfile}
                  onChange={(e) => setPrivacySettings(prev => ({ ...prev, publicProfile: e.target.checked }))}
                />
                <ToggleSwitch
                  label="Show Location"
                  description="Display your location on profile"
                  checked={privacySettings.showLocation}
                  onChange={(e) => setPrivacySettings(prev => ({ ...prev, showLocation: e.target.checked }))}
                />
                <ToggleSwitch
                  label="Show Stats"
                  description="Display your stats publicly"
                  checked={privacySettings.showStats}
                  onChange={(e) => setPrivacySettings(prev => ({ ...prev, showStats: e.target.checked }))}
                />
              </div>
            )}
          </div>

          {activeSection !== 'account' && (
            <div className="p-4 border-t border-cream-500/10">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-3 bg-gold-500 text-charcoal-900 rounded-lg font-bold hover:bg-gold-400 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// =============================================================================
// AVATAR CUSTOMIZATION MODAL
// =============================================================================
const AvatarCustomizationModal = ({ profile, isOpen, onClose, onSave }) => {
  const [selectedColor, setSelectedColor] = useState(profile?.avatarColor || 'gold');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ avatarColor: selectedColor });
      toast.success('Avatar updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentColor = AVATAR_COLORS.find(c => c.id === selectedColor) || AVATAR_COLORS[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-sm bg-charcoal-950 border border-cream-500/10 rounded-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-cream-500/10">
            <h2 className="text-lg font-display font-bold text-cream-100">Customize Avatar</h2>
            <button
              onClick={onClose}
              aria-label="Close avatar customization"
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="flex justify-center mb-6">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${currentColor.from} ${currentColor.to} border-2 ${currentColor.border} flex items-center justify-center`}>
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className={`w-12 h-12 ${currentColor.icon}`} />
                )}
              </div>
            </div>

            <p className="text-sm text-cream-500/60 mb-3 text-center">Choose a color theme</p>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar color options">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color.id)}
                  aria-label={`Select ${color.id} color`}
                  aria-checked={selectedColor === color.id}
                  role="radio"
                  className={`aspect-square rounded-lg bg-gradient-to-br ${color.from} ${color.to} border-2 transition-all ${
                    selectedColor === color.id ? `${color.border} scale-110` : 'border-transparent hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-cream-500/10">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-gold-500 text-charcoal-900 rounded-lg font-bold hover:bg-gold-400 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Avatar'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// =============================================================================
// MAIN PROFILE COMPONENT
// =============================================================================
const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarCustomization, setShowAvatarCustomization] = useState(false);

  const isOwnProfile = !userId || userId === user?.uid;
  const profileUserId = userId || user?.uid;

  const { data: profile, isLoading: loading, error, isError, refetch } = useProfile(profileUserId);
  const updateProfileMutation = useUpdateProfile(profileUserId || '');

  // Get milestone achievements
  const achievements = useMemo(() => getMilestoneAchievements(profile), [profile]);

  // Get avatar color
  const avatarColor = useMemo(() => {
    return AVATAR_COLORS.find(c => c.id === profile?.avatarColor) || AVATAR_COLORS[0];
  }, [profile?.avatarColor]);

  // Get current corps/team name
  const teamName = useMemo(() => {
    if (!profile?.corps) return null;
    const corpsList = Object.values(profile.corps);
    if (corpsList.length === 0) return null;
    // Return the first corps name as the "team"
    return corpsList[0]?.corpsName || corpsList[0]?.name || null;
  }, [profile?.corps]);

  // Compute stats for StatCards
  const stats = useMemo(() => {
    if (!profile?.corps) return { seasonAverage: 0, bestScore: 0, highestRank: null };

    let totalScore = 0;
    let scoreCount = 0;
    let bestScore = 0;
    let highestRank = null;

    Object.values(profile.corps).forEach((corps) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          if (season.finalScore) {
            totalScore += season.finalScore;
            scoreCount++;
            if (season.finalScore > bestScore) {
              bestScore = season.finalScore;
            }
          }
          if (season.placement && (highestRank === null || season.placement < highestRank)) {
            highestRank = season.placement;
          }
        });
      }
      // Also check current season score
      if (corps.totalSeasonScore) {
        totalScore += corps.totalSeasonScore;
        scoreCount++;
        if (corps.totalSeasonScore > bestScore) {
          bestScore = corps.totalSeasonScore;
        }
      }
      if (corps.ranking && (highestRank === null || corps.ranking < highestRank)) {
        highestRank = corps.ranking;
      }
    });

    return {
      seasonAverage: scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : '—',
      bestScore: bestScore > 0 ? bestScore.toFixed(1) : '—',
      highestRank: highestRank ? `#${highestRank}` : '—',
    };
  }, [profile?.corps]);

  // Collect season history for DataTable
  const seasonHistory = useMemo(() => {
    if (!profile?.corps) return [];
    const history = [];
    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          history.push({
            ...season,
            corpsName: corps.name || corps.corpsName,
            classKey
          });
        });
      }
    });
    return history.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
  }, [profile]);

  const handleStartEdit = () => {
    setEditData({
      displayName: profile?.displayName || '',
      location: profile?.location || '',
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
        favoriteCorps: editData.favoriteCorps
      });
      toast.success('Profile updated');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSave = async (updates) => {
    await updateProfileMutation.mutateAsync(updates);
  };

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

  const historyColumns = getSeasonHistoryColumns();

  return (
    <div className="flex-1 overflow-y-auto hud-scroll">
      <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">

        {/* ================================================================
            HEADER: Simple Avatar + Name + Team Name
            ================================================================ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <button
              onClick={() => isOwnProfile && setShowAvatarCustomization(true)}
              aria-label={isOwnProfile ? 'Customize avatar' : `${profile.displayName || 'User'} avatar`}
              className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarColor.from} ${avatarColor.to} border-2 ${avatarColor.border} flex items-center justify-center transition-transform ${isOwnProfile ? 'hover:scale-105 cursor-pointer' : ''}`}
            >
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName || 'User avatar'} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className={`w-8 h-8 ${avatarColor.icon}`} />
              )}
            </button>

            {/* Name + Team */}
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.displayName}
                  onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                  placeholder="Display Name"
                  className="px-3 py-1 bg-charcoal-800 border border-cream-500/20 rounded-lg text-cream-100 text-lg font-display font-bold focus:outline-none focus:border-gold-500"
                />
              ) : (
                <h1 className="text-xl font-display font-bold text-cream-100">
                  {profile.displayName || 'Anonymous Director'}
                </h1>
              )}
              {teamName && (
                <p className="text-sm text-cream-500/60">{teamName}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isOwnProfile && !isEditing && (
              <button
                onClick={handleStartEdit}
                aria-label="Edit Profile"
                className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
                className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Editing fields for location/favoriteCorps */}
        {isEditing && (
          <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-4 space-y-3">
            <input
              type="text"
              value={editData.location}
              onChange={(e) => setEditData({ ...editData, location: e.target.value })}
              placeholder="Location (e.g., Austin, TX)"
              className="w-full px-3 py-2 bg-charcoal-800 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
            />
            <input
              type="text"
              value={editData.favoriteCorps}
              onChange={(e) => setEditData({ ...editData, favoriteCorps: e.target.value })}
              placeholder="Favorite Corps (e.g., Blue Devils)"
              className="w-full px-3 py-2 bg-charcoal-800 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-sm font-bold hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-charcoal-800 border border-cream-500/20 text-cream-400 rounded-lg text-sm font-bold hover:bg-charcoal-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Profile meta when not editing */}
        {!isEditing && (profile.location || profile.favoriteCorps) && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-cream-500/60">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {profile.location}
              </span>
            )}
            {profile.favoriteCorps && (
              <span>
                Favorite: <span className="text-gold-400">{profile.favoriteCorps}</span>
              </span>
            )}
          </div>
        )}

        {/* ================================================================
            STATS GRID: Season Average, Best Score, Highest Rank
            ================================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-cream-500/50 mb-3">Career Stats</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Season Avg" value={stats.seasonAverage} />
            <StatCard label="Best Score" value={stats.bestScore} />
            <StatCard label="Highest Rank" value={stats.highestRank} />
          </div>
        </section>

        {/* ================================================================
            SEASON HISTORY: DataTable
            ================================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-cream-500/50 mb-3">Season History</h2>
          <DataTable
            columns={historyColumns}
            data={seasonHistory}
            getRowKey={(row, idx) => `${row.classKey}-${row.seasonNumber}-${idx}`}
            rowHeight="compact"
            emptyState={
              <div className="py-12 text-center">
                <Calendar className="w-10 h-10 text-cream-500/30 mx-auto mb-2" />
                <p className="text-cream-500/50 text-sm">No season history yet</p>
              </div>
            }
          />
        </section>

        {/* ================================================================
            ACHIEVEMENTS: Simple icon grid (no glow)
            ================================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-cream-500/50 mb-3">Achievements</h2>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {achievements.map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <div
                    key={achievement.id}
                    className="flex flex-col items-center p-3 bg-charcoal-900 border border-charcoal-700 rounded-lg"
                    title={`${achievement.name}: ${achievement.description}`}
                  >
                    <Icon className={`w-6 h-6 ${achievement.color} mb-1`} />
                    <span className="text-[10px] text-cream-500/60 text-center leading-tight">
                      {achievement.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-charcoal-900 border border-charcoal-700 rounded-lg p-6 text-center">
              <Medal className="w-8 h-8 text-cream-500/30 mx-auto mb-2" />
              <p className="text-cream-500/50 text-sm">No achievements yet</p>
              <p className="text-cream-500/40 text-xs mt-1">Complete seasons to earn achievements</p>
            </div>
          )}
        </section>

        {/* ================================================================
            QUICK ACTIONS
            ================================================================ */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/battlepass')}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 text-sm font-medium hover:border-cream-500/30 transition-colors"
          >
            <Gift className="w-4 h-4 text-gold-400" />
            Battle Pass
          </button>
          <button
            onClick={() => navigate('/leagues')}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 text-sm font-medium hover:border-cream-500/30 transition-colors"
          >
            <Trophy className="w-4 h-4 text-purple-400" />
            Leagues
          </button>
          {isOwnProfile && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 text-sm font-medium hover:border-cream-500/30 transition-colors"
            >
              <Coins className="w-4 h-4 text-green-400" />
              {(profile.corpsCoin || 0).toLocaleString()} CC
            </button>
          )}
        </div>
      </div>

      {/* ================================================================
          MODALS
          ================================================================ */}
      <SettingsPanel
        profile={profile}
        user={user}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <AvatarCustomizationModal
        profile={profile}
        isOpen={showAvatarCustomization}
        onClose={() => setShowAvatarCustomization(false)}
        onSave={handleAvatarSave}
      />
    </div>
  );
};

export default Profile;
