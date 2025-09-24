// src/pages/ProfilePage.js - Enhanced with fantasy director features + avatar builder + comments
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import LoadingScreen from '../components/ui/LoadingScreen';
import Icon from '../components/ui/Icon';
import UniformDisplay from '../components/profile/UniformDisplay';
import UniformBuilder from '../components/profile/UniformBuilder';
import CommentsSection from '../components/profile/CommentsSection';

const ProfilePage = ({ loggedInProfile, loggedInUserId, viewingUserId }) => {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioText, setBioText] = useState('');
    const [isBuildingUniform, setIsBuildingUniform] = useState(false);
    const [timeSinceActive, setTimeSinceActive] = useState('');
    const [seasonStats, setSeasonStats] = useState({});
    const [careerStats, setCareerStats] = useState({});
    const [recentActivity, setRecentActivity] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');

    const isOwner = loggedInUserId && viewingUserId === loggedInUserId;
    const profileUserId = viewingUserId || loggedInUserId;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            
            if (!profileUserId) {
                setProfile(null);
                setIsLoading(false);
                return;
            }
            
            if (isOwner && loggedInProfile) {
                setProfile(loggedInProfile);
                await loadDirectorStats(loggedInProfile);
            } else {
                try {
                    const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', profileUserId, 'profile', 'data');
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        const profileData = { userId: profileUserId, ...docSnap.data() };
                        setProfile(profileData);
                        await loadDirectorStats(profileData);
                    } else {
                        setProfile(null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setProfile(null);
                }
            }
            
            setIsLoading(false);
        };

        fetchProfileData();
    }, [viewingUserId, loggedInUserId, loggedInProfile, isOwner, profileUserId]);

    const loadDirectorStats = async (profileData) => {
        if (!profileData) return;

        try {
            // Load season settings
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);
            
            if (seasonSnap.exists()) {
                const seasonSettings = seasonSnap.data();
                
                // Calculate current season stats
                const userCorps = getAllUserCorps(profileData);
                const currentSeasonStats = calculateSeasonStats(userCorps, profileData, seasonSettings);
                setSeasonStats(currentSeasonStats);

                // Calculate career stats
                const career = calculateCareerStats(profileData);
                setCareerStats(career);

                // Load recent activity
                if (seasonSettings.seasonUid) {
                    await loadRecentActivity(profileData.userId, seasonSettings.seasonUid);
                }
            }
        } catch (error) {
            console.error('Error loading director stats:', error);
        }
    };

    const loadRecentActivity = async (userId, seasonUid) => {
        try {
            const recapRef = doc(db, 'fantasy_recaps', seasonUid);
            const recapSnap = await getDoc(recapRef);
            
            if (recapSnap.exists()) {
                const recapData = recapSnap.data();
                const recentRecaps = recapData.recaps
                    ?.sort((a, b) => b.offSeasonDay - a.offSeasonDay)
                    .slice(0, 10) || [];
                
                const activity = recentRecaps.map(recap => ({
                    date: recap.timestamp?.toDate(),
                    day: recap.offSeasonDay,
                    userScores: recap.userScores?.[userId] || {},
                    rankings: recap.rankings || {}
                }));
                
                setRecentActivity(activity);
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    };

    const calculateSeasonStats = (userCorps, profile, seasonSettings) => {
        const stats = {
            activeCorps: 0,
            totalSeasonScore: 0,
            averageScore: 0,
            bestRank: null,
            worstRank: null,
            seasonsParticipated: profile.seasons ? Object.keys(profile.seasons).length : 0
        };

        Object.keys(userCorps).forEach(corpsClass => {
            const corps = userCorps[corpsClass];
            if (corps && corps.corpsName) {
                stats.activeCorps++;
                stats.totalSeasonScore += corps.totalSeasonScore || 0;
                
                if (corps.bestRank) {
                    if (!stats.bestRank || corps.bestRank < stats.bestRank) {
                        stats.bestRank = corps.bestRank;
                    }
                }
                if (corps.worstRank) {
                    if (!stats.worstRank || corps.worstRank > stats.worstRank) {
                        stats.worstRank = corps.worstRank;
                    }
                }
            }
        });

        if (stats.activeCorps > 0) {
            stats.averageScore = stats.totalSeasonScore / stats.activeCorps;
        }

        return stats;
    };

    const calculateCareerStats = (profile) => {
        const career = {
            totalSeasons: 0,
            championships: 0,
            finalistAppearances: 0,
            totalTrophies: 0,
            favoriteClass: null,
            longestStreak: 0,
            totalCorpsManaged: 0
        };

        // Count seasons participated
        if (profile.seasons) {
            career.totalSeasons = Object.keys(profile.seasons).length;
        }

        // Count trophies and achievements
        if (profile.trophies) {
            career.championships = (profile.trophies.championships || []).length;
            career.finalistAppearances = (profile.trophies.finalistMedals || []).length;
            career.totalTrophies = career.championships + career.finalistAppearances + 
                                 (profile.trophies.regionals || []).length +
                                 (profile.trophies.leagueChampionships || []).length;
        }

        // Calculate favorite corps class
        const classCount = {};
        if (profile.seasons) {
            Object.values(profile.seasons).forEach(season => {
                if (season.corps) {
                    Object.keys(season.corps).forEach(corpsClass => {
                        classCount[corpsClass] = (classCount[corpsClass] || 0) + 1;
                    });
                }
            });
        }
        
        if (Object.keys(classCount).length > 0) {
            career.favoriteClass = Object.keys(classCount).reduce((a, b) => 
                classCount[a] > classCount[b] ? a : b
            );
            career.totalCorpsManaged = Object.values(classCount).reduce((sum, count) => sum + count, 0);
        }

        return career;
    };

    const handleSaveBio = async () => {
        if (!isOwner || !profile) return;
        
        try {
            const profileRef = doc(db, 'artifacts', dataNamespace, 'users', loggedInUserId, 'profile', 'data');
            await updateDoc(profileRef, { bio: bioText.trim() });
            setProfile({ ...profile, bio: bioText.trim() });
            setIsEditingBio(false);
        } catch (error) {
            console.error('Error updating bio:', error);
        }
    };

    const handleSaveUniform = async (newUniform) => {
        if (!isOwner || !loggedInUserId) return;
        
        try {
            const profileRef = doc(db, 'artifacts', dataNamespace, 'users', loggedInUserId, 'profile', 'data');
            await setDoc(profileRef, { uniform: newUniform }, { merge: true });
            setProfile(prev => ({ ...prev, uniform: newUniform }));
            setIsBuildingUniform(false);
        } catch (error) {
            console.error('Error saving uniform:', error);
        }
    };

    const timeSince = (date) => {
        if (!date) return 'Never';
        const now = new Date();
        const lastActive = date.toDate ? date.toDate() : new Date(date);
        const diffInSeconds = Math.floor((now - lastActive) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    useEffect(() => {
        setBioText(profile?.bio || '');
    }, [profile]);

    useEffect(() => {
        if (profile?.lastActive) {
            setTimeSinceActive(timeSince(profile.lastActive));
            const intervalId = setInterval(() => setTimeSinceActive(timeSince(profile.lastActive)), 60000);
            return () => clearInterval(intervalId);
        }
    }, [profile?.lastActive]);

    if (isLoading) {
        return <LoadingScreen message="Loading fantasy director profile..." />;
    }

    if (!profile) {
        return (
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Director Not Found
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        This fantasy director profile doesn't exist or has been made private.
                    </p>
                </div>
            </div>
        );
    }

    // Create default uniform if none exists
    const defaultUniform = {
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
    };
    
    const userUniform = profile?.uniform ? { ...defaultUniform, ...profile.uniform } : defaultUniform;
    const userCorps = getAllUserCorps(profile);
    const hasAnyCorps = Object.values(userCorps).some(corps => corps && corps.corpsName);

    return (
        <>
            {/* Uniform Builder Modal */}
            {isBuildingUniform && (
                <UniformBuilder 
                    uniform={userUniform}
                    onSave={handleSaveUniform}
                    onCancel={() => setIsBuildingUniform(false)}
                    UniformDisplayComponent={UniformDisplay}
                />
            )}

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
                {/* Profile Header */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-theme overflow-hidden">
                    <div className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                            {/* Profile Avatar with Uniform Builder */}
                            <div className="flex-shrink-0 relative">
                                <UniformDisplay uniform={userUniform} />
                                {isOwner && (
                                    <button 
                                        onClick={() => setIsBuildingUniform(true)} 
                                        className="absolute top-2 right-2 bg-primary/90 hover:bg-primary text-on-primary p-2 rounded-full shadow-lg backdrop-blur-sm transition-all" 
                                        aria-label="Edit Avatar"
                                        title="Customize Your Avatar"
                                    >
                                        <Icon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            {/* Profile Info */}
                            <div className="flex-grow">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                                            {profile.username}
                                        </h1>
                                        <div className="flex items-center gap-4 text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                                            <span>Fantasy Director</span>
                                            <span>•</span>
                                            <span>Level {profile.level || 1}</span>
                                            <span>•</span>
                                            <span>Last active {timeSinceActive}</span>
                                        </div>
                                        {profile.createdAt && (
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                                                Member since {profile.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col md:items-end gap-2">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                    {seasonStats.activeCorps}
                                                </div>
                                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    Active Corps
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                    {careerStats.totalSeasons}
                                                </div>
                                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    Seasons
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                    {careerStats.totalTrophies}
                                                </div>
                                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    Trophies
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bio Section */}
                                <div className="mt-6">
                                    {isEditingBio ? (
                                        <div className="space-y-3">
                                            <textarea
                                                value={bioText}
                                                onChange={(e) => setBioText(e.target.value)}
                                                placeholder="Tell other directors about your fantasy strategy..."
                                                className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark min-h-[100px] focus:ring-2 focus:ring-primary focus:border-primary"
                                                maxLength={500}
                                            />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    {bioText.length}/500 characters
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setIsEditingBio(false); setBioText(profile.bio || ''); }}
                                                        className="px-4 py-2 text-sm bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleSaveBio}
                                                        className="px-4 py-2 text-sm bg-primary text-on-primary rounded-theme hover:opacity-90"
                                                    >
                                                        Save Bio
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between">
                                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                                {profile.bio || (isOwner ? 'Click edit to add your fantasy director bio...' : 'This director hasn\'t added a bio yet.')}
                                            </p>
                                            {isOwner && (
                                                <button
                                                    onClick={() => setIsEditingBio(true)}
                                                    className="ml-4 text-sm text-primary dark:text-primary-dark hover:underline flex-shrink-0"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark">
                    <nav className="flex space-x-0 overflow-x-auto">
                        {[
                            { id: 'overview', label: 'Overview', icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" },
                            { id: 'corps', label: 'Corps Empire', icon: "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" },
                            { id: 'trophies', label: 'Trophy Case', icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25s4.544.16 6.75.471v1.515M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-4.395 5.472M18.75 4.236V4.5a9.042 9.042 0 01-2.48 5.228m2.48-5.228V2.721A47.505 47.505 0 0012 2.25c-2.291 0-4.544.16-6.75.471v1.515M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228M12 14.25s-3-2.25-3-3.75c0-1.5 1.5-3 3-3s3 1.5 3 3c0 1.5-3 3.75-3 3.75z" }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary text-primary dark:text-primary-dark'
                                        : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                }`}
                            >
                                <Icon path={tab.icon} className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="space-y-8">
                    {activeTab === 'overview' && (
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Season Summary */}
                            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                    Current Season
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Total Score</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {seasonStats.totalSeasonScore?.toFixed(3) || '0.000'} pts
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Average Score</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {seasonStats.averageScore?.toFixed(3) || '0.000'} pts
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Best Rank</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {seasonStats.bestRank ? `#${seasonStats.bestRank}` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Active Corps</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {seasonStats.activeCorps}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Career Summary */}
                            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                    Career Highlights
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Championships</span>
                                        <span className="font-semibold text-primary dark:text-primary-dark">
                                            {careerStats.championships}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Finalist Medals</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {careerStats.finalistAppearances}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Corps Managed</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {careerStats.totalCorpsManaged}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Favorite Class</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {careerStats.favoriteClass ? CORPS_CLASSES[careerStats.favoriteClass]?.name || careerStats.favoriteClass : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            {recentActivity.length > 0 && (
                                <div className="md:col-span-2">
                                    <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                            Recent Competition Results
                                        </h3>
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {recentActivity.map((activity, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme">
                                                    <div>
                                                        <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                                            Day {activity.day}
                                                        </div>
                                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            {activity.date?.toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            {Object.keys(activity.userScores).length} corps competed
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'corps' && (
                        <div className="space-y-6">
                            {hasAnyCorps ? (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {CORPS_CLASS_ORDER.map(corpsClassKey => {
                                        const corps = userCorps[corpsClassKey];
                                        const classConfig = CORPS_CLASSES[corpsClassKey];
                                        
                                        if (!corps || !corps.corpsName || !classConfig) return null;

                                        return (
                                            <div key={corpsClassKey} className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className={`w-4 h-4 rounded-full ${classConfig.color}`}></div>
                                                    <div>
                                                        <h4 className="font-bold text-text-primary dark:text-text-primary-dark">
                                                            {corps.corpsName}
                                                        </h4>
                                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            {classConfig.name}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-text-secondary dark:text-text-secondary-dark text-sm">Season Score</span>
                                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                            {(corps.totalSeasonScore || 0).toFixed(3)} pts
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-text-secondary dark:text-text-secondary-dark text-sm">Best Rank</span>
                                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                            {corps.bestRank ? `#${corps.bestRank}` : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-text-secondary dark:text-text-secondary-dark text-sm">Competitions</span>
                                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                            {corps.showsAttended || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-8 text-center">
                                    <Icon path="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" className="w-12 h-12 text-text-secondary dark:text-text-secondary-dark mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                        No Corps Yet
                                    </h3>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        {isOwner ? "Start building your fantasy corps empire!" : "This director hasn't created any corps yet."}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'trophies' && (
                        <div className="space-y-6">
                            {/* Championships */}
                            {profile.trophies?.championships?.length > 0 && (
                                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                                        <Icon path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25s4.544.16 6.75.471v1.515M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-4.395 5.472M18.75 4.236V4.5a9.042 9.042 0 01-2.48 5.228m2.48-5.228V2.721A47.505 47.505 0 0012 2.25c-2.291 0-4.544.16-6.75.471v1.515M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228M12 14.25s-3-2.25-3-3.75c0-1.5 1.5-3 3-3s3 1.5 3 3c0 1.5-3 3.75-3 3.75z" className="w-5 h-5 text-yellow-500" />
                                        Championships ({profile.trophies.championships.length})
                                    </h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {profile.trophies.championships.map((trophy, index) => (
                                            <div key={index} className="p-4 bg-background dark:bg-background-dark rounded-theme border border-yellow-200 dark:border-yellow-800">
                                                <div className="font-semibold text-yellow-600 dark:text-yellow-400">
                                                    {trophy.season} Season
                                                </div>
                                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                    {trophy.corpsClass ? CORPS_CLASSES[trophy.corpsClass]?.name : 'Championship'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Finalist Medals */}
                            {profile.trophies?.finalistMedals?.length > 0 && (
                                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                                        <Icon path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25s4.544.16 6.75.471v1.515M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-4.395 5.472M18.75 4.236V4.5a9.042 9.042 0 01-2.48 5.228m2.48-5.228V2.721A47.505 47.505 0 0012 2.25c-2.291 0-4.544.16-6.75.471v1.515M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228M12 14.25s-3-2.25-3-3.75c0-1.5 1.5-3 3-3s3 1.5 3 3c0 1.5-3 3.75-3 3.75z" className="w-5 h-5 text-gray-400" />
                                        Finalist Medals ({profile.trophies.finalistMedals.length})
                                    </h3>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        {profile.trophies.finalistMedals.map((medal, index) => (
                                            <div key={index} className="p-3 bg-background dark:bg-background-dark rounded-theme border border-gray-200 dark:border-gray-700 text-center">
                                                <div className="font-semibold text-gray-600 dark:text-gray-400">
                                                    {medal.season}
                                                </div>
                                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                    {medal.rank ? `#${medal.rank}` : 'Finalist'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {careerStats.totalTrophies === 0 && (
                                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-8 text-center">
                                    <Icon path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25s4.544.16 6.75.471v1.515M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-4.395 5.472M18.75 4.236V4.5a9.042 9.042 0 01-2.48 5.228m2.48-5.228V2.721A47.505 47.505 0 0012 2.25c-2.291 0-4.544.16-6.75.471v1.515M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228M12 14.25s-3-2.25-3-3.75c0-1.5 1.5-3 3-3s3 1.5 3 3c0 1.5-3 3.75-3 3.75z" className="w-12 h-12 text-text-secondary dark:text-text-secondary-dark mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                        No Trophies Yet
                                    </h3>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        {isOwner ? "Keep building your corps and competing to earn trophies!" : "This director is working toward their first trophy."}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Comments Section */}
                <CommentsSection
                    profileOwnerId={profileUserId}
                    loggedInProfile={loggedInProfile}
                />
            </div>
        </>
    );
};

export default ProfilePage;