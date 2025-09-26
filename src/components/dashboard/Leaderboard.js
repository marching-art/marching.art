// src/components/dashboard/Leaderboard.js - Direct query approach without collection group
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDoc, doc, getDocs } from 'firebase/firestore';
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
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState('');

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
            setDebugInfo('Starting leaderboard fetch...');
            
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

                // Try cloud function approach first
                console.log('Attempting cloud function approach...');
                setDebugInfo('Trying cloud function...');
                
                try {
                    const result = await getUserRankings({
                        corpsClass: selectedCorpsClass,
                        leagueId: selectedLeague?.id || null
                    });
                    
                    if (result.data.success && result.data.rankings) {
                        console.log('Cloud function returned', result.data.rankings.length, 'rankings');
                        setLeaderboard(result.data.rankings);
                        setDebugInfo(`Cloud function returned ${result.data.rankings.length} entries`);
                        setIsLoading(false);
                        return;
                    }
                } catch (functionError) {
                    console.log('Cloud function failed:', functionError);
                    setDebugInfo('Cloud function failed, trying direct approach...');
                }

                // Fall back to direct profile fetching for known users
                console.log('Using direct profile approach...');
                const allCorpsEntries = [];

                // Start with the current user if available
                if (profile) {
                    console.log('Processing current user profile...');
                    console.log('Full profile data:', profile);
                    
                    const userCorps = getAllUserCorps(profile);
                    console.log('getAllUserCorps result:', userCorps);
                    console.log('Profile structure check:');
                    console.log('- profile.corps:', profile.corps);
                    console.log('- profile.corpsName:', profile.corpsName);
                    console.log('- profile.totalSeasonScore:', profile.totalSeasonScore);
                    
                    Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                        console.log(`Checking corps class ${corpsClass}:`, corps);
                        
                        if (corps && corps.corpsName && (corpsClass === selectedCorpsClass)) {
                            const score = corps.totalSeasonScore || 0;
                            
                            console.log('Found current user corps:', {
                                username: profile.username,
                                corpsName: corps.corpsName,
                                corpsClass,
                                score
                            });
                            
                            allCorpsEntries.push({
                                id: `${profile.userId}_${corpsClass}`,
                                userId: profile.userId,
                                username: profile.username,
                                corpsName: corps.corpsName,
                                corpsClass: corpsClass,
                                totalSeasonScore: score
                            });
                        } else {
                            console.log(`Skipping ${corpsClass} - no corps or wrong class:`, {
                                hasCorps: !!corps,
                                hasCorpsName: corps?.corpsName,
                                isSelectedClass: corpsClass === selectedCorpsClass,
                                selectedClass: selectedCorpsClass
                            });
                        }
                    });
                }

                // Try to fetch league members if in a league
                if (selectedLeague && selectedLeague.members) {
                    console.log('Processing league members...');
                    setDebugInfo(`Processing ${selectedLeague.members.length} league members...`);
                    
                    let processedMembers = 0;
                    
                    for (const memberId of selectedLeague.members) {
                        if (memberId === profile?.userId) continue; // Already processed
                        
                        try {
                            const memberProfileRef = doc(db, 'artifacts', dataNamespace, 'users', memberId, 'profile', 'data');
                            const memberDoc = await getDoc(memberProfileRef);
                            
                            if (memberDoc.exists()) {
                                const memberData = memberDoc.data();
                                const userCorps = getAllUserCorps(memberData);
                                
                                Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                                    if (corps && corps.corpsName && (corpsClass === selectedCorpsClass)) {
                                        const score = corps.totalSeasonScore || 0;
                                        
                                        allCorpsEntries.push({
                                            id: `${memberId}_${corpsClass}`,
                                            userId: memberId,
                                            username: memberData.username || 'Unknown',
                                            corpsName: corps.corpsName,
                                            corpsClass: corpsClass,
                                            totalSeasonScore: score
                                        });
                                    }
                                });
                                processedMembers++;
                            }
                        } catch (memberError) {
                            console.log('Error fetching member', memberId, ':', memberError);
                        }
                    }
                    
                    console.log('Processed', processedMembers, 'league members');
                }

                // Sort by score descending
                allCorpsEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
                
                // If no entries found, create a fallback entry for the current user if they have any corps
                if (allCorpsEntries.length === 0 && profile) {
                    console.log('No scored entries found, checking for any corps data...');
                    const userCorps = getAllUserCorps(profile);
                    
                    // Show any corps the user has, even with 0 score
                    Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                        if (corps && corps.corpsName && (corpsClass === selectedCorpsClass)) {
                            console.log('Adding fallback entry for user corps:', {
                                username: profile.username,
                                corpsName: corps.corpsName,
                                corpsClass,
                                score: corps.totalSeasonScore || 0
                            });
                            
                            allCorpsEntries.push({
                                id: `${profile.userId}_${corpsClass}`,
                                userId: profile.userId,
                                username: profile.username,
                                corpsName: corps.corpsName,
                                corpsClass: corpsClass,
                                totalSeasonScore: corps.totalSeasonScore || 0
                            });
                        }
                    });
                    
                    // If still no entries, check if user has any corps in other classes
                    if (allCorpsEntries.length === 0) {
                        console.log('No corps found for selected class, checking all classes...');
                        Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                            if (corps && corps.corpsName) {
                                console.log(`User has corps in ${corpsClass}:`, corps.corpsName);
                            }
                        });
                    }
                }
                
                console.log('Final leaderboard entries:', allCorpsEntries.length);
                setDebugInfo(`Found ${allCorpsEntries.length} total entries`);
                setLeaderboard(allCorpsEntries);
                
            } catch (error) {
                console.error("Leaderboard fetch failed:", error);
                setError(`Failed to load leaderboard: ${error.message}`);
                setDebugInfo(`Error: ${error.message}`);
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchLeaderboardData();
    }, [selectedLeague, selectedCorpsClass, profile, dataNamespace]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            {/* Debug Info for Admin */}
            {profile?.isAdmin && debugInfo && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-theme">
                    <div className="text-blue-800 dark:text-blue-200 text-sm">
                        <strong>Debug:</strong> {debugInfo}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme">
                    <div className="text-red-800 dark:text-red-200 text-sm">
                        <strong>Error:</strong> {error}
                    </div>
                </div>
            )}

            {/* Notice about limited leaderboard */}
            {!selectedLeague && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-theme">
                    <div className="text-yellow-800 dark:text-yellow-200 text-sm">
                        <strong>Note:</strong> Global leaderboard is currently limited due to database permissions. 
                        Join a league to see full leaderboard data.
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
                    {profile?.isAdmin && debugInfo && (
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-2">{debugInfo}</p>
                    )}
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-4xl mb-4">🏆</div>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        No corps with scores found for {CORPS_CLASSES[selectedCorpsClass]?.name || selectedCorpsClass}.
                    </p>
                    {selectedLeague ? (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                            League members need to have active corps to appear on the leaderboard.
                        </p>
                    ) : (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                            Join a league or create corps to see leaderboard data.
                        </p>
                    )}
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
                                            {(player.totalSeasonScore || 0).toFixed(1)}
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