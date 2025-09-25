// src/pages/LeagueDetailPage.js - Fixed parameter handling and navigation
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import Leaderboard from '../components/dashboard/Leaderboard';
import MatchupsDisplay from '../components/leagues/MatchupsDisplay';
import LeagueChat from '../components/leagues/LeagueChat';
import LeagueHistory from '../components/leagues/LeagueHistory';
import Icon from '../components/ui/Icon';
import toast from 'react-hot-toast';

const LeagueDetailPage = ({ leagueId: propLeagueId, navigate }) => {
    // Use leagueId from props (passed from App.js navigation)
    const leagueId = propLeagueId;
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    
    const [league, setLeague] = useState(null);
    const [leagueMembers, setLeagueMembers] = useState([]);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [activeTab, setActiveTab] = useState('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);
    const [error, setError] = useState(null);
    const [leagueStats, setLeagueStats] = useState(null);

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (isLoadingAuth || !leagueId) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
                // Fetch league and season data
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

                // Check if user has access to this league
                if (!leagueData.members?.includes(loggedInProfile?.userId) && !loggedInProfile?.isAdmin) {
                    setError('You do not have access to this league');
                    return;
                }

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

                // Fetch member profiles
                await fetchMemberProfiles(leagueData.members || []);

            } catch (err) {
                console.error('Error fetching league data:', err);
                setError('Failed to load league data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeagueData();
    }, [leagueId, loggedInProfile, isLoadingAuth]);

    const fetchMemberProfiles = async (memberIds) => {
        try {
            const memberPromises = memberIds.map(async (memberId) => {
                const profileDoc = await getDoc(doc(db, 'artifacts', dataNamespace, 'users', memberId, 'profile', 'data'));
                if (!profileDoc.exists()) return null;
                
                const profileData = { id: memberId, userId: memberId, ...profileDoc.data() };
                const allCorps = getAllUserCorps(profileData);
                
                // Calculate total score across all corps classes for this member
                let totalSeasonScore = 0;
                Object.keys(allCorps).forEach(corpsClass => {
                    const corps = allCorps[corpsClass];
                    if (corps?.totalSeasonScore) {
                        totalSeasonScore += corps.totalSeasonScore;
                    }
                });
                
                return {
                    ...profileData,
                    allCorps,
                    totalSeasonScore,
                    rank: 0 // Will be calculated after sorting
                };
            });
            
            const members = await Promise.all(memberPromises);
            const validMembers = members.filter(member => member !== null);
            
            // Sort by total score and assign ranks
            const sortedMembers = validMembers.sort((a, b) => b.totalSeasonScore - a.totalSeasonScore);
            sortedMembers.forEach((member, index) => {
                member.rank = index + 1;
            });
            
            setLeagueMembers(sortedMembers);
            
            // Calculate league stats
            const stats = {
                totalMembers: sortedMembers.length,
                avgScore: sortedMembers.length > 0 ? Math.round(sortedMembers.reduce((sum, member) => sum + member.totalSeasonScore, 0) / sortedMembers.length) : 0,
                highScore: sortedMembers.length > 0 ? sortedMembers[0].totalSeasonScore : 0,
                lowScore: sortedMembers.length > 0 ? sortedMembers[sortedMembers.length - 1].totalSeasonScore : 0
            };
            setLeagueStats(stats);
            
        } catch (error) {
            console.error('Error fetching member profiles:', error);
        }
    };

    const handleLeaveLeague = async () => {
        if (!window.confirm('Are you sure you want to leave this league? This action cannot be undone.')) {
            return;
        }
        
        setIsLeaving(true);
        try {
            const leaveLeagueFunction = httpsCallable(getFunctions(), 'leaveLeague');
            const result = await leaveLeagueFunction({ leagueId });
            
            toast.success(result.data.message);
            navigate('/leagues');
        } catch (error) {
            console.error('Error leaving league:', error);
            toast.error(error.message || 'Failed to leave league');
        } finally {
            setIsLeaving(false);
        }
    };

    const handleViewProfile = (userId) => {
        navigate(`/profile/${userId}`);
    };

    const getCurrentUserRank = () => {
        const currentUser = leagueMembers.find(member => member.userId === loggedInProfile?.userId);
        return currentUser?.rank || 0;
    };

    const tabs = [
        { id: 'overview', name: 'Overview', icon: 'home' },
        { id: 'leaderboard', name: 'Leaderboard', icon: 'trophy' },
        { id: 'matchups', name: 'Matchups', icon: 'users' },
        { id: 'chat', name: 'Chat', icon: 'message-circle' },
        { id: 'history', name: 'History', icon: 'clock' }
    ];

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

    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <Icon name="alert-triangle" className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        {error}
                    </h2>
                    <button
                        onClick={() => navigate('/leagues')}
                        className="bg-primary text-on-primary hover:bg-primary/90 transition-colors font-bold py-2 px-4 rounded-theme"
                    >
                        Back to Leagues
                    </button>
                </div>
            </div>
        );
    }

    if (!league) return null;

    const userRank = getCurrentUserRank();
    const userMember = leagueMembers.find(m => m.id === loggedInProfile?.userId);

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* League Header */}
            <div className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => navigate('/leagues')}
                            className="p-2 hover:bg-accent dark:hover:bg-accent-dark/20 rounded-theme transition-colors"
                        >
                            <Icon name="arrow-left" className="h-5 w-5 text-text-secondary dark:text-text-secondary-dark" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-primary dark:text-primary-dark">{league.name}</h1>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                {seasonSettings?.name} • Week {currentWeek} • {leagueMembers.length} Directors
                            </p>
                        </div>
                    </div>

                    {/* User Stats */}
                    {userMember && (
                        <div className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                            #{userRank}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            Your Rank
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                            {userMember.totalSeasonScore}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            Total Points
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLeaveLeague}
                                    disabled={isLeaving}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-theme transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLeaving ? 'Leaving...' : 'Leave League'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap gap-1 mt-6">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-theme transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-primary text-on-primary'
                                        : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                }`}
                            >
                                <Icon name={tab.icon} className="h-4 w-4" />
                                {tab.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="container mx-auto px-4 py-8">
                {activeTab === 'overview' && (
                    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* League Stats */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">League Overview</h3>
                                
                                {leagueStats && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                                {leagueStats.totalMembers}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Members</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                                {leagueStats.avgScore}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Avg Score</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                                {leagueStats.highScore}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">High Score</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                                {currentWeek}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Current Week</div>
                                        </div>
                                    </div>
                                )}

                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    Compete against fellow directors in this exclusive league. Track your progress, 
                                    engage in weekly matchups, and climb the leaderboard to become the ultimate corps director!
                                </p>
                            </div>

                            {/* Top Members Preview */}
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Top Directors</h3>
                                <div className="space-y-3">
                                    {leagueMembers.slice(0, 5).map((member, index) => (
                                        <div key={member.id} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    index === 0 ? 'bg-yellow-500 text-yellow-900' :
                                                    index === 1 ? 'bg-gray-400 text-gray-900' :
                                                    index === 2 ? 'bg-amber-600 text-amber-900' :
                                                    'bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                        {member.username || 'Anonymous Director'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-lg font-bold text-primary dark:text-primary-dark">
                                                {member.totalSeasonScore}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setActiveTab('leaderboard')}
                                    className="w-full mt-4 p-2 text-center text-primary hover:text-primary/80 transition-colors"
                                >
                                    View Full Leaderboard →
                                </button>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-8">
                            {/* League Info */}
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">League Details</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Created:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">
                                            {league.createdAt ? new Date(league.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Season:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">
                                            {seasonSettings?.name || 'Current Season'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Invite Code:</span>
                                        <span className="font-mono text-primary dark:text-primary-dark">
                                            {league.inviteCode}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">Quick Actions</h4>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setActiveTab('chat')}
                                        className="w-full p-2 text-left text-text-primary dark:text-text-primary-dark hover:bg-background dark:hover:bg-background-dark rounded transition-colors"
                                    >
                                        💬 League Chat
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('matchups')}
                                        className="w-full p-2 text-left text-text-primary dark:text-text-primary-dark hover:bg-background dark:hover:bg-background-dark rounded transition-colors"
                                    >
                                        ⚔️ View Matchups
                                    </button>
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="w-full p-2 text-left text-text-primary dark:text-text-primary-dark hover:bg-background dark:hover:bg-background-dark rounded transition-colors"
                                    >
                                        🎯 Manage Corps
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'leaderboard' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">League Leaderboard</h3>
                            <Leaderboard 
                                members={leagueMembers}
                                currentUserId={loggedInProfile?.userId}
                                onViewProfile={handleViewProfile}
                                showGlobalRanking={false}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'matchups' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">Weekly Matchups</h3>
                            <MatchupsDisplay 
                                league={league}
                                members={leagueMembers}
                                currentWeek={currentWeek}
                                onViewProfile={handleViewProfile}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">League Chat</h3>
                            <LeagueChat 
                                league={league}
                                currentUser={loggedInProfile}
                                members={leagueMembers}
                                onViewProfile={handleViewProfile}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">League History</h3>
                            <LeagueHistory 
                                league={league}
                                leagueMembers={leagueMembers}
                                currentWeek={currentWeek}
                                onViewProfile={handleViewProfile}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeagueDetailPage;