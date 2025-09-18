import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';

const StatsPage = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [statsData, setStatsData] = useState(null);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [selectedCorps, setSelectedCorps] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStatsData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            try {
                // Fetch season settings first to get the season ID
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);

                    // Fetch stats using season UID
                    const statsDoc = await getDoc(doc(db, 'dci-stats', seasonData.seasonUid));
                    if (statsDoc.exists()) {
                        setStatsData(statsDoc.data());
                    }
                }
            } catch (error) {
                console.error("Error fetching stats data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatsData();
    }, [isLoadingAuth]);

    // Filter corps based on search term
    const filteredCorps = statsData?.data?.filter(corps =>
        corps.corpsName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        corps.sourceYear.toString().includes(searchTerm)
    ).sort((a, b) => a.corpsName.localeCompare(b.corpsName)) || [];

    // Get selected corps data
    const selectedCorpsData = selectedCorps ? 
        statsData?.data?.find(corps => `${corps.corpsName}-${corps.sourceYear}` === selectedCorps) : 
        null;

    const captions = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading statistics...</p>
                </div>
            </div>
        );
    }

    if (!statsData || !statsData.data) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">No Statistics Available</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        Corps statistics haven't been calculated for the current season yet.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Page Header */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                            Corps Statistics
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            {seasonSettings?.name || 'Current Season'} Performance Data
                        </p>
                    </div>

                    {/* Season Info */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {statsData.data.length}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Corps Available</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    8
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Caption Categories</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {seasonSettings?.currentPointCap || 150}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Point Cap</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {statsData.lastUpdated ? new Date(statsData.lastUpdated.seconds * 1000).toLocaleDateString() : 'Unknown'}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Last Updated</p>
                            </div>
                        </div>
                    </div>

                    {/* Corps Search and Selection */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Corps Search
                        </h2>
                        
                        <div className="space-y-4">
                            {/* Search Input */}
                            <input
                                type="text"
                                placeholder="Search by corps name or year..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary"
                            />

                            {/* Corps Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                                {filteredCorps.map(corps => {
                                    const corpsKey = `${corps.corpsName}-${corps.sourceYear}`;
                                    return (
                                        <button
                                            key={corpsKey}
                                            onClick={() => setSelectedCorps(corpsKey === selectedCorps ? '' : corpsKey)}
                                            className={`p-3 text-left rounded-theme transition-all ${
                                                selectedCorps === corpsKey
                                                    ? 'bg-primary text-on-primary shadow-lg'
                                                    : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                            }`}
                                        >
                                            <p className="font-bold text-sm">{corps.corpsName}</p>
                                            <p className="text-xs opacity-75">{corps.sourceYear} • {corps.points} pts</p>
                                        </button>
                                    );
                                })}
                            </div>

                            {filteredCorps.length === 0 && searchTerm && (
                                <p className="text-center py-4 text-text-secondary dark:text-text-secondary-dark">
                                    No corps found matching "{searchTerm}"
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Selected Corps Statistics */}
                    {selectedCorpsData && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {selectedCorpsData.corpsName}
                                    </h2>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        {selectedCorpsData.sourceYear} Season • {selectedCorpsData.points} Fantasy Points
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedCorps('')}
                                    className="mt-2 sm:mt-0 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                                >
                                    ✕ Close
                                </button>
                            </div>

                            {/* Caption Statistics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {captions.map(caption => {
                                    const stats = selectedCorpsData.stats[caption];
                                    return (
                                        <div key={caption} className="bg-background dark:bg-background-dark p-4 rounded-theme">
                                            <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                                {caption}
                                            </h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary dark:text-text-secondary-dark">Average:</span>
                                                    <span className="font-bold text-primary dark:text-primary-dark">
                                                        {stats.avg?.toFixed(3) || '0.000'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary dark:text-text-secondary-dark">Best:</span>
                                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                                        {stats.max?.toFixed(3) || '0.000'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary dark:text-text-secondary-dark">Lowest:</span>
                                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                                        {stats.min?.toFixed(3) || '0.000'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary dark:text-text-secondary-dark">Events:</span>
                                                    <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                        {stats.count || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Overall Performance Summary */}
                            <div className="mt-6 p-4 bg-accent dark:bg-accent-dark/10 rounded-theme">
                                <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                    Performance Summary
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-lg font-bold text-primary dark:text-primary-dark">
                                            {((selectedCorpsData.stats.GE1?.avg || 0) + (selectedCorpsData.stats.GE2?.avg || 0)).toFixed(3)}
                                        </p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Avg General Effect</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-primary dark:text-primary-dark">
                                            {(((selectedCorpsData.stats.VP?.avg || 0) + (selectedCorpsData.stats.VA?.avg || 0) + (selectedCorpsData.stats.CG?.avg || 0)) / 2).toFixed(3)}
                                        </p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Avg Visual Score</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-primary dark:text-primary-dark">
                                            {(((selectedCorpsData.stats.B?.avg || 0) + (selectedCorpsData.stats.MA?.avg || 0) + (selectedCorpsData.stats.P?.avg || 0)) / 2).toFixed(3)}
                                        </p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Avg Music Score</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Help Text */}
                    {!selectedCorpsData && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme text-center">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Corps Performance Analytics
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Search for and select a corps above to view detailed performance statistics including 
                                average scores, best performances, and historical data across all caption categories.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsPage;