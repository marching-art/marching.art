import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState({});
    const [message, setMessage] = useState('');
    
    const initialWeek = Math.ceil(currentOffSeasonDay / 7);
    const [activeWeek, setActiveWeek] = useState(initialWeek > 0 ? initialWeek : 1);

    const [registrations, setRegistrations] = useState({});
    const [expandedShow, setExpandedShow] = useState(null);

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
        const isPastDay = day < currentOffSeasonDay;

        return (
            <div key={day} className={`p-2 border-theme border-accent dark:border-accent-dark rounded-theme ${isPastDay ? 'bg-surface/50 dark:bg-surface-dark/50 opacity-60' : 'bg-background dark:bg-background-dark'}`}>
                <div className="font-bold text-center text-text-primary dark:text-text-primary-dark">{day}</div>
                <div className="mt-1 space-y-1">
                    {(dayEvent?.shows || []).map((show, index) => {
                        const showIdentifier = `${week}-${day}-${index}`;
                        const isSelected = (selectedShows[`week${week}`] || []).some(s => s.eventName === show.eventName);
                        const isSelectionLimitReached = (selectedShows[`week${week}`] || []).length >= 4;

                        return (
                            <div key={showIdentifier} className="text-xs p-1.5 rounded-theme bg-surface dark:bg-surface-dark">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={showIdentifier}
                                        checked={isSelected}
                                        disabled={show.mandatory || isPastDay || (isSelectionLimitReached && !isSelected)}
                                        onChange={(e) => handleSelectShow(week, show, e.target.checked)}
                                        className="h-4 w-4 rounded text-primary focus:ring-primary border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark"
                                    />
                                    <label htmlFor={showIdentifier} className="ml-1.5 font-semibold text-text-primary dark:text-text-primary-dark truncate cursor-pointer">{show.eventName.replace(/DCI/g, 'marching.art')}</label>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeekDetails = (week) => {
        const startDay = (week - 1) * 7 + 1;
        const endDay = week * 7;
        const weekEvents = seasonEvents.filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay);
        const userSelectionsForWeek = selectedShows[`week${week}`] || [];
        const currentWeekNumber = Math.ceil(currentOffSeasonDay / 7);
        const isPastWeek = week < currentWeekNumber;

        return (
            <div className="mt-4 p-4 border-t-theme border-accent dark:border-accent-dark">
                <h4 className="text-lg font-bold text-primary dark:text-primary-dark">Week {week} Show Details</h4>
                {weekEvents.length > 0 ? (
                    weekEvents.map(day => (
                        <div key={day.offSeasonDay} className="mt-2">
                            <h5 className="font-semibold text-text-primary dark:text-text-primary-dark">Day {day.offSeasonDay}</h5>
                            {day.shows.map((show, index) => {
                                const showIdentifier = `${week}-${day.offSeasonDay}-details-${index}`;
                                return (
                                    <div key={showIdentifier} className="ml-4 p-2 text-sm">
                                        <p className="font-bold text-text-primary dark:text-text-primary-dark">{show.eventName.replace(/DCI/g, 'marching.art')} <em className="font-normal text-text-secondary dark:text-text-secondary-dark">({show.location})</em></p>
                                        <button onClick={() => toggleShowDetails(showIdentifier, week, show)} className="text-xs text-primary dark:text-primary-dark hover:underline">
                                            {expandedShow === showIdentifier ? 'Hide Details' : 'Who\'s Going?'}
                                        </button>
                                        {expandedShow === showIdentifier && (
                                            <div className="mt-1 pl-4 text-xs text-text-secondary dark:text-text-secondary-dark">
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
                ) : <p className="text-text-secondary dark:text-text-secondary-dark">No shows scheduled for this week.</p>}
                
                { !isPastWeek && (
                    <div className="flex justify-end items-center mt-4 space-x-4">
                        <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Selections for Week {week}: {userSelectionsForWeek.length} / 4</p>
                        <button 
                            onClick={() => handleSaveWeek(week)}
                            disabled={isLoading[week]}
                            className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">
                            {isLoading[week] ? 'Saving...' : `Save Week ${week} Selections`}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const weeks = Array.from({ length: 7 }, (_, i) => i + 1);

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Select Your Shows</h2>
            <div className="flex justify-center border-b-theme border-accent dark:border-accent-dark mb-4">
                {weeks.map(week => (
                    <button
                        key={week}
                        onClick={() => setActiveWeek(week)}
                        className={`py-2 px-4 text-sm md:text-base font-bold transition-colors ${activeWeek === week ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}
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