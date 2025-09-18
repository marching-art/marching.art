import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// HELPER FUNCTION: This function reads the current theme's colors from the CSS variables on the root element.
const getThemeColors = () => {
    if (typeof window === 'undefined') {
        // Return fallback colors for server-side rendering
        return {
            primary: '#3B82F6',
            textPrimary: '#111827',
            textSecondary: '#6B7280',
        };
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const isDarkMode = document.documentElement.classList.contains('dark');
    const getColor = (varName) => `rgb(${rootStyles.getPropertyValue(varName).trim()})`;

    return {
        primary: isDarkMode ? getColor('--color-primary-dark') : getColor('--color-primary'),
        textPrimary: isDarkMode ? getColor('--text-primary-dark') : getColor('--text-primary'),
        textSecondary: isDarkMode ? getColor('--text-secondary-dark') : getColor('--text-secondary'),
    };
};


const SeasonArchive = ({ seasons = [], userId, seasonSettings, fantasyRecaps, theme }) => {
    const [seasonType, setSeasonType] = useState('Live'); // Default state
    const [activeSeason, setActiveSeason] = useState(null);
    const [themeColors, setThemeColors] = useState(getThemeColors());

    // This effect sets the default tab based on the current season status when the component loads
    useEffect(() => {
        if (seasonSettings) {
            const currentSeasonType = seasonSettings.status === 'live-season' ? 'Live' : 'Off';
            setSeasonType(currentSeasonType);
        }
    }, [seasonSettings]);

    useEffect(() => { setThemeColors(getThemeColors()); }, [theme]);

    const currentSeasonData = useMemo(() => {
        if (!seasonSettings || !fantasyRecaps || !userId) {
            return null;
        }

        // Find the user's results from all recaps in the current season
        const userEvents = fantasyRecaps.recaps.map(dayRecap => {
            let userResult = null;
            let showWithUser = null;
            
            dayRecap.shows.forEach(show => {
                const result = show.results.find(res => res.uid === userId);
                if (result) {
                    userResult = result;
                    showWithUser = show;
                }
            });

            if (userResult && showWithUser) {
                // Calculate rank for this event
                const sortedResults = [...showWithUser.results].sort((a,b) => b.totalScore - a.totalScore);
                const rank = sortedResults.findIndex(res => res.uid === userId) + 1;
                return {
                    eventName: showWithUser.eventName,
                    rank: rank,
                    score: userResult.totalScore,
                    day: dayRecap.offSeasonDay,
                };
            }
            return null;
        }).filter(Boolean).sort((a,b) => a.day - b.day); // Filter out nulls and sort by day

        return {
            name: seasonSettings.name,
            type: seasonSettings.status === 'live-season' ? 'Live' : 'Off',
            showTitle: `Current Season`,
            repertoire: 'Scores reflect your performance in the active game.',
            events: userEvents,
            isCurrent: true, // Add a flag to identify this special season object
        };
    }, [userId, seasonSettings, fantasyRecaps]);

    // Combine current season data with archived seasons
    const allSeasons = useMemo(() => {
        return currentSeasonData ? [currentSeasonData, ...seasons] : seasons;
    }, [currentSeasonData, seasons]);
    
    // This effect now sets the default active season, prioritizing the current one
    useEffect(() => {
        const filtered = allSeasons.filter(s => s.type.toLowerCase().startsWith(seasonType.toLowerCase()));
        const sorted = filtered.sort((a,b) => b.name.localeCompare(a.name));
        
        // Prioritize the current season if it matches the selected type
        const current = sorted.find(s => s.isCurrent);
        setActiveSeason(current || (sorted.length > 0 ? sorted[0] : null));
    }, [seasonType, allSeasons]);
    
    const chartData = {
        labels: activeSeason?.events.map(e => e.eventName.replace(/DCI/g, 'marching.art').split(' ').slice(0, 2).join(' ')) || [],
        datasets: [
            {
                label: 'Total Score',
                data: activeSeason?.events.map(e => e.score) || [],
                fill: true,
                backgroundColor: `${themeColors.primary}33`, // Added 33 for hex alpha
                borderColor: themeColors.primary,
                tension: 0.1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Score Progression',
                color: themeColors.textPrimary,
                font: { size: 16 }
            }
        },
        scales: {
             x: { ticks: { color: themeColors.textSecondary } },
             y: { ticks: { color: themeColors.textSecondary } }
        }
    };

    const filteredSeasons = allSeasons.filter(s => s.type.toLowerCase().startsWith(seasonType.toLowerCase())).sort((a,b) => b.name.localeCompare(a.name));

    return (
        <div>
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Season Archive</h3>
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-2">
                <button onClick={() => setSeasonType('Live')} className={`py-2 px-4 font-bold transition-colors ${seasonType === 'Live' ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}>Live Seasons</button>
                <button onClick={() => setSeasonType('Off')} className={`py-2 px-4 font-bold transition-colors ${seasonType === 'Off' ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}>Off-Seasons</button>
            </div>
            
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {filteredSeasons.map(season => (
                    <button 
                        key={season.name} 
                        onClick={() => setActiveSeason(season)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${activeSeason?.name === season.name ? 'border-b-2 border-primary text-primary dark:border-primary-dark dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}
                    >
                        {season.name} {season.isCurrent && '★'}
                    </button>
                ))}
            </div>

            {activeSeason ? (
                <div>
                    <h4 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">{activeSeason.showTitle}</h4>
                    <p className="italic text-text-secondary dark:text-text-secondary-dark mb-4">{activeSeason.repertoire}</p>
                    
                    {activeSeason.events.length > 0 ? (
                         <div className="w-full h-64 relative mb-6">
                            <Line options={chartOptions} data={chartData} />
                        </div>
                    ) : (
                        <div className="w-full h-64 relative mb-6 flex items-center justify-center text-text-secondary dark:text-text-secondary-dark">
                           <p>No scores recorded yet for this season.</p>
                        </div>
                    )}
                    
                    <table className="w-full text-left text-sm text-text-primary dark:text-text-primary-dark">
                        <thead className="border-b-theme border-accent dark:border-accent-dark">
                            <tr>
                                <th className="p-2 font-semibold">Event</th>
                                <th className="p-2 font-semibold">Rank</th>
                                <th className="p-2 font-semibold">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSeason.events.map((event, i) => (
                                <tr key={i} className="border-b-theme border-surface dark:border-accent-dark/20">
                                    <td className="p-2">{event.eventName.replace(/DCI/g, 'marching.art')}</td>
                                    <td className="p-2">{event.rank}</td>
                                    <td className="p-2 font-semibold text-primary dark:text-primary-dark">{event.score.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-2 text-text-secondary dark:text-text-secondary-dark">No seasons of this type played.</p>}
        </div>
    );
};
export default SeasonArchive;