// src/components/dashboard/MyStatus.js
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import Icon from '../ui/Icon';

const MyStatus = ({ username, profile }) => {
    const [userCorps, setUserCorps] = useState({});
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [recentScores, setRecentScores] = useState([]);
    const [leagueRankings, setLeagueRankings] = useState([]);
    const [upcomingShows, setUpcomingShows] = useState([]);
    const [seasonStats, setSeasonStats] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!profile) return;

            try {
                // Get user corps data
                const corps = getAllUserCorps(profile);
                setUserCorps(corps);

                // Fetch season settings
                const seasonRef = doc(db, 'game-settings', 'season');
                const seasonSnap = await getDoc(seasonRef);
                
                if (seasonSnap.exists()) {
                    const settings = seasonSnap.data();
                    setSeasonSettings(settings);

                    // Fetch recent fantasy recap data for score trends
                    if (settings.seasonUid) {
                        await fetchRecentScores(settings.seasonUid, corps);
                        await fetchSeasonStats(settings.seasonUid, corps);
                        await fetchUpcomingShows(settings);
                    }

                    // Fetch league rankings if user is in leagues
                    if (profile.leagueIds && profile.leagueIds.length > 0) {
                        await fetchLeagueRankings(profile.leagueIds, profile.userId);
                    }
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [profile]);

    const fetchRecentScores = async (seasonUid, corps) => {
        try {
            const recapRef = doc(db, 'fantasy_recaps', seasonUid);
            const recapSnap = await getDoc(recapRef);
            
            if (recapSnap.exists()) {
                const recapData = recapSnap.data();
                const recentRecaps = recapData.recaps
                    ?.sort((a, b) => b.offSeasonDay - a.offSeasonDay)
                    .slice(0, 5) || [];
                
                // Process scores for each corps class
                const processedScores = recentRecaps.map(recap => ({
                    day: recap.offSeasonDay,
                    date: recap.timestamp?.toDate(),
                    scores: Object.keys(corps).reduce((acc, corpsClass) => {
                        const corpsName = corps[corpsClass]?.corpsName;
                        if (corpsName) {
                            const userScore = recap.userScores?.[profile.userId]?.[corpsClass];
                            acc[corpsClass] = {
                                score: userScore || 0,
                                rank: recap.rankings?.[corpsClass]?.findIndex(entry => 
                                    entry.userId === profile.userId) + 1 || 'N/A'
                            };
                        }
                        return acc;
                    }, {})
                }));
                
                setRecentScores(processedScores);
            }
        } catch (error) {
            console.error('Error fetching recent scores:', error);
        }
    };

    const fetchSeasonStats = async (seasonUid, corps) => {
        try {
            // Calculate season statistics
            const stats = {};
            
            Object.keys(corps).forEach(corpsClass => {
                const corpsData = corps[corpsClass];
                stats[corpsClass] = {
                    totalScore: corpsData.totalSeasonScore || 0,
                    showsSelected: Object.keys(corpsData.selectedShows || {}).length,
                    tradesUsed: corpsData.weeklyTrades?.used || 0,
                    lastScoredDay: corpsData.lastScoredDay || 0
                };
            });
            
            setSeasonStats(stats);
        } catch (error) {
            console.error('Error calculating season stats:', error);
        }
    };

    const fetchUpcomingShows = async (settings) => {
        try {
            if (settings.status === 'live-season' && settings.events) {
                const today = new Date();
                const upcoming = settings.events
                    .flatMap(event => 
                        event.shows?.map(show => ({
                            ...show,
                            week: event.week,
                            dayIndex: event.dayIndex
                        })) || []
                    )
                    .filter(show => {
                        if (!show.date) return false;
                        const showDate = show.date.toDate ? show.date.toDate() : new Date(show.date);
                        return showDate >= today;
                    })
                    .sort((a, b) => {
                        const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
                        const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
                        return dateA - dateB;
                    })
                    .slice(0, 3);
                
                setUpcomingShows(upcoming);
            }
        } catch (error) {
            console.error('Error fetching upcoming shows:', error);
        }
    };

    const fetchLeagueRankings = async (leagueIds, userId) => {
        try {
            const rankings = [];
            
            for (const leagueId of leagueIds.slice(0, 3)) { // Limit to top 3 leagues for performance
                const leagueRef = doc(db, 'leagues', leagueId);
                const leagueSnap = await getDoc(leagueRef);
                
                if (leagueSnap.exists()) {
                    const leagueData = leagueSnap.data();
                    
                    // Get league member profiles for ranking
                    const memberProfiles = [];
                    for (const memberId of leagueData.members || []) {
                        const memberRef = doc(db, 'artifacts', dataNamespace, 'users', memberId, 'profile', 'data');
                        const memberSnap = await getDoc(memberRef);
                        if (memberSnap.exists()) {
                            memberProfiles.push({ userId: memberId, ...memberSnap.data() });
                        }
                    }
                    
                    // Calculate rankings based on total season score
                    const ranked = memberProfiles
                        .map(member => {
                            const corps = getAllUserCorps(member);
                            const totalScore = Object.values(corps)
                                .reduce((sum, c) => sum + (c.totalSeasonScore || 0), 0);
                            return { ...member, totalScore };
                        })
                        .sort((a, b) => b.totalScore - a.totalScore);
                    
                    const userRank = ranked.findIndex(member => member.userId === userId) + 1;
                    
                    rankings.push({
                        leagueName: leagueData.name,
                        userRank,
                        totalMembers: ranked.length,
                        userScore: ranked.find(m => m.userId === userId)?.totalScore || 0
                    });
                }
            }
            
            setLeagueRankings(rankings);
        } catch (error) {
            console.error('Error fetching league rankings:', error);
        }
    };

    const StatCard = ({ title, value, subtitle, color, icon, trend = null, onClick = null }) => (
        <div 
            className={`bg-background dark:bg-background-dark p-4 rounded-theme text-center transition-all hover:shadow-lg ${
                onClick ? 'cursor-pointer hover:bg-accent dark:hover:bg-accent-dark/10' : ''
            }`}
            onClick={onClick}
        >
            <div className="flex items-center justify-center gap-2 mb-2">
                {icon && <Icon path={icon} className="w-4 h-4 text-primary dark:text-primary-dark" />}
                {color && <div className={`w-3 h-3 rounded-full ${color}`}></div>}
                <p className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">{title}</p>
            </div>
            {isLoading ? (
                <div className="h-6 bg-surface dark:bg-surface-dark rounded animate-pulse w-3/4 mx-auto"></div>
            ) : (
                <div className="space-y-1">
                    <p className="text-xl font-bold text-primary dark:text-primary-dark">{value}</p>
                    {subtitle && <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{subtitle}</p>}
                    {trend && (
                        <div className={`flex items-center justify-center gap-1 text-xs ${
                            trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-text-secondary dark:text-text-secondary-dark'
                        }`}>
                            <Icon path={trend > 0 ? "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.94" : 
                                      trend < 0 ? "M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.511l-5.511-3.182" :
                                      "M5 12h14"} 
                                  className="w-3 h-3" />
                            <span>{Math.abs(trend).toFixed(1)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const QuickAction = ({ title, description, icon, onClick, color = "bg-primary" }) => (
        <button
            onClick={onClick}
            className={`${color} hover:opacity-90 text-on-primary p-3 rounded-theme text-left transition-all hover:scale-105 shadow-theme`}
        >
            <div className="flex items-start gap-3">
                <Icon path={icon} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-semibold text-sm">{title}</h4>
                    <p className="text-xs opacity-90">{description}</p>
                </div>
            </div>
        </button>
    );

    if (Object.keys(userCorps).length === 0) {
        return (
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                    Welcome to marching.art, <span className="text-primary dark:text-primary-dark">{username}!</span>
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                    Ready to build your ultimate drum corps? Create your first corps below to get started.
                </p>
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme border-l-4 border-primary">
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        💡 <strong>Tip:</strong> Start with a World Class corps for the full experience, 
                        then expand to Open Class and A Class for maximum scoring potential!
                    </p>
                </div>
            </div>
        );
    }

    // Calculate trends and summary stats
    const totalSeasonScore = Object.values(userCorps)
        .reduce((sum, corps) => sum + (corps.totalSeasonScore || 0), 0);
    
    const recentTrend = recentScores.length >= 2 
        ? recentScores[0]?.scores && recentScores[1]?.scores 
            ? Object.values(recentScores[0].scores).reduce((sum, s) => sum + s.score, 0) -
              Object.values(recentScores[1].scores).reduce((sum, s) => sum + s.score, 0)
            : 0
        : 0;

    const orderedCorpsToDisplay = CORPS_CLASS_ORDER.filter(key => userCorps[key]);
    const bestRank = Math.min(...leagueRankings.map(r => r.userRank).filter(r => r > 0), Infinity);

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            {/* Header with seasonal context */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                        Welcome back, <span className="text-primary dark:text-primary-dark">{username}!</span>
                    </h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        {seasonSettings?.status === 'live-season' 
                            ? `Live Season • ${seasonSettings?.name || 'Current Season'}`
                            : `Off-Season • ${seasonSettings?.name || 'Fantasy Season'}`}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">{totalSeasonScore.toFixed(1)}</p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Total Score</p>
                </div>
            </div>

            {/* Corps Status Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {orderedCorpsToDisplay.map(corpsClass => {
                    const corps = userCorps[corpsClass];
                    const classInfo = CORPS_CLASSES[corpsClass];
                    const stats = seasonStats[corpsClass] || {};
                    const recentScore = recentScores[0]?.scores?.[corpsClass];
                    
                    return (
                        <StatCard
                            key={corpsClass}
                            title={classInfo.name}
                            value={stats.totalScore?.toFixed(1) || '0.0'}
                            subtitle={corps.corpsName}
                            color={classInfo.color}
                            trend={recentTrend}
                        />
                    );
                })}
            </div>

            {/* Performance Insights */}
            {(recentScores.length > 0 || leagueRankings.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {recentScores.length > 0 && (
                        <StatCard
                            title="Recent Performance"
                            value={`${Object.values(recentScores[0]?.scores || {}).reduce((sum, s) => sum + s.score, 0).toFixed(1)}`}
                            subtitle={`Day ${recentScores[0]?.day || 'N/A'}`}
                            icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                            trend={recentTrend}
                        />
                    )}
                    
                    {bestRank !== Infinity && (
                        <StatCard
                            title="Best League Rank"
                            value={`#${bestRank}`}
                            subtitle={`of ${leagueRankings.find(r => r.userRank === bestRank)?.totalMembers || 'N/A'}`}
                            icon="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M15.75 4.5V2.25a1.5 1.5 0 00-3 0v2.25m3 0h-3m0 0h-.375a1.125 1.125 0 00-1.125 1.125v4.125c0 .621.504 1.125 1.125 1.125h2.25c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H15.75z"
                        />
                    )}
                    
                    {upcomingShows.length > 0 && (
                        <StatCard
                            title="Next Show"
                            value={upcomingShows[0].eventName}
                            subtitle={upcomingShows[0].date?.toDate ? 
                                upcomingShows[0].date.toDate().toLocaleDateString() : 
                                'TBD'
                            }
                            icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 002.25 2.25v7.5"
                        />
                    )}
                </div>
            )}

            {/* Quick Actions */}
            <div className="border-t border-accent dark:border-accent-dark pt-4">
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <QuickAction
                        title="Adjust Lineups"
                        description="Make trades and optimize your corps"
                        icon="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
                        onClick={() => {/* Will be handled by parent components */}}
                    />
                    <QuickAction
                        title="Select Shows"
                        description="Choose which competitions to attend"
                        icon="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                        color="bg-secondary"
                        onClick={() => {/* Will be handled by parent components */}}
                    />
                    <QuickAction
                        title="View Leagues"
                        description="Check your competitive standings"
                        icon="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                        color="bg-yellow-600"
                        onClick={() => {/* Will be handled by parent components */}}
                    />
                </div>
            </div>
        </div>
    );
};

export default MyStatus;