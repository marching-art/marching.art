// src/pages/ProfilePage.js - Simplified version with better error handling
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { getAllUserCorps, CORPS_CLASSES } from '../utils/profileCompatibility';
import { useUserStore } from '../store/userStore';
import LoadingScreen from '../components/ui/LoadingScreen';
import Icon from '../components/ui/Icon';
import UniformDisplay from '../components/profile/UniformDisplay';
import CommentsSection from '../components/profile/CommentsSection';

// Director Header Component
const DirectorHeader = ({ profile, isOwner, careerStats }) => {
    const joinDate = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
    const memberSince = joinDate ? joinDate.getFullYear() : 'Unknown';
    
    return (
        <div className="bg-gradient-to-r from-primary/20 to-accent/20 dark:from-primary-dark/20 dark:to-accent-dark/20 rounded-theme p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <div className="w-32 h-32 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-6xl font-bold text-white shadow-xl">
                        {profile.isAdmin ? '👑' : (profile.username?.charAt(0)?.toUpperCase() || '?')}
                    </div>
                </div>
                
                {/* Director Info */}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                        <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark">
                            {profile.username || 'Anonymous Director'}
                        </h1>
                        {profile.isAdmin && (
                            <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                ADMIN
                            </span>
                        )}
                    </div>
                    <p className="text-lg text-text-secondary dark:text-text-secondary-dark mb-1">
                        {profile.isAdmin ? 'Site Administrator' : 'Fantasy Drum Corps Director'}
                    </p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4">
                        Member since {memberSince}
                    </p>
                    
                    {profile.bio && (
                        <div className="mb-4">
                            <p className="text-text-primary dark:text-text-primary-dark max-w-2xl leading-relaxed">
                                {profile.bio}
                            </p>
                        </div>
                    )}
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {profile.level || 1}
                            </p>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Level</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {careerStats.totalSeasons || 0}
                            </p>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Seasons</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {careerStats.totalCorpsManaged || 0}
                            </p>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Corps</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {careerStats.totalTrophies || 0}
                            </p>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Trophies</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple Corps Display
const CorpsPortfolio = ({ profile }) => {
    const userCorps = getAllUserCorps(profile);
    const corpsWithData = Object.entries(userCorps).filter(([_, corps]) => corps && corps.corpsName);
    
    if (corpsWithData.length === 0) {
        return (
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6 text-center">
                <div className="text-4xl mb-3">🥁</div>
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                    Corps Portfolio
                </h3>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    No drum corps created yet.
                </p>
            </div>
        );
    }
    
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="text-3xl">🥁</div>
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    Active Corps Portfolio
                </h3>
            </div>
            
            <div className="space-y-4">
                {corpsWithData.map(([corpsClass, corps]) => {
                    const classConfig = CORPS_CLASSES[corpsClass];
                    
                    return (
                        <div key={corpsClass} className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-lg text-text-primary dark:text-text-primary-dark">
                                        {corps.corpsName}
                                    </h4>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        {classConfig?.name || corpsClass} • Season Score: {(corps.totalSeasonScore || 0).toFixed(1)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Main ProfilePage Component
const ProfilePage = ({ loggedInProfile, loggedInUserId, viewingUserId }) => {
    const { user, connectionError } = useUserStore();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const profileUserId = viewingUserId || loggedInUserId;
    const isOwner = !viewingUserId || loggedInUserId === viewingUserId;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            setError(null);
            
            console.log('ProfilePage: Fetching profile data');
            console.log('Profile User ID:', profileUserId);
            console.log('Is Owner:', isOwner);
            console.log('Logged In Profile:', loggedInProfile);
            
            if (!profileUserId) {
                console.log('No profile user ID');
                setProfile(null);
                setError('No user ID provided');
                setIsLoading(false);
                return;
            }

            try {
                let profileData;
                
                if (isOwner && loggedInProfile) {
                    console.log('Using logged in profile data');
                    profileData = loggedInProfile;
                } else {
                    console.log('Fetching profile from Firestore');
                    console.log('Data namespace:', dataNamespace);
                    
                    if (!dataNamespace) {
                        throw new Error('Data namespace not configured');
                    }
                    
                    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', profileUserId, 'profile', 'data');
                    const profileDoc = await getDoc(profileRef);
                    
                    if (!profileDoc.exists()) {
                        throw new Error('Profile document not found');
                    }
                    
                    profileData = { userId: profileUserId, ...profileDoc.data() };
                    console.log('Profile fetched:', profileData.username);
                }

                setProfile(profileData);
                
            } catch (error) {
                console.error('Error loading profile data:', error);
                setError(error.message);
                setProfile(null);
            }
            
            setIsLoading(false);
        };

        fetchProfileData();
    }, [profileUserId, isOwner, loggedInProfile, dataNamespace]);

    const calculateCareerStats = (profile) => {
        if (!profile) return {};
        
        const career = {
            totalSeasons: profile.seasons ? Object.keys(profile.seasons).length : 0,
            championships: profile.trophies?.championships?.length || 0,
            finalistAppearances: profile.trophies?.finalistMedals?.length || 0,
            totalTrophies: 0,
            totalCorpsManaged: 0
        };

        // Count current corps
        const userCorps = getAllUserCorps(profile);
        career.totalCorpsManaged = Object.keys(userCorps).length;

        // Count total trophies
        if (profile.trophies) {
            career.totalTrophies = (profile.trophies.championships || []).length + 
                                 (profile.trophies.finalistMedals || []).length + 
                                 (profile.trophies.regionals || []).length +
                                 (profile.trophies.leagueChampionships || []).length;
        }

        return career;
    };

    if (isLoading) {
        return <LoadingScreen message="Loading profile..." />;
    }

    // Show connection error from userStore
    if (connectionError) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme p-6 max-w-md mx-auto">
                    <div className="text-red-600 dark:text-red-400 mb-2 text-4xl">⚠️</div>
                    <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                        Connection Error
                    </h2>
                    <p className="text-red-700 dark:text-red-300 mb-4">
                        {connectionError}
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-theme"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        );
    }

    // Show local error
    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-theme p-6 max-w-md mx-auto">
                    <div className="text-orange-600 dark:text-orange-400 mb-2 text-4xl">🔍</div>
                    <h2 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-2">
                        Profile Error
                    </h2>
                    <p className="text-orange-700 dark:text-orange-300 mb-4">
                        {error}
                    </p>
                    <div className="text-sm text-orange-600 dark:text-orange-400">
                        <p><strong>User ID:</strong> {profileUserId || 'Not set'}</p>
                        <p><strong>Data Namespace:</strong> {dataNamespace || 'Not set'}</p>
                        <p><strong>Is Owner:</strong> {isOwner ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Profile Not Found
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                    {viewingUserId ? "The requested profile could not be found." : "Your profile could not be loaded."}
                </p>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    <p><strong>User ID:</strong> {profileUserId || 'Not available'}</p>
                    <p><strong>Namespace:</strong> {dataNamespace || 'Not configured'}</p>
                </div>
            </div>
        );
    }

    const careerStats = calculateCareerStats(profile);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Director Header */}
            <DirectorHeader profile={profile} isOwner={isOwner} careerStats={careerStats} />

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Corps Portfolio */}
                <CorpsPortfolio profile={profile} />
                
                {/* Basic Info */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Profile Information
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <strong className="text-text-primary dark:text-text-primary-dark">Email:</strong>
                            <span className="ml-2 text-text-secondary dark:text-text-secondary-dark">{profile.email}</span>
                        </div>
                        <div>
                            <strong className="text-text-primary dark:text-text-primary-dark">Level:</strong>
                            <span className="ml-2 text-text-secondary dark:text-text-secondary-dark">{profile.level || 1}</span>
                        </div>
                        {profile.isAdmin && (
                            <div>
                                <strong className="text-text-primary dark:text-text-primary-dark">Role:</strong>
                                <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-bold">Administrator</span>
                            </div>
                        )}
                        <div>
                            <strong className="text-text-primary dark:text-text-primary-dark">Last Active:</strong>
                            <span className="ml-2 text-text-secondary dark:text-text-secondary-dark">
                                {profile.lastActive ? new Date(profile.lastActive.seconds * 1000 || profile.lastActive).toLocaleString() : 'Unknown'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comments Section */}
            {!isOwner && (
                <CommentsSection 
                    profileUserId={profileUserId}
                    loggedInUserId={loggedInUserId}
                    loggedInProfile={loggedInProfile}
                />
            )}
        </div>
    );
};

export default ProfilePage;