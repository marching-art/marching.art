import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    const initialWeek = Math.ceil(currentOffSeasonDay / 7);
    const [activeWeek, setActiveWeek] = useState(initialWeek > 0 ? initialWeek : 1);

    useEffect(() => {
        setSelectedShows(profile.selectedShows || {});
        const currentWeek = Math.ceil(currentOffSeasonDay / 7);
        setActiveWeek(currentWeek > 0 ? currentWeek : 1);
    }, [profile, currentOffSeasonDay]);

    const handleSelectShow = (week, show, isSelected) => {
        const weekKey = `week${week}`;
        const currentSelections = selectedShows[weekKey] || [];
        let newSelections;

        if (isSelected) {
            newSelections = [...currentSelections, { eventName: show.eventName, date: show.date, location: show.location, offSeasonDay: show.offSeasonDay }];
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
    
    const weeks = Array.from({ length: 7 }, (_, i) => i + 1);
    
    const startDay = (activeWeek - 1) * 7 + 1;
    const endDay = activeWeek * 7;
    const weekEvents = seasonEvents
        .filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay)
        .flatMap(day => day.shows.map(show => ({...show, offSeasonDay: day.offSeasonDay})))
        .sort((a,b) => a.offSeasonDay - b.offSeasonDay);

    const userSelectionsForWeek = selectedShows[`week${activeWeek}`] || [];
    const currentWeekNumber = Math.ceil(currentOffSeasonDay / 7);
    const isPastWeek = activeWeek < currentWeekNumber;

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark">Select Your Shows</h2>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 sm:mt-0">Select up to 4 shows per week.</p>
            </div>
            
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {weeks.map(week => (
                    <button
                        key={week}
                        onClick={() => setActiveWeek(week)}
                        className={`py-2 px-3 sm:px-4 whitespace-nowrap text-sm md:text-base font-bold transition-colors ${activeWeek === week ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}
                    >
                        Week {week}
                    </button>
                ))}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {weekEvents.length > 0 ? weekEvents.map((show, index) => {
                    const showIdentifier = `week${activeWeek}-show${index}`;
                    const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName);
                    const isSelectionLimitReached = userSelectionsForWeek.length >= 4;
                    const isPastShow = show.offSeasonDay < currentOffSeasonDay;

                    return (
                        <div key={showIdentifier} className={`p-3 rounded-theme flex items-center gap-4 transition-opacity ${isPastShow ? 'bg-surface dark:bg-surface-dark opacity-60' : 'bg-background dark:bg-background-dark'}`}>
                             <input
                                type="checkbox"
                                id={showIdentifier}
                                checked={isSelected}
                                disabled={isPastShow || (isSelectionLimitReached && !isSelected)}
                                onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)}
                                className="h-5 w-5 rounded text-primary focus:ring-primary border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark flex-shrink-0"
                            />
                            <div>
                                <label htmlFor={showIdentifier} className={`font-semibold text-text-primary dark:text-text-primary-dark ${!isPastShow && 'cursor-pointer'}`}>
                                    {show.eventName.replace(/DCI/g, 'marching.art')}
                                </label>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{show.location} - <span className="font-medium">Day {show.offSeasonDay}</span></p>
                            </div>
                        </div>
                    )
                }) : <p className="text-center text-text-secondary dark:text-text-secondary-dark py-4">No shows scheduled for this week.</p>}
            </div>

            { !isPastWeek && (
                <div className="flex flex-col sm:flex-row justify-end items-center mt-4 pt-4 border-t-theme border-accent dark:border-accent-dark space-y-4 sm:space-y-0 sm:space-x-4">
                    {message && <p className="text-sm font-semibold text-red-600">{message}</p>}
                    <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        Selections for Week {activeWeek}: {userSelectionsForWeek.length} / 4
                    </p>
                    <button 
                        onClick={() => handleSaveWeek(activeWeek)}
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">
                        {isLoading ? 'Saving...' : `Save Week ${activeWeek} Selections`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShowSelection;