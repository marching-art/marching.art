import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllUserCorps, CORPS_CLASSES } from '../utils/profileCompatibility';
import Leaderboard from '../components/dashboard/Leaderboard';
import MatchupsDisplay from '../components/leagues/MatchupsDisplay';
import LeagueChat from '../components/leagues/LeagueChat';
import LeagueHistory from '../components/leagues/LeagueHistory';
import Icon from '../components/ui/Icon';

const LeagueDetailPage = () => {
    const { leagueId } = useParams();
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const navigate = useNavigate();
    
    const [league, setLeague] = useState(null);
    const [leagueMembers, setLeagueMembers] = useState([]);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [activeTab, setActiveTab] = useState('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [leagueStats, setLeagueStats] = useState(null);

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (isLoadingAuth || !leagueId) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
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

                if (!leagueData.members?.includes(loggedInProfile?.userId) && !loggedInProfile?.isAdmin) {
                    setError('You do not have access to this league');
                    return;
                }

                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);
                    
                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        const week = Math.ceil(currentDay / 7);
                        setCurrentWeek(Math.max(1, week));
                    }
                }

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
                try {
                    const profileDoc = await getDoc(doc(db, `artifacts/${dataNamespace}/users/${memberId}/profile/data`));
                    if (profileDoc.exists()) {
                        const profileData = profileDoc.data();
                        const userCorps = getAllUserCorps(profileData);
                        
                        return {
                            id: memberId,
                            username: profileData.username || 'Unknown Director',
                            corps: userCorps,
                            totalScore: Object.values(userCorps).reduce((sum, corps) => 
                                sum + (corps.totalSeasonScore || 0), 0),
                            lastActive: profileData.lastActive || new Date(),
                            joinedDate: profileData.createdAt || new Date(),
                            activeSeasonId: profileData.activeSeasonId
                        };
                    }
                } catch (err) {
                    console.warn(`Failed to fetch profile for ${memberId}:`, err);
                }
                return null;
            });

            const members = (await Promise.all(memberPromises)).filter(Boolean);
            members.sort((a, b) => b.totalScore - a.totalScore);
            setLeagueMembers(members);

            // Calculate league stats
            if (members.length > 0) {
                const scores = members.map(m => m.totalScore).filter(s => s > 0);
                setLeagueStats({
                    averageScore: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
                    highestScore: scores.length > 0 ? Math.max(...scores) : 0,
                    lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
                    activeMemberCount: members.filter(m => m.totalScore > 0).length,
                    totalMembers: members.length
                });
            }

        } catch (error) {
            console.error("Error fetching member profiles:", error);
        }
    };

    const handleViewProfile = (userId) => {
        navigate(`/profile/${userId}`);
    };

    const getCurrentUserRank = () => {
        const userIndex = leagueMembers.findIndex(m => m.id === loggedInProfile?.userId);
        return userIndex >= 0 ? userIndex + 1 : null;
    };

    const tabs = [
        { id: 'overview', name: 'Overview', icon: 'home' },
        { id: 'standings', name: 'Standings', icon: 'trophy' },
        { id: 'chat', name: 'Chat', icon: 'chat' },
        { id: 'matchups', name: 'Matchups', icon: 'users' },
        { id: 'members', name: 'Members', icon: 'user-group' },
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
                    <h2 className="text-2xl font-bold text-red-600 mb-4">League Error</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/leagues')}
                        className="bg-primary hover:bg-primary/90 text-on-primary font-bold py-2 px-4 rounded-theme"
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

                    {/* User Status Bar */}
                    {userMember && (
                        <div className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        #{userRank || '--'}
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Your Rank</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {userMember.totalScore.toFixed(0)}
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Your Score</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {leagueStats?.highestScore ? 
                                            ((userMember.totalScore / leagueStats.highestScore) * 100).toFixed(0) : 0}%
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">vs Leader</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {Object.keys(userMember.corps).length}
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Active Corps</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Tabs */}
                    <div className="mt-6">
                        <nav className="flex space-x-1 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? 'bg-primary text-on-primary'
                                            : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                    }`}
                                >
                                    <Icon name={tab.icon} className="h-4 w-4" />
                                    {tab.name}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="container mx-auto px-4 py-8">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* League Stats */}
                        <div className="lg:col-span-2">
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme mb-6">
                                <h3 className="text-xl font-bold text-primary dark:text-primary-dark mb-4">League Statistics</h3>
                                {leagueStats && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center p-4 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark">
                                            <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                {leagueStats.averageScore.toFixed(0)}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Average Score</div>
                                        </div>
                                        <div className="text-center p-4 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark">
                                            <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                {leagueStats.highestScore.toFixed(0)}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Highest Score</div>
                                        </div>
                                        <div className="text-center p-4 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark">
                                            <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                {leagueStats.activeMemberCount}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Active Directors</div>
                                        </div>
                                        <div className="text-center p-4 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark">
                                            <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                {currentWeek}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Current Week</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Top Performers */}
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h3 className="text-xl font-bold text-primary dark:text-primary-dark mb-4">Top Performers</h3>
                                <div className="space-y-3">
                                    {leagueMembers.slice(0, 5).map((member, index) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors cursor-pointer"
                                            onClick={() => handleViewProfile(member.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                                    index === 0 ? 'bg-yellow-500 text-black' :
                                                    index === 1 ? 'bg-gray-400 text-black' :
                                                    index === 2 ? 'bg-amber-600 text-white' :
                                                    'bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                                        {member.username}
                                                        {member.id === loggedInProfile?.userId && (
                                                            <span className="text-primary dark:text-primary-dark ml-2">(You)</span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        {Object.keys(member.corps).length} corps active
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                                {member.totalScore.toFixed(0)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* League Info Sidebar */}
                        <div className="space-y-6">
                            {/* League Chat Preview */}
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-primary dark:text-primary-dark">League Chat</h3>
                                    <button
                                        onClick={() => setActiveTab('chat')}
                                        className="text-sm text-primary dark:text-primary-dark hover:underline"
                                    >
                                        View All
                                    </button>
                                </div>
                                <LeagueChat 
                                    leagueId={leagueId}
                                    leagueName={league.name}
                                    leagueMembers={leagueMembers}
                                />
                            </div>

                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h3 className="text-lg font-bold text-primary dark:text-primary-dark mb-4">League Info</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Created:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">
                                            {new Date(league.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Season:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">{seasonSettings?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Invite Code:</span>
                                        <span className="font-mono text-primary dark:text-primary-dark">{league.inviteCode}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <h3 className="text-lg font-bold text-primary dark:text-primary-dark mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="w-full p-3 text-left bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors"
                                    >
                                        <div className="font-medium text-text-primary dark:text-text-primary-dark">Manage Your Corps</div>
                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Update lineups and shows</div>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('members')}
                                        className="w-full p-3 text-left bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors"
                                    >
                                        <div className="font-medium text-text-primary dark:text-text-primary-dark">View All Members</div>
                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">See complete member list</div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'standings' && (
                    <div className="max-w-6xl mx-auto">
                        <Leaderboard initialLeague={league} onViewProfile={handleViewProfile} />
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="max-w-4xl mx-auto">
                        <LeagueChat 
                            leagueId={leagueId}
                            leagueName={league.name}
                            leagueMembers={leagueMembers}
                        />
                    </div>
                )}

                {activeTab === 'matchups' && (
                    <div className="max-w-6xl mx-auto">
                        <MatchupsDisplay 
                            league={league} 
                            currentWeek={currentWeek} 
                            onViewProfile={handleViewProfile}
                            season={seasonSettings}
                        />
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">
                                League Members ({leagueMembers.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {leagueMembers.map((member, index) => (
                                    <div
                                        key={member.id}
                                        className="p-4 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors cursor-pointer"
                                        onClick={() => handleViewProfile(member.id)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-text-primary dark:text-text-primary-dark">
                                                    {member.username}
                                                    {member.id === loggedInProfile?.userId && (
                                                        <span className="text-primary dark:text-primary-dark ml-2">(You)</span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                    Rank #{index + 1}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-primary dark:text-primary-dark">
                                                    {member.totalScore.toFixed(0)}
                                                </div>
                                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    Total Score
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            {Object.entries(member.corps).map(([corpsClass, corps]) => (
                                                <div key={corpsClass} className="text-center p-2 bg-surface dark:bg-surface-dark rounded">
                                                    <div className="font-medium text-text-primary dark:text-text-primary-dark truncate">
                                                        {corps.corpsName || 'No Corps'}
                                                    </div>
                                                    <div className="text-text-secondary dark:text-text-secondary-dark">
                                                        {CORPS_CLASSES[corpsClass]?.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
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