import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

const ScoresPage = () => {
    const [allRecaps, setAllRecaps] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRecaps = async () => {
            setIsLoading(true);
            try {
                const recapsQuery = query(collection(db, 'fantasy_recaps'));
                const querySnapshot = await getDocs(recapsQuery);
                const fetchedRecaps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (fetchedRecaps.length > 0) {
                    // Sort seasons by the date of their first recap, newest first
                    fetchedRecaps.sort((a, b) => {
                        const dateA = a.recaps?.[0]?.date.toDate() || 0;
                        const dateB = b.recaps?.[0]?.date.toDate() || 0;
                        return dateB - dateA;
                    });
                    setAllRecaps(fetchedRecaps);
                    // Default to the latest season and its latest day
                    const latestSeason = fetchedRecaps[0];
                    setSelectedSeason(latestSeason);
                    if (latestSeason.recaps?.length > 0) {
                        const latestDay = latestSeason.recaps.sort((a,b) => b.offSeasonDay - a.offSeasonDay)[0];
                        setSelectedDay(latestDay);
                    }
                }
            } catch (error) {
                console.error("Error fetching fantasy recaps:", error);
            }
            setIsLoading(false);
        };
        fetchRecaps();
    }, []);

    const handleSeasonChange = (seasonId) => {
        const season = allRecaps.find(r => r.id === seasonId);
        setSelectedSeason(season);
        // Default to the latest day of the newly selected season
        if (season.recaps?.length > 0) {
            const latestDay = season.recaps.sort((a,b) => b.offSeasonDay - a.offSeasonDay)[0];
            setSelectedDay(latestDay);
        } else {
            setSelectedDay(null);
        }
    };

    const handleDayChange = (day) => {
        const dayData = selectedSeason.recaps.find(r => r.offSeasonDay === parseInt(day));
        setSelectedDay(dayData);
    };

    if (isLoading) return <div className="p-8 text-center"><p className="text-lg font-semibold">Loading Recaps...</p></div>;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6 text-center">Fantasy Show Recaps</h1>
            
            <div className="flex flex-col md:flex-row gap-4 items-center justify-center mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="flex items-center gap-2">
                    <label htmlFor="season-select" className="font-semibold">Season:</label>
                    <select id="season-select" value={selectedSeason?.id || ''} onChange={e => handleSeasonChange(e.target.value)} className="bg-gray-100 dark:bg-gray-900 border rounded p-2">
                        {allRecaps.map(season => <option key={season.id} value={season.id}>{season.seasonName}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="day-select" className="font-semibold">Day:</label>
                    <select id="day-select" value={selectedDay?.offSeasonDay || ''} onChange={e => handleDayChange(e.target.value)} className="bg-gray-100 dark:bg-gray-900 border rounded p-2" disabled={!selectedSeason}>
                        {(selectedSeason?.recaps || []).sort((a,b) => a.offSeasonDay - b.offSeasonDay).map(day => <option key={day.offSeasonDay} value={day.offSeasonDay}>Day {day.offSeasonDay}</option>)}
                    </select>
                </div>
            </div>

            {selectedDay ? (
                <div className="space-y-8">
                    {selectedDay.shows.map((show, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{show.eventName}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{show.location}</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="p-2 w-12">Rank</th>
                                            <th className="p-2">Corps</th>
                                            <th className="p-2 text-right">GE</th>
                                            <th className="p-2 text-right">Visual</th>
                                            <th className="p-2 text-right">Music</th>
                                            <th className="p-2 text-right">Total Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {show.results.sort((a, b) => b.totalScore - a.totalScore).map((res, i) => (
                                            <tr key={res.uid} className="border-b border-gray-100 dark:border-gray-700">
                                                <td className="p-2 font-bold">{i + 1}</td>
                                                <td className="p-2 font-semibold">{res.corpsName}</td>
                                                <td className="p-2 text-right">{res.geScore.toFixed(3)}</td>
                                                <td className="p-2 text-right">{res.visualScore.toFixed(3)}</td>
                                                <td className="p-2 text-right">{res.musicScore.toFixed(3)}</td>
                                                <td className="p-2 font-bold text-right">{res.totalScore.toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                 <p className="text-center text-gray-600 dark:text-gray-300 mt-8">No recaps found for the selected season or day.</p>
            )}
        </div>
    );
};

export default ScoresPage;