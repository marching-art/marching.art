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
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Season Archive</h3>
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-2">
                <button onClick={() => setSeasonType('Live')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Live' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>Live Seasons</button>
                <button onClick={() => setSeasonType('Off')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Off' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>Off-Seasons</button>
            </div>
            
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
                {filteredSeasons.map(season => (
                    <button 
                        key={season.name} 
                        onClick={() => setActiveSeason(season)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${activeSeason?.name === season.name ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                        {season.name}
                    </button>
                ))}
            </div>

            {activeSeason ? (
                <div>
                    <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200">{activeSeason.showTitle}</h4>
                    <p className="italic text-gray-600 dark:text-gray-400 mb-4">{activeSeason.repertoire}</p>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="p-2">Event</th>
                                <th className="p-2">Rank</th>
                                <th className="p-2">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSeason.events.map((event, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                    <td className="p-2">{event.eventName}</td>
                                    <td className="p-2">{event.rank}</td>
                                    <td className="p-2">{event.score.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-2 text-gray-500">No seasons of this type played.</p>}
        </div>
    );
};
export default SeasonArchive;