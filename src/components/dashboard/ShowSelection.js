import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [expandedShow, setExpandedShow] = useState(null);
    const [registrations, setRegistrations] = useState({});

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

    const toggleShowDetails = async (showIdentifier, week, show) => {
        if (expandedShow === showIdentifier) {
            setExpandedShow(null);
            return;
        }

        // Fetch registrations if not already fetched
        if (!registrations[showIdentifier]) {
            try {
                const getShowRegistrations = httpsCallable(functions, 'getShowRegistrations');
                const result = await getShowRegistrations({
                    week,
                    eventName: show.eventName,
                    date: show.date
                });
                setRegistrations(prev => ({ ...prev, [showIdentifier]: result.data.corpsNames }));
            } catch (error) {
                console.error("Error fetching registrations:", error);
                setRegistrations(prev => ({ ...prev, [showIdentifier]: ["Error loading."] }));
            }
        }
        setExpandedShow(showIdentifier);
    };

    const renderWeek = (week) => {
    const weekKey = `week${week}`;
    const startDay = (week - 1) * 7 + 1;
    const endDay = week * 7;
    const weekEventsByDay = seasonEvents.filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay);

    let userSelectionsForWeek = selectedShows[weekKey] || [];
    weekEventsByDay.forEach(day => {
        day.shows.forEach(show => {
            if (show.mandatory && !userSelectionsForWeek.some(s => s.eventName === show.eventName)) {
                userSelectionsForWeek.push({ eventName: show.eventName, date: show.date, location: show.location });
            }
        });
    });

    const isPastWeek = week < currentWeek;
    // --- NEW: Check if the user has reached the selection limit for this week ---
    const isSelectionLimitReached = userSelectionsForWeek.length >= 4;

    return (
        <div key={week} className="border-t border-gray-200 dark:border-gray-700 pt-4">
            {/* --- NEW: Week Header --- */}
            <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-500 mb-2">Week {week}</h3>
            
            {weekEventsByDay.length > 0 ? (
                <div className="space-y-4 mt-2">
                    {weekEventsByDay.map(day => (
                        <div key={day.offSeasonDay}>
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">Day {day.offSeasonDay}</h4>
                            {day.shows.map((show, index) => {
                                const showIdentifier = `${week}-${day.offSeasonDay}-${index}`;
                                const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName);
                                return (
                                    <div key={index} className="ml-4 p-2 bg-gray-50 dark:bg-gray-900 rounded mt-1">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center flex-grow">
                                                <input
                                                    type="checkbox"
                                                    id={showIdentifier}
                                                    checked={isSelected}
                                                    // --- UPDATED: Disable checkbox if limit is reached and it's not already selected ---
                                                    disabled={show.mandatory || isPastWeek || (isSelectionLimitReached && !isSelected)}
                                                    onChange={(e) => handleSelectShow(week, show, e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 disabled:opacity-50 cursor-pointer"
                                                />
                                                <label htmlFor={showIdentifier} className="ml-3 text-sm flex-grow cursor-pointer">
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{show.eventName}</span>
                                                    <em className="text-gray-500 dark:text-gray-400 ml-2">({show.location})</em>
                                                </label>
                                            </div>
                                            <button onClick={() => toggleShowDetails(showIdentifier, week, show)} className="text-xs text-blue-500 hover:underline flex-shrink-0 ml-2">
                                                {expandedShow === showIdentifier ? 'Hide' : 'Who\'s Going?'}
                                            </button>
                                        </div>
                                        {expandedShow === showIdentifier && (
                                            <div className="mt-2 pl-8 text-sm text-gray-600 dark:text-gray-400">
                                                <p className="italic">Registered Directors:</p>
                                                <ul className="list-disc pl-5">
                                                    {registrations[showIdentifier] ? (
                                                        registrations[showIdentifier].length > 0 ? (
                                                            registrations[showIdentifier].map((name, i) => <li key={i}>{name}</li>)
                                                        ) : (<li>No one yet!</li>)
                                                    ) : (<li>Loading...</li>)
                                                    }
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    {/* --- NEW: Save Selections Button for the week --- */}
                    {!isPastWeek && (
                         <div className="flex justify-end mt-4">
                            <button 
                                onClick={() => handleSaveWeek(week)}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                                {isLoading ? 'Saving...' : `Save Week ${week} Selections`}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-gray-500 mt-2">No shows scheduled for this week.</p>
            )}
        </div>
    )
};

// Create an array for the 7 weeks of the off-season to map over.
    const weeksToRender = Array.from({ length: 7 }, (_, i) => i + 1);

    return (
        <div>
            {/* Map over the weeks and call your renderWeek function for each one */}
            {weeksToRender.map(week => renderWeek(week))}
            
            {/* Display any global messages */}
            {message && <p className="mt-4 text-center text-sm text-red-600">{message}</p>}
        </div>
    );
   

};

export default ShowSelection;