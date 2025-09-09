import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const currentWeek = Math.ceil(currentOffSeasonDay / 7);

    const handleSelectShow = (week, show, isSelected) => {
        const weekKey = `week${week}`;
        const currentSelections = selectedShows[weekKey] || [];

        let newSelections;
        if (isSelected) {
            // Add show if not already present
            if (!currentSelections.some(s => s.eventName === show.eventName && s.date === show.date)) {
                newSelections = [...currentSelections, { eventName: show.eventName, date: show.date }];
            } else {
                newSelections = currentSelections;
            }
        } else {
            // Remove show
            newSelections = currentSelections.filter(s => !(s.eventName === show.eventName && s.date === show.date));
        }

        // Enforce max 4 shows per week
        if (newSelections.length > 4) {
            setMessage("You can select a maximum of 4 shows per week.");
            return;
        }

        setSelectedShows(prev => ({ ...prev, [weekKey]: newSelections }));
        setMessage('');
    };

    const handleSaveWeek = async (week) => {
        setIsLoading(true);
        setMessage('');
        const weekKey = `week${week}`;
        const showsToSave = selectedShows[weekKey] || [];

        try {
            const selectUserShows = httpsCallable(functions, 'selectUserShows');
            const result = await selectUserShows({ week, shows: showsToSave });
            setMessage(result.data.message);
        } catch (error) {
            console.error("Error saving show selections:", error);
            setMessage(error.message);
        }
        setIsLoading(false);
    };

    const renderWeek = (week) => {
        const weekKey = `week${week}`;
        const startDay = (week - 1) * 7 + 1;
        const endDay = week * 7;
        const weekEvents = seasonEvents.filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay);
        const showsThisWeek = weekEvents.flatMap(day => day.shows.map(show => ({...show, offSeasonDay: day.offSeasonDay })));
        const userSelectionsForWeek = selectedShows[weekKey] || [];
        const isPastWeek = week < currentWeek;

        return (
            <div key={week} className={`p-4 rounded-md ${isPastWeek ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}>
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Week {week} (Days {startDay}-{endDay})</h3>
                    {!isPastWeek && (
                         <button 
                            onClick={() => handleSaveWeek(week)} 
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded disabled:bg-gray-400"
                        >
                            {isLoading ? 'Saving...' : `Save Week ${week}`}
                        </button>
                    )}
                </div>
                 <p className="text-sm text-gray-500 mb-2">Selections: {userSelectionsForWeek.length} / 4</p>
                {showsThisWeek.length > 0 ? (
                    <div className="space-y-2 mt-2">
                        {showsThisWeek.map((show, index) => {
                            const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName && s.date === show.date);
                            return (
                                <div key={index} className="flex items-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                    <input 
                                        type="checkbox"
                                        id={`show-${week}-${index}`}
                                        checked={isSelected}
                                        disabled={isPastWeek}
                                        onChange={(e) => handleSelectShow(week, show, e.target.checked)}
                                        className="mr-3 h-5 w-5 rounded text-yellow-600 focus:ring-yellow-500"
                                    />
                                    <label htmlFor={`show-${week}-${index}`} className="flex-grow">
                                        <span className="font-semibold">{show.eventName}</span>
                                        <span className="text-sm text-gray-500 ml-2"> (Day {show.offSeasonDay})</span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500 mt-2">No shows scheduled for this week.</p>
                )}
            </div>
        )
    }

    return (
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
             <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 border-b-2 pb-2 mb-4">Season Schedule & Show Selection</h2>
             {message && <p className="mb-4 font-semibold">{message}</p>}
             <div className="space-y-6">
                {Array.from({ length: 7 }, (_, i) => i + 1).map(week => renderWeek(week))}
             </div>
        </div>
    )
};

export default ShowSelection;