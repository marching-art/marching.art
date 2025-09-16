import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

const Leaderboard = ({ profile }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    const [selectedLeague, setSelectedLeague] = useState(null);

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

            const finalQuery = query(baseQuery, orderBy('totalSeasonScore', 'desc'));

            unsubscribe = onSnapshot(finalQuery, (querySnapshot) => {
                const players = querySnapshot.docs.map(doc => ({ id: doc.ref.parent.parent.id, ...doc.data() }));
                setLeaderboard(players);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching leaderboard:", error);
                setIsLoading(false);
            });
        };
        
        fetchLeaderboardData();
        return () => { if (unsubscribe) unsubscribe(); };
    }, [selectedLeague]);

    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';
    
    const userLeagues = profile?.leagues || [];

    return (
        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-text-secondary dark:text-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            <div className="flex flex-wrap border-b-theme border-accent dark:border-accent-dark mb-4">
                <button
                    onClick={() => setSelectedLeague(null)}
                    className={`py-2 px-4 font-semibold transition-colors ${!selectedLeague ? 'border-b-2 border-primary text-primary dark:border-primary-dark dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}
                >
                    Global
                </button>
                {userLeagues.map(league => (
                    <button
                        key={league.id}
                        onClick={() => setSelectedLeague(league)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${selectedLeague?.id === league.id ? 'border-b-2 border-primary text-primary dark:border-primary-dark dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}
                    >
                        {league.name}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <p className="text-center text-text-secondary dark:text-text-secondary-dark mt-4">Loading Leaderboard...</p>
            ) : (
                <ol className="list-decimal list-inside space-y-2">
                    {leaderboard.map((player, index) => {
                        const isCurrentUser = player.id === profile.userId;

                        return (
                            <li 
                                key={player.id} 
                                className={`p-2 rounded-theme bg-background dark:bg-background-dark flex justify-between items-center ${isCurrentUser ? 'border-theme border-primary dark:border-primary-dark' : 'border-theme border-transparent'}`}
                            >
                                <div>
                                    <span className="font-bold text-text-primary dark:text-text-primary-dark">{index + 1}. {player.corpsName}</span>
                                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark ml-2">({player.username})</span>
                                </div>
                                <span className="font-bold text-lg text-primary dark:text-primary-dark">
                                    {player.totalSeasonScore ? player.totalSeasonScore.toFixed(3) : '0.000'}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default Leaderboard;