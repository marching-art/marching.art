// =============================================================================
// PROFILE - DIRECTOR CARD STYLE (Gold Standard Aligned)
// =============================================================================
// Dense stats, compact header, ESPN aesthetic
// Laws: No glow, no shadow, tight spacing, tables over cards

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  User, Trophy, Settings, Star, TrendingUp, Calendar,
  Crown, Medal, MapPin, Edit, Check, X, LogOut, Coins, Heart,
  ChevronRight, MessageCircle, Mail, AtSign, AlertCircle, Bell, Shield, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../App';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateUsername, updateEmail } from '../firebase/functions';
import toast from 'react-hot-toast';
import { DataTable } from '../components/ui/DataTable';
import { formatSeasonName } from '../utils/season';

// =============================================================================
// ACHIEVEMENT DEFINITIONS
// =============================================================================

const getMilestoneAchievements = (profile) => {
  const achievements = [];
  const stats = profile?.stats || {};
  const unlockedClasses = profile?.unlockedClasses || [];

  if ((stats.championships || 0) >= 1) {
    achievements.push({ id: 'champ', icon: Trophy, label: 'Champ' });
  }
  if ((stats.championships || 0) >= 3) {
    achievements.push({ id: 'dynasty', icon: Crown, label: 'Dynasty' });
  }
  if ((stats.seasonsPlayed || 0) >= 1) {
    achievements.push({ id: 'rookie', icon: Star, label: 'Rookie' });
  }
  if ((stats.seasonsPlayed || 0) >= 5) {
    achievements.push({ id: 'veteran', icon: Medal, label: 'Veteran' });
  }
  if ((stats.seasonsPlayed || 0) >= 10) {
    achievements.push({ id: 'legend', icon: Star, label: 'Legend' });
  }
  if (unlockedClasses.includes('world') || unlockedClasses.includes('worldClass')) {
    achievements.push({ id: 'world', icon: TrendingUp, label: 'World' });
  }

  return achievements;
};

// =============================================================================
// SEASON HISTORY TABLE COLUMNS
// =============================================================================

const seasonHistoryColumns = [
  {
    key: 'seasonName',
    header: 'Season',
    render: (row) => {
      const seasonStr = row.seasonId || row.seasonName;
      return <span className="text-gray-400">{seasonStr ? formatSeasonName(seasonStr) : '-'}</span>;
    },
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => <span className="text-white">{row.corpsName || 'Unknown'}</span>,
  },
  {
    key: 'className',
    header: 'Class',
    width: '60px',
    render: (row) => {
      const names = { worldClass: 'World', openClass: 'Open', aClass: 'A', soundSport: 'SS' };
      return <span className="text-gray-500">{names[row.classKey] || row.classKey}</span>;
    },
  },
  {
    key: 'placement',
    header: 'RK',
    width: '45px',
    align: 'center',
    isRank: true,
    render: (row) => row.placement ? `#${row.placement}` : '-',
  },
  {
    key: 'totalSeasonScore',
    header: 'Score',
    width: '65px',
    align: 'right',
    render: (row) => {
      const score = row.finalScore || row.totalSeasonScore;
      return (
        <span className="text-white font-data tabular-nums">
          {score ? score.toLocaleString() : '-'}
        </span>
      );
    },
  },
];

// =============================================================================
// TOGGLE COMPONENT
// =============================================================================

const Toggle = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between py-2.5 cursor-pointer group">
    <div className="flex-1 mr-3">
      <p className="text-sm text-white group-hover:text-gray-200">{label}</p>
      {description && <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>}
    </div>
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
      />
      <div className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-[#0057B8]' : 'bg-[#333]'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </div>
    </div>
  </label>
);

// =============================================================================
// SETTINGS MODAL
// =============================================================================

const SettingsModal = ({ user, isOpen, onClose, initialTab = 'account' }) => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Account settings state
  const [accountData, setAccountData] = useState({
    username: '',
    email: '',
  });
  const [originalData, setOriginalData] = useState({
    username: '',
    email: '',
  });
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);

  const [emailPrefs, setEmailPrefs] = useState({
    allEmails: true,
    streakAtRisk: true,
    streakBroken: true,
    weeklyDigest: true,
    lineupReminder: true,
    leagueActivity: true,
    milestoneAchieved: true,
    winBack: true,
  });

  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    publicProfile: true,
    showLocation: true,
    showStats: true,
  });
  const [originalPrivacy, setOriginalPrivacy] = useState({
    publicProfile: true,
    showLocation: true,
    showStats: true,
  });

  // Push notification state
  const [pushPrefs, setPushPrefs] = useState({
    allPush: false,
    streakAtRisk: true,
    matchupStart: true,
    matchupResult: true,
    scoreUpdate: true,
    leagueActivity: true,
    tradeProposal: true,
    showReminder: true,
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasPrivacyChanges, setHasPrivacyChanges] = useState(false);

  // Check push notification support
  useEffect(() => {
    const checkPushSupport = async () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setPushSupported(supported);
      if (supported) {
        setPushPermission(Notification.permission);
      }
    };
    checkPushSupport();
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  const loadSettings = async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const data = profileSnap.data();

        // Load account data
        const loadedAccountData = {
          username: data.username || '',
          email: data.email || user.email || '',
        };
        setAccountData(loadedAccountData);
        setOriginalData(loadedAccountData);

        // Load email preferences
        const prefs = data.settings?.emailPreferences || {};
        setEmailPrefs({
          allEmails: prefs.allEmails ?? true,
          streakAtRisk: prefs.streakAtRisk ?? true,
          streakBroken: prefs.streakBroken ?? true,
          weeklyDigest: prefs.weeklyDigest ?? true,
          lineupReminder: prefs.lineupReminder ?? true,
          leagueActivity: prefs.leagueActivity ?? true,
          milestoneAchieved: prefs.milestoneAchieved ?? true,
          winBack: prefs.winBack ?? true,
        });

        // Load privacy settings
        const privacy = data.privacy || {};
        const loadedPrivacy = {
          publicProfile: privacy.publicProfile ?? true,
          showLocation: privacy.showLocation ?? true,
          showStats: privacy.showStats ?? true,
        };
        setPrivacySettings(loadedPrivacy);
        setOriginalPrivacy(loadedPrivacy);

        // Load push preferences
        const push = data.settings?.pushPreferences || {};
        setPushPrefs({
          allPush: push.allPush ?? false,
          streakAtRisk: push.streakAtRisk ?? true,
          matchupStart: push.matchupStart ?? true,
          matchupResult: push.matchupResult ?? true,
          scoreUpdate: push.scoreUpdate ?? true,
          leagueActivity: push.leagueActivity ?? true,
          tradeProposal: push.tradeProposal ?? true,
          showReminder: push.showReminder ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const hasAccountChanges = accountData.username !== originalData.username ||
                            accountData.email !== originalData.email;

  const saveAccountSettings = async () => {
    setAccountSaving(true);
    setUsernameError('');
    setEmailError('');

    try {
      const promises = [];

      // Update username if changed
      if (accountData.username && accountData.username !== originalData.username) {
        promises.push(
          updateUsername({ username: accountData.username })
            .catch(err => {
              const message = err.message || 'Failed to update username';
              setUsernameError(message);
              throw err;
            })
        );
      }

      // Update email if changed
      if (accountData.email && accountData.email !== originalData.email) {
        promises.push(
          updateEmail({ email: accountData.email })
            .catch(err => {
              const message = err.message || 'Failed to update email';
              setEmailError(message);
              throw err;
            })
        );
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        setOriginalData({ ...accountData });
        toast.success('Account settings saved');
      }
    } catch (error) {
      console.error('Error saving account settings:', error);
    } finally {
      setAccountSaving(false);
    }
  };

  const updatePref = (key, value) => {
    setEmailPrefs(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updatePushPref = (key, value) => {
    setPushPrefs(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updatePrivacy = (key, value) => {
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
    setHasPrivacyChanges(true);
  };

  const saveNotificationPrefs = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        'settings.emailPreferences': emailPrefs,
        'settings.pushPreferences': pushPrefs,
      });
      toast.success('Notification preferences saved');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving notification prefs:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacySettings = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        'privacy': privacySettings,
      });
      setOriginalPrivacy({ ...privacySettings });
      toast.success('Privacy settings saved');
      setHasPrivacyChanges(false);
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        const { requestPushPermission } = await import('../api/pushNotifications');
        const token = await requestPushPermission();
        if (token) {
          const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
          await updateDoc(profileRef, {
            'settings.fcmToken': token,
            'settings.pushPreferences.allPush': true,
          });
          setPushPrefs(prev => ({ ...prev, allPush: true }));
          toast.success('Push notifications enabled');
        } else {
          toast.error('Failed to register for push notifications');
        }
      } else if (permission === 'denied') {
        toast.error('Push notifications were denied. Enable them in browser settings.');
      }
    } catch (error) {
      console.error('Error enabling push:', error);
      toast.error('Failed to enable push notifications');
    }
  };

  const handleDisablePush = async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        'settings.pushPreferences.allPush': false,
      });
      setPushPrefs(prev => ({ ...prev, allPush: false }));
      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Error disabling push:', error);
      toast.error('Failed to disable push notifications');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out');
      onClose();
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#1a1a1a] border-t sm:border border-[#333] rounded-t-xl sm:rounded-sm safe-area-bottom max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - mobile only */}
        <div className="sm:hidden flex justify-center py-2">
          <div className="w-8 h-1 bg-gray-600 rounded-full" />
        </div>

        <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Settings</span>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#333] shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 min-w-0 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'account'
                ? 'text-white border-b-2 border-[#0057B8]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Account
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 min-w-0 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'notifications'
                ? 'text-white border-b-2 border-[#0057B8]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Alerts
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 min-w-0 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'privacy'
                ? 'text-white border-b-2 border-[#0057B8]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Privacy
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scroll-momentum">
          {activeTab === 'account' && (
            <div className="p-3 space-y-3">
              {/* Username Field */}
              <div className="bg-[#111] border border-[#333] p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AtSign className="w-3 h-3" />
                  Username
                </div>
                <input
                  type="text"
                  value={accountData.username}
                  onChange={(e) => {
                    setAccountData(prev => ({ ...prev, username: e.target.value }));
                    setUsernameError('');
                  }}
                  placeholder="Enter username"
                  maxLength={15}
                  className="w-full bg-transparent text-sm text-white font-data border-none outline-none placeholder:text-gray-600"
                />
                <div className="text-[9px] text-gray-600 mt-1">3-15 characters, letters, numbers, underscores</div>
                {usernameError && (
                  <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {usernameError}
                  </div>
                )}
              </div>

              {/* Email Field */}
              <div className="bg-[#111] border border-[#333] p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
                <input
                  type="email"
                  value={accountData.email}
                  onChange={(e) => {
                    setAccountData(prev => ({ ...prev, email: e.target.value }));
                    setEmailError('');
                  }}
                  placeholder="Enter email address"
                  className="w-full bg-transparent text-sm text-white font-data border-none outline-none placeholder:text-gray-600"
                />
                {emailError && (
                  <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {emailError}
                  </div>
                )}
              </div>

              {/* Save Account Changes Button */}
              {hasAccountChanges && (
                <button
                  onClick={saveAccountSettings}
                  disabled={accountSaving}
                  className="w-full py-3 min-h-[44px] bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6] active:bg-[#004999] disabled:opacity-50 transition-all press-feedback rounded-sm flex items-center justify-center gap-2"
                >
                  {accountSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              <div className="bg-[#111] border border-[#333] p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Member Since</div>
                <div className="text-sm text-white">
                  {user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString()
                    : 'Unknown'}
                </div>
              </div>

              <a
                href="https://buymeacoffee.com/marching.art"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 min-h-[44px] bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/20 active:bg-amber-500/30 transition-all press-feedback rounded-sm flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Support marching.art
              </a>

              <button
                onClick={handleSignOut}
                className="w-full py-3 min-h-[44px] bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/20 active:bg-red-500/30 transition-all press-feedback rounded-sm flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-3 space-y-4">
              {/* Push Notifications Section */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  Push Notifications
                </p>

                {!pushSupported ? (
                  <div className="bg-[#111] border border-[#333] p-3 text-center">
                    <p className="text-xs text-gray-500">Push notifications not supported in this browser</p>
                  </div>
                ) : pushPermission === 'denied' ? (
                  <div className="bg-[#111] border border-[#333] p-3 text-center">
                    <p className="text-xs text-gray-500">Push notifications blocked. Enable in browser settings.</p>
                  </div>
                ) : !pushPrefs.allPush ? (
                  <button
                    onClick={handleEnablePush}
                    className="w-full py-3 min-h-[44px] bg-[#0057B8]/20 border border-[#0057B8]/40 text-[#0057B8] text-sm font-bold hover:bg-[#0057B8]/30 transition-all rounded-sm flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Enable Push Notifications
                  </button>
                ) : (
                  <div className="space-y-0 divide-y divide-[#333] bg-[#111] border border-[#333]">
                    <div className="px-3">
                      <Toggle
                        label="Push Notifications"
                        description="Master toggle"
                        checked={pushPrefs.allPush}
                        onChange={handleDisablePush}
                      />
                    </div>
                    <div className="px-3">
                      <Toggle
                        label="Streak Warnings"
                        description="Alert when streak is expiring"
                        checked={pushPrefs.streakAtRisk}
                        onChange={(e) => updatePushPref('streakAtRisk', e.target.checked)}
                      />
                    </div>
                    <div className="px-3">
                      <Toggle
                        label="Matchup Start"
                        description="When matchups begin"
                        checked={pushPrefs.matchupStart}
                        onChange={(e) => updatePushPref('matchupStart', e.target.checked)}
                      />
                    </div>
                    <div className="px-3">
                      <Toggle
                        label="Matchup Results"
                        description="When results are posted"
                        checked={pushPrefs.matchupResult}
                        onChange={(e) => updatePushPref('matchupResult', e.target.checked)}
                      />
                    </div>
                    <div className="px-3">
                      <Toggle
                        label="League Activity"
                        description="Trades and mentions"
                        checked={pushPrefs.leagueActivity}
                        onChange={(e) => updatePushPref('leagueActivity', e.target.checked)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Email Notifications Section */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email Notifications
                </p>

                <div className="space-y-0 divide-y divide-[#333] bg-[#111] border border-[#333]">
                  <div className="px-3">
                    <Toggle
                      label="All Emails"
                      description="Master toggle"
                      checked={emailPrefs.allEmails}
                      onChange={(e) => updatePref('allEmails', e.target.checked)}
                    />
                  </div>

                  {emailPrefs.allEmails && (
                    <>
                      <div className="px-3">
                        <Toggle
                          label="Streak Warnings"
                          description="Alert when streak is expiring"
                          checked={emailPrefs.streakAtRisk}
                          onChange={(e) => updatePref('streakAtRisk', e.target.checked)}
                        />
                      </div>
                      <div className="px-3">
                        <Toggle
                          label="Weekly Digest"
                          description="Summary every Sunday"
                          checked={emailPrefs.weeklyDigest}
                          onChange={(e) => updatePref('weeklyDigest', e.target.checked)}
                        />
                      </div>
                      <div className="px-3">
                        <Toggle
                          label="Lineup Reminders"
                          description="Before shows"
                          checked={emailPrefs.lineupReminder}
                          onChange={(e) => updatePref('lineupReminder', e.target.checked)}
                        />
                      </div>
                      <div className="px-3">
                        <Toggle
                          label="League Activity"
                          description="Trades and results"
                          checked={emailPrefs.leagueActivity}
                          onChange={(e) => updatePref('leagueActivity', e.target.checked)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {hasChanges && (
                <button
                  onClick={saveNotificationPrefs}
                  disabled={saving}
                  className="w-full py-2.5 bg-[#0057B8] text-white text-sm font-bold rounded-sm hover:bg-[#0066d6] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              )}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="p-3 space-y-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Privacy Controls
              </p>

              <div className="space-y-0 divide-y divide-[#333] bg-[#111] border border-[#333]">
                <div className="px-3">
                  <Toggle
                    label="Public Profile"
                    description="Allow others to view your profile"
                    checked={privacySettings.publicProfile}
                    onChange={(e) => updatePrivacy('publicProfile', e.target.checked)}
                  />
                </div>
                <div className="px-3">
                  <Toggle
                    label="Show Location"
                    description="Display location on profile"
                    checked={privacySettings.showLocation}
                    onChange={(e) => updatePrivacy('showLocation', e.target.checked)}
                  />
                </div>
                <div className="px-3">
                  <Toggle
                    label="Show Statistics"
                    description="Display performance stats publicly"
                    checked={privacySettings.showStats}
                    onChange={(e) => updatePrivacy('showStats', e.target.checked)}
                  />
                </div>
              </div>

              {hasPrivacyChanges && (
                <button
                  onClick={savePrivacySettings}
                  disabled={saving}
                  className="w-full py-2.5 bg-[#0057B8] text-white text-sm font-bold rounded-sm hover:bg-[#0066d6] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Privacy Settings'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// STAT CELL COMPONENT
// =============================================================================

const StatCell = ({ value, label }) => (
  <div className="text-center px-2">
    <div className="text-lg font-bold text-white font-data tabular-nums leading-tight">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
  </div>
);

// =============================================================================
// MAIN PROFILE COMPONENT
// =============================================================================

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [saving, setSaving] = useState(false);

  const isOwnProfile = !userId || userId === user?.uid;

  // Handle URL parameters for deep linking to settings
  useEffect(() => {
    const settingsParam = searchParams.get('settings');
    if (settingsParam && isOwnProfile) {
      if (settingsParam === 'emails') {
        setSettingsTab('emails');
      } else {
        setSettingsTab('account');
      }
      setShowSettings(true);
      searchParams.delete('settings');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, isOwnProfile, setSearchParams]);

  const profileUserId = userId || user?.uid;
  const { data: profile, isLoading, error, isError, refetch } = useProfile(profileUserId);
  const updateProfileMutation = useUpdateProfile(profileUserId || '');

  // Achievements
  const achievements = useMemo(() => getMilestoneAchievements(profile), [profile]);

  // Team name
  const teamName = useMemo(() => {
    if (!profile?.corps) return null;
    const corps = Object.values(profile.corps)[0];
    return corps?.corpsName || corps?.name || null;
  }, [profile?.corps]);

  // Stats
  const stats = useMemo(() => {
    if (!profile?.corps) return { starts: 0, avgScore: '-', bestFinish: '-', badges: 0 };

    let totalScore = 0;
    let scoreCount = 0;
    let bestRank = null;

    Object.values(profile.corps).forEach((corps) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          if (season.finalScore) {
            totalScore += season.finalScore;
            scoreCount++;
          }
          if (season.placement && (bestRank === null || season.placement < bestRank)) {
            bestRank = season.placement;
          }
        });
      }
      if (corps.totalSeasonScore) {
        totalScore += corps.totalSeasonScore;
        scoreCount++;
      }
      if (corps.ranking && (bestRank === null || corps.ranking < bestRank)) {
        bestRank = corps.ranking;
      }
    });

    return {
      starts: profile?.stats?.seasonsPlayed || scoreCount || 0,
      avgScore: scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : '-',
      bestFinish: bestRank ? `#${bestRank}` : '-',
      badges: achievements.length,
    };
  }, [profile, achievements]);

  // Season history
  const seasonHistory = useMemo(() => {
    if (!profile?.corps) return [];
    const history = [];
    const seen = new Set();

    Object.entries(profile.corps).forEach(([classKey, corps]) => {
      if (corps.seasonHistory) {
        corps.seasonHistory.forEach(season => {
          const uniqueKey = `${classKey}-${season.seasonId || season.seasonName}`;
          if (seen.has(uniqueKey)) return;
          seen.add(uniqueKey);
          const corpsName = season.corpsName || corps.name || corps.corpsName;
          history.push({ ...season, corpsName, classKey });
        });
      }
    });

    return history.sort((a, b) => {
      const aId = a.seasonId || a.seasonName || '';
      const bId = b.seasonId || b.seasonName || '';
      return bId.localeCompare(aId);
    });
  }, [profile]);

  // Handlers
  const handleStartEdit = () => {
    setEditData({
      displayName: profile?.displayName || '',
      location: profile?.location || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfileMutation.mutateAsync(editData);
      toast.success('Profile updated');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-3">{error?.message || 'Error loading profile'}</p>
          <button onClick={() => refetch()} className="text-xs text-[#0057B8] hover:underline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* FIXED HEADER - Director Card Style */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-14 h-14 bg-[#333] border border-[#444] flex-shrink-0 flex items-center justify-center">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-500" />
            )}
          </div>

          {/* Name + Meta */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editData.displayName}
                onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                className="w-full px-2 py-1 bg-[#222] border border-[#444] text-white text-sm font-bold focus:outline-none focus:border-[#0057B8]"
                placeholder="Display Name"
              />
            ) : (
              <h1 className="text-sm font-bold text-white truncate">
                {profile.displayName || 'Anonymous Director'}
              </h1>
            )}
            {teamName && (
              <p className="text-[11px] text-gray-500 truncate">{teamName}</p>
            )}
            {!isEditing && profile.location && (
              <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {profile.location}
              </p>
            )}
          </div>

          {/* Stats Grid - Right Side */}
          <div className="hidden sm:flex items-center gap-1 border-l border-[#333] pl-3">
            <StatCell value={stats.starts} label="Starts" />
            <StatCell value={stats.avgScore} label="Avg" />
            <StatCell value={stats.bestFinish} label="Best" />
            <StatCell value={stats.badges} label="Badges" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {isOwnProfile && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="p-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
                aria-label="Edit profile"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Edit Location Row */}
        {isEditing && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={editData.location}
              onChange={(e) => setEditData({ ...editData, location: e.target.value })}
              placeholder="Location"
              className="flex-1 px-2 py-1.5 bg-[#222] border border-[#444] text-white text-xs focus:outline-none focus:border-[#0057B8]"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-[#333] border border-[#444] text-gray-400 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-momentum">
        {/* MOBILE STATS STRIP - Only visible on mobile */}
        <div className="sm:hidden border-b border-[#333] bg-[#1a1a1a] py-3 flex justify-around">
          <StatCell value={stats.starts} label="Starts" />
          <StatCell value={stats.avgScore} label="Avg" />
          <StatCell value={stats.bestFinish} label="Best" />
          <StatCell value={stats.badges} label="Badges" />
        </div>

        {/* TROPHY CASE */}
        <div className="border-b border-[#333]">
          <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Trophy Case
            </h3>
          </div>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-px bg-[#333]">
              {achievements.map((a) => {
                const Icon = a.icon;
                return (
                  <div
                    key={a.id}
                    className="bg-[#1a1a1a] p-3 flex flex-col items-center justify-center min-h-[64px]"
                    title={a.label}
                  >
                    <Icon className="w-5 h-5 text-yellow-500" />
                    <span className="text-[10px] text-gray-500 mt-1">{a.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center bg-[#1a1a1a]">
              <Medal className="w-6 h-6 text-gray-600 mx-auto mb-1" />
              <p className="text-xs text-gray-500">No badges yet</p>
            </div>
          )}
        </div>

        {/* SEASON HISTORY */}
        <div className="border-b border-[#333]">
          <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Season History
            </h3>
          </div>
          <DataTable
            columns={seasonHistoryColumns}
            data={seasonHistory}
            getRowKey={(row, idx) => `${row.classKey}-${row.seasonId || idx}-${idx}`}
            zebraStripes={true}
            emptyState={
              <div className="p-4 text-center">
                <Calendar className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">No season history</p>
              </div>
            }
          />
        </div>

        {/* QUICK LINKS */}
        <div className={`grid gap-px bg-[#333] ${isOwnProfile ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          <a
            href="https://buymeacoffee.com/marching.art"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#1a1a1a] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
          >
            <Heart className="w-5 h-5 text-amber-500 mb-1" />
            <span className="text-xs text-gray-400">Support</span>
          </a>
          <a
            href="https://discord.gg/YvFRJ97A5H"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#1a1a1a] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
          >
            <MessageCircle className="w-5 h-5 text-[#5865F2] mb-1" />
            <span className="text-xs text-gray-400">Discord</span>
          </a>
          <Link
            to="/leagues"
            className="bg-[#1a1a1a] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
          >
            <Crown className="w-5 h-5 text-purple-500 mb-1" />
            <span className="text-xs text-gray-400">Leagues</span>
          </Link>
          {isOwnProfile && (
            <Link
              to="/dashboard"
              className="bg-[#1a1a1a] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <Coins className="w-5 h-5 text-yellow-500 mb-1" />
              <span className="text-xs text-gray-400 font-data tabular-nums">
                {(profile.corpsCoin || 0).toLocaleString()} CC
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <SettingsModal
        user={user}
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          setSettingsTab('account');
        }}
        initialTab={settingsTab}
      />
    </div>
  );
};

export default Profile;
