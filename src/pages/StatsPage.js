import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const StatsPage = () => {
    const [statsData, setStatsData] = useState([]);
    const [seasonName, setSeasonName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'desc' });
    const [selectedCaption, setSelectedCaption] = useState('GE1');

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const seasonRef = doc(db, 'game-settings', 'season');
                const seasonSnap = await getDoc(seasonRef);
                if (seasonSnap.exists()) {
                    const seasonId = seasonSnap.data().seasonUid;
                    setSeasonName(seasonSnap.data().name);

                    const statsRef = doc(db, 'dci-stats', seasonId);
                    const statsSnap = await getDoc(statsRef);
                    if (statsSnap.exists()) {
                        setStatsData(statsSnap.data().data || []);
                    } else {
                        console.log("Stats document not found. Please run calculation from admin panel.");
                    }
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
            setIsLoading(false);
        };
        fetchStats();
    }, []);

    const sortedData = React.useMemo(() => {
        let sortableItems = [...statsData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = sortConfig.key.includes('stats.') ? a.stats[selectedCaption][sortConfig.key.split('.')[2]] : a[sortConfig.key];
                let bValue = sortConfig.key.includes('stats.') ? b.stats[selectedCaption][sortConfig.key.split('.')[2]] : b[sortConfig.key];

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [statsData, sortConfig, selectedCaption]);

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'desc' ? ' ▼' : ' ▲';
        }
        return '';
    };

    if (isLoading) {
        return <div className="p-8 text-center"><p>Loading Statistics...</p></div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">Statistics Center</h1>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-8">Data for the {seasonName}</p>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Caption Power Rankings</h2>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4">
                    Select a caption to see which corps performed the best historically. Click on column headers to sort.
                </p>
                
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
                    <table className="w-full text-left text-sm text-text-primary dark:text-text-primary-dark">
                        <thead className="border-b-theme border-accent dark:border-accent-dark">
                            <tr>
                                <th className="p-3 font-semibold cursor-pointer" onClick={() => requestSort('corpsName')}>Corps {getSortIndicator('corpsName')}</th>
                                <th className="p-3 font-semibold cursor-pointer text-right" onClick={() => requestSort('points')}>Points {getSortIndicator('points')}</th>
                                <th className="p-3 font-semibold cursor-pointer text-right" onClick={() => requestSort(`stats.${selectedCaption}.avg`)}>Avg Score {getSortIndicator(`stats.${selectedCaption}.avg`)}</th>
                                <th className="p-3 font-semibold cursor-pointer text-right" onClick={() => requestSort(`stats.${selectedCaption}.max`)}>Max Score {getSortIndicator(`stats.${selectedCaption}.max`)}</th>
                                <th className="p-3 font-semibold cursor-pointer text-right" onClick={() => requestSort(`stats.${selectedCaption}.count`)}># Scores {getSortIndicator(`stats.${selectedCaption}.count`)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map(corp => (
                                <tr key={corp.id} className="transition-colors even:bg-accent/40 dark:even:bg-accent-dark/10 hover:bg-accent dark:hover:bg-accent-dark/20">
                                    <td className="p-3 font-semibold">{corp.corpsName} ({corp.sourceYear})</td>
                                    <td className="p-3 font-bold text-right">{corp.points}</td>
                                    <td className="p-3 text-right font-bold text-primary dark:text-primary-dark">{corp.stats[selectedCaption].avg.toFixed(3)}</td>
                                    <td className="p-3 text-right">{corp.stats[selectedCaption].max.toFixed(3)}</td>
                                    <td className="p-3 text-right">{corp.stats[selectedCaption].count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StatsPage;
