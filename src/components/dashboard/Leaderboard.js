import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

// CHANGED: Accept the user's profile as a prop
const Leaderboard = ({ profile }) => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonName, setSeasonName] = useState('');
    // NEW: Add state to manage which leaderboard is being viewed.
    // 'null' represents the Global Leaderboard.
    const [selectedLeague, setSelectedLeague] = useState(null);

    useEffect(() => {
        setIsLoading(true); // NEW: Set loading to true whenever the league changes
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

            // This query logic is now fully functional because 'selectedLeague' is a state variable.
            let baseQuery = query(
                collectionGroup(db, 'profile'),
                where('activeSeasonId', '==', activeSeasonId)
            );

            if (selectedLeague) {
                baseQuery = query(baseQuery, where('leagueIds', 'array-contains', selectedLeague.id));
            }

            const finalQuery = query(baseQuery, orderBy('totalSeasonScore', 'desc'));

            unsubscribe = onSnapshot(finalQuery, (querySnapshot) => {
                const players = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLeaderboard(players);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching leaderboard:", error);
                setIsLoading(false);
            });
        };
        
        fetchLeaderboardData();
        return () => { if (unsubscribe) unsubscribe(); };
    }, [selectedLeague]); // Re-run the query whenever the selected league changes

    // CHANGED: The title is now dynamic based on the selected league
    const leaderboardTitle = selectedLeague ? selectedLeague.name : 'Global Leaderboard';

    const CardContainer = ({ children }) => (
        <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
            {children}
        </div>
    );

    // This component now assumes profile.leagues is an array of objects like [{id: '...', name: '...'}]
    // You would populate this from your 'leagues' collection when the user's profile loads.
    const userLeagues = profile?.leagues || [];

    return (
        <CardContainer>
            <h2 className="text-2xl font-bold text-brand-primary dark:bg-brand-surface-dark mb-1">{seasonName}</h2>
            <h3 className="text-lg font-semibold text-brand-text-secondary dark:text-brand-text-secondary-dark mb-4">{leaderboardTitle}</h3>

            {/* NEW: UI for switching between leaderboards */}
            <div className="flex flex-wrap border-b-2 border-brand-accent dark:border-brand-accent-dark mb-4">
                <button
                    onClick={() => setSelectedLeague(null)}
                    className={`py-2 px-4 font-semibold transition-colors ${!selectedLeague ? 'border-b-2 border-brand-secondary text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-text-primary'}`}
                >
                    Global
                </button>
                {userLeagues.map(league => (
                    <button
                        key={league.id}
                        onClick={() => setSelectedLeague(league)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${selectedLeague?.id === league.id ? 'border-b-2 border-brand-secondary text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-text-primary'}`}
                    >
                        {league.name}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <p className="text-center text-brand-text-secondary dark:text-brand-text-secondary-dark mt-4">Loading Leaderboard...</p>
            ) : (
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
            )}
        </CardContainer>
    );
};

export default Leaderboard;