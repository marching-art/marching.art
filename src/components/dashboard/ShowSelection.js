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
    
    // Fixed date calculation - add days directly, don't subtract 1
    const getCalendarDateForDay = (day) => {
        if (!seasonStartDate) return null;
        const calendarDate = new Date(seasonStartDate.getTime());
        calendarDate.setDate(calendarDate.getDate() + day - 1); // This is correct: day 1 = start date
        return calendarDate;
    };

    // Group shows by day for better organization
    const showsForActiveWeekGrouped = useMemo(() => {
        if (!seasonEvents) return {};
        
        let showsForWeek = [];
        if (seasonMode === 'live') {
            showsForWeek = (seasonEvents.filter(e => e.week === activeWeek)[0]?.shows || []);
        } else { // off-season
            const startDay = (activeWeek - 1) * 7 + 1;
            const endDay = activeWeek * 7;
            showsForWeek = seasonEvents
                .filter(e => e.offSeasonDay >= startDay && e.offSeasonDay <= endDay)
                .flatMap(day => day.shows.map(show => ({ 
                    ...show, 
                    day: day.offSeasonDay,
                    dayIndex: day.offSeasonDay - 1 // For consistency with live season
                })));
        }

        // Group by day
        const grouped = {};
        showsForWeek.forEach(show => {
            const day = seasonMode === 'live' ? show.dayIndex + 1 : show.day;
            if (!grouped[day]) {
                grouped[day] = [];
            }
            grouped[day].push(show);
        });

        // Sort shows within each day
        Object.keys(grouped).forEach(day => {
            grouped[day].sort((a, b) => a.eventName.localeCompare(b.eventName));
        });

        return grouped;
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

    // Check if this is championship week (week 7 for off-season, week 10 for live)
    const isChampionshipWeek = (seasonMode === 'off' && activeWeek === 7) || (seasonMode === 'live' && activeWeek === 10);

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
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 sm:mt-0">
                    {isChampionshipWeek ? 'Championship events - automatic enrollment' : 'Select up to 4 shows per week'}
                </p>
            </div>
        
            <div className="flex border-b-theme border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                {weeks.map(week => (
                    <button key={week} onClick={() => setActiveWeek(week)} className={`py-2 px-3 sm:px-4 whitespace-nowrap text-sm md:text-base font-bold transition-colors ${activeWeek === week ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'}`}>
                        Week {week}
                        {((seasonMode === 'off' && week === 7) || (seasonMode === 'live' && week === 10)) && ' (Championships)'}
                    </button>
                ))}
            </div>

            {/* Championship Week Notice */}
            {isChampionshipWeek && (
                <div className="mb-6 p-4 bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20 rounded-theme">
                    <h4 className="font-bold text-primary dark:text-primary-dark mb-2">Championship Week</h4>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        All corps are automatically enrolled in championship events. Advancement through Prelims → Semifinals → Finals 
                        is based on performance. No show selection needed this week.
                    </p>
                </div>
            )}

            {/* Show Selection by Day */}
            {!isChampionshipWeek && (
                <div className="space-y-6">
                    {Object.keys(showsForActiveWeekGrouped).length > 0 ? (
                        Object.keys(showsForActiveWeekGrouped)
                            .sort((a, b) => parseInt(a) - parseInt(b))
                            .map(day => {
                                const dayNumber = parseInt(day);
                                const showsForDay = showsForActiveWeekGrouped[day];
                                const calendarDate = getCalendarDateForDay(dayNumber);
                                const isPastDay = dayNumber < currentDay;

                                return (
                                    <div key={day} className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                                        <h4 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                            Day {day}
                                            {calendarDate && (
                                                <span className="ml-2 text-sm font-normal text-text-secondary dark:text-text-secondary-dark">
                                                    ({calendarDate.toLocaleDateString()})
                                                </span>
                                            )}
                                            {isPastDay && (
                                                <span className="ml-2 text-xs bg-accent dark:bg-accent-dark px-2 py-1 rounded-theme text-text-secondary dark:text-text-secondary-dark">
                                                    Past
                                                </span>
                                            )}
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {showsForDay.map((show, index) => {
                                                const isSelected = userSelectionsForWeek.some(s => s.eventName === show.eventName);
                                                const isSelectionLimitReached = userSelectionsForWeek.length >= 4;

                                                return (
                                                    <div key={`${day}-${index}`} className={`p-3 rounded-theme flex items-center gap-3 transition-opacity ${isPastDay ? 'bg-background dark:bg-background-dark opacity-60' : 'bg-background dark:bg-background-dark'}`}>
                                                        <input 
                                                            type="checkbox" 
                                                            id={`${day}-${index}`} 
                                                            checked={isSelected} 
                                                            disabled={isPastDay || (isSelectionLimitReached && !isSelected)} 
                                                            onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)} 
                                                            className="h-4 w-4 rounded text-primary focus:ring-primary border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark flex-shrink-0" 
                                                        />
                                                        <div className="flex-grow">
                                                            <label htmlFor={`${day}-${index}`} className={`font-semibold text-text-primary dark:text-text-primary-dark ${!isPastDay && 'cursor-pointer'}`}>
                                                                {show.eventName.replace(/DCI/g, 'marching.art')}
                                                            </label>
                                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                                {show.location}
                                                            </p>
                                                        </div>
                                                        {seasonMode === 'off' && !isPastDay && (
                                                            <button 
                                                                onClick={() => setRegistrantsModalShow(show)} 
                                                                className="text-sm text-primary dark:text-primary-dark hover:underline flex-shrink-0"
                                                            >
                                                                Who's Going?
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        <p className="text-center text-text-secondary dark:text-text-secondary-dark py-8">
                            No shows scheduled for this week.
                        </p>
                    )}
                </div>
            )}

            {/* Save Button - only show for non-championship weeks */}
            {!isPastWeek && !isChampionshipWeek && (
                <div className="flex flex-col sm:flex-row justify-end items-center mt-6 pt-4 border-t-theme border-accent dark:border-accent-dark space-y-4 sm:space-y-0 sm:space-x-4">
                    {message && <p className="text-sm font-semibold text-red-600">{message}</p>}
                    <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        Selections for Week {activeWeek}: {userSelectionsForWeek.length} / 4
                    </p>
                    <button 
                        onClick={() => handleSaveWeek(activeWeek)} 
                        disabled={isLoading} 
                        className="w-full sm:w-auto bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : `Save Week ${activeWeek} Selections`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShowSelection;