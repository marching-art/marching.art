// src/pages/Settings.jsx (Tactical Luxury: Centered Form Card Layout)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, MapPin, Shield, Bell, Palette,
  Save, AlertCircle, Check, Lock, LogOut, Trash2
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile as firebaseUpdateProfile } from 'firebase/auth';
import { updateProfile } from '../firebase/functions';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    location: '',
    avatar: ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    showReminders: true,
    leagueUpdates: true,
    battlePassRewards: true,
    weeklyRecap: true
  });

  const [privacySettings, setPrivacySettings] = useState({
    publicProfile: true,
    showLocation: true,
    showStats: true
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setProfileData({
          displayName: data.displayName || user.displayName || '',
          bio: data.bio || '',
          location: data.location || '',
          avatar: data.avatar || user.photoURL || ''
        });

        setNotificationSettings({
          emailNotifications: data.settings?.emailNotifications ?? true,
          showReminders: data.settings?.showReminders ?? true,
          leagueUpdates: data.settings?.leagueUpdates ?? true,
          battlePassRewards: data.settings?.battlePassRewards ?? true,
          weeklyRecap: data.settings?.weeklyRecap ?? true
        });

        setPrivacySettings({
          publicProfile: data.privacy?.publicProfile ?? true,
          showLocation: data.privacy?.showLocation ?? true,
          showStats: data.privacy?.showStats ?? true
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const result = await updateProfile({
        displayName: profileData.displayName,
        bio: profileData.bio,
        location: profileData.location
      });

      if (result.data.success) {
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        'settings': notificationSettings
      });
      toast.success('Notification settings saved!');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        'privacy': privacySettings
      });
      toast.success('Privacy settings saved!');
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      toast.error('Failed to save privacy settings');
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        <div className="h-8 w-48 bg-surface-tertiary rounded animate-pulse" />
        <div className="h-96 bg-surface-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'account', label: 'Account', icon: Lock }
  ];

  // Toggle switch component
  const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
      />
      <div className="w-11 h-6 bg-stone-300 dark:bg-surface-highlight peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );

  // Setting row component
  const SettingRow = ({ title, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-surface rounded-lg border border-stone-200 dark:border-border-default">
      <div>
        <p className="font-display font-medium text-text-main">{title}</p>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="sports-header text-3xl md:text-4xl text-text-main mb-2">Settings</h1>
        <p className="text-text-muted font-body">Manage your account and preferences</p>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center"
      >
        <div className="bg-white dark:bg-surface-secondary rounded-full p-1.5 border border-stone-200 dark:border-border-default shadow-sm dark:shadow-none flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-display font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-text-inverse'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="form-card">
            <h3 className="text-lg font-display font-bold text-text-main uppercase tracking-wide mb-6">
              Profile Information
            </h3>

            <div className="space-y-5">
              {/* Display Name */}
              <div>
                <label className="form-label">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    className="form-input pl-10"
                    placeholder="Your display name"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    maxLength={50}
                  />
                </div>
                <p className="text-xs text-text-muted mt-1.5">
                  This is how your name will appear to other players
                </p>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="form-label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="email"
                    className="form-input pl-10 opacity-60 cursor-not-allowed"
                    value={user?.email || 'Anonymous'}
                    disabled
                  />
                </div>
                <p className="text-xs text-text-muted mt-1.5">
                  Email cannot be changed from settings
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="form-label">Bio</label>
                <textarea
                  className="form-input resize-none min-h-[100px]"
                  placeholder="Tell us about yourself..."
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-text-muted mt-1.5">
                  {profileData.bio.length}/500 characters
                </p>
              </div>

              {/* Location */}
              <div>
                <label className="form-label">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    className="form-input pl-10"
                    placeholder="City, State/Country"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="btn-pill flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="form-card">
            <h3 className="text-lg font-display font-bold text-text-main uppercase tracking-wide mb-6">
              Notification Preferences
            </h3>

            <div className="space-y-3">
              <SettingRow
                title="Email Notifications"
                description="Receive email updates about your account"
                checked={notificationSettings.emailNotifications}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  emailNotifications: e.target.checked
                })}
              />

              <SettingRow
                title="Show Reminders"
                description="Get reminded about upcoming shows"
                checked={notificationSettings.showReminders}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  showReminders: e.target.checked
                })}
              />

              <SettingRow
                title="League Updates"
                description="Notifications about your leagues"
                checked={notificationSettings.leagueUpdates}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  leagueUpdates: e.target.checked
                })}
              />

              <SettingRow
                title="Battle Pass Rewards"
                description="Alerts when new rewards are available"
                checked={notificationSettings.battlePassRewards}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  battlePassRewards: e.target.checked
                })}
              />

              <SettingRow
                title="Weekly Recap"
                description="Weekly summary of your performance"
                checked={notificationSettings.weeklyRecap}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  weeklyRecap: e.target.checked
                })}
              />
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={handleSaveNotifications}
                disabled={saving}
                className="btn-pill flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Privacy Settings */}
      {activeTab === 'privacy' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="form-card">
            <h3 className="text-lg font-display font-bold text-text-main uppercase tracking-wide mb-6">
              Privacy Settings
            </h3>

            <div className="space-y-3">
              <SettingRow
                title="Public Profile"
                description="Allow others to view your profile"
                checked={privacySettings.publicProfile}
                onChange={(e) => setPrivacySettings({
                  ...privacySettings,
                  publicProfile: e.target.checked
                })}
              />

              <SettingRow
                title="Show Location"
                description="Display your location on your profile"
                checked={privacySettings.showLocation}
                onChange={(e) => setPrivacySettings({
                  ...privacySettings,
                  showLocation: e.target.checked
                })}
              />

              <SettingRow
                title="Show Statistics"
                description="Display your stats and achievements"
                checked={privacySettings.showStats}
                onChange={(e) => setPrivacySettings({
                  ...privacySettings,
                  showStats: e.target.checked
                })}
              />
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={handleSavePrivacy}
                disabled={saving}
                className="btn-pill flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Privacy Settings'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Account Settings */}
      {activeTab === 'account' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Account Info */}
          <div className="form-card">
            <h3 className="text-lg font-display font-bold text-text-main uppercase tracking-wide mb-6">
              Account Information
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-stone-50 dark:bg-surface rounded-lg border border-stone-200 dark:border-border-default">
                <span className="text-text-muted font-display text-sm">Account Type</span>
                <span className="text-text-main font-display font-medium">
                  {user?.isAnonymous ? 'Guest' : 'Registered'}
                </span>
              </div>

              <div className="flex justify-between p-3 bg-stone-50 dark:bg-surface rounded-lg border border-stone-200 dark:border-border-default">
                <span className="text-text-muted font-display text-sm">User ID</span>
                <span className="text-text-main font-mono text-sm">{user?.uid?.slice(0, 12)}...</span>
              </div>

              <div className="flex justify-between p-3 bg-stone-50 dark:bg-surface rounded-lg border border-stone-200 dark:border-border-default">
                <span className="text-text-muted font-display text-sm">Joined</span>
                <span className="text-text-main font-display">
                  {user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString()
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <div className="form-card">
            <h3 className="text-lg font-display font-bold text-text-main uppercase tracking-wide mb-4">
              Session
            </h3>

            <div className="flex items-start gap-3 mb-5">
              <AlertCircle className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-text-secondary font-body">Sign out of your account</p>
                <p className="text-sm text-text-muted">
                  You'll need to sign in again to access your account
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-stone-300 dark:border-surface-highlight text-text-secondary hover:border-stone-400 dark:hover:border-surface-tertiary hover:text-text-main transition-colors font-display font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Danger Zone */}
          <div className="form-card border-danger/30 bg-danger-muted">
            <h3 className="text-lg font-display font-bold text-danger uppercase tracking-wide mb-4">
              Danger Zone
            </h3>

            <div className="flex items-start gap-3 mb-5">
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-text-secondary font-body">Delete Account</p>
                <p className="text-sm text-text-muted">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
            </div>

            <button
              onClick={() => toast.error('Please contact support to delete your account')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-red-500/30 text-red-600 dark:text-red-400/80 hover:border-red-500/50 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors font-display font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Settings;
