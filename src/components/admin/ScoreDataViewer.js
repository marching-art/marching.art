import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const DAYS = Array.from({ length: 49 }, (_, i) => i + 1);

const ScoreDataViewer = () => {
    const [seasonData, setSeasonData] = useState(null);
    const [corpsList, setCorpsList] = useState([]);
    const [gridData, setGridData] = useState({});
    const [selectedCaption, setSelectedCaption] = useState('GE1');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);

            if (seasonSnap.exists()) {
                const settings = seasonSnap.data();
                setSeasonData(settings);

                if (settings.dataDocId) {
                    const corpsDataRef = doc(db, 'dci-data', settings.dataDocId);
                    const corpsSnap = await getDoc(corpsDataRef);
                    if (corpsSnap.exists()) {
                        const corpsValues = corpsSnap.data().corpsValues || [];
                        // --- MODIFICATION: Sort corps by point value, descending ---
                        setCorpsList(corpsValues.sort((a, b) => b.points - a.points));
                    }
                }
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!seasonData || corpsList.length === 0) return;

        const processedData = {};
        corpsList.forEach(corp => {
            processedData[corp.corpsName] = {};
            DAYS.forEach(day => {
                const dayEvent = seasonData.events.find(e => e.offSeasonDay === day);
                let scoreForDay = null;
                if (dayEvent) {
                    for (const show of dayEvent.shows) {
                        const scoreData = show.scores.find(s => s.corps === corp.corpsName);
                        if (scoreData && scoreData.captions[selectedCaption] > 0) {
                            scoreForDay = scoreData.captions[selectedCaption];
                            break; 
                        }
                    }
                }
                processedData[corp.corpsName][day] = scoreForDay;
            });
        });
        setGridData(processedData);
    }, [selectedCaption, seasonData, corpsList]);

    if (isLoading) {
        return <p>Loading score data...</p>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-lg">
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">Season Score Data Viewer</h2>
            
            {/* --- MODIFICATION: Replaced dropdown with a tab-style header --- */}
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
                {CAPTIONS.map(caption => (
                    <button
                        key={caption}
                        onClick={() => setSelectedCaption(caption)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${
                            selectedCaption === caption
                                ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        {caption}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
                        <tr>
                            <th className="p-2 border border-gray-300 dark:border-gray-600">Corps</th>
                            {DAYS.map(day => <th key={day} className="p-2 border border-gray-300 dark:border-gray-600 text-center">{day}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {corpsList.map(corp => (
                            <tr key={`${corp.corpsName}-${corp.sourceYear}`} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/50">
                                <td className="p-2 border border-gray-300 dark:border-gray-600 font-semibold whitespace-nowrap">
                                    {/* --- MODIFICATION: Display name, year, and points --- */}
                                    {`${corp.corpsName} (${corp.sourceYear}) - ${corp.points} pts`}
                                </td>
                                {DAYS.map(day => (
                                    <td key={`${corp.corpsName}-${day}`} className="p-2 border border-gray-300 dark:border-gray-600 text-center">
                                        {gridData[corp.corpsName]?.[day]?.toFixed(3) || ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScoreDataViewer;