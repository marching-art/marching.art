import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';

const MatchupCard = ({ matchup, members, onViewProfile }) => {
    const [p1_uid, p2_uid] = matchup.pair;
    const p1 = members.find(m => m.id === p1_uid);
    const p2 = p2_uid === 'BYE' ? { username: 'BYE WEEK', corpsName: '—' } : members.find(m => m.id === p2_uid);

    if (!p1 || !p2) return null; // Member data not loaded yet or user deleted

    const p1_isWinner = matchup.winner === p1_uid;
    const p2_isWinner = matchup.winner === p2_uid;

    const PlayerDisplay = ({ player, isWinner, score, isBye = false }) => (
        <div className={`flex justify-between items-center p-3 rounded-theme ${isWinner ? 'bg-primary/20' : ''}`}>
            <div>
                <button 
                    onClick={() => !isBye && onViewProfile(player.id)} 
                    disabled={isBye}
                    className={`font-bold text-text-primary dark:text-text-primary-dark ${!isBye && 'hover:underline'}`}
                >
                    {player.corpsName || 'Unnamed Corps'}
                </button>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{player.username}</p>
            </div>
            <span className="text-lg font-bold text-primary dark:text-primary-dark">{score > 0 ? score.toFixed(3) : '—'}</span>
        </div>
    );

    return (
        <div className="bg-background dark:bg-background-dark p-2 rounded-theme border border-accent dark:border-accent-dark">
            <PlayerDisplay player={p1} isWinner={p1_isWinner} score={matchup.scores[p1_uid] || 0} />
            <div className="text-center my-1 font-bold text-text-secondary dark:text-text-secondary-dark">VS</div>
            <PlayerDisplay player={p2} isWinner={p2_isWinner} score={matchup.scores[p2_uid] || 0} isBye={p2_uid === 'BYE'} />
        </div>
    );
};


const MatchupsDisplay = ({ league, currentWeek, onViewProfile, season }) => {
    const [matchupData, setMatchupData] = useState(null);
    const [leagueMembers, setLeagueMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('worldClass');

    useEffect(() => {
        const fetchMatchupsAndMembers = async () => {
            if (!league?.id || currentWeek <= 0) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            
            try {
                // Fetch member profiles
                if (league.members && league.members.length > 0) {
                    const memberProfilesQuery = query(collection(db, `artifacts/${dataNamespace}/users`), where('__name__', 'in', league.members));
                    const profilesSnapshot = await getDocs(memberProfilesQuery);
                    const membersData = profilesSnapshot.docs.map(doc => {
                        const profile = doc.data().profile?.data;
                        return {
                            id: doc.id,
                            username: profile?.username || 'Unknown User',
                            corpsName: profile?.corps?.worldClass?.corpsName || profile?.corpsName || 'Unnamed Corps',
                        };
                    });
                    setLeagueMembers(membersData);
                }

                // Fetch matchups for the current week
                const matchupRef = doc(db, `leagues/${league.id}/matchups/week${currentWeek}`);
                const matchupSnap = await getDoc(matchupRef);
                setMatchupData(matchupSnap.exists() ? matchupSnap.data() : null);
            } catch (error) {
                console.error('Error fetching matchups and members:', error);
                setMatchupData(null);
            }

            setIsLoading(false);
        };

        fetchMatchupsAndMembers();
    }, [league?.id, currentWeek]);

    const matchups = matchupData?.[`${selectedClass}Matchups`] || [];

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                <h2 className="text-2xl font-bold text-primary dark:text-primary-dark">Week {currentWeek} Matchups</h2>
                {/* Class Selector Tabs */}
                <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                    {Object.entries(CORPS_CLASSES).map(([key, classInfo]) => (
                        <button
                            key={key}
                            onClick={() => setSelectedClass(key)}
                            className={`px-3 py-1 rounded-theme font-semibold transition-all text-sm ${
                                selectedClass === key ? 'bg-primary text-on-primary' : 'bg-surface dark:bg-background-dark'
                            }`}
                        >
                            {classInfo.name}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && <p>Loading matchups...</p>}
            {!isLoading && matchups.length === 0 && (
                <p className="text-text-secondary dark:text-text-secondary-dark italic">
                    No matchups found for {CORPS_CLASSES[selectedClass].name} this week.
                </p>
            )}
            {!isLoading && matchups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchups.map((match, index) => (
                        <MatchupCard key={index} matchup={match} members={leagueMembers} onViewProfile={onViewProfile} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default MatchupsDisplay;
