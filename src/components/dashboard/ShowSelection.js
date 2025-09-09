import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [expandedShow, setExpandedShow] = useState(null); // To track which show details are open

    const currentWeek = Math.ceil(currentOffSeasonDay / 7);

    const handleSelectShow = (week, show, isSelected) => {
        const weekKey = `week${week}`;
        const currentSelections = selectedShows[weekKey] || [];

        let newSelections;
        if (isSelected) {
            newSelections = [...currentSelections, { eventName: show.eventName, date: show.date, location: show.location }];
        } else {
            newSelections = currentSelections.filter(s => !(s.eventName === show.eventName && s.date === show.date));
        }

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

    const toggleShowDetails = (showIdentifier) => {
        setExpandedShow(expandedShow === showIdentifier ? null : showIdentifier);
    };

    const renderWeek = (week) => {
        const weekKey = `week${week}`;
        const startDay = (week - 1) * 7 + 1;
        const endDay = week * 7;
        const weekEvents = seasonEvents.filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay);
        const showsThisWeek = weekEvents.flatMap(day => day.shows.map(show => ({...show, offSeasonDay: day.offSeasonDay })));
        
        let userSelectionsForWeek = selectedShows[weekKey] || [];
        
        // Auto-enroll in mandatory shows for the week
        showsThisWeek.forEach(show => {
            if (show.mandatory && !userSelectionsForWeek.some(s => s.eventName === show.eventName)) {
                 userSelectionsForWeek.push({ eventName: show.eventName, date: show.date, location: show.location });
            }
        });

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
                            const showIdentifier = `${week}-${index}`;
                            const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName && s.date === show.date);
                            return (
                                <div key={index} className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                    <div className="flex items-center">
                                        <input 
                                            type="checkbox"
                                            id={`show-${showIdentifier}`}
                                            checked={isSelected}
                                            disabled={isPastWeek || show.mandatory}
                                            onChange={(e) => handleSelectShow(week, show, e.target.checked)}
                                            className="mr-3 h-5 w-5 rounded text-yellow-600 focus:ring-yellow-500 disabled:opacity-50"
                                        />
                                        <label htmlFor={`show-${showIdentifier}`} className="flex-grow">
                                            <span className="font-semibold">{show.eventName}</span>
                                            <span className="text-sm text-gray-500 ml-2">({show.location})</span>
                                            {show.mandatory && <span className="ml-2 text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">MANDATORY</span>}
                                        </label>
                                        <button onClick={() => toggleShowDetails(showIdentifier)} className="text-sm text-blue-500 hover:underline">
                                           {expandedShow === showIdentifier ? 'Hide' : 'Who\'s Going?'}
                                        </button>
                                    </div>
                                    {expandedShow === showIdentifier && (
                                        <div className="mt-2 pl-8 text-sm text-gray-600 dark:text-gray-400">
                                            {/* This is where you would query and display the list of users */}
                                            <p className="italic">Registered Directors:</p>
                                            <ul className="list-disc pl-5">
                                                <li>Placeholder Corps 1</li>
                                                <li>Placeholder Corps 2</li>
                                                <li>(Fetching real-time registration data is a future feature)</li>
                                            </ul>
                                        </div>
                                    )}
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
             {message && <p className="mb-4 font-semibold text-red-500">{message}</p>}
             <div className="space-y-6">
                {Array.from({ length: 7 }, (_, i) => i + 1).map(week => renderWeek(week))}
             </div>
        </div>
    )
};

export default ShowSelection;