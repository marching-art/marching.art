import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const SeasonArchive = ({ seasons = [] }) => {
    const [seasonType, setSeasonType] = useState('Off');
    const [activeSeason, setActiveSeason] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

     useEffect(() => {
        const handleThemeChange = () => {
            setTheme(localStorage.getItem('theme') || 'light');
        };
        window.addEventListener('themeChanged', handleThemeChange);
        return () => {
            window.removeEventListener('themeChanged', handleThemeChange);
        };
    }, []);

    // Effect to set the active season whenever the component loads or the type changes
    useEffect(() => {
        const filtered = seasons.filter(s => s.type === seasonType);
        // Sort seasons by name descending to show the most recent first
        const sorted = filtered.sort((a,b) => b.name.localeCompare(a.name));
        setActiveSeason(sorted.length > 0 ? sorted[0] : null);
    }, [seasonType, seasons]);
    
    // Chart Data and Options
    const chartData = {
        labels: activeSeason?.events.map(e => e.eventName.split(' ').slice(0, 2).join(' ')) || [], // Shorten event names for labels
        datasets: [
            {
                label: 'Total Score',
                data: activeSeason?.events.map(e => e.score) || [],
                fill: true,
                backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.4)',
                borderColor: theme === 'dark' ? '#3B82F6' : '#1E3A8A', // brand-primary
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
                color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
                font: { size: 16 }
            }
        },
        scales: {
             x: { ticks: { color: theme === 'dark' ? '#D1D5DB' : '#4B5563' } },
             y: { ticks: { color: theme === 'dark' ? '#D1D5DB' : '#4B5563' } }
        }
    };

    const filteredSeasons = seasons.filter(s => s.type === seasonType).sort((a,b) => b.name.localeCompare(a.name));

    return (
        <div className="lg:col-span-2 bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
            <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">Season Archive</h3>
            <div className="flex border-b-2 border-brand-accent dark:border-brand-accent-dark mb-2">
                <button onClick={() => setSeasonType('Live')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Live' ? 'text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-primary dark:hover:text-brand-secondary-dark'}`}>Live Seasons</button>
                <button onClick={() => setSeasonType('Off')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Off' ? 'text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-primary dark:hover:text-brand-secondary-dark'}`}>Off-Seasons</button>
            </div>
            
            <div className="flex border-b-2 border-brand-accent dark:border-brand-accent-dark mb-4 overflow-x-auto">
                {filteredSeasons.map(season => (
                    <button 
                        key={season.name} 
                        onClick={() => setActiveSeason(season)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${activeSeason?.name === season.name ? 'border-b-2 border-brand-secondary text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-text-primary dark:hover:text-brand-text-primary-dark'}`}
                    >
                        {season.name}
                    </button>
                ))}
            </div>

            {activeSeason ? (
                <div>
                    <h4 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-primary-dark">{activeSeason.showTitle}</h4>
                    <p className="italic text-brand-text-secondary dark:text-brand-text-secondary-dark mb-4">{activeSeason.repertoire}</p>
                    
                    {/* NEW: Chart Display */}
                    <div className="w-full h-64 relative mb-6">
                        <Line options={chartOptions} data={chartData} />
                    </div>
                    
                    <table className="w-full text-left text-brand-text-primary dark:text-brand-text-primary-dark">
                        <thead>
                            <tr className="border-b border-brand-accent dark:border-brand-accent-dark">
                                <th className="p-2 font-semibold">Event</th>
                                <th className="p-2 font-semibold">Rank</th>
                                <th className="p-2 font-semibold">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSeason.events.map((event, i) => (
                                <tr key={i} className="border-b border-brand-surface dark:border-gray-700">
                                    <td className="p-2">{event.eventName}</td>
                                    <td className="p-2">{event.rank}</td>
                                    <td className="p-2">{event.score.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-2 text-brand-text-secondary dark:text-brand-text-secondary-dark">No seasons of this type played.</p>}
        </div>
    );
};
export default SeasonArchive;