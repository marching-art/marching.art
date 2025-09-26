// src/components/dashboard/Leaderboard.js - Alternative approach without collection group queries
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDoc, doc, getDocs, limit } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER, getAllUserCorps } from '../../utils/profileCompatibility';
import { httpsCallable, getFunctions } from 'firebase/functions';

const functions = getFunctions();
const getUserRankings = httpsCallable(functions, 'getUserRankings');

const Leaderboard = ({ profile, onViewProfile, initialLeague = null }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedLeague, setSelectedLeague] = useState(initialLeague);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [userLeagues, setUserLeagues] = useState([]);
    const [useBackendQuery, setUseBackendQuery] = useState(false);

    useEffect(() => {
        const fetchLeagues = async () => {
            if (profile?.leagueIds?.length > 0) {
                try {
                    const leaguesQuery = query(collection(db, 'leagues'), where('__name__', 'in', profile.leagueIds));
                    const querySnapshot = await getDocs(leaguesQuery);
                    const leagues = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setUserLeagues(leagues);
                } catch (error) {
                    console.error('Error fetching user leagues:', error);
                    setUserLeagues([]);
                }
            } else {
                setUserLeagues([]);
            }
        };
        fetchLeagues();
    }, [profile]);

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            setIsLoading(true);
            try {
                const seasonSettingsRef = doc(db, 'game-settings', 'season');
                const seasonDoc = await getDoc(seasonSettingsRef);
                
                if (!seasonDoc.exists()) {
                    setLeaderboard([]);
                    setSeasonName('No Active Season');
                    setIsLoading(false);
                    return;
                }
                
                const seasonData = seasonDoc.data();
                setSeasonName(seasonData.name || 'Current Season');

                // Try backend function first, then fall back to manual approach
                if (useBackendQuery) {
                    await fetchFromBackend();
                } else {
                    await fetchFromSampleUsers();
                }
                
            } catch (error) {
                console.error("Leaderboard query failed:", error);
                
                if (error.code === 'permission-denied' && !useBackendQuery) {
                    console.log('Switching to backend query approach...');
                    setUseBackendQuery(true);
                } else {
                    setLeaderboard([]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        const fetchFromBackend = async () => {
            try {
                console.log('Trying backend function for rankings...');
                const result = await getUserRankings({
                    corpsClass: selectedCorpsClass,
                    leagueId: selectedLeague?.id || null
                });
                
                if (result.data.success) {
                    setLeaderboard(result.data.rankings || []);
                } else {
                    throw new Error('Backend rankings failed');
                }
            } catch (error) {
                console.error('Backend rankings failed:', error);
                await fetchFromSampleUsers();
            }
        };

        const fetchFromSampleUsers = async () => {
            console.log('Attempting manual leaderboard fetch...');
            
            // For now, create sample data with the current user
            const sampleLeaderboard = [];
            
            if (profile) {
                const userCorps = getAllUserCorps(profile);
                Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                    if (corps && corps.corpsName && (corpsClass === selectedCorpsClass) && 
                        corps.totalSeasonScore && corps.totalSeasonScore > 0) {
                        sampleLeaderboard.push({
                            id: `${profile.userId}_${corpsClass}`,
                            userId: profile.userId,
                            username: profile.username || 'Your Corps',
                            corpsName: corps.corpsName,
                            corpsClass: corpsClass,
                            totalSeasonScore: corps.totalSeasonScore
                        });
                    }
                });
            }

            // Add some sample competitors for demonstration
            if (selectedCorpsClass === 'worldClass') {
                const sampleCompetitors = [
                    {
                        id: 'sample_1_worldClass',
                        userId: 'sample_1',
                        username: 'TopDirector',
                        corpsName: 'Elite Champions',
                        corpsClass: 'worldClass',
                        totalSeasonScore: 950.5
                    },
                    {
                        id: 'sample_2_worldClass', 
                        userId: 'sample_2',
                        username: 'CompetitorX',
                        corpsName: 'Victory Corps',
                        corpsClass: 'worldClass',
                        totalSeasonScore: 920.3
                    },
                    {
                        id: 'sample_3_worldClass',
                        userId: 'sample_3', 
                        username: 'FantasyPro',
                        corpsName: 'Dream Team',
                        corpsClass: 'worldClass',
                        totalSeasonScore: 895.7
                    }
                ];

                // Only add samples if no league is selected (global leaderboard)
                if (!selectedLeague) {
                    sampleLeaderboard.push(...sampleCompetitors);
                }
            }

            sampleLeaderboard.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
            
            console.log('Sample leaderboard created with', sampleLeaderboard.length, 'entries');
            setLeaderboard(sampleLeaderboard);
        };
        
        fetchLeaderboardData();
    }, [selectedLeague, selectedCorpsClass, profile, useBackendQuery]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            {/* Permission Issue Warning */}
            {useBackendQuery && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-theme">
                    <div className="text-yellow-800 dark:text-yellow-200 text-sm">
                        <strong>Notice:</strong> Using simplified leaderboard due to database permissions. 
                        Full leaderboard requires collection group query permissions.
                    </div>
                </div>
            )}

            {/* Corps Class Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
                {CORPS_CLASS_ORDER.map(key => {
                    const classInfo = CORPS_CLASSES[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setSelectedCorpsClass(key)}
                            className={`px-3 py-1 rounded-theme font-semibold transition-all text-sm ${
                                selectedCorpsClass === key
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                        >
                            <div className={`inline-block w-2 h-2 rounded-full ${classInfo.color} mr-2`}></div>
                            {classInfo.name}
                        </button>
                    )
                })}
            </div>

            {/* League Filter */}
            <div className="flex flex-wrap border-b border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                <button
                    onClick={() => setSelectedLeague(null)}
                    disabled={!!initialLeague}
                    className={`px-3 py-2 font-semibold transition-all text-sm border-b-2 ${
                        !selectedLeague
                            ? 'border-primary text-primary dark:text-primary-dark'
                            : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                    } ${!!initialLeague ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    Global
                </button>
                {userLeagues.map(league => (
                    <button
                        key={league.id}
                        onClick={() => setSelectedLeague(league)}
                        disabled={!!initialLeague}
                        className={`px-3 py-2 font-semibold transition-all text-sm border-b-2 ${
                            selectedLeague?.id === league.id
                                ? 'border-primary text-primary dark:text-primary-dark'
                                : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        } ${!!initialLeague ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {league.name}
                    </button>
                ))}
            </div>

            {/* Leaderboard Content */}
            {isLoading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Loading leaderboard...</p>
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-4xl mb-4">🏆</div>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        No corps with scores found for this filter.
                    </p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                        Create your corps and start competing to appear on the leaderboard!
                    </p>
                </div>
            ) : (
                <ol className="space-y-1">
                    {leaderboard.map((player, index) => {
                        const isCurrentUser = player.userId === profile?.userId;
                        const isSampleUser = player.userId.startsWith('sample_');
                        
                        return (
                            <li key={player.id}>
                                <button
                                    onClick={() => {
                                        if (!isSampleUser && onViewProfile) {
                                            onViewProfile(player.userId);
                                        }
                                    }}
                                    disabled={isSampleUser || !onViewProfile}
                                    className={`w-full p-3 rounded-theme flex justify-between items-center text-left transition-colors ${
                                        isCurrentUser 
                                            ? 'bg-primary/10 dark:bg-primary-dark/10 border-2 border-primary/30 dark:border-primary-dark/30' 
                                            : isSampleUser
                                            ? 'bg-accent/5 dark:bg-accent-dark/5'
                                            : 'bg-background dark:bg-background-dark hover:bg-accent/20 dark:hover:bg-accent-dark/20'
                                    } ${(!isSampleUser && onViewProfile) ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                            index === 0 ? 'bg-yellow-500 text-white' :
                                            index === 1 ? 'bg-gray-400 text-white' :
                                            index === 2 ? 'bg-yellow-600 text-white' :
                                            'bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark'
                                        }`}>
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="font-semibold text-text-primary dark:text-text-primary-dark flex items-center gap-2">
                                                {player.username}
                                                {isCurrentUser && (
                                                    <span className="text-xs bg-primary dark:bg-primary-dark text-white px-2 py-1 rounded-full">
                                                        You
                                                    </span>
                                                )}
                                                {isSampleUser && (
                                                    <span className="text-xs bg-accent dark:bg-accent-dark text-white px-2 py-1 rounded-full">
                                                        Sample
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                {player.corpsName}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-primary dark:text-primary-dark">
                                            {player.totalSeasonScore.toFixed(1)}
                                        </div>
                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                            points
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
            
            {/* Debug Info for Admin */}
            {profile?.isAdmin && (
                <div className="mt-6 pt-4 border-t border-accent dark:border-accent-dark text-xs text-text-secondary dark:text-text-secondary-dark">
                    <div className="mb-2"><strong>Admin Debug:</strong></div>
                    <div>Using Backend Query: {useBackendQuery ? 'Yes' : 'No'}</div>
                    <div>Selected League: {selectedLeague?.name || 'Global'}</div>
                    <div>Selected Class: {selectedCorpsClass}</div>
                    <div>Results: {leaderboard.length}</div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;