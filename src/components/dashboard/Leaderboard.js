import React, { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { useUserStore } from '../../store/userStore';

const Leaderboard = ({ onViewProfile, initialLeague = null }) => {
    const { loggedInProfile: profile } = useUserStore();
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [error, setError] = useState(null);

    const isLeaguePage = !!initialLeague;

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Get season settings first
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                
                if (!seasonDoc.exists()) {
                    setLeaderboard([]);
                    setSeasonName('No Active Season');
                    setIsLoading(false);
                    return;
                }
                
                const seasonData = seasonDoc.data();
                const activeSeasonId = seasonData.seasonUid;
                setSeasonName(seasonData.name);

                if (isLeaguePage) {
                    // SCALABLE: League leaderboard - use precomputed global data + filter
                    await fetchLeagueLeaderboard(activeSeasonId, initialLeague);
                } else {
                    // SCALABLE: Global leaderboard - use precomputed data
                    await fetchGlobalLeaderboard(activeSeasonId);
                }
                
            } catch (error) {
                console.error("Leaderboard fetch failed:", error);
                setError(error.message);
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboardData();
    }, [selectedCorpsClass, isLeaguePage, initialLeague?.id]);

    const fetchGlobalLeaderboard = async (activeSeasonId) => {
        // SCALABLE: Single document read instead of collection group query
        const leaderboardDoc = await getDoc(doc(db, `leaderboards/${activeSeasonId}`));
        
        if (!leaderboardDoc.exists()) {
            setLeaderboard([]);
            return;
        }

        const leaderboardData = leaderboardDoc.data();
        const rankings = leaderboardData.rankings || [];

        // Filter by selected corps class and format for display
        const filteredRankings = rankings
            .filter(entry => entry.corpsClass === selectedCorpsClass || !entry.corpsClass) // Handle legacy data
            .map((entry, index) => ({
                id: `${entry.uid}_${selectedCorpsClass}`,
                userId: entry.uid,
                username: entry.username || 'Unknown Player',
                corpsName: entry.corpsName || getCorpsNameFromEntry(entry, selectedCorpsClass),
                corpsClass: selectedCorpsClass,
                totalSeasonScore: entry.score || 0,
                rank: index + 1
            }))
            .slice(0, 100); // Limit to top 100 for performance

        setLeaderboard(filteredRankings);
    };

    const fetchLeagueLeaderboard = async (activeSeasonId, league) => {
        if (!league?.members || league.members.length === 0) {
            setLeaderboard([]);
            return;
        }

        // SCALABLE: Get global leaderboard first, then filter for league members
        const leaderboardDoc = await getDoc(doc(db, `leaderboards/${activeSeasonId}`));
        
        if (!leaderboardDoc.exists()) {
            setLeaderboard([]);
            return;
        }

        const leaderboardData = leaderboardDoc.data();
        const globalRankings = leaderboardData.rankings || [];

        // Filter global rankings for league members only
        const leagueMembers = new Set(league.members);
        const leagueRankings = globalRankings
            .filter(entry => leagueMembers.has(entry.uid))
            .filter(entry => entry.corpsClass === selectedCorpsClass || !entry.corpsClass)
            .map((entry, index) => ({
                id: `${entry.uid}_${selectedCorpsClass}`,
                userId: entry.uid,
                username: entry.username || 'Unknown Player',
                corpsName: entry.corpsName || 'Unknown Corps',
                corpsClass: selectedCorpsClass,
                totalSeasonScore: entry.score || 0,
                rank: index + 1,
                globalRank: globalRankings.findIndex(r => r.uid === entry.uid) + 1
            }));

        setLeaderboard(leagueRankings);
    };

    // Helper function for legacy data compatibility
    const getCorpsNameFromEntry = (entry, corpsClass) => {
        if (entry[`${corpsClass}CorpsName`]) return entry[`${corpsClass}CorpsName`];
        if (entry.corpsName) return entry.corpsName;
        return 'Unknown Corps';
    };

    const getDisplayTitle = () => {
        if (isLeaguePage) {
            return `${initialLeague?.name || 'League'} Leaderboard`;
        }
        
        const classData = CORPS_CLASSES[selectedCorpsClass];
        return `${classData?.className || 'Global'} Leaderboard`;
    };

    const getRankDisplay = (entry) => {
        if (isLeaguePage && entry.globalRank) {
            return (
                <div className="text-center">
                    <div className="font-bold text-lg">#{entry.rank}</div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        #{entry.globalRank} global
                    </div>
                </div>
            );
        }
        return <div className="font-bold text-lg">#{entry.rank}</div>;
    };

    const getUserRankInfo = () => {
        if (!profile?.userId) return null;
        
        const userEntry = leaderboard.find(entry => entry.userId === profile.userId);
        if (!userEntry) return null;

        return (
            <div className="bg-primary/10 border border-primary/30 p-4 rounded-lg mb-4">
                <div className="text-center">
                    <div className="font-bold text-primary dark:text-primary-dark">Your Rank</div>
                    <div className="text-2xl font-bold">#{userEntry.rank}</div>
                    {userEntry.globalRank && (
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            #{userEntry.globalRank} globally
                        </div>
                    )}
                    <div className="text-lg font-semibold mt-1">
                        {userEntry.totalSeasonScore.toFixed(3)} points
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Loading leaderboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-red-300 dark:border-red-700">
                <div className="text-center py-8">
                    <p className="text-red-600 dark:text-red-400">Failed to load leaderboard</p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                        {getDisplayTitle()}
                    </h2>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        {seasonName} • {leaderboard.length} players
                    </p>
                </div>

                {/* Corps Class Selector */}
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <label className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                        Class:
                    </label>
                    <select
                        value={selectedCorpsClass}
                        onChange={(e) => setSelectedCorpsClass(e.target.value)}
                        className="px-3 py-1 border border-accent dark:border-accent-dark rounded-md 
                                 bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark
                                 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {CORPS_CLASS_ORDER.map(corpsClass => {
                            const classData = CORPS_CLASSES[corpsClass];
                            return (
                                <option key={corpsClass} value={corpsClass}>
                                    {classData.className}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            {/* User's Rank Info */}
            {getUserRankInfo()}

            {/* Leaderboard Table */}
            {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏆</div>
                    <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
                        No rankings available yet
                    </p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                        Rankings update hourly based on performance
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {leaderboard.map((entry, index) => {
                        const isCurrentUser = entry.userId === profile?.userId;
                        
                        return (
                            <div
                                key={entry.id}
                                className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                                    isCurrentUser
                                        ? 'bg-primary/10 border-primary/30'
                                        : 'bg-background dark:bg-background-dark border-accent/30 hover:border-accent/50'
                                }`}
                                onClick={() => onViewProfile && onViewProfile(entry.userId)}
                            >
                                {/* Rank */}
                                <div className="flex-shrink-0 w-16">
                                    {getRankDisplay(entry)}
                                </div>

                                {/* Player Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-text-primary dark:text-text-primary-dark truncate">
                                        {entry.username}
                                        {isCurrentUser && (
                                            <span className="ml-2 text-xs bg-primary text-on-primary px-2 py-1 rounded-full">
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark truncate">
                                        {entry.corpsName}
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="flex-shrink-0 text-right">
                                    <div className="font-bold text-lg text-text-primary dark:text-text-primary-dark">
                                        {entry.totalSeasonScore.toFixed(3)}
                                    </div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                        points
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer Info */}
            {leaderboard.length > 0 && (
                <div className="mt-6 pt-4 border-t border-accent/30 text-center">
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        Rankings update every hour • Showing top {Math.min(100, leaderboard.length)} players
                    </p>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;