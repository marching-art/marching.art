// pages/SettingsPage.js
// Settings page for Enhanced Fantasy Drum Corps Game
// Optimized for user customization and preferences

import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, updateEmail, deleteUser } from 'firebase/auth';
import { auth, db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import toast from 'react-hot-toast';

const SettingsPage = () => {
    const { user, loggedInProfile, updateProfile } = useUserStore();
    const navigate = useNavigate();

    // State management
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState({
        // Profile settings
        displayName: '',
        bio: '',
        isPrivate: false,
        
        // Notification settings
        emailNotifications: true,
        pushNotifications: true,
        weeklyDigest: true,
        tradeAlerts: true,
        leagueUpdates: true,
        
        // Game preferences
        theme: 'system', // 'light', 'dark', 'system'
        defaultCorpsClass: 'worldClass',
        autoSave: true,
        confirmActions: true,
        
        // Privacy settings
        profileVisibility: 'public', // 'public', 'friends', 'private'
        showRealName: false,
        showLocation: false,
        allowMessages: true
    });

    // Password change state
    const [passwordForm, setPasswordForm] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    // Load user settings on mount
    useEffect(() => {
        if (loggedInProfile) {
            setSettings(prev => ({
                ...prev,
                displayName: loggedInProfile.displayName || '',
                bio: loggedInProfile.bio || '',
                isPrivate: loggedInProfile.isPrivate || false,
                ...loggedInProfile.settings
            }));
        }
    }, [loggedInProfile]);

    // Handle settings update
    const handleSettingsUpdate = async (newSettings) => {
        if (!user) return;

        setIsLoading(true);
        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            await updateDoc(profileRef, {
                settings: newSettings,
                lastUpdated: new Date()
            });

            setSettings(newSettings);
            toast.success('Settings updated successfully!');
        } catch (error) {
            console.error('Error updating settings:', error);
            toast.error('Failed to update settings');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle profile update
    const handleProfileUpdate = async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            await updateDoc(profileRef, {
                displayName: settings.displayName,
                bio: settings.bio,
                isPrivate: settings.isPrivate,
                lastUpdated: new Date()
            });

            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle password change
    const handlePasswordChange = async () => {
        if (passwordForm.new !== passwordForm.confirm) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwordForm.new.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            await updatePassword(user, passwordForm.new);
            setPasswordForm({ current: '', new: '', confirm: '' });
            toast.success('Password updated successfully!');
        } catch (error) {
            console.error('Error updating password:', error);
            toast.error('Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle account deletion
    const handleAccountDeletion = async () => {
        const confirmText = 'DELETE MY ACCOUNT';
        const userInput = prompt(
            `This action cannot be undone. All your corps, achievements, and data will be permanently deleted.\n\nType "${confirmText}" to confirm:`
        );

        if (userInput !== confirmText) {
            return;
        }

        setIsLoading(true);
        try {
            // Delete user data from Firestore first
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            await updateDoc(profileRef, {
                deleted: true,
                deletedAt: new Date()
            });

            // Delete the user account
            await deleteUser(user);
            
            toast.success('Account deleted successfully');
            navigate('/');
        } catch (error) {
            console.error('Error deleting account:', error);
            toast.error('Failed to delete account');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: 'user' },
        { id: 'notifications', label: 'Notifications', icon: 'bell' },
        { id: 'preferences', label: 'Preferences', icon: 'settings' },
        { id: 'privacy', label: 'Privacy', icon: 'shield' },
        { id: 'account', label: 'Account', icon: 'key' }
    ];

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* Header */}
            <div className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                                Settings
                            </h1>
                            <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
                                Manage your account and preferences
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent/10 transition-colors flex items-center gap-2"
                        >
                            <Icon name="arrow-left" size={16} />
                            Dashboard
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <nav className="space-y-2">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-theme transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-primary text-on-primary'
                                            : 'text-text-primary dark:text-text-primary-dark hover:bg-accent/10'
                                    }`}
                                >
                                    <Icon name={tab.icon} size={18} />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {activeTab === 'profile' && (
                            <ProfileSettings
                                settings={settings}
                                setSettings={setSettings}
                                onUpdate={handleProfileUpdate}
                                isLoading={isLoading}
                            />
                        )}
                        
                        {activeTab === 'notifications' && (
                            <NotificationSettings
                                settings={settings}
                                setSettings={setSettings}
                                onUpdate={handleSettingsUpdate}
                                isLoading={isLoading}
                            />
                        )}
                        
                        {activeTab === 'preferences' && (
                            <GamePreferences
                                settings={settings}
                                setSettings={setSettings}
                                onUpdate={handleSettingsUpdate}
                                isLoading={isLoading}
                            />
                        )}
                        
                        {activeTab === 'privacy' && (
                            <PrivacySettings
                                settings={settings}
                                setSettings={setSettings}
                                onUpdate={handleSettingsUpdate}
                                isLoading={isLoading}
                            />
                        )}
                        
                        {activeTab === 'account' && (
                            <AccountSettings
                                passwordForm={passwordForm}
                                setPasswordForm={setPasswordForm}
                                onPasswordChange={handlePasswordChange}
                                onAccountDeletion={handleAccountDeletion}
                                isLoading={isLoading}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Profile Settings Component
const ProfileSettings = ({ settings, setSettings, onUpdate, isLoading }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark space-y-6"
    >
        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Profile Information
        </h2>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Display Name
                </label>
                <input
                    type="text"
                    value={settings.displayName}
                    onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Enter your display name"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Bio
                </label>
                <textarea
                    value={settings.bio}
                    onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                    className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Tell others about your drum corps journey..."
                />
            </div>
            
            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    id="privateProfile"
                    checked={settings.isPrivate}
                    onChange={(e) => setSettings(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    className="h-4 w-4 text-primary focus:ring-primary border-accent rounded"
                />
                <label htmlFor="privateProfile" className="text-sm text-text-primary dark:text-text-primary-dark">
                    Make my profile private
                </label>
            </div>
        </div>
        
        <button
            onClick={onUpdate}
            disabled={isLoading}
            className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
            {isLoading ? 'Updating...' : 'Update Profile'}
        </button>
    </motion.div>
);

// Notification Settings Component
const NotificationSettings = ({ settings, setSettings, onUpdate, isLoading }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark space-y-6"
    >
        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Notification Preferences
        </h2>
        
        <div className="space-y-4">
            {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                { key: 'pushNotifications', label: 'Push Notifications', desc: 'Browser push notifications' },
                { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of your performance' },
                { key: 'tradeAlerts', label: 'Trade Alerts', desc: 'Notifications for staff trading' },
                { key: 'leagueUpdates', label: 'League Updates', desc: 'Updates from your leagues' }
            ].map(option => (
                <div key={option.key} className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme">
                    <div>
                        <div className="font-medium text-text-primary dark:text-text-primary-dark">
                            {option.label}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {option.desc}
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={settings[option.key]}
                        onChange={(e) => setSettings(prev => ({ ...prev, [option.key]: e.target.checked }))}
                        className="h-4 w-4 text-primary focus:ring-primary border-accent rounded"
                    />
                </div>
            ))}
        </div>
        
        <button
            onClick={() => onUpdate(settings)}
            disabled={isLoading}
            className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
            {isLoading ? 'Updating...' : 'Update Notifications'}
        </button>
    </motion.div>
);

// Game Preferences Component
const GamePreferences = ({ settings, setSettings, onUpdate, isLoading }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark space-y-6"
    >
        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Game Preferences
        </h2>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Theme
                </label>
                <select
                    value={settings.theme}
                    onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
                    className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                >
                    <option value="system">System Default</option>
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                </select>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Default Corps Class
                </label>
                <select
                    value={settings.defaultCorpsClass}
                    onChange={(e) => setSettings(prev => ({ ...prev, defaultCorpsClass: e.target.value }))}
                    className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                >
                    <option value="worldClass">World Class</option>
                    <option value="openClass">Open Class</option>
                    <option value="allAge">All Age</option>
                </select>
            </div>
            
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme">
                    <div>
                        <div className="font-medium text-text-primary dark:text-text-primary-dark">Auto Save</div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Automatically save lineup changes</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={settings.autoSave}
                        onChange={(e) => setSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                        className="h-4 w-4 text-primary focus:ring-primary border-accent rounded"
                    />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme">
                    <div>
                        <div className="font-medium text-text-primary dark:text-text-primary-dark">Confirm Actions</div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Show confirmation for important actions</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={settings.confirmActions}
                        onChange={(e) => setSettings(prev => ({ ...prev, confirmActions: e.target.checked }))}
                        className="h-4 w-4 text-primary focus:ring-primary border-accent rounded"
                    />
                </div>
            </div>
        </div>
        
        <button
            onClick={() => onUpdate(settings)}
            disabled={isLoading}
            className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
            {isLoading ? 'Updating...' : 'Update Preferences'}
        </button>
    </motion.div>
);

// Privacy Settings Component
const PrivacySettings = ({ settings, setSettings, onUpdate, isLoading }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark space-y-6"
    >
        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Privacy Settings
        </h2>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Profile Visibility
                </label>
                <select
                    value={settings.profileVisibility}
                    onChange={(e) => setSettings(prev => ({ ...prev, profileVisibility: e.target.value }))}
                    className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                >
                    <option value="public">Public</option>
                    <option value="friends">Friends Only</option>
                    <option value="private">Private</option>
                </select>
            </div>
            
            <div className="space-y-3">
                {[
                    { key: 'showRealName', label: 'Show Real Name', desc: 'Display your real name on your profile' },
                    { key: 'showLocation', label: 'Show Location', desc: 'Display your location on your profile' },
                    { key: 'allowMessages', label: 'Allow Messages', desc: 'Allow other users to send you messages' }
                ].map(option => (
                    <div key={option.key} className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme">
                        <div>
                            <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                {option.label}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                {option.desc}
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings[option.key]}
                            onChange={(e) => setSettings(prev => ({ ...prev, [option.key]: e.target.checked }))}
                            className="h-4 w-4 text-primary focus:ring-primary border-accent rounded"
                        />
                    </div>
                ))}
            </div>
        </div>
        
        <button
            onClick={() => onUpdate(settings)}
            disabled={isLoading}
            className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
            {isLoading ? 'Updating...' : 'Update Privacy Settings'}
        </button>
    </motion.div>
);

// Account Settings Component
const AccountSettings = ({ passwordForm, setPasswordForm, onPasswordChange, onAccountDeletion, isLoading }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
    >
        {/* Password Change */}
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                Change Password
            </h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                        Current Password
                    </label>
                    <input
                        type="password"
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                        className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                        New Password
                    </label>
                    <input
                        type="password"
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                        className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                        Confirm New Password
                    </label>
                    <input
                        type="password"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                        className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                </div>
            </div>
            
            <button
                onClick={onPasswordChange}
                disabled={isLoading || !passwordForm.current || !passwordForm.new || !passwordForm.confirm}
                className="mt-4 bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
                {isLoading ? 'Updating...' : 'Change Password'}
            </button>
        </div>
        
        {/* Danger Zone */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-theme p-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
                Danger Zone
            </h2>
            
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Delete Account
                    </h3>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button
                        onClick={onAccountDeletion}
                        disabled={isLoading}
                        className="bg-red-500 text-white px-6 py-3 rounded-theme font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    </motion.div>
);

export default SettingsPage;