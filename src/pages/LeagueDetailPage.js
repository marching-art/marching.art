import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Leaderboard from '../components/dashboard/Leaderboard';
import MatchupsDisplay from '../components/leagues/MatchupsDisplay'; // Import new component

const LeagueDetailPage = ({ profile, leagueId, setPage, onViewProfile }) => {
    const [league, setLeague] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [season, setSeason] = useState(null); // State for season data

    useEffect(() => {
        const seasonRef = doc(db, 'game-settings', 'season');
        const unsubSeason = onSnapshot(seasonRef, (docSnap) => {
            setSeason(docSnap.data());
        });
        
        if (!leagueId) {
            setIsLoading(false);
            return;
        }
        const leagueRef = doc(db, 'leagues', leagueId);
        const unsubLeague = onSnapshot(leagueRef, (docSnap) => {
            if (docSnap.exists()) {
                setLeague({ id: docSnap.id, ...docSnap.data() });
            } else {
                setLeague(null);
            }
            setIsLoading(false);
        });

        return () => {
            unsubSeason();
            unsubLeague();
        };
    }, [leagueId]);

    if (isLoading) {
        return <div className="p-8 text-center"><p>Loading League...</p></div>;
    }
    if (!league) {
        return <div className="p-8 text-center"><p>League not found.</p></div>;
    }

    // Calculate current week
    let currentWeek = 0;
    if (season?.schedule?.startDate) {
        const startDate = season.schedule.startDate.toDate();
        const diff = new Date().getTime() - startDate.getTime();
        currentWeek = Math.ceil((Math.floor(diff / (1000 * 60 * 60 * 24)) + 1) / 7);
    }

    const champions = league.champions || [];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <button onClick={() => setPage('leagues')} className="text-sm text-primary dark:text-primary-dark hover:underline mb-2">
                    &larr; Back to All Leagues
                </button>
                <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark">{league.name}</h1>
                <div className="mt-2">
                    <span className="text-text-secondary dark:text-text-secondary-dark">Invite Code: </span>
                    <span className="font-mono bg-surface dark:bg-surface-dark p-2 rounded-theme text-text-primary dark:text-text-primary-dark">{league.inviteCode}</span>
                </div>
            </div>

            {currentWeek > 0 && <MatchupsDisplay 
                league={league} 
                currentWeek={currentWeek} 
                onViewProfile={onViewProfile} 
                season={season}
            />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <Leaderboard 
                        profile={profile} 
                        onViewProfile={onViewProfile}
                        initialLeague={league} 
                    />
                </div>
                <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                    <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Hall of Fame</h2>
                    {champions.length > 0 ? (
                        <ul className="space-y-4">
                            {champions.sort((a,b) => b.seasonName.localeCompare(a.seasonName)).map(champ => (
                                <li key={champ.seasonName} className="border-b border-accent dark:border-accent-dark pb-3">
                                    <p className="font-semibold text-text-secondary dark:text-text-secondary-dark text-sm">{champ.seasonName}</p>
                                    <p className="font-bold text-lg text-yellow-500">
                                        &#127942; {champ.winnerUsername}
                                    </p>
                                    <p className="text-sm text-text-primary dark:text-text-primary-dark">{champ.winnerCorpsName}</p>
                                    {/* MODIFIED LINE BELOW */}
                                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{champ.score.toFixed(3)} pts</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-text-secondary dark:text-text-secondary-dark italic">No champions have been crowned yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeagueDetailPage;