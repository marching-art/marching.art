import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const LiveShowSelection = ({ seasonEvents, profile, seasonStartDate }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState({});
    const [message, setMessage] = useState('');

    // Group all events by their week number
    const showsByWeek = seasonEvents.reduce((acc, event) => {
        const week = event.week;
        if (!acc[week]) {
            acc[week] = [];
        }
        // Since one event can have multiple shows, add them all
        event.shows.forEach(show => {
            acc[week].push({ ...show, dayIndex: event.dayIndex });
        });
        // Sort shows within the week by day
        acc[week].sort((a, b) => a.dayIndex - b.dayIndex);
        return acc;
    }, {});
    
    // Calculate the current day and week of the live season
    let currentDay = 0;
    if (seasonStartDate) {
        const diff = new Date().getTime() - seasonStartDate.getTime();
        currentDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }
    const currentWeek = Math.ceil(currentDay / 7);

    const [activeWeek, setActiveWeek] = useState(currentWeek > 0 && currentWeek <= 10 ? currentWeek : 1);

    useEffect(() => {
        setSelectedShows(profile.selectedShows || {});
    }, [profile]);

    const handleSelectShow = (week, show, isSelected) => {
        const weekKey = `week${week}`;
        const currentSelections = selectedShows[weekKey] || [];
        let newSelections;

        if (isSelected) {
            newSelections = [...currentSelections, { eventName: show.eventName, date: show.date, location: show.location }];
        } else {
            newSelections = currentSelections.filter(s => s.eventName !== show.eventName);
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
            // Clear message after a few seconds
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving show selections:", error);
            setMessage(error.message);
        }
        setIsLoading(prev => ({ ...prev, [week]: false }));
    };

    const weeks = Array.from({ length: 10 }, (_, i) => i + 1);

    return (
        <div className="lg:col-span-2 bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
            <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">Live Season Schedule</h2>
            <div className="flex flex-wrap border-b border-brand-accent dark:border-brand-accent-dark mb-4">
                {weeks.map(week => (
                    <button
                        key={week}
                        onClick={() => setActiveWeek(week)}
                        className={`py-2 px-4 font-semibold transition-colors ${activeWeek === week ? 'border-b-2 border-brand-secondary text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-primary dark:hover:text-brand-secondary'}`}
                    >
                        Week {week}
                    </button>
                ))}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {(showsByWeek[activeWeek] || []).map((show, index) => {
                    const weekKey = `week${activeWeek}`;
                    const showIdentifier = `${weekKey}-${index}`;
                    const isSelected = (selectedShows[weekKey] || []).some(s => s.eventName === show.eventName);
                    const isSelectionLimitReached = (selectedShows[weekKey] || []).length >= 4;
                    const isPastShow = show.dayIndex < currentDay;

                    return (
                        <div key={showIdentifier} className={`p-3 rounded-md flex items-center gap-4 ${isPastShow ? 'bg-gray-200 dark:bg-gray-800 opacity-70' : 'bg-brand-background dark:bg-brand-background-dark'}`}>
                            <input
                                type="checkbox"
                                id={showIdentifier}
                                checked={isSelected}
                                disabled={isPastShow || (isSelectionLimitReached && !isSelected)}
                                onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-secondary disabled:opacity-50"
                            />
                            <div>
                                <label htmlFor={showIdentifier} className="font-semibold text-brand-text-primary dark:text-brand-text-primary-dark cursor-pointer">{show.eventName.replace(/DCI/g, 'marching.art')}</label>
                                <p className="text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark">{show.location}</p>
                            </div>
                        </div>
                    );
                })}
                 {(!showsByWeek[activeWeek] || showsByWeek[activeWeek].length === 0) && (
                    <p className="text-center text-brand-text-secondary dark:text-brand-text-secondary-dark py-4">No shows scheduled for this week.</p>
                )}
            </div>
            
            {activeWeek >= currentWeek && (
                 <div className="flex justify-end items-center mt-4 pt-4 border-t-2 border-brand-accent dark:border-brand-accent-dark space-x-4">
                    <p className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-primary-dark">
                        Selections for Week {activeWeek}: {(selectedShows[`week${activeWeek}`] || []).length} / 4
                    </p>
                    <button 
                        onClick={() => handleSaveWeek(activeWeek)}
                        disabled={isLoading[activeWeek]}
                        className="bg-brand-primary hover:bg-blue-800 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                        {isLoading[activeWeek] ? 'Saving...' : `Save Week ${activeWeek} Selections`}
                    </button>
                </div>
            )}
             {message && <p className="mt-4 text-center text-sm font-semibold text-green-600 dark:text-green-400">{message}</p>}
        </div>
    );
};

export default LiveShowSelection;
