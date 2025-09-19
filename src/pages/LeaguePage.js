import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps, CORPS_CLASSES } from '../utils/profileCompatibility';

// Import your components
import LeagueManager from '../components/dashboard/LeagueManager';
import Leaderboard from '../components/dashboard/Leaderboard';

const LeaguePage = ({ setPage, onViewLeague }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [userLeagues, setUserLeagues] = useState([]);
    const [selectedView, setSelectedView] = useState('my-leagues');

    useEffect(() => {
        const fetchLeagueData = async () => {
    if (isLoadingAuth) return;
    
    setIsLoading(true);
    try {
        // Fetch season settings first
        const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
        if (seasonDoc.exists()) {
            const seasonData = seasonDoc.data();
            setSeasonSettings(seasonData);

            // Calculate current week
            if (seasonData.schedule?.startDate) {
                const startDate = seasonData.schedule.startDate.toDate();
                const diffInMillis = new Date().getTime() - startDate.getTime();
                const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                const week = Math.ceil(currentDay / 7);
                setCurrentWeek(Math.max(1, week));
            }
        }

        // FIXED: Better error handling for league member fetching
        if (loggedInProfile?.leagueIds?.length > 0) {
            try {
                const leaguesQuery = query(
                    collection(db, 'leagues'), 
                    where('__name__', 'in', loggedInProfile.leagueIds)
                );
                const querySnapshot = await getDocs(leaguesQuery);
                
                const leagues = await Promise.all(querySnapshot.docs.map(async (leagueDoc) => {
                    const leagueData = { id: leagueDoc.id, ...leagueDoc.data() };
                    
                    // FIXED: Safer member profile fetching with error handling
                    if (leagueData.members && leagueData.members.length > 0) {
                        try {
                            // Limit to first 10 members for performance
                            const memberIds = leagueData.members.slice(0, 10);
                            
                            // FIXED: Use individual document gets instead of collectionGroup query
                            const memberPromises = memberIds.map(memberId => 
                                getDoc(doc(db, `artifacts/${dataNamespace}/users/${memberId}/profile/data`))
                                    .catch(error => {
                                        console.warn(`Failed to fetch profile for ${memberId}:`, error);
                                        return null; // Return null for failed fetches
                                    })
                            );
                            
                            const memberDocs = await Promise.all(memberPromises);
                            
                            const membersData = memberDocs
                                .filter(doc => doc && doc.exists()) // Filter out failed fetches
                                .map(doc => {
                                    const profileData = doc.data();
                                    const userCorps = getAllUserCorps(profileData);
                                    return {
                                        id: doc.id,
                                        username: profileData.username || 'Unknown User',
                                        totalScore: Object.values(userCorps).reduce((sum, corps) => 
                                            sum + (corps.totalSeasonScore || 0), 0)
                                    };
                                });
                            
                            const sortedMembers = membersData.sort((a, b) => b.totalScore - a.totalScore);
                            const userRank = sortedMembers.findIndex(m => m.id === loggedInProfile.userId) + 1;
                            const topScore = sortedMembers[0]?.totalScore || 0;
                            const userMember = sortedMembers.find(m => m.id === loggedInProfile.userId);
                            const userScore = userMember?.totalScore || 0;

                            return {
                                ...leagueData,
                                memberCount: leagueData.members.length,
                                userRank: userRank || leagueData.members.length,
                                topScore: topScore,
                                userScore: userScore,
                                isLeading: userRank === 1,
                                members: sortedMembers.slice(0, 3) // Top 3 for preview
                            };
                        } catch (error) {
                            console.error('Error fetching member profiles:', error);
                            // Return league data without member details
                            return {
                                ...leagueData,
                                memberCount: leagueData.members.length,
                                userRank: leagueData.members.length,
                                topScore: 0,
                                userScore: 0,
                                isLeading: false,
                                members: []
                            };
                        }
                    }
                    
                    return {
                        ...leagueData,
                        memberCount: 0,
                        userRank: 1,
                        topScore: 0,
                        userScore: 0,
                        isLeading: false,
                        members: []
                    };
                }));
                
                setUserLeagues(leagues.sort((a, b) => a.userRank - b.userRank));
            } catch (error) {
                console.error("Error fetching leagues:", error);
                setUserLeagues([]);
            }
        } else {
            setUserLeagues([]);
        }
    } catch (error) {
        console.error("Error fetching league data:", error);
    } finally {
        setIsLoading(false);
    }
};

        fetchLeagueData();
    }, [loggedInProfile, isLoadingAuth]);

    // Handle viewing a profile
    const handleViewProfile = (userId) => {
        setPage('profile', { userId });
    };

    // Handle viewing a league detail - THIS IS THE KEY FIX
    const handleViewLeagueDetail = (leagueId) => {
        setPage('leagueDetail', { leagueId });
    };

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading leagues...</p>
                </div>
            </div>
        );
    }

    // Show error state if no profile
    if (!loggedInProfile) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Profile Not Found</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Unable to load your profile. Please try refreshing the page.</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'my-leagues', name: 'My Leagues', count: userLeagues.length },
        { id: 'global', name: 'Global Rankings', count: null }
    ];

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Page Header */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                            Fantasy Leagues
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            Compete with friends in private leagues
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="border-b border-accent dark:border-accent-dark">
                        <nav className="-mb-px flex space-x-8">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSelectedView(tab.id)}
                                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        selectedView === tab.id
                                            ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
                                            : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                    }`}
                                >
                                    {tab.name}
                                    {tab.count !== null && (
                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content Based on Selected View */}
                    {selectedView === 'my-leagues' ? (
                        <div className="space-y-8">
                            {/* League Manager */}
                            <LeagueManager profile={loggedInProfile} />

                            {/* My Leagues Grid */}
                            {userLeagues.length > 0 ? (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                        Your Leagues
                                    </h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {userLeagues.map(league => (
                                            <div 
                                                key={league.id} 
                                                className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6 hover:shadow-lg transition-shadow cursor-pointer"
                                                onClick={() => handleViewLeagueDetail(league.id)}
                                            >
                                                {/* League Header */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-primary dark:text-primary-dark">
                                                            {league.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            <span>{league.memberCount} members</span>
                                                            <span>•</span>
                                                            <span>Week {currentWeek}</span>
                                                            {league.isLeading && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-yellow-500 font-semibold">Leading</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                            #{league.userRank}
                                                        </div>
                                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            Your Rank
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Performance Stats */}
                                                <div className="grid grid-cols-3 gap-4 mb-4">
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                            {league.userScore.toFixed(3)}
                                                        </div>
                                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            Your Score
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                            {league.topScore.toFixed(3)}
                                                        </div>
                                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            Leader Score
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                            {((league.userScore / league.topScore) * 100).toFixed(0)}%
                                                        </div>
                                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            vs Leader
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Top Members Preview */}
                                                <div className="border-t border-accent dark:border-accent-dark pt-4">
                                                    <div className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                                        Top Members
                                                    </div>
                                                    <div className="space-y-1">
                                                        {league.members.slice(0, 3).map((member, index) => (
                                                            <div key={member.id} className="flex justify-between items-center">
                                                                <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                                    {index + 1}. {member.username}
                                                                    {member.id === loggedInProfile.userId && (
                                                                        <span className="text-primary dark:text-primary-dark ml-1">(You)</span>
                                                                    )}
                                                                </span>
                                                                <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                                                    {member.totalScore.toFixed(3)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Action Hint */}
                                                <div className="mt-4 pt-3 border-t border-accent dark:border-accent-dark">
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark text-center">
                                                        Click to view full league details
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                        No Leagues Yet
                                    </h3>
                                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                        Create your first league or join one with an invite code to get started!
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Global Leaderboard */
                        <div className="max-w-4xl mx-auto">
                            <Leaderboard onViewProfile={handleViewProfile} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaguePage;