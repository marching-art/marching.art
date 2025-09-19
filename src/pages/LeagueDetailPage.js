import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps, CORPS_CLASSES } from '../utils/profileCompatibility';
import Leaderboard from '../components/dashboard/Leaderboard';
import MatchupsDisplay from '../components/leagues/MatchupsDisplay';

const LeagueDetailPage = ({ leagueId, setPage, onViewProfile }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [league, setLeague] = useState(null);
    const [leagueMembers, setLeagueMembers] = useState([]);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [activeTab, setActiveTab] = useState('standings');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [weeklyStats, setWeeklyStats] = useState({});

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
                // Fetch league and season data in parallel
                const [leagueDoc, seasonDoc] = await Promise.all([
                    getDoc(doc(db, 'leagues', leagueId)),
                    getDoc(doc(db, 'game-settings', 'season'))
                ]);

                if (!leagueDoc.exists()) {
                    setError('League not found');
                    return;
                }

                const leagueData = { id: leagueDoc.id, ...leagueDoc.data() };
                setLeague(leagueData);

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
                        setSelectedWeek(Math.max(1, week));
                    }
                }

                // Fetch member profiles with detailed data
                if (leagueData.members && leagueData.members.length > 0) {
                    const memberProfilesQuery = query(
                        collection(db, `artifacts/${dataNamespace}/users`), 
                        where('__name__', 'in', leagueData.members)
                    );
                    const profilesSnapshot = await getDocs(memberProfilesQuery);
                    const membersData = profilesSnapshot.docs.map(doc => {
                        const profileData = doc.data().profile?.data || {};
                        const userCorps = getAllUserCorps(profileData);
                        return {
                            id: doc.id,
                            username: profileData.username || 'Unknown User',
                            uniform: profileData.uniform,
                            corps: userCorps,
                            totalScore: Object.values(userCorps).reduce((sum, corps) => 
                                sum + (corps.totalSeasonScore || 0), 0),
                            joinedAt: profileData.createdAt,
                            isOnline: Math.random() > 0.6 // Mock online status
                        };
                    });
                    setLeagueMembers(membersData.sort((a, b) => b.totalScore - a.totalScore));
                }

                // Calculate weekly statistics
                calculateWeeklyStats(leagueData, seasonData);

            } catch (err) {
                console.error("Error fetching league data:", err);
                setError('Failed to load league data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeagueData();
    }, [leagueId, isLoadingAuth]);

    const calculateWeeklyStats = (leagueData, seasonData) => {
        // Mock weekly statistics - replace with real matchup data
        const stats = {};
        const maxWeeks = seasonData?.status === 'live-season' ? 10 : 7;
        
        for (let week = 1; week <= maxWeeks; week++) {
            stats[week] = {
                totalMatches: Math.floor(leagueData.members?.length / 2) || 0,
                completedMatches: Math.floor(Math.random() * (Math.floor(leagueData.members?.length / 2) || 0)),
                averageScore: 75.5 + Math.random() * 10,
                highScore: 85.2 + Math.random() * 5
            };
        }
        setWeeklyStats(stats);
    };

    // Check if user is a member of this league
    const isMember = league?.members?.includes(loggedInProfile?.userId);
    const isCreator = league?.creatorUid === loggedInProfile?.userId;

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading league...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">League Error</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">{error}</p>
                    <button 
                        onClick={() => setPage('leagues')}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
                    >
                        Back to Leagues
                    </button>
                </div>
            </div>
        );
    }

    // Not a member state
    if (league && !isMember && !loggedInProfile?.isAdmin) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Private League</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                        You don't have access to view this league.
                    </p>
                    <button 
                        onClick={() => setPage('leagues')}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
                    >
                        Back to Leagues
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'standings', name: 'Standings', icon: '🏆' },
        { id: 'matchups', name: 'Matchups', icon: '⚔️' },
        { id: 'members', name: 'Members', icon: '👥' },
        { id: 'history', name: 'History', icon: '📈' },
        { id: 'chat', name: 'Chat', icon: '💬' }
    ];

    const maxWeeks = seasonSettings?.status === 'live-season' ? 10 : 7;
    const weeks = Array.from({ length: maxWeeks }, (_, i) => i + 1);

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Header with League Info */}
                    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary-dark/10 dark:to-secondary-dark/10 rounded-theme p-6 border border-accent dark:border-accent-dark">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                                        {league.name}
                                    </h1>
                                    {isCreator && (
                                        <span className="px-2 py-1 bg-secondary text-on-secondary text-xs rounded-theme">
                                            Creator
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-text-secondary dark:text-text-secondary-dark">
                                    <span>{leagueMembers.length} members</span>
                                    <span>•</span>
                                    <span>{seasonSettings?.name || 'Current Season'}</span>
                                    <span>•</span>
                                    <span>Week {currentWeek}</span>
                                    <span>•</span>
                                    <span className="font-mono bg-surface dark:bg-surface-dark px-2 py-1 rounded">
                                        {league.inviteCode}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setPage('leagues')}
                                className="bg-surface dark:bg-surface-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme transition-all"
                            >
                                ← Back to Leagues
                            </button>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                            <div className="bg-background/50 dark:bg-background-dark/50 rounded-theme p-3 text-center">
                                <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                    {leagueMembers.length}
                                </div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    Active Members
                                </div>
                            </div>
                            <div className="bg-background/50 dark:bg-background-dark/50 rounded-theme p-3 text-center">
                                <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                    {weeklyStats[currentWeek]?.totalMatches || 0}
                                </div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    This Week's Matches
                                </div>
                            </div>
                            <div className="bg-background/50 dark:bg-background-dark/50 rounded-theme p-3 text-center">
                                <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                    {weeklyStats[currentWeek]?.averageScore?.toFixed(1) || '0.0'}
                                </div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    Average Score
                                </div>
                            </div>
                            <div className="bg-background/50 dark:bg-background-dark/50 rounded-theme p-3 text-center">
                                <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                    {league.champions?.length || 0}
                                </div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    Past Champions
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="border-b border-accent dark:border-accent-dark">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
                                            : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                    }`}
                                >
                                    <span className="mr-2">{tab.icon}</span>
                                    {tab.name}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-96">
                        {activeTab === 'standings' && (
                            <div className="space-y-6">
                                <Leaderboard 
                                    onViewProfile={onViewProfile} 
                                    initialLeague={league}
                                />
                                
                                {/* Weekly Performance Chart */}
                                <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                        League Performance Trends
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                                Weekly High Scores
                                            </h4>
                                            <div className="space-y-2">
                                                {weeks.slice(0, Math.min(currentWeek, 5)).reverse().map(week => (
                                                    <div key={week} className="flex justify-between items-center">
                                                        <span className="text-text-secondary dark:text-text-secondary-dark">
                                                            Week {week}
                                                        </span>
                                                        <span className="font-bold text-primary dark:text-primary-dark">
                                                            {weeklyStats[week]?.highScore?.toFixed(3) || '0.000'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                                Match Completion Rate
                                            </h4>
                                            <div className="space-y-2">
                                                {weeks.slice(0, Math.min(currentWeek, 5)).reverse().map(week => {
                                                    const completed = weeklyStats[week]?.completedMatches || 0;
                                                    const total = weeklyStats[week]?.totalMatches || 1;
                                                    const percentage = Math.round((completed / total) * 100);
                                                    return (
                                                        <div key={week} className="flex justify-between items-center">
                                                            <span className="text-text-secondary dark:text-text-secondary-dark">
                                                                Week {week}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 bg-accent dark:bg-accent-dark rounded-full h-2">
                                                                    <div 
                                                                        className="bg-primary dark:bg-primary-dark h-2 rounded-full"
                                                                        style={{ width: `${percentage}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-medium">
                                                                    {percentage}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'matchups' && (
                            <div className="space-y-6">
                                {/* Week Selector */}
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                        Weekly Matchups
                                    </h3>
                                    <select 
                                        value={selectedWeek} 
                                        onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                                        className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark"
                                    >
                                        {weeks.map(week => (
                                            <option key={week} value={week}>Week {week}</option>
                                        ))}
                                    </select>
                                </div>

                                <MatchupsDisplay
                                    league={league}
                                    currentWeek={selectedWeek}
                                    onViewProfile={onViewProfile}
                                    season={seasonSettings}
                                />
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                        League Members ({leagueMembers.length})
                                    </h3>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        {leagueMembers.filter(m => m.isOnline).length} online
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {leagueMembers.map((member, index) => (
                                        <div key={member.id} className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 bg-accent dark:bg-accent-dark rounded-full flex items-center justify-center">
                                                            <span className="text-lg font-bold">
                                                                {member.username.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        {member.isOnline && (
                                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-surface dark:border-surface-dark"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <button
                                                            onClick={() => onViewProfile(member.id)}
                                                            className="font-bold text-text-primary dark:text-text-primary-dark hover:text-primary dark:hover:text-primary-dark"
                                                        >
                                                            {member.username}
                                                        </button>
                                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            Rank #{index + 1}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-primary dark:text-primary-dark">
                                                        {member.totalScore.toFixed(3)}
                                                    </div>
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                        Total Score
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1">
                                                {Object.entries(member.corps).map(([corpsClass, corps]) => (
                                                    <div key={corpsClass} className="flex justify-between text-sm">
                                                        <span className="text-text-secondary dark:text-text-secondary-dark">
                                                            <span className={`inline-block w-2 h-2 rounded-full ${CORPS_CLASSES[corpsClass]?.color} mr-2`}></span>
                                                            {corps.corpsName}
                                                        </span>
                                                        <span className="font-medium">
                                                            {(corps.totalSeasonScore || 0).toFixed(3)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                    League History
                                </h3>
                                
                                {/* Past Champions */}
                                {league.champions && league.champions.length > 0 ? (
                                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                                        <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                                            Hall of Champions
                                        </h4>
                                        <div className="space-y-4">
                                            {league.champions.map((champion, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-text-primary dark:text-text-primary-dark">
                                                                {champion.winnerUsername}
                                                            </div>
                                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                                {champion.winnerCorpsName} • {champion.seasonName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-primary dark:text-primary-dark">
                                                            {champion.score?.toFixed(3) || 'N/A'}
                                                        </div>
                                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            {champion.archivedAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
                                        No champions yet. Be the first to win a season!
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                                <div className="text-center py-12">
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                        League Chat Coming Soon
                                    </h3>
                                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                        Chat with your league members in real-time. Feature in development!
                                    </p>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        For now, join our{' '}
                                        <a 
                                            href="https://discord.gg/YvFRJ97A5H" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-primary dark:text-primary-dark hover:underline"
                                        >
                                            Discord community
                                        </a>
                                        {' '}to chat with other players.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeagueDetailPage;