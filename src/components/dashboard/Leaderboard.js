// src/components/dashboard/Leaderboard.js - Fixed collection group query
import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, getDoc, doc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER, getAllUserCorps } from '../../utils/profileCompatibility';

const Leaderboard = ({ profile, onViewProfile, initialLeague = null }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedLeague, setSelectedLeague] = useState(initialLeague);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [userLeagues, setUserLeagues] = useState([]);

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
                const activeSeasonId = seasonData.seasonUid;
                setSeasonName(seasonData.name || 'Current Season');

                // FIXED: Use 'data' as the collection name since the actual collection is 
                // artifacts/marching-art/users/{userId}/profile/data
                const profilesRef = collectionGroup(db, 'data');
                let leaderboardQuery;

                if (selectedLeague) {
                    leaderboardQuery = query(
                        profilesRef,
                        where('leagueIds', 'array-contains', selectedLeague.id)
                    );
                } else {
                    // For global leaderboard, get all profile data documents
                    leaderboardQuery = profilesRef;
                }

                console.log('Executing leaderboard query...');
                const querySnapshot = await getDocs(leaderboardQuery);
                console.log('Query returned', querySnapshot.docs.length, 'documents');
                
                let allCorpsEntries = [];
                
                querySnapshot.docs.forEach(doc => {
                    // Only process documents that are profile data (not other 'data' collections)
                    const docPath = doc.ref.path;
                    if (!docPath.includes('/profile/data')) {
                        return; // Skip non-profile documents
                    }
                    
                    const playerData = doc.data();
                    // Extract userId from the document path: artifacts/namespace/users/{userId}/profile/data
                    const pathParts = docPath.split('/');
                    const userId = pathParts[3]; // users/{userId} -> {userId}
                    
                    // Skip if no username (invalid profile)
                    if (!playerData.username) {
                        return;
                    }
                    
                    const userCorps = getAllUserCorps(playerData);
                    
                    Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                        if (corps && corps.corpsName && (corpsClass === selectedCorpsClass) && 
                            corps.totalSeasonScore && corps.totalSeasonScore > 0) {
                            allCorpsEntries.push({
                                id: `${userId}_${corpsClass}`,
                                userId: userId,
                                username: playerData.username || 'Unnamed Manager',
                                corpsName: corps.corpsName,
                                corpsClass: corpsClass,
                                totalSeasonScore: corps.totalSeasonScore
                            });
                        }
                    });
                });
                
                // Sort by score descending
                allCorpsEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
                
                console.log('Processed', allCorpsEntries.length, 'leaderboard entries');
                setLeaderboard(allCorpsEntries);
                
            } catch (error) {
                console.error("Leaderboard query failed:", error);
                console.error("Error code:", error.code);
                console.error("Error message:", error.message);
                
                if (error.code === 'permission-denied') {
                    console.error("Permission denied - check Firestore rules for collection group queries");
                }
                
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchLeaderboardData();
    }, [selectedLeague, selectedCorpsClass]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

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
                        Check back after the season starts and scores are posted!
                    </p>
                </div>
            ) : (
                <ol className="space-y-1">
                    {leaderboard.map((player, index) => {
                        const isCurrentUser = player.userId === profile?.userId;
                        return (
                            <li key={player.id}>
                                <button
                                    onClick={() => onViewProfile && onViewProfile(player.userId)}
                                    disabled={!onViewProfile}
                                    className={`w-full p-3 rounded-theme flex justify-between items-center text-left transition-colors ${
                                        isCurrentUser 
                                            ? 'bg-primary/10 dark:bg-primary-dark/10 border-2 border-primary/30 dark:border-primary-dark/30' 
                                            : 'bg-background dark:bg-background-dark hover:bg-accent/20 dark:hover:bg-accent-dark/20'
                                    } ${onViewProfile ? 'cursor-pointer' : 'cursor-default'}`}
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
                                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                {player.username}
                                                {isCurrentUser && (
                                                    <span className="ml-2 text-xs bg-primary dark:bg-primary-dark text-white px-2 py-1 rounded-full">
                                                        You
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
        </div>
    );
};

export default Leaderboard;