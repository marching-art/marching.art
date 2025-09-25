// src/pages/LeaguePage.js - Complete fixed version with enhanced error handling
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import LeagueManager from '../components/dashboard/LeagueManager';
import Icon from '../components/ui/Icon';

const LeaguePage = ({ navigate }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    
    const [userLeagues, setUserLeagues] = useState([]);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [globalLeagueStats, setGlobalLeagueStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [error, setError] = useState(null);

    // Ensure navigate function exists
    const safeNavigate = typeof navigate === 'function' ? navigate : (page) => {
        console.warn(`Navigation requested to ${page} but navigate function not provided`);
    };
    
    useEffect(() => {
        const fetchLeagueData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            try {
                // Fetch season settings
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

                // Fetch global league statistics
                await fetchGlobalStats();

                // Fetch user's leagues with enhanced data
                if (loggedInProfile?.leagueIds?.length > 0) {
                    const leagues = await fetchUserLeaguesWithStats(loggedInProfile.leagueIds);
                    setUserLeagues(leagues);
                    
                    // Fetch recent activity from user's leagues
                    await fetchRecentActivity(loggedInProfile.leagueIds);
                }
                
            } catch (error) {
                console.error("Error fetching league data:", error);
                setError('Failed to load league data');
            } finally {
                setIsLoading(false);
            }
        };

        if (!isLoadingAuth) {
            fetchLeagueData();
        }
    }, [loggedInProfile, isLoadingAuth]);

    const fetchGlobalStats = async () => {
        try {
            const leaguesQuery = query(collection(db, 'leagues'));
            const leaguesSnapshot = await getDocs(leaguesQuery);
            
            let totalLeagues = 0;
            let totalMembers = 0;
            let mostActiveLeague = null;
            let maxMembers = 0;
            
            leaguesSnapshot.docs.forEach(doc => {
                const league = doc.data();
                totalLeagues++;
                const memberCount = league.members?.length || 0;
                totalMembers += memberCount;
                
                if (memberCount > maxMembers) {
                    maxMembers = memberCount;
                    mostActiveLeague = league.name;
                }
            });
            
            setGlobalLeagueStats({
                totalLeagues,
                totalMembers,
                avgMembersPerLeague: totalLeagues > 0 ? Math.round(totalMembers / totalLeagues * 10) / 10 : 0,
                mostActiveLeague: mostActiveLeague || 'No leagues yet'
            });
        } catch (error) {
            console.error("Error fetching global league stats:", error);
            setGlobalLeagueStats({
                totalLeagues: 0,
                totalMembers: 0,
                avgMembersPerLeague: 0,
                mostActiveLeague: 'Data unavailable'
            });
        }
    };

    const fetchUserLeaguesWithStats = async (leagueIds) => {
        try {
            const leaguePromises = leagueIds.map(async (leagueId) => {
                const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
                if (!leagueDoc.exists()) return null;
                
                const leagueData = { id: leagueDoc.id, ...leagueDoc.data() };
                
                // Calculate user's rank in league (placeholder logic)
                const userRank = Math.floor(Math.random() * leagueData.members.length) + 1;
                
                return {
                    ...leagueData,
                    userRank,
                    memberCount: leagueData.members?.length || 0,
                    totalScore: Math.floor(Math.random() * 1000) + 500 // Placeholder
                };
            });
            
            const leagues = await Promise.all(leaguePromises);
            return leagues.filter(league => league !== null);
        } catch (error) {
            console.error("Error fetching user leagues:", error);
            return [];
        }
    };

    const fetchRecentActivity = async (leagueIds) => {
        // Mock recent activity for now - replace with real data when matchups are implemented
        setRecentActivity([
            { type: 'trade', message: 'New trade completed in Championship League', time: '2 hours ago' },
            { type: 'result', message: 'Week 3 results are in!', time: '1 day ago' },
            { type: 'member', message: 'DirectorMike joined Elite Corps League', time: '2 days ago' }
        ]);
    };

    const handleViewLeague = (leagueId) => {
        safeNavigate(`/league/${leagueId}`);
    };

    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <Icon name="alert-triangle" className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        {error}
                    </h2>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-primary text-on-primary hover:bg-primary/90 transition-colors font-bold py-2 px-4 rounded-theme"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading Directors Club...</p>
                </div>
            </div>
        );
    }

    if (!loggedInProfile) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Directors Club Access Required</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Please complete your profile setup to access league features.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold text-primary dark:text-primary-dark mb-4">
                        Ultimate Directors Club
                    </h1>
                    <p className="text-lg text-text-secondary dark:text-text-secondary-dark max-w-3xl mx-auto">
                        Compete against fellow directors in private leagues. Create your own league or join existing ones to prove your corps management skills.
                    </p>
                </div>

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Main League Management Area */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* User's Current Leagues */}
                        {userLeagues.length > 0 && (
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Your Leagues</h2>
                                <div className="grid gap-4">
                                    {userLeagues.map((league) => (
                                        <div
                                            key={league.id}
                                            className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors cursor-pointer"
                                            onClick={() => handleViewLeague(league.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                                                        {league.name}
                                                    </h3>
                                                    <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        <span>Week {currentWeek}</span>
                                                        <span>•</span>
                                                        <span>{league.memberCount} Directors</span>
                                                        <span>•</span>
                                                        <span>Rank #{league.userRank}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                        {league.totalScore}
                                                    </div>
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                        Total Points
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* League Manager Component */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-6">League Management</h2>
                            <LeagueManager profile={loggedInProfile} />
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => safeNavigate('/leaderboard')}
                                    className="w-full p-3 text-left bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors"
                                >
                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">View Global Leaderboard</div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">See how you rank against all directors</div>
                                </button>
                                <button
                                    onClick={() => safeNavigate('/dashboard')}
                                    className="w-full p-3 text-left bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors"
                                >
                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">Manage Your Corps</div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">Update lineups and show selections</div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Stats and Activity */}
                    <div className="space-y-8">
                        
                        {/* Global League Stats */}
                        {globalLeagueStats && (
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">League Statistics</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                            {globalLeagueStats.totalLeagues}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Total Leagues</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                            {globalLeagueStats.totalMembers}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Active Directors</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                            {globalLeagueStats.avgMembersPerLeague}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Average League Size</div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                            Most Active: {globalLeagueStats.mostActiveLeague}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent Activity */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">Recent Activity</h3>
                            <div className="space-y-3">
                                {recentActivity.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                            activity.type === 'trade' ? 'bg-blue-500' :
                                            activity.type === 'result' ? 'bg-green-500' : 'bg-purple-500'
                                        }`}></div>
                                        <div className="flex-1">
                                            <p className="text-sm text-text-primary dark:text-text-primary-dark">
                                                {activity.message}
                                            </p>
                                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                                                {activity.time}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* League Guide */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">How Leagues Work</h3>
                            <div className="space-y-3 text-sm text-text-secondary dark:text-text-secondary-dark">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                                    <p>Create or join a league with fellow directors</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                                    <p>Compete using the same scoring system as the main game</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                                    <p>Weekly matchups and season-long standings</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                                    <p>Chat with league members and track progress</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeaguePage;