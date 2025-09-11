import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState({}); // Use an object for week-specific loading
    const [message, setMessage] = useState('');
    
    // --- MODIFICATION START ---
    // Calculate the initial week and ensure it's at least 1.
    const initialWeek = Math.ceil(currentOffSeasonDay / 7);
    const [activeWeek, setActiveWeek] = useState(initialWeek > 0 ? initialWeek : 1);
    // --- MODIFICATION END ---

    const [registrations, setRegistrations] = useState({});
    const [expandedShow, setExpandedShow] = useState(null);

    // When profile changes, reset the local state and ensure activeWeek is valid
    useEffect(() => {
        setSelectedShows(profile.selectedShows || {});
        // --- MODIFICATION START ---
        const currentWeek = Math.ceil(currentOffSeasonDay / 7);
        setActiveWeek(currentWeek > 0 ? currentWeek : 1);
        // --- MODIFICATION END ---
    }, [profile, currentOffSeasonDay]);

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
        setIsLoading(prev => ({ ...prev, [week]: true }));
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
        setIsLoading(prev => ({ ...prev, [week]: false }));
    };
    
    const toggleShowDetails = async (showIdentifier, week, show) => {
        if (expandedShow === showIdentifier) {
            setExpandedShow(null);
            return;
        }
        if (!registrations[showIdentifier]) {
            try {
                const getShowRegistrations = httpsCallable(functions, 'getShowRegistrations');
                const result = await getShowRegistrations({ week, eventName: show.eventName, date: show.date });
                setRegistrations(prev => ({ ...prev, [showIdentifier]: result.data.corpsNames }));
            } catch (error) {
                console.error("Error fetching registrations:", error);
                setRegistrations(prev => ({ ...prev, [showIdentifier]: ["Error loading."] }));
            }
        }
        setExpandedShow(showIdentifier);
    };

    const renderDay = (day, week) => {
        const dayEvent = seasonEvents.find(e => e.offSeasonDay === day);
        const currentWeekNumber = Math.ceil(currentOffSeasonDay / 7);
        const isPastDay = day < currentOffSeasonDay;

        return (
            <div key={day} className={`p-2 border border-gray-200 dark:border-gray-700 rounded-md ${isPastDay ? 'bg-gray-100 dark:bg-gray-800 opacity-60' : 'bg-white dark:bg-gray-900'}`}>
                <div className="font-bold text-center text-gray-800 dark:text-gray-200">{day}</div>
                <div className="mt-1 space-y-1">
                    {(dayEvent?.shows || []).map((show, index) => {
                        const showIdentifier = `${week}-${day}-${index}`;
                        const isSelected = (selectedShows[`week${week}`] || []).some(s => s.eventName === show.eventName);
                        const isSelectionLimitReached = (selectedShows[`week${week}`] || []).length >= 4;

                        return (
                            <div key={showIdentifier} className="text-xs p-1 rounded bg-yellow-100 dark:bg-yellow-900/50">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={showIdentifier}
                                        checked={isSelected}
                                        disabled={show.mandatory || isPastDay || (isSelectionLimitReached && !isSelected)}
                                        onChange={(e) => handleSelectShow(week, show, e.target.checked)}
                                        className="h-3 w-3 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 disabled:opacity-50"
                                    />
                                    <label htmlFor={showIdentifier} className="ml-1.5 font-semibold text-gray-900 dark:text-yellow-200 truncate cursor-pointer">{show.eventName}</label>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeekDetails = (week) => {
        const weekKey = `week${week}`;
        const startDay = (week - 1) * 7 + 1;
        const endDay = week * 7;
        const weekEvents = seasonEvents.filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay);
        const userSelectionsForWeek = selectedShows[weekKey] || [];
        const currentWeekNumber = Math.ceil(currentOffSeasonDay / 7);
        const isPastWeek = week < currentWeekNumber;

        return (
            <div className="mt-4 p-4 border-t-2 border-yellow-500">
                <h4 className="text-lg font-bold text-yellow-700 dark:text-yellow-400">Week {week} Show Details</h4>
                {weekEvents.length > 0 ? (
                    weekEvents.map(day => (
                        <div key={day.offSeasonDay} className="mt-2">
                            <h5 className="font-semibold text-gray-800 dark:text-gray-300">Day {day.offSeasonDay}</h5>
                            {day.shows.map((show, index) => {
                                const showIdentifier = `${week}-${day.offSeasonDay}-details-${index}`;
                                return (
                                    <div key={showIdentifier} className="ml-4 p-2 text-sm">
                                        <p className="font-bold">{show.eventName} <em className="font-normal text-gray-500">({show.location})</em></p>
                                        <button onClick={() => toggleShowDetails(showIdentifier, week, show)} className="text-xs text-blue-500 hover:underline">
                                            {expandedShow === showIdentifier ? 'Hide Details' : 'Who\'s Going?'}
                                        </button>
                                        {expandedShow === showIdentifier && (
                                            <div className="mt-1 pl-4 text-xs">
                                                <ul className="list-disc pl-5">
                                                    {registrations[showIdentifier] ? (
                                                        registrations[showIdentifier].length > 0 ? (
                                                            registrations[showIdentifier].map((name, i) => <li key={i}>{name}</li>)
                                                        ) : (<li>No registrations yet.</li>)
                                                    ) : (<li>Loading...</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))
                ) : <p className="text-gray-500">No shows scheduled for this week.</p>}
                
                { !isPastWeek && (
                    <div className="flex justify-end items-center mt-4 space-x-4">
                        <p className="text-sm font-semibold">Selections for Week {week}: {userSelectionsForWeek.length} / 4</p>
                        <button 
                            onClick={() => handleSaveWeek(week)}
                            disabled={isLoading[week]}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                            {isLoading[week] ? 'Saving...' : `Save Week ${week} Selections`}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const weeks = Array.from({ length: 7 }, (_, i) => i + 1);

    return (
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Select Your Shows</h2>
            <div className="flex justify-center border-b border-gray-300 dark:border-gray-600 mb-4">
                {weeks.map(week => (
                    <button
                        key={week}
                        onClick={() => setActiveWeek(week)}
                        className={`py-2 px-4 text-lg font-bold transition-colors ${activeWeek === week ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                    >
                        Week {week}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => renderDay((activeWeek - 1) * 7 + 1 + i, activeWeek))}
            </div>

            {renderWeekDetails(activeWeek)}

            {message && <p className="mt-4 text-center text-sm font-semibold text-red-600">{message}</p>}
        </div>
    );
};

export default ShowSelection;