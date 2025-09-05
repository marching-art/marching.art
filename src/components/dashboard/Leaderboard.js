import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import { db, appId } from '../../firebase';
import { doc } from 'firebase/firestore';

const Leaderboard = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');

    useEffect(() => {
        let unsubscribe;
        const fetchLeaderboardData = async () => {
            // First, get the current active season ID from game-settings
            const seasonSettingsRef = doc(db, 'game-settings', 'season');
            const seasonDoc = await getDoc(seasonSettingsRef);
            if (!seasonDoc.exists()) {
                setIsLoading(false);
                return;
            }
            const activeSeasonId = seasonDoc.id;
            setSeasonName(seasonDoc.data().name);

            // Now, create the query to get all players for the active season, ordered by score
            const profilesQuery = query(
                collectionGroup(db, 'profile'), 
                where('activeSeasonId', '==', activeSeasonId),
                orderBy('totalSeasonScore', 'desc')
            );
            
            // Set up a realtime listener for the leaderboard
            unsubscribe = onSnapshot(profilesQuery, (querySnapshot) => {
                const players = [];
                querySnapshot.forEach((doc) => {
                    players.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                setLeaderboard(players);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching leaderboard:", error);
                // The error message will contain a link to create the required index.
                setIsLoading(false);
            });
        };
        
        fetchLeaderboardData();

        // Cleanup the listener when the component unmounts
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Loading Leaderboard...</h2>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-4">Global Leaderboard</h3>
            <ol className="list-decimal list-inside space-y-3">
                {leaderboard.map((player, index) => (
                    <li key={player.id} className="p-2 rounded-md bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                        <div>
                            <span className="font-bold text-black dark:text-white">{index + 1}. {player.corpsName}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({player.username})</span>
                        </div>
                        <span className="font-bold text-lg text-yellow-800 dark:text-yellow-300">
                            {player.totalSeasonScore ? player.totalSeasonScore.toFixed(3) : '0.000'}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default Leaderboard;