import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';
import CaptionChart from '../components/scores/CaptionChart';

const ScoresPage = ({ theme }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [fantasyRecaps, setFantasyRecaps] = useState(null);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedShow, setSelectedShow] = useState(null);
    const [availableDays, setAvailableDays] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchScoresData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            try {
                // Fetch season settings and fantasy recaps
                const [seasonDoc, recapsQuery] = await Promise.all([
                    getDoc(doc(db, 'game-settings', 'season')),
                    getDocs(query(collection(db, 'fantasy_recaps'), orderBy('seasonName', 'desc'), limit(5)))
                ]);

                if (seasonDoc.exists()) {
                    setSeasonSettings(seasonDoc.data());
                }

                if (!recapsQuery.empty) {
                    // Get the most recent recap
                    const latestRecap = recapsQuery.docs[0].data();
                    setFantasyRecaps(latestRecap);

                    // Get available days
                    const days = latestRecap.recaps?.map(recap => recap.offSeasonDay).sort((a, b) => b - a) || [];
                    setAvailableDays(days);

                    // Set most recent day as default
                    if (days.length > 0) {
                        setSelectedDay(days[0]);
                    }
                }
            } catch (error) {
                console.error("Error fetching scores data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchScoresData();
    }, [isLoadingAuth]);

    // Get shows for selected day
    const selectedDayData = fantasyRecaps?.recaps?.find(recap => recap.offSeasonDay === selectedDay);
    const showsForDay = selectedDayData?.shows || [];

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading scores...</p>
                </div>
            </div>
        );
    }

    if (!fantasyRecaps || availableDays.length === 0) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">No Scores Available</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        No fantasy scores have been recorded for the current season yet.
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
                            Fantasy Scores
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            {fantasyRecaps.seasonName} Results
                        </p>
                    </div>

                    {/* Day Selector */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Select Competition Day
                        </h2>
                        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-32 overflow-y-auto">
                            {availableDays.map(day => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={`p-2 rounded-theme font-semibold text-sm transition-all ${
                                        selectedDay === day
                                            ? 'bg-primary text-on-primary shadow-lg'
                                            : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                    }`}
                                >
                                    Day {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Show Results for Selected Day */}
                    {selectedDayData && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                    Day {selectedDay} Results
                                </h2>
                                <p className="text-text-secondary dark:text-text-secondary-dark mt-1 sm:mt-0">
                                    {selectedDayData.date ? new Date(selectedDayData.date.seconds * 1000).toLocaleDateString() : 'Date Unknown'}
                                </p>
                            </div>

                            {/* Show Selector */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {showsForDay.map((show, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedShow(selectedShow === show ? null : show)}
                                        className={`p-4 text-left rounded-theme transition-all ${
                                            selectedShow === show
                                                ? 'bg-primary text-on-primary shadow-lg'
                                                : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                        }`}
                                    >
                                        <h3 className="font-bold text-sm mb-1">
                                            {show.eventName?.replace(/DCI/g, 'marching.art')}
                                        </h3>
                                        <p className="text-xs opacity-75">
                                            {show.location} • {show.results?.length || 0} corps
                                        </p>
                                    </button>
                                ))}
                            </div>

                            {/* Selected Show Details */}
                            {selectedShow && (
                                <div className="space-y-6">
                                    {/* Chart */}
                                    <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                                        <div className="h-64 md:h-96">
                                            <CaptionChart showData={selectedShow} theme={theme} />
                                        </div>
                                    </div>

                                    {/* Results Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-accent dark:bg-accent-dark/20">
                                                <tr>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">Rank</th>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">Corps Name</th>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">Manager</th>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">GE</th>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">Visual</th>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">Music</th>
                                                    <th className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedShow.results
                                                    ?.sort((a, b) => b.totalScore - a.totalScore)
                                                    .map((result, index) => (
                                                    <tr key={result.uid} className="border-b border-accent dark:border-accent-dark/20 hover:bg-accent dark:hover:bg-accent-dark/10">
                                                        <td className="p-3 font-bold text-primary dark:text-primary-dark">
                                                            {index + 1}
                                                        </td>
                                                        <td className="p-3 font-semibold text-text-primary dark:text-text-primary-dark">
                                                            {result.corpsName}
                                                        </td>
                                                        <td className="p-3 text-text-secondary dark:text-text-secondary-dark">
                                                            Manager Name
                                                        </td>
                                                        <td className="p-3 text-text-primary dark:text-text-primary-dark">
                                                            {result.geScore?.toFixed(3)}
                                                        </td>
                                                        <td className="p-3 text-text-primary dark:text-text-primary-dark">
                                                            {result.visualScore?.toFixed(3)}
                                                        </td>
                                                        <td className="p-3 text-text-primary dark:text-text-primary-dark">
                                                            {result.musicScore?.toFixed(3)}
                                                        </td>
                                                        <td className="p-3 font-bold text-lg text-primary dark:text-primary-dark">
                                                            {result.totalScore?.toFixed(3)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Show Selection Hint */}
                            {!selectedShow && showsForDay.length > 0 && (
                                <div className="text-center py-8">
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        Click on a show above to view detailed results and charts
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Season Summary */}
                    {seasonSettings && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                Season Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {availableDays.length}
                                    </p>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Days Scored</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-primary dark:text-primary-dark capitalize">
                                        {seasonSettings.status?.replace('-', ' ')}
                                    </p>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Season Type</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {seasonSettings.currentPointCap}
                                    </p>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Point Cap</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScoresPage;