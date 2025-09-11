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
                        // Sort corps alphabetically for consistent display
                        const corpsValues = corpsSnap.data().corpsValues || [];
                        setCorpsList(corpsValues.sort((a, b) => a.corpsName.localeCompare(b.corpsName)));
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
                            break; // Take the first score found for that day
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
            <div className="flex items-center space-x-4 mb-4">
                <label htmlFor="caption-select" className="font-semibold">Select Caption:</label>
                <select
                    id="caption-select"
                    value={selectedCaption}
                    onChange={(e) => setSelectedCaption(e.target.value)}
                    className="bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-green-500 rounded p-2 text-gray-800 dark:text-green-300"
                >
                    {CAPTIONS.map(caption => <option key={caption} value={caption}>{caption}</option>)}
                </select>
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
                            <tr key={corp.corpsName} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/50">
                                <td className="p-2 border border-gray-300 dark:border-gray-600 font-semibold whitespace-nowrap">{corp.corpsName}</td>
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