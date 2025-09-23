// Enhanced UserSettingsPage.js - Complete user settings with all authentication features
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AvatarUpload from '../components/auth/AvatarUpload';
import EmailVerification from '../components/auth/EmailVerification';
import Icon from '../components/ui/Icon';
import toast from 'react-hot-toast';

const UserSettingsPage = () => {
    const { 
        user, 
        userProfile, 
        updateProfile, 
        updateUserEmail, 
        updateUserPassword, 
        deleteAccount,
        loading 
    } = useAuth();
    const navigate = useNavigate();
    
    // Form states
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    
    // Profile settings
    const [profileData, setProfileData] = useState({
        displayName: '',
        bio: '',
        location: '',
        favoriteCorps: '',
        website: '',
        birthday: '',
        uniformStyle: 'classic'
    });
    
    // Email settings
    const [emailData, setEmailData] = useState({
        newEmail: '',
        currentPassword: ''
    });
    
    // Password settings
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    // Notification preferences
    const [notificationSettings, setNotificationSettings] = useState({
        emailNotifications: true,
        leagueNotifications: true,
        scoreNotifications: true,
        achievementNotifications: true,
        marketingEmails: false,
        pushNotifications: true,
        commentNotifications: true
    });
    
    // Privacy settings
    const [privacySettings, setPrivacySettings] = useState({
        profileVisibility: 'public',
        showStats: true,
        showLeagues: true,
        showAchievements: true,
        allowComments: true,
        showOnlineStatus: true,
        indexProfile: true
    });
    
    // Account deletion
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deletePassword, setDeletePassword] = useState('');

    // Load user data on mount
    useEffect(() => {
        if (userProfile) {
            setProfileData({
                displayName: userProfile.displayName || '',
                bio: userProfile.bio || '',
                location: userProfile.location || '',
                favoriteCorps: userProfile.favoriteCorps || '',
                website: userProfile.website || '',
                birthday: userProfile.birthday || '',
                uniformStyle: userProfile.uniformStyle || 'classic'
            });
            
            if (userProfile.settings) {
                setNotificationSettings(prev => ({
                    ...prev,
                    ...userProfile.settings.notifications
                }));
                
                setPrivacySettings(prev => ({
                    ...prev,
                    ...userProfile.settings.privacy
                }));
            }
        }
        
        if (user?.email) {
            setEmailData(prev => ({
                ...prev,
                newEmail: user.email
            }));
        }
    }, [userProfile, user]);

    // Handle profile update
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});
        
        try {
            // Validate profile data
            const validationErrors = {};
            
            if (profileData.displayName.length > 50) {
                validationErrors.displayName = 'Display name must be 50 characters or less';
            }
            
            if (profileData.bio.length > 500) {
                validationErrors.bio = 'Bio must be 500 characters or less';
            }
            
            if (profileData.website && !/^https?:\/\/.+/.test(profileData.website)) {
                validationErrors.website = 'Website must be a valid URL starting with http:// or https://';
            }
            
            if (Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors);
                return;
            }
            
            await updateProfile(profileData);
            toast.success('Profile updated successfully!');
            
        } catch (error) {
            console.error('Profile update error:', error);
            setErrors({ general: error.message });
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle email update
    const handleUpdateEmail = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});
        
        try {
            if (!emailData.newEmail.trim() || !emailData.currentPassword) {
                setErrors({ email: 'Email and current password are required' });
                return;
            }
            
            if (emailData.newEmail === user.email) {
                setErrors({ email: 'New email must be different from current email' });
                return;
            }
            
            await updateUserEmail(emailData.newEmail, emailData.currentPassword);
            setEmailData({ ...emailData, currentPassword: '' });
            
        } catch (error) {
            console.error('Email update error:', error);
            setErrors({ email: error.message });
            toast.error(error.message || 'Failed to update email');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle password update
    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});
        
        try {
            const { currentPassword, newPassword, confirmPassword } = passwordData;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                setErrors({ password: 'All password fields are required' });
                return;
            }
            
            if (newPassword !== confirmPassword) {
                setErrors({ password: 'New passwords do not match' });
                return;
            }
            
            if (newPassword.length < 6) {
                setErrors({ password: 'New password must be at least 6 characters' });
                return;
            }
            
            if (newPassword === currentPassword) {
                setErrors({ password: 'New password must be different from current password' });
                return;
            }
            
            await updateUserPassword(currentPassword, newPassword);
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            
        } catch (error) {
            console.error('Password update error:', error);
            setErrors({ password: error.message });
            toast.error(error.message || 'Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle notification settings update
    const handleUpdateNotifications = async () => {
        setIsLoading(true);
        
        try {
            await updateProfile({
                settings: {
                    ...userProfile?.settings,
                    notifications: notificationSettings
                }
            });
            toast.success('Notification preferences updated!');
            
        } catch (error) {
            console.error('Notification update error:', error);
            toast.error('Failed to update notification preferences');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle privacy settings update
    const handleUpdatePrivacy = async () => {
        setIsLoading(true);
        
        try {
            await updateProfile({
                settings: {
                    ...userProfile?.settings,
                    privacy: privacySettings
                }
            });
            toast.success('Privacy settings updated!');
            
        } catch (error) {
            console.error('Privacy update error:', error);
            toast.error('Failed to update privacy settings');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle account deletion
    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== 'DELETE') {
            setErrors({ delete: 'Please type "DELETE" to confirm' });
            return;
        }
        
        if (!deletePassword) {
            setErrors({ delete: 'Password is required to delete account' });
            return;
        }
        
        setIsLoading(true);
        
        try {
            await deleteAccount(deletePassword);
            navigate('/');
            
        } catch (error) {
            console.error('Account deletion error:', error);
            setErrors({ delete: error.message });
            toast.error(error.message || 'Failed to delete account');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle avatar update
    const handleAvatarUpdate = async (newAvatarUrl) => {
        try {
            await updateProfile({ avatar: newAvatarUrl });
        } catch (error) {
            console.error('Avatar update error:', error);
            toast.error('Failed to update profile with new avatar');
        }
    };

    // Tab configuration
    const tabs = [
        { id: 'profile', name: 'Profile', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
        { id: 'account', name: 'Account', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        { id: 'notifications', name: 'Notifications', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
        { id: 'privacy', name: 'Privacy', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
        { id: 'danger', name: 'Danger Zone', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' }
    ];

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-8 h-8 text-text-secondary dark:text-text-secondary-dark mx-auto mb-4 animate-spin" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        Account Settings
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        Manage your account preferences and privacy settings
                    </p>
                </div>

                {/* Email Verification Banner */}
                <EmailVerification user={user} />

                {/* General Error */}
                {errors.general && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <p className="text-red-700 dark:text-red-300">{errors.general}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <nav className="space-y-2">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-primary text-on-primary'
                                            : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10'
                                    }`}
                                >
                                    <Icon path={tab.icon} className="w-5 h-5" />
                                    {tab.name}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        <div className="bg-surface dark:bg-surface-dark rounded-2xl border border-accent/20 dark:border-accent-dark/20 p-6">
                            
                            {/* Profile Tab */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                                            Profile Information
                                        </h2>
                                    </div>

                                    {/* Avatar Section */}
                                    <div className="flex flex-col items-center gap-4 p-6 bg-accent/5 dark:bg-accent-dark/5 rounded-xl">
                                        <AvatarUpload
                                            currentAvatar={userProfile?.avatar}
                                            onAvatarUpdate={handleAvatarUpdate}
                                            size="large"
                                        />
                                    </div>

                                    {/* Profile Form */}
                                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Display Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={profileData.displayName}
                                                    onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                                                    className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                                        errors.displayName ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                                    }`}
                                                    placeholder="Your display name"
                                                    maxLength={50}
                                                />
                                                {errors.displayName && (
                                                    <p className="text-red-500 text-sm mt-1">{errors.displayName}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Username
                                                </label>
                                                <input
                                                    type="text"
                                                    value={userProfile?.username || ''}
                                                    disabled
                                                    className="w-full px-4 py-3 bg-accent/10 dark:bg-accent-dark/10 border border-accent/20 dark:border-accent-dark/20 rounded-xl text-text-secondary dark:text-text-secondary-dark"
                                                />
                                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                                                    Username cannot be changed
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                Bio
                                            </label>
                                            <textarea
                                                value={profileData.bio}
                                                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                                                rows={4}
                                                className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none ${
                                                    errors.bio ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                                }`}
                                                placeholder="Tell us about yourself..."
                                                maxLength={500}
                                            />
                                            <div className="flex justify-between items-center mt-1">
                                                {errors.bio && (
                                                    <p className="text-red-500 text-sm">{errors.bio}</p>
                                                )}
                                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark ml-auto">
                                                    {profileData.bio.length}/500
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Location
                                                </label>
                                                <input
                                                    type="text"
                                                    value={profileData.location}
                                                    onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="City, State/Country"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Favorite Corps
                                                </label>
                                                <input
                                                    type="text"
                                                    value={profileData.favoriteCorps}
                                                    onChange={(e) => setProfileData({...profileData, favoriteCorps: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="Your favorite drum corps"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                Website
                                            </label>
                                            <input
                                                type="url"
                                                value={profileData.website}
                                                onChange={(e) => setProfileData({...profileData, website: e.target.value})}
                                                className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                                    errors.website ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                                }`}
                                                placeholder="https://your-website.com"
                                            />
                                            {errors.website && (
                                                <p className="text-red-500 text-sm mt-1">{errors.website}</p>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full md:w-auto px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 animate-spin" />
                                                    Updating...
                                                </>
                                            ) : (
                                                'Update Profile'
                                            )}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Account Tab */}
                            {activeTab === 'account' && (
                                <div className="space-y-8">
                                    <div>
                                        <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                                            Account Security
                                        </h2>
                                    </div>

                                    {/* Email Section */}
                                    <div className="p-6 bg-accent/5 dark:bg-accent-dark/5 rounded-xl">
                                        <h3 className="text-lg font-medium text-text-primary dark:text-text-primary-dark mb-4">
                                            Email Address
                                        </h3>
                                        <form onSubmit={handleUpdateEmail} className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Current Email
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="email"
                                                        value={user.email}
                                                        disabled
                                                        className="flex-1 px-4 py-3 bg-accent/10 dark:bg-accent-dark/10 border border-accent/20 dark:border-accent-dark/20 rounded-xl text-text-secondary dark:text-text-secondary-dark"
                                                    />
                                                    {user.emailVerified ? (
                                                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                                                            <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4" />
                                                            Verified
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
                                                            <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-4 h-4" />
                                                            Unverified
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    New Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    value={emailData.newEmail}
                                                    onChange={(e) => setEmailData({...emailData, newEmail: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="Enter new email address"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Current Password
                                                </label>
                                                <input
                                                    type="password"
                                                    value={emailData.currentPassword}
                                                    onChange={(e) => setEmailData({...emailData, currentPassword: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="Confirm with current password"
                                                />
                                            </div>

                                            {errors.email && (
                                                <p className="text-red-500 text-sm">{errors.email}</p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isLoading || emailData.newEmail === user.email}
                                                className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary rounded-xl transition-all"
                                            >
                                                Update Email
                                            </button>
                                        </form>
                                    </div>

                                    {/* Password Section */}
                                    <div className="p-6 bg-accent/5 dark:bg-accent-dark/5 rounded-xl">
                                        <h3 className="text-lg font-medium text-text-primary dark:text-text-primary-dark mb-4">
                                            Change Password
                                        </h3>
                                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Current Password
                                                </label>
                                                <input
                                                    type="password"
                                                    value={passwordData.currentPassword}
                                                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="Enter current password"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    New Password
                                                </label>
                                                <input
                                                    type="password"
                                                    value={passwordData.newPassword}
                                                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="Enter new password"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                    Confirm New Password
                                                </label>
                                                <input
                                                    type="password"
                                                    value={passwordData.confirmPassword}
                                                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                                    placeholder="Confirm new password"
                                                />
                                            </div>

                                            {errors.password && (
                                                <p className="text-red-500 text-sm">{errors.password}</p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary rounded-xl transition-all"
                                            >
                                                Update Password
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Notifications Tab */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                                            Notification Preferences
                                        </h2>
                                    </div>

                                    <div className="space-y-4">
                                        {Object.entries({
                                            emailNotifications: 'Email Notifications',
                                            leagueNotifications: 'League Updates',
                                            scoreNotifications: 'Score Notifications',
                                            achievementNotifications: 'Achievement Alerts',
                                            commentNotifications: 'Comment Notifications',
                                            pushNotifications: 'Push Notifications',
                                            marketingEmails: 'Marketing Emails'
                                        }).map(([key, label]) => (
                                            <div key={key} className="flex items-center justify-between p-4 bg-accent/5 dark:bg-accent-dark/5 rounded-xl">
                                                <div>
                                                    <h3 className="font-medium text-text-primary dark:text-text-primary-dark">
                                                        {label}
                                                    </h3>
                                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        {key === 'emailNotifications' && 'Receive important updates via email'}
                                                        {key === 'leagueNotifications' && 'Get notified about league activities'}
                                                        {key === 'scoreNotifications' && 'Alerts for new scores and results'}
                                                        {key === 'achievementNotifications' && 'Notifications for unlocked achievements'}
                                                        {key === 'commentNotifications' && 'Get notified of new comments on your profile'}
                                                        {key === 'pushNotifications' && 'Browser push notifications'}
                                                        {key === 'marketingEmails' && 'Promotional content and news'}
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={notificationSettings[key]}
                                                        onChange={(e) => setNotificationSettings({
                                                            ...notificationSettings,
                                                            [key]: e.target.checked
                                                        })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-accent/20 dark:bg-accent-dark/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleUpdateNotifications}
                                        disabled={isLoading}
                                        className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary rounded-xl transition-all"
                                    >
                                        Save Preferences
                                    </button>
                                </div>
                            )}

                            {/* Privacy Tab */}
                            {activeTab === 'privacy' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                                            Privacy Settings
                                        </h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 bg-accent/5 dark:bg-accent-dark/5 rounded-xl">
                                            <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                                Profile Visibility
                                            </h3>
                                            <select
                                                value={privacySettings.profileVisibility}
                                                onChange={(e) => setPrivacySettings({
                                                    ...privacySettings,
                                                    profileVisibility: e.target.value
                                                })}
                                                className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                            >
                                                <option value="public">Public - Anyone can view</option>
                                                <option value="friends">Friends Only</option>
                                                <option value="private">Private - Only me</option>
                                            </select>
                                        </div>

                                        {Object.entries({
                                            showStats: 'Show Game Statistics',
                                            showLeagues: 'Show League Participation',
                                            showAchievements: 'Show Achievements',
                                            allowComments: 'Allow Profile Comments',
                                            showOnlineStatus: 'Show Online Status',
                                            indexProfile: 'Allow Search Engine Indexing'
                                        }).map(([key, label]) => (
                                            <div key={key} className="flex items-center justify-between p-4 bg-accent/5 dark:bg-accent-dark/5 rounded-xl">
                                                <div>
                                                    <h3 className="font-medium text-text-primary dark:text-text-primary-dark">
                                                        {label}
                                                    </h3>
                                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        {key === 'showStats' && 'Display your game statistics on your profile'}
                                                        {key === 'showLeagues' && 'Show which leagues you participate in'}
                                                        {key === 'showAchievements' && 'Display your earned achievements'}
                                                        {key === 'allowComments' && 'Let other users comment on your profile'}
                                                        {key === 'showOnlineStatus' && 'Show when you are online'}
                                                        {key === 'indexProfile' && 'Allow your profile to appear in search results'}
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={privacySettings[key]}
                                                        onChange={(e) => setPrivacySettings({
                                                            ...privacySettings,
                                                            [key]: e.target.checked
                                                        })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-accent/20 dark:bg-accent-dark/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleUpdatePrivacy}
                                        disabled={isLoading}
                                        className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary rounded-xl transition-all"
                                    >
                                        Save Privacy Settings
                                    </button>
                                </div>
                            )}

                            {/* Danger Zone Tab */}
                            {activeTab === 'danger' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
                                            Danger Zone
                                        </h2>
                                        <p className="text-text-secondary dark:text-text-secondary-dark">
                                            These actions are permanent and cannot be undone.
                                        </p>
                                    </div>

                                    <div className="border border-red-200 dark:border-red-800 rounded-xl p-6 bg-red-50 dark:bg-red-900/10">
                                        <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                                            Delete Account
                                        </h3>
                                        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                                            Once you delete your account, there is no going back. Your profile, 
                                            league participation, comments, and all associated data will be permanently removed.
                                        </p>

                                        {!showDeleteConfirm ? (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                                            >
                                                Delete Account
                                            </button>
                                        ) : (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                                        Type "DELETE" to confirm
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={deleteConfirmation}
                                                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                                                        className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-red-300 dark:border-red-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                                                        placeholder="Type DELETE"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                                        Enter your password
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={deletePassword}
                                                        onChange={(e) => setDeletePassword(e.target.value)}
                                                        className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-red-300 dark:border-red-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                                                        placeholder="Enter your password"
                                                    />
                                                </div>

                                                {errors.delete && (
                                                    <p className="text-red-500 text-sm">{errors.delete}</p>
                                                )}

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={handleDeleteAccount}
                                                        disabled={isLoading || deleteConfirmation !== 'DELETE' || !deletePassword}
                                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                                                    >
                                                        {isLoading ? 'Deleting...' : 'Delete Account Permanently'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowDeleteConfirm(false);
                                                            setDeleteConfirmation('');
                                                            setDeletePassword('');
                                                            setErrors({});
                                                        }}
                                                        disabled={isLoading}
                                                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserSettingsPage;