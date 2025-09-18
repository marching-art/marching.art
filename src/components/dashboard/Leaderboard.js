import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CORPS_CLASSES, getAllUserCorps } from '../../utils/profileCompatibility';

const Leaderboard = ({ profile, onViewProfile, initialLeague = null }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedLeague, setSelectedLeague] = useState(initialLeague);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');

    useEffect(() => {
        setIsLoading(true);
        let unsubscribe;
        const fetchLeaderboardData = async () => {
            const seasonSettingsRef = doc(db, 'game-settings', 'season');
            const seasonDoc = await getDoc(seasonSettingsRef);
            if (!seasonDoc.exists()) {
                setIsLoading(false);
                return;
            }
            const seasonData = seasonDoc.data();
            const activeSeasonId = seasonData.seasonUid;
            if (!activeSeasonId) {
                console.error("Season UID is not configured in game-settings/season");
                setIsLoading(false);
                return;
            }
            
            setSeasonName(seasonData.name);

            let baseQuery = query(
                collectionGroup(db, 'profile'),
                where('activeSeasonId', '==', activeSeasonId)
            );

            if (selectedLeague) {
                baseQuery = query(baseQuery, where('leagueIds', 'array-contains', selectedLeague.id));
            }

            unsubscribe = onSnapshot(baseQuery, (querySnapshot) => {
                const allCorpsEntries = [];
                
                querySnapshot.docs.forEach(doc => {
                    const playerData = doc.data();
                    const userId = doc.ref.parent.parent.id;
                    const userCorps = getAllUserCorps(playerData);
                    
                    // Add each corps class as a separate leaderboard entry
                    Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                        if (corps && corps.corpsName && (corpsClass === selectedCorpsClass)) {
                            allCorpsEntries.push({
                                id: `${userId}_${corpsClass}`,
                                userId: userId,
                                username: playerData.username,
                                corpsName: corps.corpsName,
                                corpsClass: corpsClass,
                                totalSeasonScore: corps.totalSeasonScore || 0
                            });
                        }
                    });
                });
                
                // Sort by score descending
                allCorpsEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
                
                setLeaderboard(allCorpsEntries);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching leaderboard:", error);
                setIsLoading(false);
            });
        };
        
        fetchLeaderboardData();
        return () => { if (unsubscribe) unsubscribe(); };
    }, [selectedLeague, selectedCorpsClass]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    const userLeagues = profile?.leagues || [];

    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            {/* Corps Class Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(CORPS_CLASSES).map(([key, classInfo]) => (
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
                ))}
            </div>

            {/* League Selector */}
            <div className="flex flex-wrap border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                <button
                    onClick={() => setSelectedLeague(null)}
                    disabled={!!initialLeague} // Disable Global button
                    // ...
                >
                    Global
                </button>
                {userLeagues.map(league => (
                    <button
                        key={league.id}
                        onClick={() => setSelectedLeague(league)}
                        disabled={!!initialLeague} // Disable other league buttons
                        // ...
                    >
                        {league.name}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <p className="text-center text-text-secondary dark:text-text-secondary-dark mt-4">Loading Leaderboard...</p>
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
