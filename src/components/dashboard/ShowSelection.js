import React, { useState, useEffect, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';

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
        if (!registrantsModalShow) return;
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
    }, [registrantsModalShow, getShowRegistrations]);

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

        setSelectedShows(prev => ({
            ...prev,
            [weekKey]: newSelections
        }));
    };

    const handleSaveSelectionsForWeek = async (week) => {
        setIsLoading(true);
        const toastId = toast.loading(`Saving Week ${week} selections...`);
        
        try {
            const weekKey = `week${week}`;
            const weekShows = selectedShows[weekKey] || [];
            
            // Call the function with the correct parameters
            const result = await registerForShows({
                week: week,
                shows: weekShows,
                corpsClass: corpsClass
            });

            if (result.data.success) {
                toast.success(`Week ${week} selections saved successfully!`, { id: toastId });
            } else {
                throw new Error(result.data.message || "Failed to save selections");
            }
        } catch (error) {
            console.error("Error saving show selections:", error);
            toast.error(
                error.message || "Failed to save show selections. Please try again.",
                { id: toastId }
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAllSelections = async () => {
        setIsLoading(true);
        const toastId = toast.loading("Saving all show selections...");
        
        try {
            // Save each week's selections separately
            const savePromises = [];
            
            for (let week = 1; week <= WEEKS_IN_SEASON; week++) {
                const weekKey = `week${week}`;
                const weekShows = selectedShows[weekKey] || [];
                
                if (weekShows.length > 0) {
                    savePromises.push(
                        registerForShows({
                            week: week,
                            shows: weekShows,
                            corpsClass: corpsClass
                        })
                    );
                }
            }
            
            if (savePromises.length === 0) {
                toast.error("No shows selected to save.", { id: toastId });
                return;
            }

            await Promise.all(savePromises);
            toast.success("All show selections saved successfully!", { id: toastId });
            
        } catch (error) {
            console.error("Error saving show selections:", error);
            toast.error(
                error.message || "Failed to save show selections. Please try again.",
                { id: toastId }
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewRegistrants = (show) => {
        setRegistrantsModalShow(show);
    };

    const getEventsForWeek = (week) => {
        const startDay = (week - 1) * 7 + 1;
        const endDay = week * 7;
        
        return seasonEvents.filter(event => 
            event.dayNumber >= startDay && event.dayNumber <= endDay
        );
    };

    const isShowSelected = (week, show) => {
        const weekKey = `week${week}`;
        const weekSelections = selectedShows[weekKey] || [];
        return weekSelections.some(s => s.eventName === show.eventName);
    };

    const getSelectedCount = (week) => {
        const weekKey = `week${week}`;
        return selectedShows[weekKey]?.length || 0;
    };

    const hasUnsavedChanges = () => {
        const currentSelections = JSON.stringify(selectedShows);
        const originalSelections = JSON.stringify(corpsProfile?.selectedShows || {});
        return currentSelections !== originalSelections;
    };

    const hasUnsavedChangesForWeek = (week) => {
        const weekKey = `week${week}`;
        const currentWeekSelections = JSON.stringify(selectedShows[weekKey] || []);
        const originalWeekSelections = JSON.stringify(corpsProfile?.selectedShows?.[weekKey] || []);
        return currentWeekSelections !== originalWeekSelections;
    };

    const weekOptions = Array.from({ length: WEEKS_IN_SEASON }, (_, i) => i + 1);
    const weekEvents = getEventsForWeek(activeWeek);

    return (
        <div className="space-y-6">
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                        Select Shows
                    </h3>
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        ({getSelectedCount(activeWeek)}/4 selected this week)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                        Week:
                    </label>
                    <select
                        value={activeWeek}
                        onChange={(e) => setActiveWeek(Number(e.target.value))}
                        className="px-3 py-1 border border-accent dark:border-accent-dark rounded-md 
                                 bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark
                                 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {weekOptions.map(week => (
                            <option key={week} value={week}>
                                Week {week}
                                {week === currentWeek && " (Current)"}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Shows List */}
            <div className="space-y-3">
                {weekEvents.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
                        No shows scheduled for Week {activeWeek}
                    </div>
                ) : (
                    weekEvents.map((event, index) => {
                        const show = event.shows[0]; // Assuming one show per event
                        const isSelected = isShowSelected(activeWeek, show);
                        const isPastShow = currentDay > event.dayNumber;

                        return (
                            <div
                                key={`${show.eventName}-${index}`}
                                className={`p-4 border rounded-lg transition-all ${
                                    isPastShow
                                        ? 'border-accent/30 bg-surface/50 dark:bg-surface-dark/50 opacity-60'
                                        : isSelected
                                        ? 'border-primary bg-primary/10 dark:bg-primary-dark/10'
                                        : 'border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark hover:border-primary/50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                {show.eventName}
                                            </h4>
                                            {isPastShow && (
                                                <span className="text-xs px-2 py-1 bg-accent/20 text-text-secondary dark:text-text-secondary-dark rounded">
                                                    Past
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            📍 {show.location}
                                        </p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            📅 Day {event.dayNumber}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleViewRegistrants(show)}
                                            className="text-xs px-3 py-1 bg-secondary text-on-secondary rounded hover:bg-secondary/90 transition-colors"
                                        >
                                            View Registrants
                                        </button>
                                        
                                        {!isPastShow && (
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectShow(activeWeek, show, e.target.checked)}
                                                    className="sr-only"
                                                />
                                                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                                                    isSelected
                                                        ? 'border-primary bg-primary text-white'
                                                        : 'border-accent dark:border-accent-dark'
                                                }`}>
                                                    {isSelected && <Icon name="check" size={12} />}
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Save Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-accent dark:border-accent-dark">
                {/* Save Current Week Button */}
                {hasUnsavedChangesForWeek(activeWeek) && (
                    <button
                        onClick={() => handleSaveSelectionsForWeek(activeWeek)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-secondary text-on-secondary font-semibold rounded-lg 
                                 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed 
                                 transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Icon name="loader" size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Icon name="save" size={16} />
                                Save Week {activeWeek}
                            </>
                        )}
                    </button>
                )}

                {/* Save All Changes Button */}
                {hasUnsavedChanges() && (
                    <button
                        onClick={handleSaveAllSelections}
                        disabled={isLoading}
                        className="px-6 py-2 bg-primary text-on-primary font-semibold rounded-lg 
                                 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed 
                                 transition-colors flex items-center gap-2 ml-auto"
                    >
                        {isLoading ? (
                            <>
                                <Icon name="loader" size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Icon name="save" size={16} />
                                Save All Changes
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Registrants Modal */}
            <Modal
                isOpen={!!registrantsModalShow}
                onClose={() => setRegistrantsModalShow(null)}
                title={`Registrants - ${registrantsModalShow?.eventName}`}
            >
                <div className="max-h-96 overflow-y-auto">
                    {isRegistrantsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Icon name="loader" size={24} className="animate-spin" />
                            <span className="ml-2">Loading registrants...</span>
                        </div>
                    ) : registrants.length === 0 ? (
                        <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
                            No registrants yet for this show.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {registrants.map((registrant, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg"
                                >
                                    <div>
                                        <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                            {registrant.username}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            {registrant.corpsName} ({registrant.corpsClass})
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ShowSelection;