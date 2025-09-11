import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const ScoresPage = () => {
    const [latestShows, setLatestShows] = useState([]);
    const [seasonName, setSeasonName] = useState('');
    const [recapDay, setRecapDay] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchLatestScores = async () => {
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);

            if (seasonSnap.exists()) {
                const seasonData = seasonSnap.data();
                setSeasonName(seasonData.name);
                const seasonStartDate = seasonData.schedule.startDate.toDate();
                const diff = new Date().getTime() - seasonStartDate.getTime();
                // Get *yesterday's* day number
                const lastScoredDay = Math.floor(diff / (1000 * 60 * 60 * 24)); 
                setRecapDay(lastScoredDay);

                if (lastScoredDay > 0 && seasonData.events) {
                    const eventData = seasonData.events.find(e => e.offSeasonDay === lastScoredDay);
                    if (eventData && eventData.shows) {
                         // Sort scores within each show from high to low
                        const showsWithSortedScores = eventData.shows.map(show => ({
                            ...show,
                            scores: [...show.scores].sort((a, b) => b.score - a.score)
                        }));
                        setLatestShows(showsWithSortedScores);
                    }
                }
            }
            setIsLoading(false);
        };
        fetchLatestScores();
    }, []);

    if (isLoading) return <div className="p-8 text-center"><p className="text-lg font-semibold">Loading Latest Scores...</p></div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-1 text-center">Latest Show Recaps</h1>
            {recapDay > 0 && <p className="text-center text-gray-500 dark:text-gray-400 mb-6">Showing results for Day {recapDay} of the {seasonName}</p>}

            {latestShows.length > 0 ? (
                <div className="space-y-8">
                    {latestShows.map((show, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{show.eventName}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{show.location}</p>
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-2 w-12">Rank</th>
                                        <th className="p-2">Corps</th>
                                        <th className="p-2 text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {show.scores.map((s, i) => (
                                        <tr key={s.corps} className="border-b border-gray-100 dark:border-gray-700">
                                            <td className="p-2 font-bold">{i + 1}</td>
                                            <td className="p-2">{s.corps}</td>
                                            <td className="p-2 font-bold text-right">{s.score.toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-gray-600 dark:text-gray-300 mt-8">No scores have been reported for the most recent day of competition.</p>
            )}
        </div>
    );
};

export default ScoresPage;