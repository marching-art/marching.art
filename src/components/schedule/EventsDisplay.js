import React, { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '../../store/userStore';
import { getLocalCalendarDate, formatDate, isToday, isPastDate } from '../../utils/dateUtils';
import ShowCard from './ShowCard';
import Icon from '../ui/Icon';

const EventsDisplay = ({
    seasonSettings,
    seasonStartDate,
    seasonEvents = [],
    searchTerm = '',
    filterByClass = 'all',
    quickFilter = 'all',
    sortBy = 'day',
    showMyCorpsOnly = false,
    selectedCorps = new Set(),
    compactView = false,
    selectedWeek = 1,
    viewMode = 'calendar',
    userCorps = {},
    fantasyRecaps,
    attendanceStats,
    onShowModal,
    onSetModalData,
    onViewRecap,
    onToggleFavorite,
    onToggleNotification,
    favoriteShows = new Set(),
    notifications = new Set()
}) => {
    const { loggedInProfile } = useUserStore();
    const [weeklyNotificationLimit, setWeeklyNotificationLimit] = useState(10); // Default weekly limit

    // Get events for the selected week
    const weekEvents = useMemo(() => {
        if (!seasonEvents || !Array.isArray(seasonEvents)) return [];
        
        const startDay = (selectedWeek - 1) * 7 + 1;
        const endDay = selectedWeek * 7;
        
        return seasonEvents.filter(event => {
            const day = event.offSeasonDay || event.dayIndex;
            return day >= startDay && day <= endDay;
        });
    }, [seasonEvents, selectedWeek]);

    // Filter and sort events
    const filteredEvents = useMemo(() => {
        let events = [...weekEvents];
        
        // Apply search filter
        if (searchTerm) {
            events = events.filter(event => {
                return event.shows?.some(show => 
                    show.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    show.location?.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }
        
        // Apply class filter
        if (filterByClass !== 'all') {
            events = events.filter(event => {
                return event.shows?.some(show => {
                    const restrictions = show.classRestrictions || ['worldClass', 'openClass', 'aClass'];
                    return restrictions.includes(filterByClass);
                });
            });
        }
        
        // Apply quick filter
        if (quickFilter !== 'all') {
            const today = new Date();
            events = events.filter(event => {
                const eventDate = getLocalCalendarDate(seasonStartDate, event.offSeasonDay || event.dayIndex);
                
                switch (quickFilter) {
                    case 'today':
                        return eventDate && isToday(eventDate);
                    case 'thisWeek':
                        // Already filtered by week selection
                        return true;
                    case 'favorites':
                        return event.shows?.some(show => {
                            const showKey = `${event.offSeasonDay || event.dayIndex}_${show.eventName}`;
                            return favoriteShows.has(showKey);
                        });
                    case 'attending':
                        return showMyCorpsOnly; // Will be filtered later
                    default:
                        return true;
                }
            });
        }
        
        // Apply my corps filter
        if (showMyCorpsOnly && userCorps && Object.keys(userCorps).length > 0) {
            // This would need integration with actual registration data
            // For now, showing all events when user has corps
        }
        
        // Apply corps selection filter
        if (selectedCorps.size > 0) {
            // This would filter based on actual attendance data
            // Implementation depends on how you track corps attendance
        }
        
        // Sort events
        events.sort((a, b) => {
            const dayA = a.offSeasonDay || a.dayIndex;
            const dayB = b.offSeasonDay || b.dayIndex;
            
            switch (sortBy) {
                case 'day':
                    return dayA - dayB;
                case 'name':
                    const nameA = a.shows?.[0]?.eventName || '';
                    const nameB = b.shows?.[0]?.eventName || '';
                    return nameA.localeCompare(nameB);
                case 'location':
                    const locA = a.shows?.[0]?.location || '';
                    const locB = b.shows?.[0]?.location || '';
                    return locA.localeCompare(locB);
                case 'attendance':
                    // Sort by total attendance (would need actual data)
                    return 0;
                default:
                    return dayA - dayB;
            }
        });
        
        return events;
    }, [weekEvents, searchTerm, filterByClass, quickFilter, sortBy, showMyCorpsOnly, selectedCorps, favoriteShows, seasonStartDate, userCorps]);

    // Check weekly registration limit
    const checkWeeklyRegistrationLimit = (dayNumber) => {
        if (!userCorps || Object.keys(userCorps).length === 0) return true;
        
        // Count current registrations for this week
        const weekStart = Math.floor((dayNumber - 1) / 7) * 7 + 1;
        const weekEnd = weekStart + 6;
        
        // This would need to check actual registration data
        // For now, returning true (allowing registration)
        return true;
    };

    const handleRegistrationAttempt = (dayNumber, eventName, corpsClass) => {
        if (!checkWeeklyRegistrationLimit(dayNumber)) {
            return {
                success: false,
                error: `Maximum ${weeklyNotificationLimit} events per week allowed. You've reached your limit for this week.`
            };
        }
        
        return { success: true };
    };

    if (!filteredEvents.length) {
        return (
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-8 text-center">
                <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" className="w-16 h-16 text-text-secondary dark:text-text-secondary-dark mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                    No Events Found
                </h3>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    {searchTerm || filterByClass !== 'all' || quickFilter !== 'all' 
                        ? 'Try adjusting your filters to see more events.'
                        : 'No events scheduled for this week.'
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Week Summary */}
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            Week {selectedWeek} Events
                        </h2>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {filteredEvents.reduce((total, event) => total + (event.shows?.length || 0), 0)} shows across {filteredEvents.length} days
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Group by:</p>
                            <select
                                value={viewMode}
                                onChange={(e) => {/* Handle view mode change */}}
                                className="text-sm border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark px-2 py-1"
                            >
                                <option value="calendar">Day</option>
                                <option value="list">List</option>
                                <option value="compact">Compact</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Events Display */}
            {filteredEvents.map(event => {
                const dayNumber = event.offSeasonDay || event.dayIndex;
                const eventDate = getLocalCalendarDate(seasonStartDate, dayNumber);
                const isEventToday = eventDate && isToday(eventDate);
                const isEventPast = eventDate && isPastDate(eventDate);
                
                return (
                    <div 
                        key={dayNumber} 
                        className={`${isEventToday ? 'ring-2 ring-primary dark:ring-primary-dark' : ''} rounded-theme`}
                    >
                        {/* Day Header */}
                        <div className={`flex items-center justify-between mb-4 p-4 rounded-theme ${
                            isEventToday 
                                ? 'bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20' 
                                : 'bg-accent dark:bg-accent-dark/20 border border-accent dark:border-accent-dark'
                        }`}>
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                    Day {dayNumber}
                                    {isEventToday && (
                                        <span className="ml-2 px-2 py-1 bg-primary dark:bg-primary-dark text-white text-xs font-bold rounded-theme">
                                            TODAY
                                        </span>
                                    )}
                                </h3>
                                <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    {eventDate && formatDate(eventDate, { includeDay: true, compact: false })}
                                </span>
                            </div>
                            
                            <div className="text-right">
                                <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                    {event.shows?.length || 0} shows
                                </span>
                                {isEventPast && (
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                        Event Completed
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Shows Grid - Responsive */}
                        <div className={`grid gap-6 ${
                            compactView 
                                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                        }`}>
                            {event.shows?.map((show, showIndex) => (
                                <div key={`${dayNumber}_${show.eventName}`} className="min-w-0">
                                    <ShowCard
                                        show={show}
                                        dayNumber={dayNumber}
                                        isPastDay={isEventPast}
                                        fantasyRecaps={fantasyRecaps}
                                        attendanceStats={attendanceStats}
                                        seasonEvents={seasonEvents}
                                        seasonUid={seasonSettings?.seasonUid}
                                        seasonStartDate={seasonStartDate}
                                        onShowModal={onShowModal}
                                        onSetModalData={onSetModalData}
                                        onViewRecap={onViewRecap}
                                        onToggleFavorite={onToggleFavorite}
                                        onToggleNotification={onToggleNotification}
                                        favoriteShows={favoriteShows}
                                        notifications={notifications}
                                        userCorps={userCorps}
                                        compactView={compactView}
                                        highlightUserCorps={showMyCorpsOnly}
                                        onRegistrationAttempt={handleRegistrationAttempt}
                                        weeklyLimit={weeklyNotificationLimit}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default EventsDisplay;