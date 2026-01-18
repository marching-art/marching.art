// =============================================================================
// PROFILE - DIRECTOR CAREER PORTFOLIO
// =============================================================================
// Redesigned with rich Trophy Case, Season Timeline, and gamification
// Laws: No glow, no shadow, grid layout, expandable sections

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  User, Settings, Crown, LogOut, Coins, Heart,
  MessageCircle, Mail, AtSign, AlertCircle, Bell, Trash2
} from 'lucide-react';
import { useAuth } from '../App';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateUsername, updateEmail, deleteAccount } from '../firebase/functions';
import toast from 'react-hot-toast';
import { DirectorProfile } from '../components/Profile/DirectorProfile';
import { UniformDesignModal } from '../components/modals/UniformDesignModal';

// =============================================================================
// NOTE: Achievement and season history display is now handled by DirectorProfile
// =============================================================================

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

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success('Account deleted successfully');
      await signOut();
      onClose();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
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

              {/* Delete Account Section */}
              <div className="pt-4 border-t border-[#333]">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 min-h-[44px] bg-transparent border border-red-500/20 text-red-400/70 text-sm font-bold hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 active:bg-red-500/20 transition-all press-feedback rounded-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                ) : (
                  <div className="bg-red-500/5 border border-red-500/30 p-4 rounded-sm space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-400">Delete Your Account?</p>
                        <p className="text-xs text-gray-400 mt-1">
                          This action is permanent and cannot be undone. All your data, corps, and season history will be permanently deleted.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                        Type DELETE to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                        placeholder="DELETE"
                        className="w-full px-3 py-2 bg-[#111] border border-[#333] text-white text-sm font-mono focus:outline-none focus:border-red-500/50"
                        disabled={isDeleting}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 min-h-[44px] bg-[#333] text-gray-300 text-sm font-bold hover:bg-[#444] disabled:opacity-50 transition-all rounded-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                        className="flex-1 py-2.5 min-h-[44px] bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-sm flex items-center justify-center gap-2"
                      >
                        {isDeleting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Delete Forever
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// NOTE: StatCell component moved to DirectorProfile
// =============================================================================

// =============================================================================
// MAIN PROFILE COMPONENT
// =============================================================================

const Profile = () => {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [saving, setSaving] = useState(false);
  const [showUniformDesign, setShowUniformDesign] = useState(false);

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

  // NOTE: Stats, achievements, and season history are now computed in DirectorProfile

  // Get active corps class for uniform design
  const activeCorpsClass = profile?.corps
    ? ['world', 'open', 'aClass', 'soundSport'].find(c => profile.corps[c]?.corpsName)
    : 'soundSport';

  // Handle uniform design save
  const handleUniformDesign = useCallback(async (design) => {
    if (!user || !activeCorpsClass) return;
    try {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.uniformDesign`]: design,
      });
      toast.success('Uniform design saved! Avatar will be generated soon.');
      setShowUniformDesign(false);
      refetch();
    } catch (err) {
      toast.error('Failed to save uniform design');
      throw err;
    }
  }, [user, activeCorpsClass, refetch]);

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
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a] relative">
      {/* FLOATING SETTINGS BUTTON - Top right corner */}
      {isOwnProfile && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:bg-[#222] transition-colors rounded-sm"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-momentum">
        {/* DIRECTOR PROFILE - New Career Portfolio Layout */}
        <DirectorProfile
          profile={profile}
          isOwnProfile={isOwnProfile}
          onEditProfile={handleStartEdit}
          onDesignUniform={() => setShowUniformDesign(true)}
        />

        {/* QUICK LINKS */}
        <div className="px-4 pb-4">
          <div className={`grid gap-2 ${isOwnProfile ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
            <a
              href="https://buymeacoffee.com/marching.art"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <Heart className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-xs text-gray-400">Support</span>
            </a>
            <a
              href="https://discord.gg/YvFRJ97A5H"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <MessageCircle className="w-5 h-5 text-[#5865F2] mb-1" />
              <span className="text-xs text-gray-400">Discord</span>
            </a>
            <Link
              to="/leagues"
              className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
            >
              <Crown className="w-5 h-5 text-purple-500 mb-1" />
              <span className="text-xs text-gray-400">Leagues</span>
            </Link>
            {isOwnProfile && (
              <Link
                to="/dashboard"
                className="bg-[#1a1a1a] border border-[#333] p-4 text-center hover:bg-[#222] active:bg-[#333] transition-colors press-feedback min-h-[72px] flex flex-col items-center justify-center"
              >
                <Coins className="w-5 h-5 text-yellow-500 mb-1" />
                <span className="text-xs text-gray-400 font-data tabular-nums">
                  {(profile.corpsCoin || 0).toLocaleString()} CC
                </span>
              </Link>
            )}
          </div>
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

      {/* UNIFORM DESIGN MODAL */}
      {showUniformDesign && activeCorpsClass && (
        <UniformDesignModal
          isOpen={showUniformDesign}
          onClose={() => setShowUniformDesign(false)}
          onSave={handleUniformDesign}
          corpsClass={activeCorpsClass}
          initialDesign={profile?.corps?.[activeCorpsClass]?.uniformDesign}
        />
      )}
    </div>
  );
};

export default Profile;
