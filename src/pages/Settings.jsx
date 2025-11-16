// src/pages/Settings.jsx
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
        toast.success('Profile updated successfully!', { icon: '✓' });
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
      toast.success('Notification settings saved!', { icon: '✓' });
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
      toast.success('Privacy settings saved!', { icon: '✓' });
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
      <div className="space-y-8">
        <div className="h-8 w-48 bg-charcoal-800 rounded animate-pulse" />
        <div className="h-64 bg-charcoal-800 rounded animate-pulse" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'account', label: 'Account', icon: Lock }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Settings</h1>
        <p className="text-cream-300">Manage your account and preferences</p>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="card">
            <h3 className="text-lg font-semibold text-cream-100 mb-6">Profile Information</h3>

            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="label">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="Your display name"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    maxLength={50}
                  />
                </div>
                <p className="text-xs text-cream-500/40 mt-1">
                  This is how your name will appear to other players
                </p>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type="email"
                    className="input pl-10 bg-charcoal-900/50 cursor-not-allowed"
                    value={user?.email || 'Anonymous'}
                    disabled
                  />
                </div>
                <p className="text-xs text-cream-500/40 mt-1">
                  Email cannot be changed from settings
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="label">Bio</label>
                <textarea
                  className="textarea"
                  placeholder="Tell us about yourself..."
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-cream-500/40 mt-1">
                  {profileData.bio.length}/500 characters
                </p>
              </div>

              {/* Location */}
              <div>
                <label className="label">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="City, State/Country"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
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
          className="space-y-6"
        >
          <div className="card">
            <h3 className="text-lg font-semibold text-cream-100 mb-6">Notification Preferences</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Email Notifications</p>
                  <p className="text-sm text-cream-500/60">Receive email updates about your account</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      emailNotifications: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Show Reminders</p>
                  <p className="text-sm text-cream-500/60">Get reminded about upcoming shows</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notificationSettings.showReminders}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      showReminders: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">League Updates</p>
                  <p className="text-sm text-cream-500/60">Notifications about your leagues</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notificationSettings.leagueUpdates}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      leagueUpdates: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Battle Pass Rewards</p>
                  <p className="text-sm text-cream-500/60">Alerts when new rewards are available</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notificationSettings.battlePassRewards}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      battlePassRewards: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Weekly Recap</p>
                  <p className="text-sm text-cream-500/60">Weekly summary of your performance</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notificationSettings.weeklyRecap}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      weeklyRecap: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveNotifications}
                disabled={saving}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
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
          className="space-y-6"
        >
          <div className="card">
            <h3 className="text-lg font-semibold text-cream-100 mb-6">Privacy Settings</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Public Profile</p>
                  <p className="text-sm text-cream-500/60">Allow others to view your profile</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={privacySettings.publicProfile}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      publicProfile: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Show Location</p>
                  <p className="text-sm text-cream-500/60">Display your location on your profile</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={privacySettings.showLocation}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      showLocation: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal-900/30 rounded-lg">
                <div>
                  <p className="font-medium text-cream-100">Show Statistics</p>
                  <p className="text-sm text-cream-500/60">Display your stats and achievements</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={privacySettings.showStats}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      showStats: e.target.checked
                    })}
                  />
                  <div className="w-11 h-6 bg-charcoal-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleSavePrivacy}
                disabled={saving}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
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
          className="space-y-6"
        >
          {/* Account Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-cream-100 mb-6">Account Information</h3>

            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-charcoal-900/30 rounded-lg">
                <span className="text-cream-500/60">Account Type</span>
                <span className="text-cream-100 font-medium">
                  {user?.isAnonymous ? 'Guest' : 'Registered'}
                </span>
              </div>

              <div className="flex justify-between p-3 bg-charcoal-900/30 rounded-lg">
                <span className="text-cream-500/60">User ID</span>
                <span className="text-cream-100 font-mono text-sm">{user?.uid?.slice(0, 12)}...</span>
              </div>

              <div className="flex justify-between p-3 bg-charcoal-900/30 rounded-lg">
                <span className="text-cream-500/60">Joined</span>
                <span className="text-cream-100">
                  {user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString()
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <div className="card border border-cream-500/20">
            <h3 className="text-lg font-semibold text-cream-100 mb-6">Session</h3>

            <div className="flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-cream-500/60 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-cream-300 mb-2">Sign out of your account</p>
                <p className="text-sm text-cream-500/60">
                  You'll need to sign in again to access your account
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="btn-outline w-full justify-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>

          {/* Danger Zone */}
          <div className="card border border-red-500/30 bg-red-500/5">
            <h3 className="text-lg font-semibold text-red-400 mb-6">Danger Zone</h3>

            <div className="flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-cream-300 mb-2">Delete Account</p>
                <p className="text-sm text-cream-500/60">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
            </div>

            <button
              onClick={() => toast.error('Please contact support to delete your account')}
              className="btn-ghost w-full justify-center text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Settings;
