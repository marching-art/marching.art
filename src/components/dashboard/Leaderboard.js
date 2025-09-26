// src/components/dashboard/Leaderboard.js - Real data using collection group queries
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
    const [error, setError] = useState(null);

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
            setError(null);
            
            try {
                console.log('Loading season settings...');
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
                console.log('Season loaded:', seasonData.name);

                // Use collection group query on 'data' to get all profile data documents
                console.log('Starting collection group query on "data"...');
                const profilesRef = collectionGroup(db, 'data');
                
                let leaderboardQuery;
                if (selectedLeague) {
                    console.log('Filtering by league:', selectedLeague.name);
                    leaderboardQuery = query(
                        profilesRef,
                        where('leagueIds', 'array-contains', selectedLeague.id)
                    );
                } else {
                    console.log('Global leaderboard query');
                    leaderboardQuery = profilesRef;
                }

                console.log('Executing collection group query...');
                const querySnapshot = await getDocs(leaderboardQuery);
                console.log('Collection group query returned', querySnapshot.docs.length, 'documents');
                
                let allCorpsEntries = [];
                let processedProfiles = 0;
                
                querySnapshot.docs.forEach(doc => {
                    const docPath = doc.ref.path;
                    console.log('Processing document path:', docPath);
                    
                    // Only process documents that are profile data
                    // Path should be: artifacts/namespace/users/{userId}/profile/data
                    if (!docPath.includes('/profile/data')) {
                        console.log('Skipping non-profile document:', docPath);
                        return;
                    }
                    
                    const playerData = doc.data();
                    
                    // Skip if no username (invalid profile)
                    if (!playerData.username) {
                        console.log('Skipping profile without username');
                        return;
                    }
                    
                    // Extract userId from the document path
                    const pathParts = docPath.split('/');
                    const userIdIndex = pathParts.findIndex(part => part === 'users') + 1;
                    const userId = pathParts[userIdIndex];
                    
                    console.log('Processing profile:', {
                        userId,
                        username: playerData.username,
                        path: docPath
                    });
                    
                    processedProfiles++;
                    
                    const userCorps = getAllUserCorps(playerData);
                    console.log('User corps for', playerData.username, ':', Object.keys(userCorps));
                    
                    Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                        if (corps && corps.corpsName && (corpsClass === selectedCorpsClass)) {
                            const score = corps.totalSeasonScore || 0;
                            
                            console.log('Found corps:', {
                                username: playerData.username,
                                corpsName: corps.corpsName,
                                corpsClass,
                                score
                            });
                            
                            allCorpsEntries.push({
                                id: `${userId}_${corpsClass}`,
                                userId: userId,
                                username: playerData.username,
                                corpsName: corps.corpsName,
                                corpsClass: corpsClass,
                                totalSeasonScore: score
                            });
                        }
                    });
                });
                
                console.log('Processed', processedProfiles, 'profiles');
                console.log('Found', allCorpsEntries.length, 'corps entries for class', selectedCorpsClass);
                
                // Sort by score descending
                allCorpsEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
                
                // Filter out entries with zero scores for cleaner leaderboard
                const nonZeroEntries = allCorpsEntries.filter(entry => entry.totalSeasonScore > 0);
                console.log('Entries with scores > 0:', nonZeroEntries.length);
                
                setLeaderboard(nonZeroEntries);
                
            } catch (error) {
                console.error("Leaderboard query failed:", error);
                console.error("Error code:", error.code);
                console.error("Error message:", error.message);
                
                setError(`Failed to load leaderboard: ${error.message}`);
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchLeaderboardData();
    }, [selectedLeague, selectedCorpsClass]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme">
                    <div className="text-red-800 dark:text-red-200 text-sm">
                        <strong>Error:</strong> {error}
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
                        No corps with scores found for {CORPS_CLASSES[selectedCorpsClass]?.name || selectedCorpsClass}.
                    </p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                        Corps need to have scores recorded to appear on the leaderboard.
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