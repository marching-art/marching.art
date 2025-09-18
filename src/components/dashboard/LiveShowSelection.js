import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';

const LiveShowSelection = ({ seasonEvents, corpsProfile, corpsClass, seasonStartDate }) => {
    const [selectedShows, setSelectedShows] = useState({});
    const [isLoading, setIsLoading] = useState({});
    const [message, setMessage] = useState('');

    const showsByWeek = seasonEvents.reduce((acc, event) => {
        const week = event.week;
        if (!acc[week]) {
            acc[week] = [];
        }
        event.shows.forEach(show => {
            acc[week].push({ ...show, dayIndex: event.dayIndex });
        });
        acc[week].sort((a, b) => a.dayIndex - b.dayIndex);
        return acc;
    }, {});
    
    let currentDay = 0;
    if (seasonStartDate) {
        const diff = new Date().getTime() - seasonStartDate.getTime();
        currentDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }
    const currentWeek = Math.ceil(currentDay / 7);

    const [activeWeek, setActiveWeek] = useState(currentWeek > 0 && currentWeek <= 10 ? currentWeek : 1);

    useEffect(() => {
        setSelectedShows(corpsProfile?.selectedShows || {});
    }, [corpsProfile]);


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
            const result = await selectUserShows({ 
                week, 
                shows: showsToSave, 
                corpsClass: corpsClass
            });
            setMessage(result.data.message);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving show selections:", error);
            setMessage(error.message);
        }
        setIsLoading(prev => ({ ...prev, [week]: false }));
    };

    if (!corpsProfile) {
        return (
            <div className="mt-8 text-center bg-background dark:bg-background-dark p-6 rounded-theme">
                <h3 className="text-xl font-bold text-primary dark:text-primary-dark">Select Your Shows</h3>
                <p className="mt-2 text-text-secondary dark:text-text-secondary-dark">
                    Once you create and save this corps, you can select its weekly show schedule here.
                </p>
            </div>
        );
    }
    
    const weeks = Array.from({ length: 10 }, (_, i) => i + 1);

    return (
        <div className="mt-8">
            <h3 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark mb-4">Live Season Schedule</h3>
            
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {weeks.map(week => (
                    <button
                        key={week}
                        onClick={() => setActiveWeek(week)}
                        className={`py-2 px-3 sm:px-4 whitespace-nowrap font-semibold transition-colors ${activeWeek === week ? 'border-b-2 border-primary text-primary dark:border-primary-dark dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}
                    >
                        Week {week}
                    </button>
                ))}
            </div>

            <div className="space-y-3 max-h-64 sm:max-h-96 overflow-y-auto pr-2">
                {(showsByWeek[activeWeek] || []).map((show, index) => {
                    const weekKey = `week${activeWeek}`;
                    const showIdentifier = `${weekKey}-${index}`;
                    const isSelected = (selectedShows[weekKey] || []).some(s => s.eventName === show.eventName);
                    const isSelectionLimitReached = (selectedShows[weekKey] || []).length >= 4;
                    const isPastShow = show.dayIndex < currentDay;

                    return (
                        <div key={showIdentifier} className={`p-3 rounded-theme flex items-center gap-4 ${isPastShow ? 'bg-surface dark:bg-surface-dark opacity-70' : 'bg-background dark:bg-background-dark'}`}>
                            <input
                                type="checkbox"
                                id={showIdentifier}
                                checked={isSelected}
                                disabled={isPastShow || (isSelectionLimitReached && !isSelected)}
                                onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)}
                                className="h-5 w-5 rounded text-primary focus:ring-primary border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark"
                            />
                            <div>
                                <label htmlFor={showIdentifier} className="font-semibold text-text-primary dark:text-text-primary-dark cursor-pointer">{show.eventName.replace(/DCI/g, 'marching.art')}</label>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{show.location}</p>
                            </div>
                        </div>
                    );
                })}
                 {(!showsByWeek[activeWeek] || showsByWeek[activeWeek].length === 0) && (
                    <p className="text-center text-text-secondary dark:text-text-secondary-dark py-4">No shows scheduled for this week.</p>
                )}
            </div>
            
            {activeWeek >= currentWeek && (
                 <div className="flex flex-col sm:flex-row justify-end items-center mt-4 pt-4 border-t-theme border-accent dark:border-accent-dark space-y-4 sm:space-y-0 sm:space-x-4">
                    <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        Selections for Week {activeWeek}: {(selectedShows[`week${activeWeek}`] || []).length} / 4
                    </p>
                    <button 
                        onClick={() => handleSaveWeek(activeWeek)}
                        disabled={isLoading[activeWeek]}
                        className="w-full sm:w-auto bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">
                        {isLoading[activeWeek] ? 'Saving...' : `Save Week ${activeWeek} Selections`}
                    </button>
                </div>
            )}
             {message && <p className="mt-4 text-center text-sm font-semibold text-green-600 dark:text-green-400">{message}</p>}
        </div>
    );
};

export default LiveShowSelection;