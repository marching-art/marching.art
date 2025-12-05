// src/pages/Settings.jsx
// "The Director's Office" - Full viewport split-view settings panel
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, MapPin, Shield, Bell,
  Save, AlertCircle, Lock, LogOut, Trash2,
  ChevronRight, Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from '../firebase/functions';
import toast from 'react-hot-toast';

// =============================================================================
// GAME-STYLE INPUT COMPONENTS
// =============================================================================

const GameInput = ({ icon: Icon, label, description, ...props }) => (
  <div className="space-y-2">
    <label className="block text-sm font-display font-bold text-cream/80 uppercase tracking-wider">
      {label}
    </label>
    <div className="relative group">
      {Icon && (
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-500/60 group-focus-within:text-gold-400 transition-colors" />
      )}
      <input
        className={`
          w-full bg-charcoal-900/80
          border-2 border-charcoal-700
          rounded-lg px-4 py-4
          ${Icon ? 'pl-12' : ''}
          text-cream font-body text-base
          placeholder:text-cream/30
          focus:outline-none focus:border-gold-500/60
          focus:shadow-[0_0_20px_rgba(234,179,8,0.15),inset_0_0_20px_rgba(234,179,8,0.05)]
          hover:border-charcoal-600
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-charcoal-700
        `}
        {...props}
      />
      {/* Focus glow line at bottom */}
      <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gold-500/0 group-focus-within:bg-gold-500/60 transition-colors rounded-full" />
    </div>
    {description && (
      <p className="text-xs text-cream/40 font-body pl-1">{description}</p>
    )}
  </div>
);

const GameTextarea = ({ label, description, ...props }) => (
  <div className="space-y-2">
    <label className="block text-sm font-display font-bold text-cream/80 uppercase tracking-wider">
      {label}
    </label>
    <div className="relative group">
      <textarea
        className={`
          w-full bg-charcoal-900/80
          border-2 border-charcoal-700
          rounded-lg px-4 py-4
          text-cream font-body text-base
          placeholder:text-cream/30
          focus:outline-none focus:border-gold-500/60
          focus:shadow-[0_0_20px_rgba(234,179,8,0.15),inset_0_0_20px_rgba(234,179,8,0.05)]
          hover:border-charcoal-600
          transition-all duration-200
          resize-none
        `}
        {...props}
      />
      <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gold-500/0 group-focus-within:bg-gold-500/60 transition-colors rounded-full" />
    </div>
    {description && (
      <p className="text-xs text-cream/40 font-body pl-1">{description}</p>
    )}
  </div>
);

const GameToggle = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between p-4 bg-charcoal-900/60 border-2 border-charcoal-800 rounded-lg cursor-pointer hover:border-charcoal-700 hover:bg-charcoal-900/80 transition-all group">
    <div className="flex-1 mr-4">
      <p className="font-display font-bold text-cream group-hover:text-gold-400 transition-colors">{label}</p>
      <p className="text-sm text-cream/50 mt-0.5">{description}</p>
    </div>
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
      />
      <div className={`
        w-14 h-8 rounded-full transition-all duration-300
        bg-charcoal-800 border-2 border-charcoal-600
        peer-checked:bg-gold-500/30 peer-checked:border-gold-500/50
        peer-checked:shadow-[0_0_15px_rgba(234,179,8,0.3)]
        peer-focus:ring-2 peer-focus:ring-gold-500/30
      `}>
        <div className={`
          absolute top-1 left-1 w-6 h-6 rounded-full transition-all duration-300
          bg-cream/60
          peer-checked:translate-x-6 peer-checked:bg-gold-400
          shadow-md
        `} />
      </div>
    </div>
  </label>
);

const GameButton = ({ children, variant = 'primary', ...props }) => {
  const variants = {
    primary: `
      bg-gradient-to-b from-gold-400 to-gold-600
      text-charcoal-950 font-display font-bold uppercase tracking-wider
      border-2 border-gold-300
      shadow-[0_4px_0_0_#854d0e,0_0_20px_rgba(234,179,8,0.3)]
      hover:shadow-[0_2px_0_0_#854d0e,0_0_25px_rgba(234,179,8,0.4)]
      hover:translate-y-0.5
      active:shadow-[0_0_0_0_#854d0e,0_0_15px_rgba(234,179,8,0.2)]
      active:translate-y-1
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
    `,
    secondary: `
      bg-charcoal-800
      text-cream font-display font-bold uppercase tracking-wider
      border-2 border-charcoal-600
      shadow-[0_4px_0_0_#0a0a0a]
      hover:shadow-[0_2px_0_0_#0a0a0a]
      hover:translate-y-0.5 hover:border-cream/20
      active:shadow-none active:translate-y-1
    `,
    danger: `
      bg-gradient-to-b from-red-500 to-red-700
      text-white font-display font-bold uppercase tracking-wider
      border-2 border-red-400
      shadow-[0_4px_0_0_#7f1d1d,0_0_15px_rgba(239,68,68,0.2)]
      hover:shadow-[0_2px_0_0_#7f1d1d,0_0_20px_rgba(239,68,68,0.3)]
      hover:translate-y-0.5
      active:shadow-none active:translate-y-1
    `
  };

  return (
    <button
      className={`
        px-6 py-3 rounded-lg transition-all duration-150
        flex items-center justify-center gap-2
        ${variants[variant]}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

// =============================================================================
// NAVIGATION ITEM COMPONENT
// =============================================================================

const NavItem = ({ icon: Icon, label, description, isActive, onClick, variant = 'default' }) => {
  const variantStyles = {
    default: isActive
      ? 'bg-gold-500/10 border-gold-500/30 text-gold-400'
      : 'border-transparent hover:bg-white/5 hover:border-white/10 text-cream/70 hover:text-cream',
    danger: isActive
      ? 'bg-red-500/10 border-red-500/30 text-red-400'
      : 'border-transparent hover:bg-red-500/5 hover:border-red-500/20 text-red-400/70 hover:text-red-400'
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left
        ${variantStyles[variant]}
      `}
    >
      <div className={`
        w-10 h-10 rounded-lg flex items-center justify-center
        ${isActive ? 'bg-gold-500/20' : 'bg-white/5'}
        ${variant === 'danger' && isActive ? 'bg-red-500/20' : ''}
      `}>
        <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm uppercase tracking-wide truncate">{label}</p>
        <p className="text-xs opacity-60 truncate mt-0.5">{description}</p>
      </div>
      <ChevronRight className={`w-5 h-5 transition-transform ${isActive ? 'translate-x-1' : ''}`} />
    </button>
  );
};

// =============================================================================
// MAIN SETTINGS COMPONENT
// =============================================================================

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

  const navItems = [
    { id: 'profile', label: 'Profile', icon: User, description: 'Your public identity' },
    { id: 'notifications', label: 'Alerts', icon: Bell, description: 'Notification preferences' },
    { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Control your visibility' },
    { id: 'account', label: 'Account', icon: Lock, description: 'Session & security' }
  ];

  const sectionTitles = {
    profile: 'PROFILE CONFIGURATION',
    notifications: 'ALERT PREFERENCES',
    privacy: 'PRIVACY CONTROLS',
    account: 'ACCOUNT SECURITY'
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cream/60 font-display uppercase tracking-wider">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden">

      {/* Left Column - Navigation Panel */}
      <div className="lg:w-[320px] xl:w-[360px] shrink-0 bg-charcoal-950/60 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/5">
        <div className="h-full flex flex-col p-4 lg:p-6">

          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold-glow-sm">
                <SettingsIcon className="w-5 h-5 text-charcoal-950" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-cream uppercase tracking-wide">Settings</h1>
                <p className="text-xs text-cream/50">Director's Office</p>
              </div>
            </div>
          </div>

          {/* Navigation Items - Horizontal on mobile, vertical on desktop */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-2 px-2 lg:mx-0 lg:px-0">
            {navItems.map((item) => (
              <div key={item.id} className="shrink-0 lg:shrink">
                <NavItem
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  isActive={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                />
              </div>
            ))}
          </div>

          {/* User Card - Desktop only */}
          <div className="hidden lg:block mt-auto pt-6 border-t border-white/5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-charcoal-900/50">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-10 h-10 rounded-lg object-cover border border-white/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400/20 to-gold-600/20 flex items-center justify-center border border-gold-500/30">
                  <User className="w-5 h-5 text-gold-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-bold text-cream truncate">
                  {user?.displayName || 'Player'}
                </p>
                <p className="text-xs text-cream/50 truncate">
                  {user?.email || 'Guest Account'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Content Panel */}
      <div className="flex-1 min-h-0 overflow-y-auto relative">

        {/* Watermark Header */}
        <div className="absolute top-0 left-0 right-0 h-48 overflow-hidden pointer-events-none select-none">
          <div className="absolute top-4 lg:top-8 left-4 lg:left-8 right-4">
            <h2 className="font-display font-black text-[3rem] lg:text-[5rem] xl:text-[6rem] text-cream/[0.03] uppercase tracking-tight leading-none whitespace-nowrap">
              {sectionTitles[activeTab]}
            </h2>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative z-10 p-4 lg:p-8 xl:p-12 max-w-3xl">
          <AnimatePresence mode="wait">

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="font-display font-bold text-2xl text-cream mb-2">Profile Information</h3>
                  <p className="text-cream/50">Customize how you appear to other players.</p>
                </div>

                <div className="space-y-6">
                  <GameInput
                    icon={User}
                    label="Display Name"
                    description="This is how your name will appear to other players"
                    placeholder="Enter your display name"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    maxLength={50}
                  />

                  <GameInput
                    icon={Mail}
                    label="Email Address"
                    description="Email cannot be changed from settings"
                    value={user?.email || 'Anonymous'}
                    disabled
                  />

                  <GameTextarea
                    label="Bio"
                    description={`${profileData.bio.length}/500 characters`}
                    placeholder="Tell us about yourself..."
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    maxLength={500}
                    rows={4}
                  />

                  <GameInput
                    icon={MapPin}
                    label="Location"
                    placeholder="City, State/Country"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    maxLength={100}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <GameButton onClick={handleSaveProfile} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </GameButton>
                </div>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="font-display font-bold text-2xl text-cream mb-2">Notification Preferences</h3>
                  <p className="text-cream/50">Control how and when you receive updates.</p>
                </div>

                <div className="space-y-3">
                  <GameToggle
                    label="Email Notifications"
                    description="Receive email updates about your account"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      emailNotifications: e.target.checked
                    })}
                  />

                  <GameToggle
                    label="Show Reminders"
                    description="Get reminded about upcoming shows"
                    checked={notificationSettings.showReminders}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      showReminders: e.target.checked
                    })}
                  />

                  <GameToggle
                    label="League Updates"
                    description="Notifications about your leagues"
                    checked={notificationSettings.leagueUpdates}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      leagueUpdates: e.target.checked
                    })}
                  />

                  <GameToggle
                    label="Battle Pass Rewards"
                    description="Alerts when new rewards are available"
                    checked={notificationSettings.battlePassRewards}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      battlePassRewards: e.target.checked
                    })}
                  />

                  <GameToggle
                    label="Weekly Recap"
                    description="Weekly summary of your performance"
                    checked={notificationSettings.weeklyRecap}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      weeklyRecap: e.target.checked
                    })}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <GameButton onClick={handleSaveNotifications} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </GameButton>
                </div>
              </motion.div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="font-display font-bold text-2xl text-cream mb-2">Privacy Settings</h3>
                  <p className="text-cream/50">Control what others can see about you.</p>
                </div>

                <div className="space-y-3">
                  <GameToggle
                    label="Public Profile"
                    description="Allow others to view your profile"
                    checked={privacySettings.publicProfile}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      publicProfile: e.target.checked
                    })}
                  />

                  <GameToggle
                    label="Show Location"
                    description="Display your location on your profile"
                    checked={privacySettings.showLocation}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      showLocation: e.target.checked
                    })}
                  />

                  <GameToggle
                    label="Show Statistics"
                    description="Display your stats and achievements"
                    checked={privacySettings.showStats}
                    onChange={(e) => setPrivacySettings({
                      ...privacySettings,
                      showStats: e.target.checked
                    })}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <GameButton onClick={handleSavePrivacy} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Privacy Settings'}
                  </GameButton>
                </div>
              </motion.div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="font-display font-bold text-2xl text-cream mb-2">Account Information</h3>
                  <p className="text-cream/50">Manage your account and session.</p>
                </div>

                {/* Account Info Cards */}
                <div className="grid gap-3">
                  <div className="flex justify-between items-center p-4 bg-charcoal-900/60 border-2 border-charcoal-800 rounded-lg">
                    <span className="text-cream/60 font-display text-sm uppercase tracking-wide">Account Type</span>
                    <span className="text-gold-400 font-display font-bold drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                      {user?.isAnonymous ? 'Guest' : 'Registered'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-charcoal-900/60 border-2 border-charcoal-800 rounded-lg">
                    <span className="text-cream/60 font-display text-sm uppercase tracking-wide">User ID</span>
                    <span className="text-cream font-mono text-sm">{user?.uid?.slice(0, 12)}...</span>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-charcoal-900/60 border-2 border-charcoal-800 rounded-lg">
                    <span className="text-cream/60 font-display text-sm uppercase tracking-wide">Joined</span>
                    <span className="text-cream font-display">
                      {user?.metadata?.creationTime
                        ? new Date(user.metadata.creationTime).toLocaleDateString()
                        : 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Session Section */}
                <div className="pt-6 border-t border-white/10">
                  <h4 className="font-display font-bold text-lg text-cream mb-4">Session</h4>
                  <div className="flex items-start gap-4 mb-4 p-4 bg-charcoal-900/40 rounded-lg border border-white/5">
                    <AlertCircle className="w-5 h-5 text-cream/50 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-cream/80">Sign out of your account</p>
                      <p className="text-sm text-cream/40 mt-1">
                        You'll need to sign in again to access your account
                      </p>
                    </div>
                  </div>
                  <GameButton variant="secondary" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </GameButton>
                </div>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-red-500/20">
                  <h4 className="font-display font-bold text-lg text-red-400 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Danger Zone
                  </h4>
                  <div className="p-4 bg-red-950/30 rounded-lg border border-red-500/20 mb-4">
                    <p className="text-cream/80 mb-1">Delete Account</p>
                    <p className="text-sm text-cream/40">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <GameButton
                    variant="danger"
                    onClick={() => toast.error('Please contact support to delete your account')}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </GameButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Settings;
