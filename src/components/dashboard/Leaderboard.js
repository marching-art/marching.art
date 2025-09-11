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
            const seasonSettingsRef = doc(db, 'game-settings', 'season');
            const seasonDoc = await getDoc(seasonSettingsRef);
            if (!seasonDoc.exists()) {
                setIsLoading(false);
                return;
            }
            const seasonData = seasonDoc.data();
            const activeSeasonId = seasonData.seasonUid; //
            if (!activeSeasonId) {
                console.error("Season UID is not configured in game-settings/season");
                setIsLoading(false);
                return;
            }
            setSeasonName(seasonData.name); //

            const profilesQuery = query(
                collectionGroup(db, 'profile'), 
                where('activeSeasonId', '==', activeSeasonId), //
                orderBy('totalSeasonScore', 'desc') //
            );
            
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
                setIsLoading(false);
            });
        };
        
        fetchLeaderboardData();

        return () => { if (unsubscribe) unsubscribe(); };
    }, []);
    
    const CardContainer = ({ children }) => (
        <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
            {children}
        </div>
    );


    if (isLoading) {
        return (
            <CardContainer>
                <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">Loading Leaderboard...</h2>
            </CardContainer>
        );
    }
    
    return (
        <CardContainer>
            <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-brand-text-secondary dark:text-brand-text-secondary-dark mb-4">Global Leaderboard</h3>
            <ol className="list-decimal list-inside space-y-3">
                {leaderboard.map((player, index) => (
                    <li key={player.id} className="p-2 rounded-md bg-brand-background dark:bg-brand-background-dark flex justify-between items-center">
                        <div>
                            <span className="font-bold text-brand-text-primary dark:text-brand-text-primary-dark">{index + 1}. {player.corpsName}</span>
                            <span className="text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark ml-2">({player.username})</span>
                        </div>
                        <span className="font-bold text-lg text-brand-primary dark:text-brand-secondary-dark">
                            {player.totalSeasonScore ? player.totalSeasonScore.toFixed(3) : '0.000'}
                        </span>
                    </li>
                ))}
            </ol>
        </CardContainer>
    );
};

export default Leaderboard;