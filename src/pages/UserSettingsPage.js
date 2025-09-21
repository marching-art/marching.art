import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/ui/Icon';

const UserSettingsPage = () => {
    const { user, loggedInProfile } = useUserStore();
    const navigate = useNavigate();
    
    // Profile settings
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [favoriteCorps, setFavoriteCorps] = useState('');
    
    // Email settings
    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    
    // Password settings
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Notification preferences
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [leagueNotifications, setLeagueNotifications] = useState(true);
    const [scoreNotifications, setScoreNotifications] = useState(true);
    const [showNotifications, setShowNotifications] = useState(true);
    
    // Privacy settings
    const [profileVisibility, setProfileVisibility] = useState('public');
    const [showStats, setShowStats] = useState(true);
    const [showLeagues, setShowLeagues] = useState(true);
    
    // UI state
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');

    // Load current settings
    useEffect(() => {
        const loadSettings = async () => {
            if (!user) return;
            
            try {
                if (loggedInProfile) {
                    setDisplayName(loggedInProfile.displayName || '');
                    setBio(loggedInProfile.bio || '');
                    setLocation(loggedInProfile.location || '');
                    setFavoriteCorps(loggedInProfile.favoriteCorps || '');
                }
                
                const settingsDoc = await getDoc(doc(db, `artifacts/prod/users/${user.uid}/settings/account`));
                if (settingsDoc.exists()) {
                    const settings = settingsDoc.data();
                    setEmailNotifications(settings.emailNotifications ?? true);
                    setLeagueNotifications(settings.leagueNotifications ?? true);
                    setScoreNotifications(settings.scoreNotifications ?? true);
                    setShowNotifications(settings.showNotifications ?? true);
                    setProfileVisibility(settings.profileVisibility || 'public');
                    setShowStats(settings.showStats ?? true);
                    setShowLeagues(settings.showLeagues ?? true);
                }
                
                setNewEmail(user.email || '');
            } catch (error) {
                console.error('Error loading settings:', error);
                toast.error('Failed to load settings');
            }
        };
        
        loadSettings();
    }, [user, loggedInProfile]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!user) return;
        
        setIsLoading(true);
        try {
            await updateDoc(doc(db, `artifacts/prod/users/${user.uid}/profile/data`), {
                displayName: displayName.trim(),
                bio: bio.trim(),
                location: location.trim(),
                favoriteCorps: favoriteCorps.trim(),
                updatedAt: new Date()
            });
            
            toast.success('Profile updated successfully');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateEmail = async (e) => {
        e.preventDefault();
        if (!user || !emailPassword) return;
        
        setIsLoading(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, emailPassword);
            await reauthenticateWithCredential(user, credential);
            await updateEmail(user, newEmail);
            
            toast.success('Email updated successfully');
            setEmailPassword('');
        } catch (error) {
            console.error('Error updating email:', error);
            if (error.code === 'auth/wrong-password') {
                toast.error('Incorrect password');
            } else if (error.code === 'auth/email-already-in-use') {
                toast.error('Email is already in use');
            } else {
                toast.error('Failed to update email');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (!user || !currentPassword || !newPassword) return;
        
        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }
        
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        
        setIsLoading(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            
            toast.success('Password updated successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Error updating password:', error);
            if (error.code === 'auth/wrong-password') {
                toast.error('Incorrect current password');
            } else {
                toast.error('Failed to update password');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateNotifications = async () => {
        if (!user) return;
        
        setIsLoading(true);
        try {
            await setDoc(doc(db, `artifacts/prod/users/${user.uid}/settings/account`), {
                emailNotifications,
                leagueNotifications,
                scoreNotifications,
                showNotifications,
                profileVisibility,
                showStats,
                showLeagues,
                updatedAt: new Date()
            }, { merge: true });
            
            toast.success('Settings updated successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
            toast.error('Failed to update settings');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', name: 'Profile', icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
        { id: 'account', name: 'Account', icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" },
        { id: 'notifications', name: 'Notifications', icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" },
        { id: 'privacy', name: 'Privacy', icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" }
    ];

    if (!user) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Access Denied</h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Please log in to access your settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark mb-4 transition-colors"
                    >
                        <Icon path="M15.75 19.5L8.25 12l7.5-7.5" className="w-5 h-5" />
                        Back
                    </button>
                    <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">Account Settings</h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                        Manage your account preferences and settings
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2 mb-8 border-b border-accent dark:border-accent-dark">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                                activeTab === tab.id
                                    ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
                                    : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                        >
                            <Icon path={tab.icon} className="w-4 h-4" />
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                    {activeTab === 'profile' && (
                        <div>
                            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Profile Information</h2>
                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                        placeholder="Your display name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                        Bio
                                    </label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                        placeholder="Tell us about yourself"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                        placeholder="Your location"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                        Favorite Corps
                                    </label>
                                    <input
                                        type="text"
                                        value={favoriteCorps}
                                        onChange={(e) => setFavoriteCorps(e.target.value)}
                                        className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                        placeholder="Your favorite drum corps"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-6 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? 'Updating...' : 'Update Profile'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="space-y-8">
                            {/* Email Change */}
                            <div>
                                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Change Email</h2>
                                <form onSubmit={handleUpdateEmail} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                            New Email
                                        </label>
                                        <input
                                            type="email"
                                            value={newEmail}
                                            onChange={(e) => setNewEmail(e.target.value)}
                                            className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            value={emailPassword}
                                            onChange={(e) => setEmailPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading || !emailPassword}
                                        className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-6 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? 'Updating...' : 'Update Email'}
                                    </button>
                                </form>
                            </div>

                            {/* Password Change */}
                            <div className="border-t border-accent dark:border-accent-dark pt-8">
                                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Change Password</h2>
                                <form onSubmit={handleUpdatePassword} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
                                        className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-6 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div>
                            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Notification Preferences</h2>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-text-primary dark:text-text-primary-dark">Email Notifications</h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Receive notifications via email</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={emailNotifications}
                                            onChange={(e) => setEmailNotifications(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary-dark/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-text-primary dark:text-text-primary-dark">League Notifications</h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Get notified about league activities</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={leagueNotifications}
                                            onChange={(e) => setLeagueNotifications(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary-dark/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-text-primary dark:text-text-primary-dark">Score Notifications</h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Get notified when new scores are available</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scoreNotifications}
                                            onChange={(e) => setScoreNotifications(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary-dark/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-text-primary dark:text-text-primary-dark">Show Notifications</h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Get notified about show registrations and updates</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showNotifications}
                                            onChange={(e) => setShowNotifications(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary-dark/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                                    </label>
                                </div>

                                <button
                                    onClick={handleUpdateNotifications}
                                    disabled={isLoading}
                                    className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-6 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? 'Updating...' : 'Save Notification Settings'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'privacy' && (
                        <div>
                            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Privacy Settings</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                        Profile Visibility
                                    </label>
                                    <select
                                        value={profileVisibility}
                                        onChange={(e) => setProfileVisibility(e.target.value)}
                                        className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                    >
                                        <option value="public">Public - Anyone can view your profile</option>
                                        <option value="friends">Friends Only - Only league members can view</option>
                                        <option value="private">Private - Only you can view your profile</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-text-primary dark:text-text-primary-dark">Show Statistics</h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Display your game statistics on your profile</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showStats}
                                            onChange={(e) => setShowStats(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary-dark/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-text-primary dark:text-text-primary-dark">Show League Membership</h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Display your league memberships on your profile</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showLeagues}
                                            onChange={(e) => setShowLeagues(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary-dark/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                                    </label>
                                </div>

                                <button
                                    onClick={handleUpdateNotifications}
                                    disabled={isLoading}
                                    className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-6 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? 'Updating...' : 'Save Privacy Settings'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Delete Account Section - Always visible at bottom */}
                <div className="mt-12 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme p-6">
                    <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Delete Account</h3>
                            <p className="text-red-700 dark:text-red-300 text-sm mb-4">
                                This action cannot be undone. All your data, including your profile, scores, leagues, and game history will be permanently deleted.
                            </p>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="bg-red-600 text-white font-bold py-2 px-4 rounded-theme hover:bg-red-700 transition-colors"
                            >
                                Delete My Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* Delete Account Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6 max-w-md w-full">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                                    <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">Confirm Account Deletion</h3>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">This action cannot be undone</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-text-primary dark:text-text-primary-dark mb-4">
                                    Are you absolutely sure you want to delete your account? This will permanently remove:
                                </p>
                                <ul className="list-disc list-inside text-sm text-text-secondary dark:text-text-secondary-dark space-y-1 mb-4">
                                    <li>Your profile and personal information</li>
                                    <li>All your game scores and statistics</li>
                                    <li>Your league memberships and history</li>
                                    <li>Your corps registrations and lineup data</li>
                                    <li>All comments and social interactions</li>
                                </ul>
                                <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                                    Please enter your password to confirm this irreversible action.
                                </p>
                            </div>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleDeleteAccount();
                            }} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Enter your password"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeletePassword('');
                                        }}
                                        className="flex-1 bg-transparent border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!deletePassword || isLoading}
                                        className="flex-1 bg-red-600 text-white font-bold py-2 px-4 rounded-theme hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? 'Deleting...' : 'Delete Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // Add the delete account function here
    const handleDeleteAccount = async () => {
        if (!user || !deletePassword) return;
        
        setIsLoading(true);
        try {
            // Reauthenticate user
            const credential = EmailAuthProvider.credential(user.email, deletePassword);
            await reauthenticateWithCredential(user, credential);
            
            // Delete user account
            await deleteUser(user);
            
            toast.success('Account deleted successfully');
            navigate('/');
        } catch (error) {
            console.error('Error deleting account:', error);
            if (error.code === 'auth/wrong-password') {
                toast.error('Incorrect password');
            } else {
                toast.error('Failed to delete account. Please try again.');
            }
        } finally {
            setIsLoading(false);
            setShowDeleteConfirm(false);
            setDeletePassword('');
        }
    };
};

export default UserSettingsPage;