// src/pages/ProfilePage.js - Director Information Hub
// Complete profile redesign showcasing director achievements, corps portfolio, and career stats
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
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
                        {profile.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                </div>
                
                {/* Director Info */}
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        {profile.username || 'Anonymous Director'}
                    </h1>
                    <p className="text-lg text-text-secondary dark:text-text-secondary-dark mb-1">
                        Fantasy Drum Corps Director
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
                                {careerStats.totalCorpsManaged}
                            </p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Corps Created</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {careerStats.totalSeasons}
                            </p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Seasons</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {careerStats.championships}
                            </p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Championships</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {careerStats.totalTrophies}
                            </p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Total Trophies</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Trophy Case Component
const TrophyCase = ({ profile }) => {
    const trophies = profile.trophies || {};
    const championships = trophies.championships || [];
    const finalistMedals = trophies.finalistMedals || [];
    const leagueChampionships = trophies.leagueChampionships || [];
    const regionals = trophies.regionals || [];
    
    const totalTrophies = championships.length + finalistMedals.length + leagueChampionships.length + regionals.length;
    
    if (totalTrophies === 0) {
        return (
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                    Trophy Case
                </h3>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    Awards and achievements will appear here as this director competes in seasons and leagues.
                </p>
            </div>
        );
    }
    
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="text-3xl">🏆</div>
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    Trophy Case ({totalTrophies})
                </h3>
            </div>
            
            <div className="space-y-4">
                {/* Championships */}
                {championships.length > 0 && (
                    <div>
                        <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3 flex items-center gap-2">
                            <span className="text-xl">🥇</span>
                            Championships ({championships.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {championships.slice(0, 6).map((trophy, index) => (
                                <div key={index} className="bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/20 dark:to-yellow-800/20 p-4 rounded-theme border border-yellow-200 dark:border-yellow-800">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">
                                            {trophy.metal === 'gold' ? '🥇' : trophy.metal === 'silver' ? '🥈' : '🥉'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-yellow-800 dark:text-yellow-200">
                                                {trophy.seasonName}
                                            </p>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                {trophy.eventName} • Rank #{trophy.rank}
                                            </p>
                                            {trophy.corpsClass && (
                                                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                                    {CORPS_CLASSES[trophy.corpsClass]?.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* League Championships */}
                {leagueChampionships.length > 0 && (
                    <div>
                        <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3 flex items-center gap-2">
                            <span className="text-xl">🏅</span>
                            League Championships ({leagueChampionships.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {leagueChampionships.slice(0, 4).map((trophy, index) => (
                                <div key={index} className="bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-theme border border-purple-200 dark:border-purple-800">
                                    <p className="font-bold text-purple-800 dark:text-purple-200">
                                        {trophy.leagueName}
                                    </p>
                                    <p className="text-sm text-purple-700 dark:text-purple-300">
                                        {trophy.seasonName}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Finals Appearances */}
                {finalistMedals.length > 0 && (
                    <div>
                        <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3 flex items-center gap-2">
                            <span className="text-xl">🎖️</span>
                            Finals Appearances ({finalistMedals.length})
                        </h4>
                        <div className="text-text-secondary dark:text-text-secondary-dark text-sm">
                            Competed in {finalistMedals.length} championship finals across multiple seasons
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Corps Portfolio Component
const CorpsPortfolio = ({ profile, currentSeasonStats }) => {
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
                    This director hasn't created any drum corps yet.
                </p>
            </div>
        );
    }
    
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="text-3xl">🥁</div>
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                        Active Corps Portfolio
                    </h3>
                </div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {corpsWithData.length} {corpsWithData.length === 1 ? 'Corps' : 'Corps'}
                </div>
            </div>
            
            <div className="space-y-4">
                {corpsWithData.map(([corpsClass, corps]) => {
                    const classConfig = CORPS_CLASSES[corpsClass];
                    const currentUniform = corps.uniforms && Object.keys(corps.uniforms).length > 0 
                        ? Object.values(corps.uniforms)[0] 
                        : null;
                    
                    return (
                        <div key={corpsClass} className="bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full ${classConfig?.color || 'bg-gray-400'}`}></div>
                                    <div>
                                        <h4 className="font-bold text-text-primary dark:text-text-primary-dark">
                                            {corps.corpsName}
                                        </h4>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            {classConfig?.name} • {classConfig?.pointCap} pts max
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Current Uniform Display */}
                                {currentUniform && (
                                    <div className="flex-shrink-0">
                                        <UniformDisplay 
                                            uniform={currentUniform} 
                                            size="small" 
                                            showInfo={false}
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {/* Corps Stats */}
                            <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                    <p className="font-bold text-primary dark:text-primary-dark">
                                        {corps.totalSeasonScore?.toFixed(1) || '0.0'}
                                    </p>
                                    <p className="text-text-secondary dark:text-text-secondary-dark text-xs">Season Score</p>
                                </div>
                                <div>
                                    <p className="font-bold text-primary dark:text-primary-dark">
                                        {Object.keys(corps.lineup || {}).length}/8
                                    </p>
                                    <p className="text-text-secondary dark:text-text-secondary-dark text-xs">Lineup</p>
                                </div>
                                <div>
                                    <p className="font-bold text-primary dark:text-primary-dark">
                                        {corps.uniforms ? Object.keys(corps.uniforms).length : 0}/4
                                    </p>
                                    <p className="text-text-secondary dark:text-text-secondary-dark text-xs">Uniforms</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Season Performance Component
const SeasonPerformance = ({ seasonStats, recentActivity }) => {
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="text-3xl">📊</div>
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    Current Season Performance
                </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                        {seasonStats.totalSeasonScore?.toFixed(1) || '0.0'}
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Total Score</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                        {seasonStats.averageScore?.toFixed(1) || '0.0'}
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Avg per Corps</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                        {seasonStats.bestRank || '--'}
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Best Rank</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                        {seasonStats.activeCorps}
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Active Corps</p>
                </div>
            </div>
            
            {/* Recent Activity */}
            {recentActivity && recentActivity.length > 0 && (
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-3">
                        Recent Performance History
                    </h4>
                    <div className="space-y-2">
                        {recentActivity.slice(0, 5).map((activity, index) => (
                            <div key={index} className="flex justify-between items-center text-sm bg-background dark:bg-background-dark p-3 rounded-theme">
                                <div>
                                    <span className="text-text-primary dark:text-text-primary-dark">
                                        Day {activity.day}
                                    </span>
                                    {activity.date && (
                                        <span className="text-text-secondary dark:text-text-secondary-dark ml-2">
                                            • {activity.date.toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <div className="text-primary dark:text-primary-dark font-semibold">
                                    {Object.values(activity.userScores).reduce((sum, score) => sum + (score || 0), 0).toFixed(1)} pts
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Career Highlights Component
const CareerHighlights = ({ careerStats, profile }) => {
    const highlights = [];
    
    if (careerStats.totalSeasons > 0) {
        highlights.push({
            icon: '📅',
            title: 'Veteran Director',
            description: `Competed in ${careerStats.totalSeasons} season${careerStats.totalSeasons !== 1 ? 's' : ''}`
        });
    }
    
    if (careerStats.championships > 0) {
        highlights.push({
            icon: '🏆',
            title: 'Champion',
            description: `Won ${careerStats.championships} championship${careerStats.championships !== 1 ? 's' : ''}`
        });
    }
    
    if (careerStats.finalistAppearances > 5) {
        highlights.push({
            icon: '🎖️',
            title: 'Finals Regular',
            description: `${careerStats.finalistAppearances} finals appearances`
        });
    }
    
    if (careerStats.favoriteClass) {
        const className = CORPS_CLASSES[careerStats.favoriteClass]?.name;
        if (className) {
            highlights.push({
                icon: '🎯',
                title: 'Specialist',
                description: `Prefers ${className} competition`
            });
        }
    }
    
    if (careerStats.totalCorpsManaged > 5) {
        highlights.push({
            icon: '🥁',
            title: 'Corps Builder',
            description: `Created ${careerStats.totalCorpsManaged} different corps`
        });
    }
    
    if (highlights.length === 0) {
        return null;
    }
    
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="text-3xl">⭐</div>
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    Career Highlights
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {highlights.map((highlight, index) => (
                    <div key={index} className="flex items-center gap-3 bg-background dark:bg-background-dark p-4 rounded-theme">
                        <div className="text-2xl">{highlight.icon}</div>
                        <div>
                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                {highlight.title}
                            </h4>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                {highlight.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Main ProfilePage Component
const ProfilePage = ({ loggedInProfile, loggedInUserId, viewingUserId }) => {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonStats, setSeasonStats] = useState({});
    const [careerStats, setCareerStats] = useState({});
    const [recentActivity, setRecentActivity] = useState([]);
    
    const profileUserId = viewingUserId || loggedInUserId;
    const isOwner = !viewingUserId || loggedInUserId === viewingUserId;

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
            // Load season settings for current season stats
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
            totalCorpsManaged: 0
        };

        // Count seasons participated
        if (profile.seasons) {
            career.totalSeasons = Object.keys(profile.seasons).length;
        }

        // Count current corps
        const userCorps = getAllUserCorps(profile);
        career.totalCorpsManaged = Object.keys(userCorps).length;

        // Count trophies and achievements
        if (profile.trophies) {
            career.championships = (profile.trophies.championships || []).length;
            career.finalistAppearances = (profile.trophies.finalistMedals || []).length;
            career.totalTrophies = career.championships + career.finalistAppearances + 
                                 (profile.trophies.regionals || []).length +
                                 (profile.trophies.leagueChampionships || []).length;
        }

        // Calculate favorite corps class
        const currentClasses = Object.keys(userCorps);
        if (currentClasses.length > 0) {
            career.favoriteClass = currentClasses[0]; // Simple logic - could be enhanced
        }

        return career;
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!profile) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Profile Not Found
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    {viewingUserId ? "The requested profile could not be found." : "Please sign in to view your profile."}
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Director Header */}
            <DirectorHeader profile={profile} isOwner={isOwner} careerStats={careerStats} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Corps Portfolio */}
                    <CorpsPortfolio profile={profile} currentSeasonStats={seasonStats} />
                    
                    {/* Season Performance */}
                    <SeasonPerformance seasonStats={seasonStats} recentActivity={recentActivity} />
                </div>
                
                {/* Right Column */}
                <div className="space-y-8">
                    {/* Trophy Case */}
                    <TrophyCase profile={profile} />
                    
                    {/* Career Highlights */}
                    <CareerHighlights careerStats={careerStats} profile={profile} />
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