import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// HELPER FUNCTION: This function reads the current theme's colors from the CSS variables on the root element.
const getThemeColors = () => {
    if (typeof window === 'undefined') {
        // Return fallback colors for server-side rendering
        return {
            primary: '#1E3A8A',
            textPrimary: '#1F2937',
            textSecondary: '#4B5563',
        };
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const getColor = (name) => `rgb(${rootStyles.getPropertyValue(name).trim()})`;

    return {
        primary: getColor('--color-primary'),
        textPrimary: getColor('--text-primary'),
        textSecondary: getColor('--text-secondary'),
    };
};


const SeasonArchive = ({ seasons = [], userId, seasonSettings, fantasyRecaps, theme }) => {
    const [seasonType, setSeasonType] = useState('Live');
    const [activeSeason, setActiveSeason] = useState(null);
    const [themeColors, setThemeColors] = useState(getThemeColors());

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
        labels: activeSeason?.events.map(e => e.eventName.split(' ').slice(0, 2).join(' ')) || [],
        datasets: [
            {
                label: 'Total Score',
                data: activeSeason?.events.map(e => e.score) || [],
                fill: true,
                backgroundColor: `${themeColors.primary} / 0.2`,
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

    const filteredSeasons = seasons.filter(s => s.type === seasonType).sort((a,b) => b.name.localeCompare(a.name));

    return (
        <div className="lg:col-span-2 bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-secondary shadow-theme">
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Season Archive</h3>
            <div className="flex border-b-theme border-accent mb-2">
                <button onClick={() => setSeasonType('Live')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Live' ? 'text-secondary border-b-2 border-secondary' : 'text-text-secondary hover:text-text-primary'}`}>Live Seasons</button>
                <button onClick={() => setSeasonType('Off')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Off' ? 'text-secondary border-b-2 border-secondary' : 'text-text-secondary hover:text-text-primary'}`}>Off-Seasons</button>
            </div>
            
            <div className="flex border-b-theme border-accent mb-4 overflow-x-auto">
                {filteredSeasons.map(season => (
                    <button 
                        key={season.name} 
                        onClick={() => setActiveSeason(season)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${activeSeason?.name === season.name ? 'border-b-2 border-secondary text-secondary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        {season.name} {season.isCurrent && '★'}
                    </button>
                ))}
            </div>

            {activeSeason ? (
                <div>
                    <h4 className="text-xl font-bold text-text-primary">{activeSeason.showTitle}</h4>
                    <p className="italic text-text-secondary mb-4">{activeSeason.repertoire}</p>
                    
                    {activeSeason.events.length > 0 ? (
                         <div className="w-full h-64 relative mb-6">
                            <Line options={chartOptions} data={chartData} />
                        </div>
                    ) : (
                        <div className="w-full h-64 relative mb-6 flex items-center justify-center text-text-secondary">
                           <p>No scores recorded yet for this season.</p>
                        </div>
                    )}
                    
                    <table className="w-full text-left text-text-primary">
                        <thead>
                            <tr className="border-b-theme border-accent">
                                <th className="p-2 font-semibold">Event</th>
                                <th className="p-2 font-semibold">Rank</th>
                                <th className="p-2 font-semibold">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSeason.events.map((event, i) => (
                                <tr key={i} className="border-b-theme border-surface dark:border-accent">
                                    <td className="p-2">{event.eventName}</td>
                                    <td className="p-2">{event.rank}</td>
                                    <td className="p-2">{event.score.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-2 text-text-secondary">No seasons of this type played.</p>}
        </div>
    );
};
export default SeasonArchive;