// src/pages/Settings.jsx
// "The Config Terminal" - Full viewport split-panel configuration interface
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, MapPin, Shield, Bell,
  Save, AlertCircle, Lock, LogOut, Trash2,
  Terminal, Database, Cpu
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from '../firebase/functions';
import toast from 'react-hot-toast';

// =============================================================================
// BRUTALIST INPUT COMPONENTS - Sharp edges, 2px borders, technical feel
// =============================================================================

const TerminalInput = ({ icon: Icon, label, code, description, ...props }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="block text-xs font-mono font-bold text-gold-500/80 uppercase tracking-widest">
        {label}
      </label>
      {code && (
        <span className="text-[10px] font-mono text-cream/30 uppercase">{code}</span>
      )}
    </div>
    <div className="relative group">
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30 group-focus-within:text-gold-500 transition-colors" />
      )}
      <input
        className={`
          w-full bg-black/60
          border-2 border-cream/10
          px-3 py-3
          ${Icon ? 'pl-10' : ''}
          text-cream font-mono text-sm
          placeholder:text-cream/20
          focus:outline-none focus:border-gold-500/50
          focus:bg-black/80
          hover:border-cream/20
          transition-all duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
        {...props}
      />
      {/* Active indicator line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold-500/0 group-focus-within:bg-gold-500 transition-colors" />
    </div>
    {description && (
      <p className="text-[11px] text-cream/30 font-mono">{description}</p>
    )}
  </div>
);

const TerminalTextarea = ({ label, code, description, ...props }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="block text-xs font-mono font-bold text-gold-500/80 uppercase tracking-widest">
        {label}
      </label>
      {code && (
        <span className="text-[10px] font-mono text-cream/30 uppercase">{code}</span>
      )}
    </div>
    <div className="relative group">
      <textarea
        className={`
          w-full bg-black/60
          border-2 border-cream/10
          px-3 py-3
          text-cream font-mono text-sm
          placeholder:text-cream/20
          focus:outline-none focus:border-gold-500/50
          focus:bg-black/80
          hover:border-cream/20
          transition-all duration-150
          resize-none
        `}
        {...props}
      />
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold-500/0 group-focus-within:bg-gold-500 transition-colors" />
    </div>
    {description && (
      <p className="text-[11px] text-cream/30 font-mono">{description}</p>
    )}
  </div>
);

const TerminalToggle = ({ checked, onChange, label, code, description }) => (
  <label className="flex items-center justify-between p-3 bg-black/40 border-2 border-cream/5 cursor-pointer hover:border-cream/15 hover:bg-black/60 transition-all group">
    <div className="flex-1 mr-4">
      <div className="flex items-center gap-3">
        <p className="font-mono font-bold text-sm text-cream group-hover:text-gold-400 transition-colors uppercase tracking-wide">{label}</p>
        {code && (
          <span className="text-[10px] font-mono text-cream/20">[{code}]</span>
        )}
      </div>
      <p className="text-[11px] text-cream/40 mt-0.5 font-mono">{description}</p>
    </div>
    <div className="relative flex items-center">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
      />
      {/* Binary indicator */}
      <div className="flex items-center gap-1 mr-3 font-mono text-xs">
        <span className={`transition-colors ${!checked ? 'text-cream/60' : 'text-cream/20'}`}>0</span>
        <span className="text-cream/10">/</span>
        <span className={`transition-colors ${checked ? 'text-gold-500' : 'text-cream/20'}`}>1</span>
      </div>
      <div className={`
        w-12 h-6 transition-all duration-200
        bg-charcoal-900 border-2 border-cream/10
        peer-checked:bg-gold-500/20 peer-checked:border-gold-500/40
        relative
      `}>
        <div className={`
          absolute top-0.5 w-5 h-5 transition-all duration-200
          bg-cream/40
          peer-checked:bg-gold-500
          ${checked ? 'left-[calc(100%-22px)]' : 'left-0.5'}
        `} />
      </div>
    </div>
  </label>
);

const DataRow = ({ label, value, mono = false }) => (
  <div className="flex justify-between items-center p-3 bg-black/40 border-2 border-cream/5">
    <span className="text-cream/40 font-mono text-xs uppercase tracking-wider">{label}</span>
    <span className={`${mono ? 'font-mono text-xs' : 'font-display font-bold'} text-cream`}>{value}</span>
  </div>
);

// =============================================================================
// SYSTEM MENU ITEM
// =============================================================================

const SystemMenuItem = ({ icon: Icon, label, code, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 text-left border-l-2
      ${isActive
        ? 'bg-gold-500/10 border-gold-500 text-gold-400'
        : 'border-transparent hover:bg-white/5 hover:border-cream/20 text-cream/50 hover:text-cream'
      }
    `}
  >
    <Icon className={`w-4 h-4 ${isActive ? 'drop-shadow-[0_0_6px_currentColor]' : ''}`} />
    <div className="flex-1 min-w-0">
      <p className="font-mono text-xs uppercase tracking-wider truncate">{label}</p>
    </div>
    <span className={`font-mono text-[10px] ${isActive ? 'text-gold-500/60' : 'text-cream/20'}`}>
      [{code}]
    </span>
  </button>
);

// =============================================================================
// MAIN SETTINGS COMPONENT
// =============================================================================

const Settings = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'profile') {
        const result = await updateProfile({
          displayName: profileData.displayName,
          bio: profileData.bio,
          location: profileData.location
        });
        if (result.data.success) {
          toast.success('Profile configuration saved');
        }
      } else if (activeTab === 'notifications') {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { 'settings': notificationSettings });
        toast.success('Alert configuration saved');
      } else if (activeTab === 'privacy') {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { 'privacy': privacySettings });
        toast.success('Privacy configuration saved');
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Configuration save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Session terminated');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to terminate session');
    }
  };

  const updateProfile_ = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateNotifications = (field, value) => {
    setNotificationSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updatePrivacy = (field, value) => {
    setPrivacySettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const navItems = [
    { id: 'profile', label: 'Profile', code: 'USR', icon: User },
    { id: 'notifications', label: 'Alerts', code: 'ALT', icon: Bell },
    { id: 'privacy', label: 'Privacy', code: 'PRV', icon: Shield },
    { id: 'account', label: 'System', code: 'SYS', icon: Database }
  ];

  const watermarks = {
    profile: 'PROFILE',
    notifications: 'ALERTS',
    privacy: 'PRIVACY',
    account: 'SYSTEM'
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black/20">
        <div className="text-center">
          <Cpu className="w-8 h-8 text-gold-500 animate-pulse mx-auto mb-3" />
          <p className="text-cream/40 font-mono text-xs uppercase tracking-widest">Loading Configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden">

      {/* Left Column - System Menu (250px) */}
      <div className="w-full lg:w-[250px] shrink-0 bg-black/60 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-cream/5">
        <div className="h-full flex flex-col">

          {/* Terminal Header */}
          <div className="p-4 border-b border-cream/5">
            <div className="flex items-center gap-2 mb-1">
              <Terminal className="w-4 h-4 text-gold-500" />
              <span className="font-mono text-xs text-gold-500 uppercase tracking-widest">Config Terminal</span>
            </div>
            <p className="text-[10px] font-mono text-cream/30">v2.4.1 // session active</p>
          </div>

          {/* System Menu - Horizontal scroll on mobile */}
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible p-2 lg:p-0 gap-1 lg:gap-0">
            {navItems.map((item) => (
              <div key={item.id} className="shrink-0 lg:shrink">
                <SystemMenuItem
                  icon={item.icon}
                  label={item.label}
                  code={item.code}
                  isActive={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                />
              </div>
            ))}
          </div>

          {/* User Module - Desktop only */}
          <div className="hidden lg:block mt-auto p-3 border-t border-cream/5">
            <div className="p-2 bg-black/40 border border-cream/5">
              <div className="flex items-center gap-2 mb-2">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-6 h-6 object-cover border border-cream/20" />
                ) : (
                  <div className="w-6 h-6 bg-gold-500/20 flex items-center justify-center border border-gold-500/30">
                    <User className="w-3 h-3 text-gold-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-cream truncate">{user?.displayName || 'DIRECTOR'}</p>
                </div>
              </div>
              <div className="text-[9px] font-mono text-cream/30 truncate">
                UID: {user?.uid?.slice(0, 16)}...
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Configuration Panel */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

        {/* Massive Watermark Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none flex items-center justify-center">
          <h2
            className="font-display font-black text-cream/[0.03] uppercase leading-none"
            style={{ fontSize: 'clamp(8rem, 20vw, 14rem)' }}
          >
            {watermarks[activeTab]}
          </h2>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto relative z-10 pb-20 lg:pb-24">
          <div className="p-4 lg:p-8 xl:p-12">
            <AnimatePresence mode="wait">

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 max-w-2xl"
                >
                  <div className="border-b border-cream/10 pb-4">
                    <h3 className="font-mono font-bold text-lg text-cream uppercase tracking-wide">User Profile</h3>
                    <p className="text-xs text-cream/40 font-mono mt-1">Configure public identity parameters</p>
                  </div>

                  <div className="space-y-4">
                    <TerminalInput
                      icon={User}
                      label="Display Name"
                      code="DNAME"
                      description="Public identifier for other directors"
                      placeholder="Enter display name"
                      value={profileData.displayName}
                      onChange={(e) => updateProfile_('displayName', e.target.value)}
                      maxLength={50}
                    />

                    <TerminalInput
                      icon={Mail}
                      label="Email Address"
                      code="EMAIL"
                      description="Read-only // Contact administrator to modify"
                      value={user?.email || 'Anonymous'}
                      disabled
                    />

                    <TerminalTextarea
                      label="Biography"
                      code="BIO"
                      description={`Character limit: ${profileData.bio.length}/500`}
                      placeholder="Enter biographical data..."
                      value={profileData.bio}
                      onChange={(e) => updateProfile_('bio', e.target.value)}
                      maxLength={500}
                      rows={4}
                    />

                    <TerminalInput
                      icon={MapPin}
                      label="Location"
                      code="LOC"
                      description="Geographic identifier (optional)"
                      placeholder="City, Region"
                      value={profileData.location}
                      onChange={(e) => updateProfile_('location', e.target.value)}
                      maxLength={100}
                    />
                  </div>
                </motion.div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 max-w-2xl"
                >
                  <div className="border-b border-cream/10 pb-4">
                    <h3 className="font-mono font-bold text-lg text-cream uppercase tracking-wide">Alert Configuration</h3>
                    <p className="text-xs text-cream/40 font-mono mt-1">Manage notification channel parameters</p>
                  </div>

                  <div className="space-y-2">
                    <TerminalToggle
                      label="Email Dispatch"
                      code="MAIL"
                      description="Receive system notifications via email"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => updateNotifications('emailNotifications', e.target.checked)}
                    />

                    <TerminalToggle
                      label="Show Reminders"
                      code="RMND"
                      description="Pre-competition alert notifications"
                      checked={notificationSettings.showReminders}
                      onChange={(e) => updateNotifications('showReminders', e.target.checked)}
                    />

                    <TerminalToggle
                      label="League Updates"
                      code="LEAG"
                      description="Circuit activity notifications"
                      checked={notificationSettings.leagueUpdates}
                      onChange={(e) => updateNotifications('leagueUpdates', e.target.checked)}
                    />

                    <TerminalToggle
                      label="Reward Alerts"
                      code="RWRD"
                      description="Battle pass unlock notifications"
                      checked={notificationSettings.battlePassRewards}
                      onChange={(e) => updateNotifications('battlePassRewards', e.target.checked)}
                    />

                    <TerminalToggle
                      label="Weekly Digest"
                      code="WKLY"
                      description="Performance summary transmission"
                      checked={notificationSettings.weeklyRecap}
                      onChange={(e) => updateNotifications('weeklyRecap', e.target.checked)}
                    />
                  </div>
                </motion.div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 max-w-2xl"
                >
                  <div className="border-b border-cream/10 pb-4">
                    <h3 className="font-mono font-bold text-lg text-cream uppercase tracking-wide">Privacy Controls</h3>
                    <p className="text-xs text-cream/40 font-mono mt-1">Configure data visibility parameters</p>
                  </div>

                  <div className="space-y-2">
                    <TerminalToggle
                      label="Public Profile"
                      code="PBLC"
                      description="Allow external profile access"
                      checked={privacySettings.publicProfile}
                      onChange={(e) => updatePrivacy('publicProfile', e.target.checked)}
                    />

                    <TerminalToggle
                      label="Location Visible"
                      code="GLOC"
                      description="Display geographic data on profile"
                      checked={privacySettings.showLocation}
                      onChange={(e) => updatePrivacy('showLocation', e.target.checked)}
                    />

                    <TerminalToggle
                      label="Statistics Visible"
                      code="STAT"
                      description="Display performance metrics publicly"
                      checked={privacySettings.showStats}
                      onChange={(e) => updatePrivacy('showStats', e.target.checked)}
                    />
                  </div>
                </motion.div>
              )}

              {/* Account/System Tab */}
              {activeTab === 'account' && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 max-w-2xl"
                >
                  <div className="border-b border-cream/10 pb-4">
                    <h3 className="font-mono font-bold text-lg text-cream uppercase tracking-wide">System Information</h3>
                    <p className="text-xs text-cream/40 font-mono mt-1">Account data and session management</p>
                  </div>

                  {/* System Data */}
                  <div className="space-y-1">
                    <DataRow
                      label="Account Type"
                      value={
                        <span className="text-gold-500 drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]">
                          {user?.isAnonymous ? 'GUEST' : 'REGISTERED'}
                        </span>
                      }
                    />
                    <DataRow label="User ID" value={user?.uid?.slice(0, 20) + '...'} mono />
                    <DataRow
                      label="Created"
                      value={user?.metadata?.creationTime
                        ? new Date(user.metadata.creationTime).toLocaleDateString()
                        : 'Unknown'
                      }
                    />
                    <DataRow
                      label="Last Login"
                      value={user?.metadata?.lastSignInTime
                        ? new Date(user.metadata.lastSignInTime).toLocaleDateString()
                        : 'Unknown'
                      }
                    />
                  </div>

                  {/* Session Control */}
                  <div className="pt-4 border-t border-cream/10">
                    <h4 className="font-mono text-xs text-cream/60 uppercase tracking-widest mb-3">Session Control</h4>
                    <div className="p-3 bg-black/40 border-2 border-cream/5 mb-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-cream/40 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-cream/70 font-mono">Terminate active session</p>
                          <p className="text-[10px] text-cream/30 font-mono mt-0.5">
                            Re-authentication required after logout
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-4 py-2.5 bg-charcoal-800 border-2 border-cream/10 text-cream font-mono text-xs uppercase tracking-wider hover:border-cream/20 hover:bg-charcoal-700 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Terminate Session
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-4 border-t border-red-500/20">
                    <h4 className="font-mono text-xs text-red-400/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" />
                      Danger Zone
                    </h4>
                    <div className="p-3 bg-red-950/20 border-2 border-red-500/10 mb-3">
                      <p className="text-xs text-cream/70 font-mono">Permanent Account Deletion</p>
                      <p className="text-[10px] text-cream/30 font-mono mt-0.5">
                        Irreversible action // All data will be purged
                      </p>
                    </div>
                    <button
                      onClick={() => toast.error('Contact support for account deletion')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-950/50 border-2 border-red-500/20 text-red-400 font-mono text-xs uppercase tracking-wider hover:border-red-500/40 hover:bg-red-950/70 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Fixed Action Bar - Video game style bottom bar */}
        {activeTab !== 'account' && (
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="bg-black/90 backdrop-blur-xl border-t-2 border-cream/10 px-4 lg:px-8 py-3">
              <div className="flex items-center justify-between max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 ${hasChanges ? 'bg-gold-500 animate-pulse' : 'bg-cream/20'}`} />
                  <span className="font-mono text-xs text-cream/50 uppercase tracking-wider">
                    {hasChanges ? 'Unsaved Changes' : 'Configuration Synced'}
                  </span>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className={`
                    flex items-center gap-2 px-6 py-2.5 font-mono text-xs uppercase tracking-widest
                    border-2 transition-all duration-150
                    ${hasChanges
                      ? 'bg-gold-500 border-gold-400 text-black hover:bg-gold-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                      : 'bg-charcoal-800 border-cream/10 text-cream/40 cursor-not-allowed'
                    }
                    disabled:opacity-50
                  `}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
