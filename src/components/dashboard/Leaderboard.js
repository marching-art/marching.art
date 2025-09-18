import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, onSnapshot, getDoc, doc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER, getAllUserCorps } from '../../utils/profileCompatibility';

const Leaderboard = ({ profile, onViewProfile, initialLeague = null }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedLeague, setSelectedLeague] = useState(initialLeague);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    // NEW: State to hold the user's league details.
    const [userLeagues, setUserLeagues] = useState([]);

    // NEW: useEffect to fetch league details when the user's profile is available.
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
        setIsLoading(true);
        let unsubscribe;
        
        const fetchLeaderboardData = async () => {
            try {
                const seasonSettingsRef = doc(db, 'game-settings', 'season');
                const seasonDoc = await getDoc(seasonSettingsRef);
                
                if (!seasonDoc.exists()) {
                    console.error("No active season found");
                    setLeaderboard([]);
                    setSeasonName('No Active Season');
                    setIsLoading(false);
                    return;
                }
                
                const seasonData = seasonDoc.data();
                const activeSeasonId = seasonData.seasonUid;
                
                if (!activeSeasonId) {
                    console.error("Season UID is not configured in game-settings/season");
                    setLeaderboard([]);
                    setSeasonName('Configuration Error');
                    setIsLoading(false);
                    return;
                }
                
                setSeasonName(seasonData.name);

                let baseQuery = query(
                    collectionGroup(db, 'profile'),
                    where('activeSeasonId', '==', activeSeasonId)
                );

                // Note: Firestore does not support collectionGroup queries with array-contains filters.
                // The league filtering will be done on the client side.

                unsubscribe = onSnapshot(baseQuery, (querySnapshot) => {
                    let allCorpsEntries = [];
                    
                    querySnapshot.docs.forEach(doc => {
                        const playerData = doc.data();
                        const userId = doc.ref.parent.parent.id;
                        
                        if (!playerData.username) return;
                        
                        // Client-side filter for selected league
                        if (selectedLeague && (!playerData.leagueIds || !playerData.leagueIds.includes(selectedLeague.id))) {
                            return;
                        }

                        const userCorps = getAllUserCorps(playerData);
                        
                        Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                            // MODIFIED: This condition now correctly includes scores of 0.
                            if (corps && corps.corpsName && (corpsClass === selectedCorpsClass) && 
                                typeof corps.totalSeasonScore === 'number') {
                                allCorpsEntries.push({
                                    id: `${userId}_${corpsClass}`,
                                    userId: userId,
                                    username: playerData.username,
                                    corpsName: corps.corpsName,
                                    corpsClass: corpsClass,
                                    totalSeasonScore: corps.totalSeasonScore
                                });
                            }
                        });
                    });
                    
                    allCorpsEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
                    
                    setLeaderboard(allCorpsEntries);
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error fetching leaderboard:", error);
                    setLeaderboard([]);
                    setIsLoading(false);
                });
                
            } catch (error) {
                console.error("Error setting up leaderboard:", error);
                setLeaderboard([]);
                setSeasonName('Error Loading Season');
                setIsLoading(false);
            }
        };
        
        fetchLeaderboardData();
        return () => { if (unsubscribe) unsubscribe(); };
    }, [selectedLeague, selectedCorpsClass]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            {/* Corps Class Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
                {/* MODIFIED: Iterate over the ordered array for correct hierarchy */}
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

            {/* League Selector */}
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
                {/* MODIFIED: Use the new userLeagues state to render tabs */}
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
                <p className="text-center text-text-secondary dark:text-text-secondary-dark mt-4">No corps with scores found for this filter.</p>
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