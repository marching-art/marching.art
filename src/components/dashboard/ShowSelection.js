import React, { useState, useEffect, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon'; // Assuming a generic Icon component

const ShowSelection = ({ seasonMode, seasonEvents, corpsProfile, corpsClass, currentDay, seasonStartDate }) => {
    const [selectedShows, setSelectedShows] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [registrantsModalShow, setRegistrantsModalShow] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [isRegistrantsLoading, setIsRegistrantsLoading] = useState(false);
    
    const WEEKS_IN_SEASON = seasonMode === 'live' ? 10 : 7;
    const currentWeek = Math.ceil(currentDay / 7);
    const initialWeek = useMemo(() => (currentWeek > 0 ? currentWeek : 1), [currentDay]);
    const [activeWeek, setActiveWeek] = useState(initialWeek);

    const functions = getFunctions();
    const getShowRegistrations = httpsCallable(functions, 'getShowRegistrations');
    const registerForShows = httpsCallable(functions, 'registerForShows');

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
                    eventName: registrantsModalShow.eventName, 
                    date: registrantsModalShow.date 
                });
                setRegistrants(result.data.registrations || []);
            } catch (error) {
                console.error("Error fetching registrants:", error);
                toast.error("Could not load registrant list.");
                setRegistrants([]);
            }
            setIsRegistrantsLoading(false);
        };
        fetchRegistrants();
    }, [registrantsModalShow, activeWeek, seasonMode, getShowRegistrations]);

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
            toast.error("You can select a maximum of 4 shows per week.");
            return;
        }

        setSelectedShows(prev => ({ ...prev, [weekKey]: newSelections }));
    };

    const handleSaveWeek = async (week) => {
        setIsLoading(true);
        const toastId = toast.loading('Saving selections...');
        try {
            const result = await registerForShows({ 
                week, 
                shows: selectedShows[`week${week}`] || [], 
                corpsClass: corpsClass
            });
            toast.success(result.data.message, { id: toastId });
        } catch (error) {
            toast.error(error.message, { id: toastId });
        }
        setIsLoading(false);
    };
    
    const getCalendarDateForDay = (day) => {
        if (!seasonStartDate) return null;
        const calendarDate = new Date(seasonStartDate.getTime());
        calendarDate.setDate(calendarDate.getDate() + day - 1);
        return calendarDate;
    };

    const showsForActiveWeekGrouped = useMemo(() => {
        if (!seasonEvents) return {};
        
        let showsForWeek = [];
        if (seasonMode === 'live') {
            showsForWeek = (seasonEvents.find(e => e.week === activeWeek)?.shows || []);
        } else { // off-season
            const startDay = (activeWeek - 1) * 7 + 1;
            const endDay = activeWeek * 7;
            showsForWeek = seasonEvents
                .filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay)
                .flatMap(day => day.shows.map(show => ({ ...show, day: day.offSeasonDay })));
        }

        const grouped = {};
        showsForWeek.forEach(show => {
            const day = seasonMode === 'live' ? (seasonEvents.find(e => e.shows.includes(show))?.dayIndex + 1) : show.day;
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(show);
        });

        Object.keys(grouped).forEach(day => {
            grouped[day].sort((a, b) => a.eventName.localeCompare(b.eventName));
        });

        return grouped;
    }, [activeWeek, seasonEvents, seasonMode]);
    
    if (!corpsProfile) {
        return (
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">Select Your Shows</h3>
                <p className="mt-2 text-text-secondary dark:text-text-secondary-dark">
                    Once you create and save this corps, you can select its weekly show schedule here.
                </p>
            </div>
        );
    }
    
    const weeks = Array.from({ length: WEEKS_IN_SEASON }, (_, i) => i + 1);
    const userSelectionsForWeek = selectedShows[`week${activeWeek}`] || [];
    const isPastWeek = activeWeek < currentWeek;
    const isChampionshipWeek = (seasonMode === 'off' && activeWeek === 7) || (seasonMode === 'live' && activeWeek === 10);

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <Modal isOpen={!!registrantsModalShow} onClose={() => setRegistrantsModalShow(null)} title={`Attendees for ${registrantsModalShow?.eventName.replace(/DCI/g, 'marching.art')}`}>
                {isRegistrantsLoading ? <p>Loading...</p> : registrants.length > 0 ? (
                    <ul className="space-y-2 list-disc list-inside text-text-primary dark:text-text-primary-dark">
                        {registrants.map((reg, i) => <li key={i}>{`${reg.corpsName} (${reg.username})`}</li>)}
                    </ul>
                ) : <p className="text-text-secondary dark:text-text-secondary-dark">No corps have registered for this show yet.</p>}
            </Modal>
        
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark">Show Selection</h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 sm:mt-0">
                    {isChampionshipWeek ? 'Championship events are automatic' : `Week ${activeWeek} Selections: ${userSelectionsForWeek.length} / 4`}
                </p>
            </div>
        
            <div className="flex border-b border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {weeks.map(week => (
                    <button key={week} onClick={() => setActiveWeek(week)} className={`py-2 px-3 sm:px-4 whitespace-nowrap text-sm md:text-base font-bold transition-colors ${activeWeek === week ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}>
                        Week {week}
                        {((seasonMode === 'off' && week === 7) || (seasonMode === 'live' && week === 10)) && ' (Championships)'}
                    </button>
                ))}
            </div>

            {isChampionshipWeek && (
                <div className="p-4 bg-primary/10 rounded-theme">
                    <h4 className="font-bold text-primary dark:text-primary-dark">Championship Week</h4>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                        All corps are automatically enrolled in championship events. No show selection is needed.
                    </p>
                </div>
            )}

            {!isChampionshipWeek && (
                <div className="space-y-6">
                    {Object.keys(showsForActiveWeekGrouped).length > 0 ? (
                        Object.keys(showsForActiveWeekGrouped).sort((a, b) => parseInt(a) - parseInt(b)).map(day => {
                                const dayNumber = parseInt(day);
                                const showsForDay = showsForActiveWeekGrouped[day];
                                const calendarDate = getCalendarDateForDay(dayNumber);
                                const isPastDay = dayNumber < currentDay;

                                return (
                                    <div key={day} className="bg-background dark:bg-background-dark/50 p-4 rounded-theme">
                                        <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                            {calendarDate ? calendarDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : `Day ${day}`}
                                            {isPastDay && <span className="ml-2 text-xs bg-accent dark:bg-accent-dark px-2 py-1 rounded-theme text-text-secondary dark:text-text-secondary-dark">Past</span>}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {showsForDay.map((show, index) => {
                                                const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName);
                                                const isSelectionLimitReached = userSelectionsForWeek.length >= 4;
                                                return (
                                                    <div key={`${day}-${index}`} className={`p-3 rounded-theme flex items-start gap-3 transition-opacity ${isPastDay ? 'opacity-60' : ''}`}>
                                                        <input type="checkbox" id={`${day}-${index}`} checked={isSelected} disabled={isPastDay || (isSelectionLimitReached && !isSelected)} onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)} className="h-5 w-5 rounded mt-0.5 text-primary focus:ring-primary border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark flex-shrink-0 cursor-pointer disabled:cursor-not-allowed" />
                                                        <div className="flex-grow">
                                                            <label htmlFor={`${day}-${index}`} className={`font-semibold text-text-primary dark:text-text-primary-dark ${!isPastDay && 'cursor-pointer'}`}>{show.eventName.replace(/DCI/g, 'marching.art')}</label>
                                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{show.location}</p>
                                                        </div>
                                                        {seasonMode === 'off' && !isPastDay && (
                                                            <button onClick={() => setRegistrantsModalShow(show)} className="text-xs text-primary dark:text-primary-dark hover:underline flex-shrink-0">Who's Going?</button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                    ) : <p className="text-center text-text-secondary dark:text-text-secondary-dark py-8">No shows scheduled for this week.</p>}
                </div>
            )}

            {!isPastWeek && !isChampionshipWeek && (
                <div className="flex justify-end items-center mt-6 pt-4 border-t border-accent dark:border-accent-dark">
                    <button onClick={() => handleSaveWeek(activeWeek)} disabled={isLoading} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-5 rounded-theme disabled:opacity-50 flex items-center gap-2">
                        <Icon name="save" className="h-4 w-4" />
                        {isLoading ? 'Saving...' : `Save Week ${activeWeek} Selections`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShowSelection;