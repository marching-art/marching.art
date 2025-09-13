import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import Modal from '../ui/Modal'; // Import the Modal component
import CaptionChart from '../charts/CaptionChart'; // Import the Chart component

const ScoresPage = ({ theme }) => { // Accept theme as a prop
    const [allRecaps, setAllRecaps] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showToChart, setShowToChart] = useState(null); // Define state for the chart modal

    useEffect(() => {
        const fetchRecaps = async () => {
            setIsLoading(true);
            try {
                const recapsQuery = query(collection(db, 'fantasy_recaps'));
                const querySnapshot = await getDocs(recapsQuery);
                const fetchedRecaps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (fetchedRecaps.length > 0) {
                    // Sort seasons by name (which includes the date) descending
                    fetchedRecaps.sort((a, b) => b.seasonName.localeCompare(a.seasonName));
                    setAllRecaps(fetchedRecaps);
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
        <>
            <Modal isOpen={!!showToChart} onClose={() => setShowToChart(null)} title={`${showToChart?.eventName} - Caption Breakdown`}>
                <div className="w-full h-96">
                    <CaptionChart showData={showToChart?.results} theme={theme} />
                </div>
            </Modal>

            <div className="p-4 md:p-8 max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold text-brand-primary dark:text-brand-primary-dark mb-6 text-center">Fantasy Show Recaps</h1>
                
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center mb-8 p-4 bg-brand-surface dark:bg-brand-surface-dark rounded-lg shadow-md">
                    <div className="flex items-center gap-2">
                        <label htmlFor="season-select" className="font-semibold text-brand-text-primary dark:text-brand-text-primary-dark">Season:</label>
                        <select id="season-select" value={selectedSeason?.id || ''} onChange={e => handleSeasonChange(e.target.value)} className="bg-white dark:bg-brand-background-dark border border-brand-accent rounded p-2 text-brand-text-primary dark:text-brand-text-primary-dark">
                            {allRecaps.map(season => <option key={season.id} value={season.id}>{season.seasonName}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="day-select" className="font-semibold text-brand-text-primary dark:text-brand-text-primary-dark">Day:</label>
                        <select id="day-select" value={selectedDay?.offSeasonDay || ''} onChange={e => handleDayChange(e.target.value)} className="bg-white dark:bg-brand-background-dark border border-brand-accent rounded p-2 text-brand-text-primary dark:text-brand-text-primary-dark" disabled={!selectedSeason}>
                            {(selectedSeason?.recaps || []).sort((a,b) => a.offSeasonDay - b.offSeasonDay).map(day => <option key={day.offSeasonDay} value={day.offSeasonDay}>Day {day.offSeasonDay}</option>)}
                        </select>
                    </div>
                </div>

                {selectedDay ? (
                    <div className="space-y-8">
                        {selectedDay.shows.map((show, index) => (
                            <div key={index} className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark">{show.eventName.replace(/DCI/g, 'marching.art')}</h2>
                                        <p className="text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark">{show.location}</p>
                                    </div>
                                    <button onClick={() => setShowToChart(show)} className="bg-brand-primary hover:bg-blue-800 text-white font-bold py-2 px-4 rounded text-sm">
                                        View Chart
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-brand-text-primary dark:text-brand-text-primary-dark">
                                        <thead className="border-b-2 border-brand-accent dark:border-brand-accent-dark">
                                            <tr>
                                                <th className="p-2 w-12 font-semibold">Rank</th>
                                                <th className="p-2 font-semibold">Corps</th>
                                                <th className="p-2 text-right font-semibold">GE</th>
                                                <th className="p-2 text-right font-semibold">Visual</th>
                                                <th className="p-2 text-right font-semibold">Music</th>
                                                <th className="p-2 text-right font-semibold">Total Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {show.results.sort((a, b) => b.totalScore - a.totalScore).map((res, i) => (
                                                <tr key={res.uid} className="border-b border-brand-surface dark:border-gray-700">
                                                    <td className="p-2 font-bold">{i + 1}</td>
                                                    <td className="p-2 font-semibold">{res.corpsName}</td>
                                                    <td className="p-2 text-right">{res.geScore.toFixed(3)}</td>
                                                    <td className="p-2 text-right">{res.visualScore.toFixed(3)}</td>
                                                    <td className="p-2 text-right">{res.musicScore.toFixed(3)}</td>
                                                    <td className="p-2 font-bold text-right text-brand-primary dark:text-brand-secondary-dark">{res.totalScore.toFixed(3)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-brand-text-secondary dark:text-brand-text-secondary-dark mt-8">No recaps found for the selected season or day.</p>
                )}
            </div>
        </>
    );
};

export default ScoresPage;

