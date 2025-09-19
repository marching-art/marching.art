import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, getDoc, doc, collection, getDocs } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER, getAllUserCorps } from '../../utils/profileCompatibility';
import { useUserStore } from '../../store/userStore';

const Leaderboard = ({ onViewProfile, initialLeague = null }) => {
    const { loggedInProfile: profile } = useUserStore();
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedLeague, setSelectedLeague] = useState(initialLeague);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [userLeagues, setUserLeagues] = useState([]);

    useEffect(() => {
        const fetchLeagues = async () => {
            if (profile?.leagueIds?.length > 0) {
                const leaguesQuery = query(collection(db, 'leagues'), where('__name__', 'in', profile.leagueIds));
                const querySnapshot = await getDocs(leaguesQuery);
                const leagues = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setUserLeagues(leagues);
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
                // Get season settings
                const seasonSettingsRef = doc(db, 'game-settings', 'season');
                const seasonDoc = await getDoc(seasonSettingsRef);
                
                if (!seasonDoc.exists) {
                    setLeaderboard([]);
                    setSeasonName('No Active Season');
                    setIsLoading(false);
                    return;
                }
                
                const seasonData = seasonDoc.data();
                const activeSeasonId = seasonData.seasonUid;
                setSeasonName(seasonData.name);

                let allCorpsEntries = [];

                if (selectedLeague) {
                    // League-specific leaderboard - use individual profile reads
                    const userIds = selectedLeague.members || [];
                    
                    if (userIds.length > 0) {
                        const profilePromises = userIds.map(userId => 
                            getDoc(doc(db, `artifacts/${dataNamespace}/users/${userId}/profile/data`))
                                .then(doc => ({ userId, doc, exists: doc.exists() }))
                                .catch(error => ({ userId, doc: null, exists: false, error }))
                        );

                        const profileResults = await Promise.all(profilePromises);
                        
                        profileResults.forEach(({ userId, doc, exists }) => {
                            if (!exists || !doc) return;
                            
                            const playerData = doc.data();
                            if (playerData.activeSeasonId !== activeSeasonId) return;
                            
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
                    }
                } else {
                    // Universal leaderboard - use fantasy_recaps (like ScoresPage does)
                    console.log('Fetching universal leaderboard from fantasy_recaps...');
                    
                    const recapsQuery = query(
                        collection(db, 'fantasy_recaps'),
                        where('seasonName', '==', seasonData.name)
                    );
                    const recapsSnapshot = await getDocs(recapsQuery);
                    
                    if (!recapsSnapshot.empty) {
                        const recapDoc = recapsSnapshot.docs[0];
                        const recapData = recapDoc.data();
                        
                        // Get the most recent day's results
                        const recaps = recapData.recaps || [];
                        if (recaps.length > 0) {
                            const latestRecap = recaps[recaps.length - 1];
                            const allResults = latestRecap.shows?.flatMap(show => show.results || []) || [];
                            
                            // Filter by selected corps class and build leaderboard entries
                            allResults.forEach(result => {
                                if (result.corpsClass === selectedCorpsClass && 
                                    result.totalScore && result.totalScore > 0) {
                                    
                                    // Try to get the username from profile, fallback to 'Player'
                                    const displayName = result.username || 'Player';
                                    
                                    allCorpsEntries.push({
                                        id: `${result.uid}_${result.corpsClass}`,
                                        userId: result.uid,
                                        username: displayName,
                                        corpsName: result.corpsName || 'Unnamed Corps',
                                        corpsClass: result.corpsClass,
                                        totalSeasonScore: result.totalScore
                                    });
                                }
                            });
                        }
                    }
                }
                
                // Remove duplicates (in case a user appears multiple times) and sort
                const uniqueEntries = allCorpsEntries.reduce((acc, entry) => {
                    const existing = acc.find(e => e.userId === entry.userId && e.corpsClass === entry.corpsClass);
                    if (!existing || entry.totalSeasonScore > existing.totalSeasonScore) {
                        acc = acc.filter(e => !(e.userId === entry.userId && e.corpsClass === entry.corpsClass));
                        acc.push(entry);
                    }
                    return acc;
                }, []);
                
                uniqueEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
                setLeaderboard(uniqueEntries);
                
            } catch (error) {
                console.error("Leaderboard query failed:", error);
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

            <div className="flex flex-wrap border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
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

            {isLoading ? (
                <p className="text-center text-text-secondary dark:text-text-secondary-dark mt-4">Loading Leaderboard...</p>
            ) : leaderboard.length === 0 ? (
                <div className="text-center text-text-secondary dark:text-text-secondary-dark mt-4">
                    <p>No corps with scores found for this filter.</p>
                    {selectedLeague && <p className="text-sm mt-2">League members need to create profiles and play games to appear here.</p>}
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
                                    className={`w-full p-2 rounded-theme flex justify-between items-center text-left transition-colors ${isCurrentUser ? 'bg-primary/10' : ''} hover:bg-accent dark:hover:bg-accent-dark/20`}
                                >
                                    <div className="flex items-center">
                                        <span className="font-bold text-text-secondary dark:text-text-secondary-dark w-8">{index + 1}.</span>
                                        <div>
                                            <span className="font-bold text-text-primary dark:text-text-primary-dark">{player.corpsName}</span>
                                            <span className="text-sm text-text-secondary dark:text-text-secondary-dark ml-2">({player.username})</span>
                                        </div>
                                    </div>
                                    <span className="font-bold text-lg text-primary dark:text-primary-dark">
                                        {player.totalSeasonScore ? player.totalSeasonScore.toFixed(3) : '0.000'}
                                    </span>
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