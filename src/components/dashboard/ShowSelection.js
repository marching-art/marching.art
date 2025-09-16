import React, { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import Modal from '../ui/Modal'; 

const ShowSelection = ({ seasonEvents, profile, currentOffSeasonDay, seasonStartDate }) => {
    const [selectedShows, setSelectedShows] = useState(profile.selectedShows || {});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [registrantsModalShow, setRegistrantsModalShow] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [isRegistrantsLoading, setIsRegistrantsLoading] = useState(false);
    
    const initialWeek = Math.ceil(currentOffSeasonDay / 7);
    const [activeWeek, setActiveWeek] = useState(initialWeek > 0 ? initialWeek : 1);

    useEffect(() => {
        setSelectedShows(profile.selectedShows || {});
        const currentWeek = Math.ceil(currentOffSeasonDay / 7);
        setActiveWeek(currentWeek > 0 ? currentWeek : 1);
    }, [profile, currentOffSeasonDay]);

    useEffect(() => {
        if (!registrantsModalShow) return;
        const fetchRegistrants = async () => {
            setIsRegistrantsLoading(true);
            try {
                const getShowRegistrations = httpsCallable(functions, 'getShowRegistrations');
                const result = await getShowRegistrations({ 
                    week: activeWeek, 
                    eventName: registrantsModalShow.eventName, 
                    date: registrantsModalShow.date 
                });
                setRegistrants(result.data.corpsNames);
            } catch (error) {
                console.error("Error fetching registrants:", error);
                setRegistrants(["Error loading registrants."]);
            }
            setIsRegistrantsLoading(false);
        };
        fetchRegistrants();
    }, [registrantsModalShow, activeWeek]);

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

    const getCalendarDateForDay = (offSeasonDay) => {
        if (!seasonStartDate) return null;
        const calendarDate = new Date(seasonStartDate.getTime());
        // REVERTED: Use the mathematically correct offset. The cutoff logic is handled elsewhere.
        calendarDate.setDate(calendarDate.getDate() + offSeasonDay - 1);
        return calendarDate;
    };

    const weeks = Array.from({ length: 7 }, (_, i) => i + 1);
    
    const showsGroupedByDate = useMemo(() => {
        const startDay = (activeWeek - 1) * 7 + 1;
        const endDay = activeWeek * 7;
        const weekEvents = seasonEvents
            .filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay)
            .flatMap(day => day.shows.map(show => ({ ...show, offSeasonDay: day.offSeasonDay })))
            .sort((a, b) => a.offSeasonDay - b.offSeasonDay);

        return weekEvents.reduce((acc, show) => {
            const date = getCalendarDateForDay(show.offSeasonDay);
            if (!date) return acc;
            const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            if (!acc[formattedDate]) acc[formattedDate] = [];
            acc[formattedDate].push(show);
            return acc;
        }, {});
    }, [activeWeek, seasonEvents, seasonStartDate]);

    const userSelectionsForWeek = selectedShows[`week${activeWeek}`] || [];
    const currentWeekNumber = Math.ceil(currentOffSeasonDay / 7);
    const isPastWeek = activeWeek < currentWeekNumber;

    return (
        <div>
            <Modal isOpen={!!registrantsModalShow} onClose={() => setRegistrantsModalShow(null)} title={`Attendees for ${registrantsModalShow?.eventName.replace(/DCI/g, 'marching.art')}`}>
                {isRegistrantsLoading ? ( <p>Loading...</p> ) : (
                    registrants.length > 0 ? (
                        <ul className="space-y-2 list-disc list-inside">
                            {registrants.map((name, i) => <li key={i}>{name}</li>)}
                        </ul>
                    ) : ( <p>No corps have registered for this show yet.</p> )
                )}
            </Modal>

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

            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {Object.keys(showsGroupedByDate).length > 0 ? Object.entries(showsGroupedByDate).map(([date, shows]) => (
                    <div key={date}>
                        <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark border-b border-accent dark:border-accent-dark pb-1 mb-2">{date}</h3>
                        <div className="space-y-3">
                            {shows.map((show, index) => {
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
                                        <div className="flex-grow">
                                            <label htmlFor={showIdentifier} className={`font-semibold text-text-primary dark:text-text-primary-dark ${!isPastShow && 'cursor-pointer'}`}>
                                                {show.eventName.replace(/DCI/g, 'marching.art')}
                                            </label>
                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{show.location}</p>
                                        </div>
                                        <button onClick={() => setRegistrantsModalShow(show)} className="text-sm text-primary dark:text-primary-dark hover:underline flex-shrink-0">
                                            Who's Going?
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )) : <p className="text-center text-text-secondary dark:text-text-secondary-dark py-4">No shows scheduled for this week.</p>}
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