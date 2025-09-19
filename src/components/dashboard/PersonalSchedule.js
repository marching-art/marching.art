import React, { useState, useEffect, useMemo } from 'react';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';

const PersonalSchedule = ({ 
    userCorps, 
    seasonEvents, 
    currentDay, 
    seasonStartDate, 
    seasonMode = 'off' // 'live' or 'off'
}) => {
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [expandedCorps, setExpandedCorps] = useState(null);

    // Calculate current week
    const currentWeek = Math.ceil(currentDay / 7);
    const maxWeeks = seasonMode === 'live' ? 10 : 7;

    // Set initial selected week to current week
    useEffect(() => {
        if (currentWeek > 0 && currentWeek <= maxWeeks) {
            setSelectedWeek(currentWeek);
        } else {
            setSelectedWeek(1);
        }
    }, [currentWeek, maxWeeks]);

    // Process all selected shows for all corps
    const processedSchedule = useMemo(() => {
        const schedule = {};
        
        // Initialize weeks
        for (let week = 1; week <= maxWeeks; week++) {
            schedule[week] = [];
        }

        // Process each corps
        Object.entries(userCorps).forEach(([corpsClass, corps]) => {
            if (!corps.selectedShows) return;

            Object.entries(corps.selectedShows).forEach(([weekKey, shows]) => {
                const week = parseInt(weekKey.replace('week', ''));
                if (schedule[week]) {
                    shows.forEach(show => {
                        // Find the day this show occurs on
                        let showDay = null;
                        if (seasonMode === 'live') {
                            // For live season, find in season events
                            const weekEvents = seasonEvents.filter(e => e.week === week);
                            for (const event of weekEvents) {
                                const matchingShow = event.shows.find(s => s.eventName === show.eventName);
                                if (matchingShow) {
                                    showDay = event.dayIndex + 1;
                                    break;
                                }
                            }
                        } else {
                            // For off-season, calculate from week
                            showDay = (week - 1) * 7 + Math.floor(Math.random() * 7) + 1; // Approximate
                        }

                        schedule[week].push({
                            ...show,
                            corpsName: corps.corpsName,
                            corpsClass: corpsClass,
                            showDay: showDay,
                            isPast: showDay < currentDay
                        });
                    });
                }
            });
        });

        // Sort shows within each week by day
        Object.keys(schedule).forEach(week => {
            schedule[week].sort((a, b) => (a.showDay || 0) - (b.showDay || 0));
        });

        return schedule;
    }, [userCorps, seasonEvents, seasonMode, maxWeeks, currentDay]);

    // Get upcoming shows across all weeks
    const upcomingShows = useMemo(() => {
        const upcoming = [];
        Object.entries(processedSchedule).forEach(([week, shows]) => {
            shows.forEach(show => {
                if (!show.isPast) {
                    upcoming.push({ ...show, week: parseInt(week) });
                }
            });
        });
        return upcoming.slice(0, 5); // Limit to next 5 shows
    }, [processedSchedule]);

    const weeks = Array.from({ length: maxWeeks }, (_, i) => i + 1);

    if (Object.keys(userCorps).length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                    My Corps Schedule
                </h4>
                <button
                    onClick={() => setExpandedCorps(expandedCorps ? null : 'all')}
                    className="text-sm text-primary dark:text-primary-dark hover:underline"
                >
                    {expandedCorps ? 'Collapse' : 'View Full Schedule'}
                </button>
            </div>

            {/* Quick Upcoming Shows */}
            {!expandedCorps && upcomingShows.length > 0 && (
                <div className="bg-background dark:bg-background-dark rounded-theme p-3 border border-accent dark:border-accent-dark">
                    <h5 className="font-medium text-text-primary dark:text-text-primary-dark mb-2 text-sm">
                        Next Shows
                    </h5>
                    <div className="space-y-1">
                        {upcomingShows.map((show, index) => (
                            <div key={index} className="text-sm flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-primary dark:text-primary-dark">
                                        {show.corpsName}
                                    </span>
                                    <span className="text-text-secondary dark:text-text-secondary-dark mx-2">
                                        •
                                    </span>
                                    <span className="text-text-primary dark:text-text-primary-dark">
                                        {show.eventName.replace(/DCI/g, 'marching.art')}
                                    </span>
                                </div>
                                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    Week {show.week}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Expanded Schedule View */}
            {expandedCorps && (
                <div className="bg-background dark:bg-background-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                    {/* Week Selector */}
                    <div className="flex border-b border-accent dark:border-accent-dark mb-4 overflow-x-auto">
                        {weeks.map(week => (
                            <button
                                key={week}
                                onClick={() => setSelectedWeek(week)}
                                className={`py-2 px-3 whitespace-nowrap text-sm font-medium transition-colors ${
                                    selectedWeek === week
                                        ? 'border-b-2 border-primary text-primary dark:border-primary-dark dark:text-primary-dark'
                                        : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                                }`}
                            >
                                Week {week}
                                {week === currentWeek && (
                                    <span className="ml-1 text-xs bg-primary text-on-primary px-1 rounded">
                                        Now
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Shows for Selected Week */}
                    {selectedWeek && (
                        <div>
                            <h6 className="font-medium text-text-primary dark:text-text-primary-dark mb-3">
                                Week {selectedWeek} Schedule
                            </h6>
                            
                            {processedSchedule[selectedWeek]?.length > 0 ? (
                                <div className="space-y-2">
                                    {processedSchedule[selectedWeek].map((show, index) => (
                                        <div 
                                            key={index} 
                                            className={`p-3 rounded-theme border transition-opacity ${
                                                show.isPast 
                                                    ? 'border-accent dark:border-accent-dark opacity-60'
                                                    : 'border-primary dark:border-primary-dark'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h5 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                        {show.corpsName}
                                                    </h5>
                                                    <p className="text-sm text-text-primary dark:text-text-primary-dark">
                                                        {show.eventName.replace(/DCI/g, 'marching.art')}
                                                    </p>
                                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        {show.location}
                                                    </p>
                                                </div>
                                                <div className="text-right text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    {show.showDay && (
                                                        <div>Day {show.showDay}</div>
                                                    )}
                                                    {show.isPast && (
                                                        <div className="text-accent dark:text-accent-dark">Past</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark italic text-center py-4">
                                    No shows selected for this week
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Summary Stats */}
            {!expandedCorps && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-background dark:bg-background-dark rounded-theme p-2">
                        <div className="font-bold text-primary dark:text-primary-dark">
                            {Object.values(processedSchedule).flat().length}
                        </div>
                        <div className="text-text-secondary dark:text-text-secondary-dark">
                            Total Shows
                        </div>
                    </div>
                    <div className="bg-background dark:bg-background-dark rounded-theme p-2">
                        <div className="font-bold text-primary dark:text-primary-dark">
                            {Object.values(processedSchedule).flat().filter(s => !s.isPast).length}
                        </div>
                        <div className="text-text-secondary dark:text-text-secondary-dark">
                            Upcoming
                        </div>
                    </div>
                    <div className="bg-background dark:bg-background-dark rounded-theme p-2">
                        <div className="font-bold text-primary dark:text-primary-dark">
                            {Object.keys(userCorps).length}
                        </div>
                        <div className="text-text-secondary dark:text-text-secondary-dark">
                            Active Corps
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalSchedule;