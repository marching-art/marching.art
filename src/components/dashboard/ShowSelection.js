import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [expandedShow, setExpandedShow] = useState(null); // To track which show details are open
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
        // ... (logic to calculate start/end day and get weekEvents) ...
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

        return (
            <div key={week} /* ... */ >
                {/* ... Week Header ... */}
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
                        disabled={show.mandatory || isPastWeek}
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
                    </div>
                ) : (
                    <p className="text-gray-500 mt-2">No shows scheduled for this week.</p>
                )}
            </div>
        );
    }

    return (
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
             <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 border-b-2 pb-2 mb-4">Season Schedule & Show Selection</h2>
             {message && <p className="mb-4 font-semibold text-red-500">{message}</p>}
             <div className="space-y-6">
                {Array.from({ length: 7 }, (_, i) => i + 1).map(week => renderWeek(week))}
             </div>
        </div>
    );
};

export default ShowSelection;