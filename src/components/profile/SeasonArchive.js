import React, { useState, useEffect } from 'react';

const SeasonArchive = ({ seasons = [] }) => {
    const [seasonType, setSeasonType] = useState('Live');
    const filteredSeasons = seasons.filter(s => s.type === seasonType);
    const [activeSeason, setActiveSeason] = useState(filteredSeasons.length > 0 ? filteredSeasons[0] : null);

    useEffect(() => {
        const newFiltered = seasons.filter(s => s.type === seasonType);
        setActiveSeason(newFiltered.length > 0 ? newFiltered[0] : null);
    }, [seasonType, seasons]);

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