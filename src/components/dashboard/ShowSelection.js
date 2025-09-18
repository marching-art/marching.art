import React, { useState, useEffect, useMemo } from 'react';
import { getShowRegistrations, selectUserShows } from '../../utils/api';
import Modal from '../ui/Modal';

const ShowSelection = ({ seasonMode, seasonEvents, corpsProfile, corpsClass, currentDay, seasonStartDate }) => {
    const [selectedShows, setSelectedShows] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [registrantsModalShow, setRegistrantsModalShow] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [isRegistrantsLoading, setIsRegistrantsLoading] = useState(false);
    
    const WEEKS_IN_SEASON = seasonMode === 'live' ? 10 : 7;
    const currentWeek = Math.ceil(currentDay / 7);
    const initialWeek = useMemo(() => (currentWeek > 0 ? currentWeek : 1), [currentDay]);
    const [activeWeek, setActiveWeek] = useState(initialWeek);

    useEffect(() => {
        setSelectedShows(corpsProfile?.selectedShows || {});
        const week = Math.ceil(currentDay / 7);
        setActiveWeek(week > 0 && week <= WEEKS_IN_SEASON ? week : 1);
    }, [corpsProfile, currentDay, WEEKS_IN_SEASON]);

    useEffect(() => {
        if (!registrantsModalShow || seasonMode !== 'off') return;
        const fetchRegistrants = async () => {
            setIsRegistrantsLoading(true);
            try {
                const result = await getShowRegistrations({ 
                    week: activeWeek, 
                    eventName: registrantsModalShow.eventName, 
                    date: registrantsModalShow.date 
                });
                setRegistrants(result.data.registrations || []);
            } catch (error) {
                console.error("Error fetching registrants:", error);
                setRegistrants([]);
            }
            setIsRegistrantsLoading(false);
        };
        fetchRegistrants();
    }, [registrantsModalShow, activeWeek, seasonMode]);

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
        try {
            const result = await selectUserShows({ 
                week, 
                shows: selectedShows[`week${week}`] || [], 
                corpsClass: corpsClass
            });
            setMessage(result.data.message);
        } catch (error) {
            setMessage(error.message);
        }
        setIsLoading(false);
    };
    
    const getCalendarDateForDay = (day) => {
        if (!seasonStartDate) return null;
        const calendarDate = new Date(seasonStartDate.getTime());
        calendarDate.setDate(calendarDate.getDate() + day - 1);
        return calendarDate;
    };

    const showsForActiveWeek = useMemo(() => {
        if (!seasonEvents) return [];
        if (seasonMode === 'live') {
            return (seasonEvents.filter(e => e.week === activeWeek)[0]?.shows || []).sort((a,b) => a.dayIndex - b.dayIndex);
        } else { // off-season
            const startDay = (activeWeek - 1) * 7 + 1;
            const endDay = activeWeek * 7;
            return seasonEvents
                .filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay)
                .flatMap(day => day.shows.map(show => ({ ...show, day: day.offSeasonDay })))
                .sort((a, b) => a.day - b.day);
        }
    }, [activeWeek, seasonEvents, seasonMode]);
    
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
    
    const weeks = Array.from({ length: WEEKS_IN_SEASON }, (_, i) => i + 1);
    const userSelectionsForWeek = selectedShows[`week${activeWeek}`] || [];
    const isPastWeek = activeWeek < currentWeek;

    return (
        <div className="mt-8">
            <Modal isOpen={!!registrantsModalShow} onClose={() => setRegistrantsModalShow(null)} title={`Attendees for ${registrantsModalShow?.eventName.replace(/DCI/g, 'marching.art')}`}>
                {isRegistrantsLoading ? <p>Loading...</p> : registrants.length > 0 ? (
                    <ul className="space-y-2 list-disc list-inside">
                        {registrants.map((reg, i) => <li key={i}>{`${reg.corpsName} (${reg.username})`}</li>)}
                    </ul>
                ) : <p>No corps have registered for this show yet.</p>}
            </Modal>
        
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark">Select Your Shows</h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 sm:mt-0">Select up to 4 shows per week.</p>
            </div>
        
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {weeks.map(week => (
                    <button key={week} onClick={() => setActiveWeek(week)} className={`py-2 px-3 sm:px-4 whitespace-nowrap text-sm md:text-base font-bold transition-colors ${activeWeek === week ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}>Week {week}</button>
                ))}
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {showsForActiveWeek.length > 0 ? showsForActiveWeek.map((show, index) => {
                    const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName);
                    const isSelectionLimitReached = userSelectionsForWeek.length >= 4;
                    const isPastShow = (seasonMode === 'live' ? show.dayIndex + 1 : show.day) < currentDay;

                    return (
                        <div key={`${activeWeek}-${index}`} className={`p-3 rounded-theme flex items-center gap-4 transition-opacity ${isPastShow ? 'bg-surface dark:bg-surface-dark opacity-60' : 'bg-background dark:bg-background-dark'}`}>
                            <input type="checkbox" id={`${activeWeek}-${index}`} checked={isSelected} disabled={isPastShow || (isSelectionLimitReached && !isSelected)} onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)} className="h-5 w-5 rounded text-primary focus:ring-primary border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark flex-shrink-0" />
                            <div className="flex-grow">
                                <label htmlFor={`${activeWeek}-${index}`} className={`font-semibold text-text-primary dark:text-text-primary-dark ${!isPastShow && 'cursor-pointer'}`}>{show.eventName.replace(/DCI/g, 'marching.art')}</label>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{show.location} - {getCalendarDateForDay(seasonMode === 'live' ? show.dayIndex + 1 : show.day)?.toLocaleDateString()}</p>
                            </div>
                            {seasonMode === 'off' && <button onClick={() => setRegistrantsModalShow(show)} className="text-sm text-primary dark:text-primary-dark hover:underline flex-shrink-0">Who's Going?</button>}
                        </div>
                    );
                }) : <p className="text-center text-text-secondary dark:text-text-secondary-dark py-4">No shows scheduled for this week.</p>}
            </div>

            {!isPastWeek && (
                <div className="flex flex-col sm:flex-row justify-end items-center mt-4 pt-4 border-t-theme border-accent dark:border-accent-dark space-y-4 sm:space-y-0 sm:space-x-4">
                    {message && <p className="text-sm font-semibold text-red-600">{message}</p>}
                    <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Selections for Week {activeWeek}: {userSelectionsForWeek.length} / 4</p>
                    <button onClick={() => handleSaveWeek(activeWeek)} disabled={isLoading} className="w-full sm:w-auto bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">{isLoading ? 'Saving...' : `Save Week ${activeWeek} Selections`}</button>
                </div>
            )}
        </div>
    );
};

export default ShowSelection;