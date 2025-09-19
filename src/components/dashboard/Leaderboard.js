import React, { useState, useEffect } from 'react';
import { getDoc, doc, collection, getDocs, query, where } from 'firebase/firestore';
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

            // Get all user IDs to check
            let userIds = [];
            
            if (selectedLeague) {
                userIds = selectedLeague.members || [];
                console.log('League members:', userIds);
            } else {
                // Get users from all leagues
                const allLeaguesQuery = query(collection(db, 'leagues'));
                const allLeaguesSnapshot = await getDocs(allLeaguesQuery);
                
                const allUserIds = new Set();
                allLeaguesSnapshot.docs.forEach(leagueDoc => {
                    const leagueData = leagueDoc.data();
                    if (leagueData.members) {
                        leagueData.members.forEach(uid => allUserIds.add(uid));
                    }
                });
                
                userIds = Array.from(allUserIds);
                console.log('All league users:', userIds);
            }

            if (userIds.length === 0) {
                console.log('No user IDs found');
                setLeaderboard([]);
                setIsLoading(false);
                return;
            }

            // Test individual profile access
            console.log('Testing access to individual profiles...');
            for (let i = 0; i < Math.min(userIds.length, 3); i++) {
                const userId = userIds[i];
                const profilePath = `artifacts/${dataNamespace}/users/${userId}/profile/data`;
                console.log(`Testing access to: ${profilePath}`);
                
                try {
                    const testDoc = await getDoc(doc(db, profilePath));
                    if (testDoc.exists()) {
                        console.log(`✓ Can access ${userId}:`, testDoc.data().username);
                    } else {
                        console.log(`✗ Document doesn't exist for ${userId}`);
                    }
                } catch (error) {
                    console.error(`✗ Permission denied for ${userId}:`, error);
                }
            }

            // Fetch all user profiles individually
            const profilePromises = userIds.map(userId => 
                getDoc(doc(db, `artifacts/${dataNamespace}/users/${userId}/profile/data`))
                    .then(doc => ({ userId, doc }))
                    .catch(error => {
                        console.warn(`Failed to fetch profile for ${userId}:`, error);
                        return { userId, doc: null, error };
                    })
            );

            const profileResults = await Promise.all(profilePromises);
            console.log('Profile fetch results:', profileResults);
            
            let allCorpsEntries = [];
            
            profileResults.forEach(({ userId, doc, error }) => {
                if (error) {
                    console.log(`Error for ${userId}:`, error.message);
                    return;
                }
                
                if (!doc || !doc.exists()) {
                    console.log(`No document for ${userId}`);
                    return;
                }
                
                const playerData = doc.data();
                console.log(`Processing ${userId}:`, playerData.username, 'activeSeasonId:', playerData.activeSeasonId);
                
                // Only include users with matching activeSeasonId
                if (playerData.activeSeasonId !== activeSeasonId) {
                    console.log(`Skipping ${userId} - wrong season`);
                    return;
                }
                
                const userCorps = getAllUserCorps(playerData);
                console.log(`Corps for ${userId}:`, userCorps);
                
                Object.entries(userCorps).forEach(([corpsClass, corps]) => {
                    if (corps && corps.corpsName && (corpsClass === selectedCorpsClass) && 
                        corps.totalSeasonScore && corps.totalSeasonScore > 0) {
                        console.log(`Adding ${userId} to leaderboard:`, corps.corpsName, corps.totalSeasonScore);
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
            
            console.log('Final leaderboard entries:', allCorpsEntries);
            allCorpsEntries.sort((a, b) => (b.totalSeasonScore || 0) - (a.totalSeasonScore || 0));
            
            setLeaderboard(allCorpsEntries);
            
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