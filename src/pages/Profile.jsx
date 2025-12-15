// src/pages/Profile.jsx
// Redesigned Profile: Clean profile showing your fantasy career with integrated settings
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User, Trophy, History, Settings, Star, TrendingUp, Calendar, Crown,
  DollarSign, AlertTriangle, RefreshCw, Zap, Flame, MapPin, Edit, Check, X,
  ChevronRight, Medal, Sparkles, Bell, Shield, LogOut, Gift, Coins,
  ArrowUp, ArrowDown, Award, Target
} from 'lucide-react';
import { useAuth } from '../App';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';
import { getCorpsCoinHistory } from '../firebase/functions';
import { getNextClassProgress } from '../utils/captionPricing';

// =============================================================================
// AVATAR CUSTOMIZATION - Simple avatar options
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
// MEANINGFUL MILESTONE ACHIEVEMENTS
// =============================================================================
const getMilestoneAchievements = (profile) => {
  const achievements = [];

  // First Championship Win
  if ((profile?.stats?.championships || 0) >= 1) {
    achievements.push({
      id: 'first-champ',
      name: 'Champion',
      description: 'Won your first championship',
      icon: Trophy,
      color: 'text-gold-400',
      bgColor: 'bg-gold-500/20',
      borderColor: 'border-gold-500/30'
    });
  }

  // Dynasty Builder - 3+ Championships
  if ((profile?.stats?.championships || 0) >= 3) {
    achievements.push({
      id: 'dynasty',
      name: 'Dynasty Builder',
      description: 'Won 3+ championships',
      icon: Crown,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    });
  }

  // Season milestones
  if ((profile?.stats?.seasonsPlayed || 0) >= 1) {
    achievements.push({
      id: 'first-season',
      name: 'Rookie Season',
      description: 'Completed your first season',
      icon: Star,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30'
    });
  }

  if ((profile?.stats?.seasonsPlayed || 0) >= 5) {
    achievements.push({
      id: 'veteran',
      name: 'Veteran Director',
      description: 'Completed 5+ seasons',
      icon: Medal,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    });
  }

  if ((profile?.stats?.seasonsPlayed || 0) >= 10) {
    achievements.push({
      id: 'legend',
      name: 'Living Legend',
      description: 'Completed 10+ seasons',
      icon: Sparkles,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30'
    });
  }

  // League winning streak (if tracked)
  if ((profile?.stats?.longestWinStreak || 0) >= 5) {
    achievements.push({
      id: 'streak',
      name: 'On Fire',
      description: '5+ league win streak',
      icon: Flame,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30'
    });
  }

  // Class unlocks
  const unlockedClasses = profile?.unlockedClasses || [];
  if (unlockedClasses.includes('world')) {
    achievements.push({
      id: 'world-unlock',
      name: 'World Class',
      description: 'Unlocked World Class',
      icon: TrendingUp,
      color: 'text-gold-400',
      bgColor: 'bg-gold-500/20',
      borderColor: 'border-gold-500/30'
    });
  }

  return achievements;
};

// =============================================================================
// CLASS DISPLAY HELPERS
// =============================================================================
const CLASS_DISPLAY = {
  worldClass: { name: 'World', color: 'text-gold-400', bg: 'bg-gold-500/10', border: 'border-gold-500/20' },
  openClass: { name: 'Open', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  aClass: { name: 'A Class', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  soundSport: { name: 'SoundSport', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

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
        <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-cream-500/50 rounded-full transition-all peer-checked:translate-x-5 peer-checked:bg-gold-400`} />
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
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-cream-500/10">
            <h2 className="text-lg font-display font-bold text-cream-100">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-cream-500/10">
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

          {/* Content */}
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

          {/* Footer */}
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
// SEASON HISTORY MODAL
// =============================================================================
const SeasonHistoryModal = ({ profile, isOpen, onClose }) => {
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
            <h2 className="text-lg font-display font-bold text-cream-100 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              Season History
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {seasonHistory.length > 0 ? (
              <div className="space-y-3">
                {seasonHistory.map((season, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-charcoal-900/50 border border-cream-500/10 rounded-lg"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      season.placement === 1 ? 'bg-gold-500/20 text-gold-400' :
                      season.placement <= 3 ? 'bg-purple-500/20 text-purple-400' :
                      'bg-charcoal-800 text-cream-500/60'
                    }`}>
                      {season.placement === 1 ? <Trophy className="w-5 h-5" /> :
                       season.placement ? `#${season.placement}` : <Calendar className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-cream-100 truncate">{season.corpsName || 'Corps'}</p>
                      <p className="text-xs text-cream-500/60">
                        {CLASS_DISPLAY[season.classKey]?.name || season.classKey} • Season {season.seasonNumber || '?'}
                      </p>
                    </div>
                    {season.finalScore && (
                      <p className="text-lg font-mono font-bold text-gold-400">{season.finalScore.toFixed(1)}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-cream-500/30 mx-auto mb-3" />
                <p className="text-cream-500/60">No season history yet</p>
                <p className="text-sm text-cream-500/40 mt-1">Complete seasons to build your history</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// =============================================================================
// AVATAR CUSTOMIZATION MODAL
// =============================================================================
const AvatarCustomizationModal = ({ profile, user, isOpen, onClose, onSave }) => {
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
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Preview */}
            <div className="flex justify-center mb-6">
              <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${currentColor.from} ${currentColor.to} border-2 ${currentColor.border} flex items-center justify-center`}>
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <User className={`w-12 h-12 ${currentColor.icon}`} />
                )}
              </div>
            </div>

            {/* Color Options */}
            <p className="text-sm text-cream-500/60 mb-3 text-center">Choose a color theme</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color.id)}
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
// CORPSCOIN EARNING OPPORTUNITIES
// =============================================================================
const EARNING_OPPORTUNITIES = [
  {
    id: 'shows',
    title: 'Show Participation',
    description: 'Perform at shows to earn CC',
    rewards: { soundSport: 50, aClass: 100, open: 150, world: 200 },
    icon: Target,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20'
  },
  {
    id: 'league',
    title: 'Weekly League Win',
    description: 'Win your weekly matchup',
    reward: 100,
    icon: Trophy,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20'
  },
  {
    id: 'season',
    title: 'Season Finish Bonus',
    description: 'Based on final ranking',
    rewards: { '1st': 1000, '2nd': 750, '3rd': 500, 'Top 10': 350, 'Top 25': 250 },
    icon: Award,
    color: 'text-gold-400',
    bgColor: 'bg-gold-500/20'
  },
  {
    id: 'battlepass',
    title: 'Battle Pass',
    description: 'Claim rewards as you level up',
    note: 'Varies by level',
    icon: Gift,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20'
  }
];

// =============================================================================
// CORPSCOIN HISTORY MODAL
// =============================================================================
const CorpsCoinHistoryModal = ({ isOpen, onClose, balance }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getCorpsCoinHistory({ limit: 50 });
      if (result.data?.success) {
        setHistory(result.data.history || []);
      }
    } catch (error) {
      console.error('Error loading CC history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'show_participation': return Target;
      case 'league_win': return Trophy;
      case 'season_bonus': return Award;
      case 'battle_pass': return Gift;
      case 'class_unlock': return TrendingUp;
      case 'league_entry': return Coins;
      default: return DollarSign;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-cream-500/10">
            <div>
              <h2 className="text-lg font-display font-bold text-cream-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-green-400" />
                CorpsCoin History
              </h2>
              <p className="text-sm text-cream-500/60 mt-1">
                Balance: <span className="text-green-400 font-mono font-bold">{(balance || 0).toLocaleString()} CC</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-cream-500/40 animate-spin" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-2">
                {history.map((entry, idx) => {
                  const Icon = getTransactionIcon(entry.type);
                  const isPositive = entry.amount > 0;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-3 p-3 bg-charcoal-900/50 border border-cream-500/10 rounded-lg"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        <Icon className={`w-5 h-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-cream-100 truncate">
                          {entry.description}
                        </p>
                        <p className="text-xs text-cream-500/60">
                          {formatDate(entry.timestamp)}
                        </p>
                      </div>
                      <div className={`text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        <p className="font-mono font-bold">
                          {isPositive ? '+' : ''}{entry.amount}
                        </p>
                        <p className="text-xs text-cream-500/40 font-mono">
                          {entry.balance?.toLocaleString()} CC
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Coins className="w-12 h-12 text-cream-500/30 mx-auto mb-3" />
                <p className="text-cream-500/60">No transaction history yet</p>
                <p className="text-sm text-cream-500/40 mt-1">Earn CC by participating in shows</p>
              </div>
            )}
          </div>

          {/* Earning Opportunities Footer */}
          <div className="p-4 border-t border-cream-500/10 bg-charcoal-900/30">
            <p className="text-xs text-cream-500/60 mb-3 font-medium uppercase tracking-wide">How to Earn</p>
            <div className="grid grid-cols-2 gap-2">
              {EARNING_OPPORTUNITIES.slice(0, 4).map((opp) => {
                const Icon = opp.icon;
                return (
                  <div key={opp.id} className="flex items-center gap-2 p-2 bg-charcoal-800/50 rounded-lg">
                    <Icon className={`w-4 h-4 ${opp.color}`} />
                    <span className="text-xs text-cream-300">{opp.title}</span>
                  </div>
                );
              })}
            </div>
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
  const [showHistory, setShowHistory] = useState(false);
  const [showAvatarCustomization, setShowAvatarCustomization] = useState(false);
  const [showCCHistory, setShowCCHistory] = useState(false);

  const isOwnProfile = !userId || userId === user?.uid;
  const profileUserId = userId || user?.uid;

  // React Query hooks
  const { data: profile, isLoading: loading, error, isError, refetch } = useProfile(profileUserId);
  const updateProfileMutation = useUpdateProfile(profileUserId || '');

  // Get milestone achievements
  const achievements = useMemo(() => getMilestoneAchievements(profile), [profile]);

  // Get avatar color
  const avatarColor = useMemo(() => {
    return AVATAR_COLORS.find(c => c.id === profile?.avatarColor) || AVATAR_COLORS[0];
  }, [profile?.avatarColor]);

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

  return (
    <div className="h-full overflow-y-auto hud-scroll">
      <div className="p-4 lg:p-6 space-y-6">

        {/* ================================================================
            HEADER: Profile Title + Settings Button
            ================================================================ */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-cream-100">Profile</h1>
          {isOwnProfile && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-cream-500/60 hover:text-cream-300 rounded-lg hover:bg-cream-500/10 transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ================================================================
            IDENTITY SECTION: Avatar, Name, Location, Favorite Corps
            ================================================================ */}
        <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => isOwnProfile && setShowAvatarCustomization(true)}
                className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${avatarColor.from} ${avatarColor.to} border-2 ${avatarColor.border} flex items-center justify-center transition-transform ${isOwnProfile ? 'hover:scale-105 cursor-pointer' : ''}`}
              >
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <User className={`w-12 h-12 ${avatarColor.icon}`} />
                )}
              </button>
              {/* Highest Class Badge */}
              {(() => {
                const classes = profile.unlockedClasses || ['soundSport'];
                let badgeColor, abbrev;
                if (classes.includes('world') || classes.includes('worldClass')) {
                  badgeColor = 'bg-gold-500'; abbrev = 'W';
                } else if (classes.includes('open') || classes.includes('openClass')) {
                  badgeColor = 'bg-purple-500'; abbrev = 'O';
                } else if (classes.includes('aClass')) {
                  badgeColor = 'bg-blue-500'; abbrev = 'A';
                } else {
                  badgeColor = 'bg-green-500'; abbrev = 'SS';
                }
                return (
                  <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-lg ${badgeColor} border-2 border-charcoal-900 flex items-center justify-center`}>
                    <span className="text-xs font-mono font-black text-white">
                      {abbrev}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Identity Info */}
            <div className="flex-1 text-center sm:text-left">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    placeholder="Display Name"
                    className="w-full px-3 py-2 bg-charcoal-800 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                  />
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
              ) : (
                <>
                  <h2 className="text-xl font-display font-bold text-cream-100">
                    {profile.displayName || 'Anonymous Director'}
                  </h2>

                  {profile.location && (
                    <p className="flex items-center justify-center sm:justify-start gap-1 text-sm text-cream-500/60 mt-1">
                      <MapPin className="w-3 h-3" />
                      {profile.location}
                    </p>
                  )}

                  {profile.favoriteCorps && (
                    <p className="text-sm text-cream-500/60 mt-1">
                      Favorite: <span className="text-gold-400">{profile.favoriteCorps}</span>
                    </p>
                  )}

                  <p className="text-xs text-cream-500/40 mt-2">
                    Member since {profile.createdAt ? new Date(profile.createdAt?.toDate?.() || profile.createdAt).getFullYear() : '2024'}
                  </p>

                  {isOwnProfile && (
                    <button
                      onClick={handleStartEdit}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-charcoal-800 border border-cream-500/20 text-cream-400 rounded-lg text-sm font-medium hover:bg-charcoal-700 transition-colors mx-auto sm:mx-0"
                    >
                      <Edit className="w-3 h-3" />
                      Edit Profile
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================
            STATS SECTION: XP, Seasons, Championships, CorpsCoin
            ================================================================ */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-gold-400 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-lg font-mono font-bold">{(profile.xp || 0).toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">XP</p>
          </div>
          <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-lg font-mono font-bold">{profile.stats?.seasonsPlayed || 0}</span>
            </div>
            <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Seasons</p>
          </div>
          <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-lg font-mono font-bold">{profile.stats?.championships || 0}</span>
            </div>
            <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Champs</p>
          </div>
          <button
            onClick={() => isOwnProfile && setShowCCHistory(true)}
            className={`bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center transition-all ${
              isOwnProfile ? 'hover:border-green-500/30 hover:bg-green-500/5 cursor-pointer' : ''
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <Coins className="w-4 h-4" />
              <span className="text-lg font-mono font-bold">{(profile.corpsCoin || 0).toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">
              {isOwnProfile ? 'CC (tap)' : 'CC'}
            </p>
          </button>
        </div>

        {/* ================================================================
            CLASS PROGRESSION - Show progress toward next class
            ================================================================ */}
        {(() => {
          const nextProgress = getNextClassProgress(
            profile.xp || 0,
            profile.unlockedClasses || ['soundSport'],
            profile.corpsCoin || 0
          );
          if (!nextProgress) {
            return (
              <div className="bg-gradient-to-r from-gold-500/10 to-amber-500/10 border border-gold-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-gold-400">All Classes Unlocked!</p>
                    <p className="text-xs text-cream-500/60">You've mastered every level of competition</p>
                  </div>
                </div>
              </div>
            );
          }
          const colorStyles = {
            blue: { border: 'border-blue-500/20', bg: 'from-blue-500/10 to-cyan-500/10', text: 'text-blue-400', gradient: 'from-blue-500 to-blue-400', iconBg: 'bg-blue-500/20' },
            purple: { border: 'border-purple-500/20', bg: 'from-purple-500/10 to-violet-500/10', text: 'text-purple-400', gradient: 'from-purple-500 to-purple-400', iconBg: 'bg-purple-500/20' },
            gold: { border: 'border-gold-500/20', bg: 'from-gold-500/10 to-amber-500/10', text: 'text-gold-400', gradient: 'from-gold-500 to-gold-400', iconBg: 'bg-gold-500/20' }
          };
          const style = colorStyles[nextProgress.color] || colorStyles.blue;
          return (
            <div className={`bg-gradient-to-r ${style.bg} border ${style.border} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${style.iconBg} flex items-center justify-center`}>
                    <TrendingUp className={`w-5 h-5 ${style.text}`} />
                  </div>
                  <div>
                    <p className="text-xs text-cream-500/60">Next Unlock</p>
                    <p className={`font-display font-bold ${style.text}`}>{nextProgress.className}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-cream-500/60">Progress</p>
                  <p className="font-mono font-bold text-cream-100">
                    {nextProgress.currentXP.toLocaleString()} / {nextProgress.requiredXP.toLocaleString()} XP
                  </p>
                </div>
              </div>
              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${nextProgress.xpProgress}%` }}
                  transition={{ duration: 0.8 }}
                  className={`h-full bg-gradient-to-r ${style.gradient} rounded-full`}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-cream-500/60">{nextProgress.xpRemaining.toLocaleString()} XP to go</span>
                {nextProgress.canUnlockWithCC && (
                  <span className={`${style.text}`}>or {nextProgress.requiredCC.toLocaleString()} CC</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ================================================================
            CORPSCOIN EARNING OPPORTUNITIES - Show how to earn CC
            ================================================================ */}
        {isOwnProfile && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-display font-bold text-green-400 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Earn CorpsCoin
              </h3>
              <button
                onClick={() => setShowCCHistory(true)}
                className="text-xs text-cream-500/60 hover:text-cream-300 flex items-center gap-1 transition-colors"
              >
                View History
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EARNING_OPPORTUNITIES.map((opp) => {
                const Icon = opp.icon;
                return (
                  <div
                    key={opp.id}
                    className="flex items-start gap-3 p-3 bg-charcoal-900/50 border border-cream-500/10 rounded-lg"
                  >
                    <div className={`w-8 h-8 rounded-lg ${opp.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${opp.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-cream-100">{opp.title}</p>
                      <p className="text-[10px] text-cream-500/60 mt-0.5">
                        {opp.reward ? `${opp.reward} CC` : opp.note || opp.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================
            MY CORPS GALLERY
            ================================================================ */}
        {profile.corps && Object.keys(profile.corps).length > 0 && (
          <div>
            <h3 className="text-sm font-display font-bold text-cream-500/60 uppercase tracking-wide mb-3">My Corps</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(profile.corps)
                .sort((a, b) => {
                  const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
                  return (classOrder[a[0]] ?? 99) - (classOrder[b[0]] ?? 99);
                })
                .map(([classKey, corps]) => {
                  const classInfo = CLASS_DISPLAY[classKey] || { name: classKey, color: 'text-cream-400', bg: 'bg-cream-500/10', border: 'border-cream-500/20' };
                  return (
                    <motion.div
                      key={classKey}
                      whileHover={{ scale: 1.02 }}
                      className={`${classInfo.bg} border ${classInfo.border} rounded-xl p-4 transition-all`}
                    >
                      <p className={`text-xs ${classInfo.color} uppercase tracking-wide font-medium mb-1`}>
                        {classInfo.name}
                      </p>
                      <p className="font-display font-bold text-cream-100 truncate">
                        {corps.corpsName || corps.name || 'Unnamed Corps'}
                      </p>
                      {corps.ranking && (
                        <p className="text-sm text-cream-500/60 mt-1">#{corps.ranking}</p>
                      )}
                      {corps.totalSeasonScore !== undefined && (
                        <p className={`text-lg font-mono font-bold ${classInfo.color} mt-2`}>
                          {corps.totalSeasonScore.toFixed(1)}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ================================================================
            ACHIEVEMENTS: Meaningful Milestones
            ================================================================ */}
        <div>
          <h3 className="text-sm font-display font-bold text-cream-500/60 uppercase tracking-wide mb-3">Achievements</h3>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center gap-3 p-4 ${achievement.bgColor} border ${achievement.borderColor} rounded-xl`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${achievement.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${achievement.color}`} />
                    </div>
                    <div>
                      <p className={`font-display font-bold ${achievement.color}`}>{achievement.name}</p>
                      <p className="text-xs text-cream-500/60">{achievement.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-6 text-center">
              <Medal className="w-10 h-10 text-cream-500/30 mx-auto mb-2" />
              <p className="text-cream-500/60">No achievements yet</p>
              <p className="text-sm text-cream-500/40 mt-1">Complete seasons and win championships to earn achievements</p>
            </div>
          )}
        </div>

        {/* ================================================================
            ACTION BUTTONS: Battle Pass + Season History
            ================================================================ */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/battlepass')}
            className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-purple-500/20 to-gold-500/20 border border-purple-500/30 rounded-xl text-cream-100 font-medium hover:from-purple-500/30 hover:to-gold-500/30 transition-all"
          >
            <Gift className="w-5 h-5 text-gold-400" />
            Battle Pass
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center justify-center gap-2 p-4 bg-charcoal-900/50 border border-cream-500/10 rounded-xl text-cream-100 font-medium hover:border-cream-500/20 transition-all"
          >
            <History className="w-5 h-5 text-purple-400" />
            Season History
          </button>
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

      <SeasonHistoryModal
        profile={profile}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      <AvatarCustomizationModal
        profile={profile}
        user={user}
        isOpen={showAvatarCustomization}
        onClose={() => setShowAvatarCustomization(false)}
        onSave={handleAvatarSave}
      />

      <CorpsCoinHistoryModal
        isOpen={showCCHistory}
        onClose={() => setShowCCHistory(false)}
        balance={profile?.corpsCoin}
      />
    </div>
  );
};

export default Profile;
