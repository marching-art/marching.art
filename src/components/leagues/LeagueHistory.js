import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility'; // Import CORPS_CLASS_ORDER

// Re-using a similar card structure from MatchupsDisplay for consistency
const HistoryMatchupCard = ({ matchup, members, onViewProfile }) => {
    const [p1_uid, p2_uid] = matchup.pair;
    const p1 = members.find(m => m.id === p1_uid);
    const p2 = p2_uid === 'BYE' ? { username: 'BYE WEEK', corpsName: '—', id: 'BYE' } : members.find(m => m.id === p2_uid);

    if (!p1 || !p2) return null;

    const p1_isWinner = matchup.winner === p1_uid;
    const p2_isWinner = matchup.winner === p2_uid;

    const PlayerDisplay = ({ player, isWinner, score }) => (
        <div className={`flex justify-between items-center p-3 rounded-theme ${isWinner ? 'bg-primary/20' : ''}`}>
            <div>
                <button
                    onClick={() => player.id !== 'BYE' && onViewProfile(player.id)}
                    disabled={player.id === 'BYE'}
                    className={`font-bold text-text-primary dark:text-text-primary-dark ${player.id !== 'BYE' && 'hover:underline'}`}
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
            <PlayerDisplay player={p2} isWinner={p2_isWinner} score={matchup.scores[p2_uid] || 0} />
        </div>
    );
};

const LeagueHistory = ({ league, leagueMembers, currentWeek, onViewProfile }) => {
    const [historyData, setHistoryData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [selectedClass, setSelectedClass] = useState('worldClass');

    useEffect(() => {
        const fetchHistory = async () => {
            if (!league?.id || currentWeek <= 1) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);

            const weekPromises = [];
            for (let i = 1; i < currentWeek; i++) {
                weekPromises.push(getDoc(doc(db, `leagues/${league.id}/matchups/week${i}`)));
            }

            try {
                const weekDocs = await Promise.all(weekPromises);
                const fetchedHistory = {};
                weekDocs.forEach((docSnap, index) => {
                    if (docSnap.exists()) {
                        fetchedHistory[index + 1] = docSnap.data();
                    }
                });
                setHistoryData(fetchedHistory);
                // Set the default selected week to the most recent completed week
                if (Object.keys(fetchedHistory).length > 0) {
                    setSelectedWeek(Math.max(...Object.keys(fetchedHistory)));
                }
            } catch (error) {
                console.error("Error fetching league history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [league?.id, currentWeek]);

    const matchups = selectedWeek ? historyData[selectedWeek]?.[`${selectedClass}Matchups`] || [] : [];
    const availableWeeks = Object.keys(historyData).sort((a, b) => b - a);

    if (isLoading) {
        return <div className="text-center p-8">Loading history...</div>;
    }

    if (availableWeeks.length === 0) {
        return (
            <div className="text-center py-12 text-text-secondary dark:text-text-secondary-dark">
                No historical data is available yet. Check back after Week 1 is complete.
            </div>
        );
    }

    return (
        <div>
            {/* Week Selector */}
            <div className="mb-4">
                <label htmlFor="week-selector" className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                    Select Week
                </label>
                <select
                    id="week-selector"
                    value={selectedWeek || ''}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    className="w-full md:w-1/3 p-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    {availableWeeks.map(week => (
                        <option key={week} value={week}>Week {week} Results</option>
                    ))}
                </select>
            </div>
            
            {/* Class Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
                 {CORPS_CLASS_ORDER.map((key) => {
                    const classInfo = CORPS_CLASSES[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setSelectedClass(key)}
                            className={`px-3 py-1 rounded-theme font-semibold transition-all text-sm ${
                                selectedClass === key ? 'bg-primary text-on-primary' : 'bg-surface dark:bg-background-dark'
                            }`}
                        >
                            {classInfo.name}
                        </button>
                    );
                })}
            </div>
            
            {/* Matchups Grid */}
            {matchups.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchups.map((match, index) => (
                        <HistoryMatchupCard key={index} matchup={match} members={leagueMembers} onViewProfile={onViewProfile} />
                    ))}
                </div>
            ) : (
                <p className="text-text-secondary dark:text-text-secondary-dark italic mt-4">
                    No matchup data found for this class in Week {selectedWeek}.
                </p>
            )}
        </div>
    );
};

export default LeagueHistory;