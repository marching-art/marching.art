import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const DAYS = Array.from({ length: 49 }, (_, i) => i + 1);

const ScoreDataViewer = () => {
    const [historicalData, setHistoricalData] = useState(null);
    const [corpsList, setCorpsList] = useState([]);
    const [gridData, setGridData] = useState({});
    const [selectedCaption, setSelectedCaption] = useState('GE1');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const seasonRef = doc(db, 'game-settings', 'season');
                const seasonSnap = await getDoc(seasonRef);

                if (!seasonSnap.exists()) return;
                
                const settings = seasonSnap.data();
                if (!settings.dataDocId) return;

                const corpsDataRef = doc(db, 'dci-data', settings.dataDocId);
                const corpsSnap = await getDoc(corpsDataRef);
                let localCorpsList = [];
                if (corpsSnap.exists()) {
                    localCorpsList = corpsSnap.data().corpsValues || [];
                    setCorpsList(localCorpsList.sort((a, b) => b.points - a.points));
                }

                const yearsToFetch = [...new Set(localCorpsList.map(c => c.sourceYear))];
                const historicalPromises = yearsToFetch.map(year => getDoc(doc(db, 'historical_scores', year)));
                const historicalDocs = await Promise.all(historicalPromises);
                
                const localHistoricalData = {};
                historicalDocs.forEach(docSnap => {
                    if (docSnap.exists()) {
                        localHistoricalData[docSnap.id] = docSnap.data().data;
                    }
                });
                setHistoricalData(localHistoricalData);
            } catch (error) {
                console.error("Error fetching score data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!historicalData || corpsList.length === 0) return;

        const processedData = {};
        corpsList.forEach(corp => {
            const uniqueCorpKey = `${corp.corpsName}-${corp.sourceYear}`;
            processedData[uniqueCorpKey] = {};
            
            const corpHistoricalEvents = historicalData[corp.sourceYear] || [];
            
            DAYS.forEach(day => {
                let scoreForDay = null;
                const dayEvents = corpHistoricalEvents.filter(e => e.offSeasonDay === day);
                
                if (dayEvents.length > 0) {
                    for (const event of dayEvents) {
                        const scoreData = event.scores.find(s => s.corps === corp.corpsName);
                        if (scoreData && scoreData.captions[selectedCaption] > 0) {
                            scoreForDay = scoreData.captions[selectedCaption];
                            break;
                        }
                    }
                }
                processedData[uniqueCorpKey][day] = scoreForDay;
            });
        });
        setGridData(processedData);
        
    }, [selectedCaption, historicalData, corpsList]);


    if (isLoading) {
        return <p>Loading score data...</p>;
    }

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Season Score Data Viewer</h2>
            
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {CAPTIONS.map(caption => (
                    <button
                        key={caption}
                        onClick={() => setSelectedCaption(caption)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${
                            selectedCaption === caption
                                ? 'border-b-2 border-primary text-primary dark:border-primary-dark dark:text-primary-dark'
                                : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        {caption}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left border-collapse">
                    <thead className="bg-surface dark:bg-surface-dark sticky top-0">
                        <tr>
                            <th className="p-2 border-theme border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark">Corps</th>
                            {DAYS.map(day => <th key={day} className="p-2 border-theme border-accent dark:border-accent-dark text-center text-text-secondary dark:text-text-secondary-dark">{day}</th>)}
                        </tr>
                    </thead>
                    <tbody className="text-text-primary dark:text-text-primary-dark">
                        {corpsList.map(corp => {
                            const uniqueCorpKey = `${corp.corpsName}-${corp.sourceYear}`;
                            return (
                                <tr key={uniqueCorpKey} className="odd:bg-background even:bg-surface dark:odd:bg-surface-dark dark:even:bg-surface-dark/50">
                                    <td className="p-2 border-theme border-accent dark:border-accent-dark font-semibold whitespace-nowrap">
                                        {`${corp.corpsName} (${corp.sourceYear}) - ${corp.points} pts`}
                                    </td>
                                    {DAYS.map(day => (
                                        <td key={`${uniqueCorpKey}-${day}`} className="p-2 border-theme border-accent dark:border-accent-dark text-center">
                                            {gridData[uniqueCorpKey]?.[day]?.toFixed(3) || ''}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScoreDataViewer;