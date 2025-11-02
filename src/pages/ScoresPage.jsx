import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import Modal from '../components/ui/Modal';
import CaptionChart from '../components/charts/CaptionChart';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import TabPanel from '../components/ui/TabPanel';

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
                
                if (fetchedRecaps.length > 0) {
                    fetchedRecaps.sort((a, b) => b.seasonName.localeCompare(a.seasonName));
                    setAllRecaps(fetchedRecaps);
                    const latestSeason = fetchedRecaps[0];
                    setSelectedSeason(latestSeason);
                    
                    if (latestSeason.recaps && latestSeason.recaps.length > 0) {
                        setSelectedDay(latestSeason.recaps[latestSeason.recaps.length - 1]);
                    }
                }
            } catch (error) {
                console.error("Error fetching recaps:", error);
            }
            setIsLoading(false);
        };
        fetchRecaps();
    }, []);

    const handleSeasonChange = (e) => {
        const seasonId = e.target.value;
        const season = allRecaps.find(s => s.id === seasonId);
        setSelectedSeason(season);
        if (season && season.recaps && season.recaps.length > 0) {
            setSelectedDay(season.recaps[season.recaps.length - 1]);
        } else {
            setSelectedDay(null);
        }
    };

    const handleDayChange = (e) => {
        const dayIndex = parseInt(e.target.value);
        if (selectedSeason && selectedSeason.recaps) {
            setSelectedDay(selectedSeason.recaps[dayIndex]);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-lg font-semibold text-primary dark:text-primary-dark">Loading Scores...</p>
            </div>
        );
    }

    const FilterControls = () => (
        <div className="flex flex-wrap gap-4 mb-6">
            <select 
                value={selectedSeason?.id || ''} 
                onChange={handleSeasonChange}
                className="bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark font-semibold"
            >
                {allRecaps.map(season => (
                    <option key={season.id} value={season.id}>{season.seasonName}</option>
                ))}
            </select>

            {selectedSeason && selectedSeason.recaps && (
                <select 
                    value={selectedSeason.recaps.indexOf(selectedDay)} 
                    onChange={handleDayChange}
                    className="bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark font-semibold"
                >
                    {selectedSeason.recaps.map((day, index) => (
                        <option key={index} value={index}>
                            Day {day.day} ({day.showsOnDay.length} shows)
                        </option>
                    ))}
                </select>
            )}

            <div className="flex gap-2">
                {CORPS_CLASS_ORDER.map(key => {
                    const classInfo = CORPS_CLASSES[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setSelectedCorpsClass(key)}
                            className={`px-4 py-2 rounded-theme font-semibold flex items-center gap-2 transition-all ${
                                selectedCorpsClass === key
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                            }`}
                        >
                            <div className={`w-3 h-3 rounded-full ${classInfo.color}`}></div>
                            {classInfo.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const ShowsGrid = () => {
        if (!selectedDay || !selectedDay.showsOnDay) {
            return <p className="text-center text-text-secondary dark:text-text-secondary-dark">No shows available.</p>;
        }

        return (
            <div className="space-y-6">
                {selectedDay.showsOnDay.map((show, idx) => {
                    const filteredResults = show.results
                        .filter(res => res.corpsClass === selectedCorpsClass || !res.corpsClass)
                        .sort((a, b) => b.totalScore - a.totalScore);

                    if (filteredResults.length === 0) return null;

                    return (
                        <div key={idx} className="bg-surface dark:bg-surface-dark p-4 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-bold text-primary dark:text-primary-dark">{show.showName}</h3>
                                <button 
                                    onClick={() => setShowToChart(show)}
                                    className="text-sm text-secondary dark:text-secondary-dark hover:underline"
                                >
                                    View Charts
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-accent dark:border-accent-dark">
                                            <th className="p-3 text-left font-semibold text-text-secondary dark:text-text-secondary-dark w-12">#</th>
                                            <th className="p-3 text-left font-semibold text-text-secondary dark:text-text-secondary-dark">Corps</th>
                                            <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">GE</th>
                                            <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">Visual</th>
                                            <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">Music</th>
                                            <th className="p-3 text-right font-semibold text-text-secondary dark:text-text-secondary-dark">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResults.map((res, i) => (
                                            <tr key={res.uid || res.id} className="transition-colors even:bg-accent/40 dark:even:bg-accent-dark/10 hover:bg-accent dark:hover:bg-accent-dark/20">
                                                <td className="p-3 font-bold">{i + 1}</td>
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
                    );
                })}
            </div>
        );
    };

    const tabs = [
        {
            label: 'Latest Scores',
            content: (
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <FilterControls />
                    <ShowsGrid />
                </div>
            )
        }
    ];

    return (
        <>
            {showToChart && (
                <Modal isOpen={!!showToChart} onClose={() => setShowToChart(null)}>
                    <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">{showToChart.showName}</h2>
                    <CaptionChart showData={showToChart} theme={theme} />
                </Modal>
            )}
            <div className="page-content">
                <TabPanel tabs={tabs} defaultTab={0} />
            </div>
        </>
    );
};

export default ScoresPage;
