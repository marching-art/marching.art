// =============================================================================
// SETTINGS MODAL
// =============================================================================
// Account, notification, and privacy settings. Extracted from Profile.jsx to
// keep that page focused on the profile view.

import React, { useState, useEffect } from 'react';
import {
  Mail,
  AtSign,
  AlertCircle,
  Bell,
  Trash2,
  Heart,
  LogOut,
  X,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile } from '../../api/profile';
import { updateUsername, updateEmail, deleteAccount } from '../../api/functions';
import toast from 'react-hot-toast';
import { useTooltipPreference } from '../../hooks/useTooltipPreference';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import PWAInstallInstructions from '../PWAInstallInstructions';

// =============================================================================
// TOGGLE
// =============================================================================

const Toggle = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between py-2.5 cursor-pointer group">
    <div className="flex-1 mr-3">
      <p className="text-sm text-white group-hover:text-secondary">{label}</p>
      {description && <p className="text-[10px] text-muted mt-0.5">{description}</p>}
    </div>
    <div className="relative">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div
        className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-interactive' : 'bg-line'}`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </div>
    </div>
  </label>
);

// =============================================================================
// SETTINGS MODAL
// =============================================================================

const SettingsModal = ({ user, isOpen, onClose, initialTab = 'account' }) => {
  const { signOut } = useAuth();
  useEscapeKey(onClose, isOpen);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Tooltip preferences
  const { tooltipsEnabled, setTooltipsEnabled } = useTooltipPreference();

  // PWA install — a persistent, always-reachable way to install the app, so
  // users who dismissed or missed the transient prompt can still find it here.
  const { platform, isInstalled, canPromptInstall, promptInstall } = usePWAInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const handleInstallApp = async () => {
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        toast.success('Installing marching.art...');
      } else if (outcome === 'unavailable') {
        // The native prompt slipped away — fall back to manual steps.
        setShowInstallHelp(true);
      }
      return;
    }
    // No native prompt (iOS, or the browser hasn't offered one): reveal steps.
    setShowInstallHelp((prev) => !prev);
  };

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

  // Load settings when the modal opens or the user changes. `loadSettings` is
  // intentionally excluded: it is recreated every render, so depending on it
  // would reload on every render.
  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const loadSettings = async () => {
    try {
      const data = await getProfile(user.uid);
      if (data) {
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

  const hasAccountChanges =
    accountData.username !== originalData.username || accountData.email !== originalData.email;

  const saveAccountSettings = async () => {
    setAccountSaving(true);
    setUsernameError('');
    setEmailError('');

    try {
      const promises = [];

      // Update username if changed
      if (accountData.username && accountData.username !== originalData.username) {
        promises.push(
          updateUsername({ username: accountData.username }).catch((err) => {
            const message = err.message || 'Failed to update username';
            setUsernameError(message);
            throw err;
          })
        );
      }

      // Update email if changed
      if (accountData.email && accountData.email !== originalData.email) {
        promises.push(
          updateEmail({ email: accountData.email }).catch((err) => {
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
    setEmailPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updatePushPref = (key, value) => {
    setPushPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveNotificationPrefs = async () => {
    setSaving(true);
    try {
      await updateProfile(user.uid, {
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
        const { requestPushPermission } = await import('../../api/pushNotifications');
        const token = await requestPushPermission();
        if (token) {
          await updateProfile(user.uid, {
            'settings.fcmToken': token,
            'settings.pushPreferences.allPush': true,
          });
          setPushPrefs((prev) => ({ ...prev, allPush: true }));
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
      await updateProfile(user.uid, {
        'settings.pushPreferences.allPush': false,
      });
      setPushPrefs((prev) => ({ ...prev, allPush: false }));
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
    } catch {
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
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="w-full sm:max-w-md bg-surface-card border-t sm:border border-line rounded-none sm:rounded-none safe-area-bottom max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - mobile only */}
        <div className="sm:hidden flex justify-center py-2">
          <div className="w-8 h-1 bg-charcoal-600 rounded-full" />
        </div>

        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Settings</span>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 min-w-0 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'account'
                ? 'text-white border-b-2 border-interactive'
                : 'text-muted hover:text-secondary'
            }`}
          >
            Account
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 min-w-0 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'notifications'
                ? 'text-white border-b-2 border-interactive'
                : 'text-muted hover:text-secondary'
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
              <div className="bg-surface-sunken border border-line p-3">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AtSign className="w-3 h-3" />
                  Username
                </div>
                <input
                  type="text"
                  value={accountData.username}
                  onChange={(e) => {
                    setAccountData((prev) => ({ ...prev, username: e.target.value }));
                    setUsernameError('');
                  }}
                  placeholder="Enter username"
                  maxLength={15}
                  className="w-full bg-transparent text-sm text-white font-data border-none outline-none placeholder:text-muted"
                />
                <div className="text-[9px] text-muted mt-1">
                  3-15 characters, letters, numbers, underscores
                </div>
                {usernameError && (
                  <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {usernameError}
                  </div>
                )}
              </div>

              {/* Email Field */}
              <div className="bg-surface-sunken border border-line p-3">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
                <input
                  type="email"
                  value={accountData.email}
                  onChange={(e) => {
                    setAccountData((prev) => ({ ...prev, email: e.target.value }));
                    setEmailError('');
                  }}
                  placeholder="Enter email address"
                  className="w-full bg-transparent text-sm text-white font-data border-none outline-none placeholder:text-muted"
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
                  className="w-full py-3 min-h-[44px] bg-interactive text-white text-sm font-bold hover:bg-interactive-hover active:bg-[#004999] disabled:opacity-50 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
                >
                  {accountSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              <div className="bg-surface-sunken border border-line p-3">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Member Since
                </div>
                <div className="text-sm text-white">
                  {user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString()
                    : 'Unknown'}
                </div>
              </div>

              {/* Help Tooltips Toggle */}
              <div className="bg-surface-sunken border border-line p-3">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                  Gameplay Help
                </div>
                <Toggle
                  checked={tooltipsEnabled}
                  onChange={(e) => setTooltipsEnabled(e.target.checked)}
                  label="Show jargon tooltips"
                  description="Explain terms like Corps, Caption, DCI on hover"
                />
              </div>

              {/* Install App — always available here so it never becomes a
                  dead end after the transient prompt is dismissed. Hidden once
                  the app is running as an installed PWA. */}
              {isInstalled ? (
                <div className="w-full py-3 min-h-[44px] bg-surface-sunken border border-line text-muted text-sm font-bold rounded-none flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  App Installed
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleInstallApp}
                    className="w-full py-3 min-h-[44px] bg-interactive/15 border border-interactive/40 text-interactive text-sm font-bold hover:bg-interactive/25 active:bg-interactive/35 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
                    aria-expanded={!canPromptInstall ? showInstallHelp : undefined}
                  >
                    <Download className="w-4 h-4" />
                    {canPromptInstall ? 'Install App' : 'How to Install App'}
                  </button>
                  {!canPromptInstall && showInstallHelp && (
                    <div className="bg-surface-sunken border border-line p-3 rounded-none">
                      <PWAInstallInstructions platform={platform} />
                    </div>
                  )}
                </div>
              )}

              <a
                href="https://buymeacoffee.com/marching.art"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 min-h-[44px] bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/20 active:bg-amber-500/30 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Support marching.art
              </a>

              <button
                onClick={handleSignOut}
                className="w-full py-3 min-h-[44px] bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/20 active:bg-red-500/30 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>

              {/* Delete Account Section */}
              <div className="pt-4 border-t border-line">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 min-h-[44px] bg-transparent border border-red-500/20 text-red-400/70 text-sm font-bold hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 active:bg-red-500/20 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                ) : (
                  <div className="bg-red-500/5 border border-red-500/30 p-4 rounded-none space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-400">Delete Your Account?</p>
                        <p className="text-xs text-muted mt-1">
                          This action is permanent and cannot be undone. All your data, corps, and
                          season history will be permanently deleted.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">
                        Type DELETE to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                        placeholder="DELETE"
                        className="w-full px-3 py-2 bg-surface-sunken border border-line text-white text-sm font-mono focus:outline-none focus:border-red-500/50"
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
                        className="flex-1 py-2.5 min-h-[44px] bg-line text-secondary text-sm font-bold hover:bg-line-strong disabled:opacity-50 transition-all rounded-none"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                        className="flex-1 py-2.5 min-h-[44px] bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-none flex items-center justify-center gap-2"
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
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  Push Notifications
                </p>

                {!pushSupported ? (
                  <div className="bg-surface-sunken border border-line p-3 text-center">
                    <p className="text-xs text-muted">
                      Push notifications not supported in this browser
                    </p>
                  </div>
                ) : pushPermission === 'denied' ? (
                  <div className="bg-surface-sunken border border-line p-3 text-center">
                    <p className="text-xs text-muted">
                      Push notifications blocked. Enable in browser settings.
                    </p>
                  </div>
                ) : !pushPrefs.allPush ? (
                  <button
                    onClick={handleEnablePush}
                    className="w-full py-3 min-h-[44px] bg-interactive/20 border border-interactive/40 text-interactive text-sm font-bold hover:bg-interactive/30 transition-all rounded-none flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Enable Push Notifications
                  </button>
                ) : (
                  <div className="space-y-0 divide-y divide-line bg-surface-sunken border border-line">
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
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email Notifications
                </p>

                <div className="space-y-0 divide-y divide-line bg-surface-sunken border border-line">
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
                  className="w-full py-2.5 bg-interactive text-white text-sm font-bold rounded-none hover:bg-interactive-hover disabled:opacity-50 transition-colors"
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

export default SettingsModal;
