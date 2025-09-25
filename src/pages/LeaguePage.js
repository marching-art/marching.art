import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import LeagueManager from '../components/dashboard/LeagueManager';
import Icon from '../components/ui/Icon';

const LeagueHub = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const navigate = useNavigate();
    
    const [userLeagues, setUserLeagues] = useState([]);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [globalLeagueStats, setGlobalLeagueStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    
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
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeagueData();
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
                avgMembersPerLeague: totalLeagues > 0 ? Math.round(totalMembers / totalLeagues) : 0,
                mostActiveLeague
            });
        } catch (error) {
            console.error("Error fetching global stats:", error);
        }
    };

    const fetchUserLeaguesWithStats = async (leagueIds) => {
        try {
            const leaguePromises = leagueIds.map(async (leagueId) => {
                const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
                if (!leagueDoc.exists()) return null;
                
                const leagueData = { id: leagueDoc.id, ...leagueDoc.data() };
                
                // Fetch member profiles for enhanced data
                if (leagueData.members && leagueData.members.length > 0) {
                    const memberPromises = leagueData.members.slice(0, 10).map(async (memberId) => {
                        try {
                            const profileDoc = await getDoc(doc(db, `artifacts/${dataNamespace}/users/${memberId}/profile/data`));
                            if (profileDoc.exists()) {
                                const profileData = profileDoc.data();
                                return {
                                    id: memberId,
                                    username: profileData.username || 'Unknown User',
                                    totalScore: Object.values(profileData.corps || {}).reduce((sum, corps) => 
                                        sum + (corps.totalSeasonScore || 0), 0)
                                };
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch profile for ${memberId}`);
                        }
                        return null;
                    });
                    
                    const members = (await Promise.all(memberPromises)).filter(Boolean);
                    members.sort((a, b) => b.totalScore - a.totalScore);
                    
                    // Calculate user's rank and league stats
                    const userMember = members.find(m => m.id === loggedInProfile.userId);
                    const userRank = userMember ? members.indexOf(userMember) + 1 : null;
                    const topScore = members.length > 0 ? members[0].totalScore : 0;
                    
                    return {
                        ...leagueData,
                        members: members,
                        userRank: userRank,
                        topScore: topScore,
                        userScore: userMember?.totalScore || 0,
                        isLeading: userRank === 1,
                        memberCount: leagueData.members.length,
                        lastActivity: new Date() // TODO: Replace with actual last activity data
                    };
                }
                
                return { ...leagueData, members: [], memberCount: 0 };
            });
            
            const leagues = (await Promise.all(leaguePromises)).filter(Boolean);
            return leagues.sort((a, b) => a.userRank - b.userRank);
        } catch (error) {
            console.error("Error fetching user leagues:", error);
            return [];
        }
    };

    const fetchRecentActivity = async (leagueIds) => {
        // TODO: Implement recent activity feed
        // This could include: recent trades, lineup changes, new members, weekly results, etc.
        setRecentActivity([
            { type: 'trade', message: 'New trade completed in Championship League', time: '2 hours ago' },
            { type: 'result', message: 'Week 3 results are in!', time: '1 day ago' },
            { type: 'member', message: 'DirectorMike joined Elite Corps League', time: '2 days ago' }
        ]);
    };

    const handleViewLeague = (leagueId) => {
        navigate(`/league/${leagueId}`);
    };

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
                    <p className="text-xl text-text-secondary dark:text-text-secondary-dark max-w-3xl mx-auto">
                        Compete with fellow fantasy corps directors, track your performance, and build the ultimate marching arts community
                    </p>
                </div>

                {/* Global Stats Overview */}
                {globalLeagueStats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark text-center">
                            <div className="text-3xl font-bold text-primary dark:text-primary-dark mb-2">
                                {globalLeagueStats.totalLeagues}
                            </div>
                            <div className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Active Leagues
                            </div>
                        </div>
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark text-center">
                            <div className="text-3xl font-bold text-primary dark:text-primary-dark mb-2">
                                {globalLeagueStats.totalMembers}
                            </div>
                            <div className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Directors
                            </div>
                        </div>
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark text-center">
                            <div className="text-3xl font-bold text-primary dark:text-primary-dark mb-2">
                                {globalLeagueStats.avgMembersPerLeague}
                            </div>
                            <div className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Avg League Size
                            </div>
                        </div>
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark text-center">
                            <div className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">
                                Week {currentWeek}
                            </div>
                            <div className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Current Week
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - My Leagues */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* My Leagues Section */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-primary dark:text-primary-dark">My Leagues</h2>
                                <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    {userLeagues.length} league{userLeagues.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {userLeagues.length > 0 ? (
                                <div className="space-y-4">
                                    {userLeagues.map((league) => (
                                        <div
                                            key={league.id}
                                            onClick={() => handleViewLeague(league.id)}
                                            className="p-6 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all cursor-pointer group"
                                        >
                                            {/* League Header */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark group-hover:text-primary dark:group-hover:text-primary-dark transition-colors">
                                                        {league.name}
                                                    </h3>
                                                    <div className="flex items-center gap-4 mt-1">
                                                        <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            {league.memberCount} members
                                                        </span>
                                                        {league.userRank && (
                                                            <span className={`text-sm font-bold ${
                                                                league.isLeading ? 'text-yellow-500' : 
                                                                league.userRank <= 3 ? 'text-green-500' : 'text-text-secondary dark:text-text-secondary-dark'
                                                            }`}>
                                                                #{league.userRank} 
                                                                {league.isLeading && ' 🏆'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                                        {league.userScore.toFixed(0)}
                                                    </div>
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                        Your Score
                                                    </div>
                                                </div>
                                            </div>

                                            {/* League Stats */}
                                            <div className="grid grid-cols-3 gap-4 mb-4">
                                                <div className="text-center p-2 bg-surface dark:bg-surface-dark rounded">
                                                    <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                        {league.topScore.toFixed(0)}
                                                    </div>
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Top Score</div>
                                                </div>
                                                <div className="text-center p-2 bg-surface dark:bg-surface-dark rounded">
                                                    <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                        {league.members.length > 0 ? 
                                                            Math.round(league.members.reduce((sum, m) => sum + m.totalScore, 0) / league.members.length) : 0}
                                                    </div>
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Average</div>
                                                </div>
                                                <div className="text-center p-2 bg-surface dark:bg-surface-dark rounded">
                                                    <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                        {league.memberCount}
                                                    </div>
                                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Members</div>
                                                </div>
                                            </div>

                                            {/* Top Members Preview */}
                                            <div className="border-t border-accent dark:border-accent-dark pt-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
                                                        Top Directors
                                                    </span>
                                                    <Icon name="arrow-right" className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark group-hover:text-primary dark:group-hover:text-primary-dark transition-colors" />
                                                </div>
                                                <div className="space-y-1">
                                                    {league.members.slice(0, 3).map((member, index) => (
                                                        <div key={member.id} className="flex justify-between items-center text-sm">
                                                            <span className={`${member.id === loggedInProfile.userId ? 'font-bold text-primary dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark'}`}>
                                                                {index + 1}. {member.username}
                                                                {member.id === loggedInProfile.userId && ' (You)'}
                                                            </span>
                                                            <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                                                {member.totalScore.toFixed(0)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">🏟️</div>
                                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                        Ready to Join the Competition?
                                    </h3>
                                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4 max-w-md mx-auto">
                                        Join existing leagues or create your own to compete with fellow directors and climb the rankings
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* League Management */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-6">League Management</h2>
                            <LeagueManager profile={loggedInProfile} />
                        </div>
                    </div>

                    {/* Right Column - Activity & Info */}
                    <div className="space-y-6">
                        {/* Recent Activity */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">Recent Activity</h3>
                            <div className="space-y-3">
                                {recentActivity.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark">
                                        <div className={`w-2 h-2 rounded-full mt-2 ${
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
                                    <p>Compete weekly with your lineups and show selections</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                                    <p>Track standings, matchups, and performance stats</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                                    <p>Crown a champion at the end of each season</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => navigate('/leaderboard')}
                                    className="w-full p-3 text-left bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors"
                                >
                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">View Global Leaderboard</div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">See how you rank against all directors</div>
                                </button>
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="w-full p-3 text-left bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-colors"
                                >
                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">Manage Your Corps</div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">Update lineups and show selections</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeagueHub;