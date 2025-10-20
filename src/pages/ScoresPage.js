import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import Modal from '../components/ui/Modal';
import CaptionChart from '../components/charts/CaptionChart';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';

// ADD THIS DEBUG CHECK
console.log('CORPS_CLASS_ORDER in ScoresPage:', CORPS_CLASS_ORDER);
console.log('Is array?', Array.isArray(CORPS_CLASS_ORDER));

const ScoresPage = ({ theme }) => {
    const [allRecaps, setAllRecaps] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [isLoading, setIsLoading] = useState(true);
    const [showToChart, setShowToChart] = useState(null);

    useEffect(() => {
        const fetchRecaps = async () => {
            setIsLoading(true);
            try {
                const recapsQuery = query(collection(db, 'fantasy_recaps'));
                const querySnapshot = await getDocs(recapsQuery);
                const fetchedRecaps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // ADD THESE DEBUG LOGS HERE ↓
                console.log('📊 Fetched recaps:', fetchedRecaps);
                
                if (fetchedRecaps.length > 0) {
                    fetchedRecaps.sort((a, b) => b.seasonName.localeCompare(a.seasonName));
                    setAllRecaps(fetchedRecaps);
                    const latestSeason = fetchedRecaps[0];
                    
                    // ADD THIS DEBUG LOG HERE ↓
                    console.log('📅 Latest season:', latestSeason);
                    console.log('📅 Recaps type:', typeof latestSeason.recaps);
                    console.log('📅 Is array?', Array.isArray(latestSeason.recaps));
                    
                    setSelectedSeason(latestSeason);
                    if (Array.isArray(latestSeason.recaps) && latestSeason.recaps.length > 0) {
                        const latestDay = [...latestSeason.recaps].sort((a,b) => b.offSeasonDay - a.offSeasonDay)[0];
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

    if (isLoading) return <div className="p-8 text-center"><p className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Loading Recaps...</p></div>;

    return (
        <>
            <Modal isOpen={!!showToChart} onClose={() => setShowToChart(null)} title={`${showToChart?.eventName} - Caption Breakdown`}>
                <div className="w-full h-96">
                    <CaptionChart showData={showToChart} theme={theme} />
                </div>
            </Modal>

            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-8 text-center">Fantasy Show Recaps</h1>
                
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center mb-8 p-4 bg-surface dark:bg-surface-dark rounded-theme shadow-theme border border-accent dark:border-accent-dark">
                    <div className="flex items-center gap-2">
                        <label htmlFor="season-select" className="font-semibold text-text-secondary dark:text-text-secondary-dark">Season:</label>
                        <select id="season-select" value={selectedSeason?.id || ''} onChange={e => handleSeasonChange(e.target.value)} className="bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary">
                            {allRecaps.map(season => <option key={season.id} value={season.id}>{season.seasonName}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="day-select" className="font-semibold text-text-secondary dark:text-text-secondary-dark">
                            Day:
                        </label>
                        <select 
                            id="day-select" 
                            value={selectedDay?.offSeasonDay || ''} 
                            onChange={e => handleDayChange(e.target.value)} 
                            className="bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary" 
                            disabled={!selectedSeason}
                        >
                            {selectedSeason?.recaps && Array.isArray(selectedSeason.recaps) && selectedSeason.recaps.length > 0 ? (
                                selectedSeason.recaps
                                    .slice() // Create a copy to avoid mutating
                                    .sort((a,b) => a.offSeasonDay - b.offSeasonDay)
                                    .map(day => (
                                        <option key={day.offSeasonDay} value={day.offSeasonDay}>
                                            Day {day.offSeasonDay}
                                        </option>
                                    ))
                            ) : (
                                <option value="">No recaps available</option>
                            )}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="class-select" className="font-semibold text-text-secondary dark:text-text-secondary-dark">Class:</label>
                        <select id="class-select" value={selectedCorpsClass} onChange={e => setSelectedCorpsClass(e.target.value)} className="bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary">
                            {/* MODIFIED: Map over CORPS_CLASS_ORDER */}
                            {CORPS_CLASS_ORDER.map(key => {
                                const classInfo = CORPS_CLASSES[key];
                                return (
                                    <option key={key} value={key}>{classInfo.name}</option>
                                )
                            })}
                        </select>
                    </div>
                </div>

                {selectedDay ? (
                    <div className="space-y-8">
                        {selectedDay.shows.map((show, index) => (
                            <div key={index} className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                                <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-primary dark:text-primary-dark">{show.eventName.replace(/DCI/g, 'marching.art')}</h2>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{show.location}</p>
                                    </div>
                                    <button onClick={() => setShowToChart(show)} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme text-sm self-start md:self-center">
                                        View Chart
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-text-primary dark:text-text-primary-dark">
                                        <thead className="border-b-theme border-accent dark:border-accent-dark">
                                            <tr>
                                                <th className="p-3 font-semibold text-text-secondary dark:text-text-secondary-dark">Rank</th>
                                                <th className="p-3 font-semibold text-text-secondary dark:text-text-secondary-dark">Corps</th>
                                                <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">GE</th>
                                                <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">Visual</th>
                                                <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">Music</th>
                                                <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">Total Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {show.results
                                                .filter(res => res.corpsClass === selectedCorpsClass || !res.corpsClass) // Filter by corps class, include legacy entries without corpsClass
                                                .sort((a, b) => b.totalScore - a.totalScore)
                                                .map((res, i) => (
                                                <tr key={res.uid || res.id} className="transition-colors even:bg-accent/40 dark:even:bg-accent-dark/10 hover:bg-accent dark:hover:bg-accent-dark/20">
                                                    <td className="p-3 font-bold w-12">{i + 1}</td>
                                                    <td className="p-3 font-semibold">
                                                        {res.corpsName}
                                                        {res.corpsClass && (
                                                            <span className={`ml-2 inline-block w-2 h-2 rounded-full ${CORPS_CLASSES[res.corpsClass]?.color || 'bg-gray-400'}`}></span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">{res.geScore.toFixed(3)}</td>
                                                    <td className="p-3 text-right">{res.visualScore.toFixed(3)}</td>
                                                    <td className="p-3 text-right">{res.musicScore.toFixed(3)}</td>
                                                    <td className="p-3 font-bold text-right text-primary dark:text-primary-dark">{res.totalScore.toFixed(3)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-text-secondary dark:text-text-secondary-dark mt-8">No recaps found for the selected season or day.</p>
                )}
            </div>
        </>
    );
};

export default ScoresPage;