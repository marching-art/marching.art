// src/pages/SettingsPage.js - User settings and account management
import React, { useState, useEffect } from 'react';
import { 
    updatePassword, 
    updateEmail, 
    sendEmailVerification, 
    reauthenticateWithCredential, 
    EmailAuthProvider,
    deleteUser
} from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { checkUsername } from '../utils/api';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';

const SettingsPage = ({ setPage, onLogout }) => {
    const { user, loggedInProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('account');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Account settings state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [bio, setBio] = useState('');

    // Preferences state
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [leagueInvites, setLeagueInvites] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(true);

    // Privacy state
    const [profileVisibility, setProfileVisibility] = useState('public');
    const [showLastActive, setShowLastActive] = useState(true);
    const [showStats, setShowStats] = useState(true);

    // Deletion modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');

    useEffect(() => {
        if (loggedInProfile) {
            setNewUsername(loggedInProfile.username || '');
            setBio(loggedInProfile.bio || '');
            setEmailNotifications(loggedInProfile.preferences?.emailNotifications ?? true);
            setLeagueInvites(loggedInProfile.preferences?.leagueInvites ?? true);
            setWeeklyDigest(loggedInProfile.preferences?.weeklyDigest ?? true);
            setProfileVisibility(loggedInProfile.privacy?.profileVisibility || 'public');
            setShowLastActive(loggedInProfile.privacy?.showLastActive ?? true);
            setShowStats(loggedInProfile.privacy?.showStats ?? true);
        }
        if (user) {
            setNewEmail(user.email || '');
        }
    }, [loggedInProfile, user]);

    const showMessage = (type, text, duration = 5000) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), duration);
    };

    const reauthenticate = async () => {
        if (!currentPassword) {
            throw new Error('Please enter your current password to proceed.');
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 6) {
            showMessage('error', 'New password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            showMessage('error', 'New passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            await reauthenticate();
            await updatePassword(user, newPassword);
            showMessage('success', 'Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            showMessage('error', error.message);
        }
        setIsLoading(false);
    };

    const handleEmailChange = async (e) => {
        e.preventDefault();
        if (!newEmail || newEmail === user.email) {
            showMessage('error', 'Please enter a new email address.');
            return;
        }

        setIsLoading(true);
        try {
            await reauthenticate();
            await updateEmail(user, newEmail);
            await sendEmailVerification(user);
            showMessage('success', 'Email updated! Please check your new email to verify it.');
            setCurrentPassword('');
        } catch (error) {
            showMessage('error', error.message);
        }
        setIsLoading(false);
    };

    const handleUsernameChange = async (e) => {
        e.preventDefault();
        if (!newUsername || newUsername === loggedInProfile.username) {
            showMessage('error', 'Please enter a new username.');
            return;
        }

        setIsLoading(true);
        try {
            await checkUsername({ username: newUsername });
            
            const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
            await updateDoc(profileRef, { username: newUsername });
            
            showMessage('success', 'Username updated successfully!');
        } catch (error) {
            showMessage('error', error.message);
        }
        setIsLoading(false);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
            await updateDoc(profileRef, { 
                bio: bio.trim(),
                preferences: {
                    emailNotifications,
                    leagueInvites,
                    weeklyDigest
                },
                privacy: {
                    profileVisibility,
                    showLastActive,
                    showStats
                }
            });
            showMessage('success', 'Profile settings updated successfully!');
        } catch (error) {
            showMessage('error', error.message);
        }
        setIsLoading(false);
    };

    const handleAccountDeletion = async () => {
        if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
            showMessage('error', 'Please type exactly "DELETE MY ACCOUNT" to confirm.');
            return;
        }

        setIsLoading(true);
        try {
            await reauthenticate();
            
            // Delete user profile from Firestore
            const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
            await deleteDoc(profileRef);
            
            // Delete Firebase Auth user
            await deleteUser(user);
            
            showMessage('success', 'Account deleted successfully. You will be logged out.');
            setTimeout(() => {
                onLogout();
                setPage('home');
            }, 2000);
        } catch (error) {
            showMessage('error', error.message);
        }
        setIsLoading(false);
        setShowDeleteModal(false);
    };

    const renderAccountTab = () => (
        <div className="space-y-8">
            {/* Password Change */}
            <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Change Password
                </h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current Password"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password (min 6 characters)"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                    >
                        Update Password
                    </button>
                </form>
            </div>

            {/* Email Change */}
            <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Change Email Address
                </h3>
                <form onSubmit={handleEmailChange} className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                        <span>Current: {user?.email}</span>
                        {!user?.emailVerified && (
                            <span className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs">
                                Unverified
                            </span>
                        )}
                    </div>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current Password"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="New Email Address"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !currentPassword || !newEmail}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                    >
                        Update Email
                    </button>
                </form>
            </div>

            {/* Username Change */}
            <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Change Username
                </h3>
                <form onSubmit={handleUsernameChange} className="space-y-4">
                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        Current: @{loggedInProfile?.username}
                    </div>
                    <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="New Username"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !newUsername || newUsername === loggedInProfile?.username}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                    >
                        Update Username
                    </button>
                </form>
            </div>
        </div>
    );

    const renderProfileTab = () => (
        <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                Profile Information
            </h3>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Bio
                    </label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell other directors about yourself..."
                        rows={4}
                        maxLength={500}
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark resize-none"
                    />
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                        {bio.length}/500 characters
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                >
                    Save Profile
                </button>
            </form>
        </div>
    );

    const renderPreferencesTab = () => (
        <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-6">
                Notification Preferences
            </h3>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="space-y-4">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={emailNotifications}
                            onChange={(e) => setEmailNotifications(e.target.checked)}
                            className="w-4 h-4 text-primary border-accent dark:border-accent-dark rounded focus:ring-primary"
                        />
                        <div>
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                Email Notifications
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Receive emails about comments, league activities, and important updates
                            </div>
                        </div>
                    </label>
                    
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={leagueInvites}
                            onChange={(e) => setLeagueInvites(e.target.checked)}
                            className="w-4 h-4 text-primary border-accent dark:border-accent-dark rounded focus:ring-primary"
                        />
                        <div>
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                League Invites
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Allow others to invite you to join their leagues
                            </div>
                        </div>
                    </label>
                    
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={weeklyDigest}
                            onChange={(e) => setWeeklyDigest(e.target.checked)}
                            className="w-4 h-4 text-primary border-accent dark:border-accent-dark rounded focus:ring-primary"
                        />
                        <div>
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                Weekly Digest
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Get a weekly summary of your corps performance and league standings
                            </div>
                        </div>
                    </label>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                >
                    Save Preferences
                </button>
            </form>
        </div>
    );

    const renderPrivacyTab = () => (
        <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-6">
                Privacy Settings
            </h3>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Profile Visibility
                    </label>
                    <select
                        value={profileVisibility}
                        onChange={(e) => setProfileVisibility(e.target.value)}
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    >
                        <option value="public">Public - Anyone can view your profile</option>
                        <option value="friends">Friends Only - Only league members can view</option>
                        <option value="private">Private - Only you can view your profile</option>
                    </select>
                </div>
                
                <div className="space-y-4">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={showLastActive}
                            onChange={(e) => setShowLastActive(e.target.checked)}
                            className="w-4 h-4 text-primary border-accent dark:border-accent-dark rounded focus:ring-primary"
                        />
                        <div>
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                Show Last Active
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Let others see when you were last online
                            </div>
                        </div>
                    </label>
                    
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={showStats}
                            onChange={(e) => setShowStats(e.target.checked)}
                            className="w-4 h-4 text-primary border-accent dark:border-accent-dark rounded focus:ring-primary"
                        />
                        <div>
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                Show Statistics
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Display your corps scores and season statistics on your profile
                            </div>
                        </div>
                    </label>
                </div>
                
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                >
                    Save Privacy Settings
                </button>
            </form>
        </div>
    );

    const renderDangerTab = () => (
        <div className="space-y-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme p-6">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
                    <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-5 h-5" />
                    Danger Zone
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                            Delete Account
                        </h4>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                            This action cannot be undone. This will permanently delete your account, 
                            all your corps, league memberships, and remove your data from our servers.
                        </p>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-theme"
                        >
                            Delete My Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const tabs = [
        { id: 'account', label: 'Account', icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
        { id: 'profile', label: 'Profile', icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
        { id: 'preferences', label: 'Preferences', icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" },
        { id: 'privacy', label: 'Privacy', icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
        { id: 'danger', label: 'Account', icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" }
    ];

    if (!user || !loggedInProfile) {
        return <LoadingScreen message="Loading settings..." />;
    }

    return (
        <>
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Account"
            >
                <div className="space-y-4">
                    <div className="text-red-600 dark:text-red-400">
                        <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-12 h-12 mx-auto mb-4" />
                    </div>
                    <p className="text-text-primary dark:text-text-primary-dark text-center">
                        Are you absolutely sure you want to delete your account?
                    </p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark text-center">
                        This action cannot be undone. All your data will be permanently deleted.
                    </p>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder='Type "DELETE MY ACCOUNT" to confirm'
                        className="w-full bg-surface dark:bg-surface-dark border border-red-500 rounded-theme p-3 text-text-primary dark:text-text-primary-dark"
                    />
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAccountDeletion}
                            disabled={isLoading || deleteConfirmation !== 'DELETE MY ACCOUNT' || !currentPassword}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                        >
                            {isLoading ? 'Deleting...' : 'Delete Account'}
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="p-4 md:p-8 max-w-6xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => setPage('dashboard')}
                            className="text-primary dark:text-primary-dark hover:underline flex items-center gap-2"
                        >
                            <Icon path="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" className="w-4 h-4" />
                            Back to Dashboard
                        </button>
                    </div>
                    <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark">
                        Account Settings
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                        Manage your account, profile, and privacy settings
                    </p>
                </div>

                {message.text && (
                    <div className={`mb-6 p-4 rounded-theme border ${
                        message.type === 'success' 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' 
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                    }`}>
                        <div className="flex items-center gap-2">
                            <Icon 
                                path={message.type === 'success' 
                                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                } 
                                className="w-5 h-5 flex-shrink-0" 
                            />
                            {message.text}
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:w-1/4">
                        <nav className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-2 sticky top-8">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-theme text-left transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-primary text-on-primary'
                                            : 'text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                    }`}
                                >
                                    <Icon path={tab.icon} className="w-5 h-5" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="lg:w-3/4">
                        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                            {activeTab === 'account' && renderAccountTab()}
                            {activeTab === 'profile' && renderProfileTab()}
                            {activeTab === 'preferences' && renderPreferencesTab()}
                            {activeTab === 'privacy' && renderPrivacyTab()}
                            {activeTab === 'danger' && renderDangerTab()}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SettingsPage;