import React, { useMemo, useState, useCallback } from 'react';
import ShowCard from './ShowCard';
import { getLocalCalendarDate, formatDate, isToday, isPastDate, isFutureDate } from '../../utils/dateUtils';
import Icon from '../ui/Icon';

const EventsDisplay = ({
    events,
    seasonSettings,
    fantasyRecaps,
    attendanceStats,
    currentDay,
    selectedWeek,
    quickFilter,
    compactView = false,
    favoriteShows = new Set(),
    notifications = new Set(),
    userCorps = {},
    onViewRecap,
    onShowModal,
    onSetModalData,
    onToggleFavorite,
    onToggleNotification
}) => {
    const [selectedShows, setSelectedShows] = useState(new Set());
    const [showBulkActions, setShowBulkActions] = useState(false);
    const [sortBy, setSortBy] = useState('day');
    const [groupBy, setGroupBy] = useState('day'); // day, location, attendance
    
    const isLiveSeason = seasonSettings?.status === 'live-season';

    // Enhanced grouping and sorting logic
    const groupedEvents = useMemo(() => {
        if (!events || events.length === 0) return [];

        // Create flat list of shows with enhanced metadata
        const allShows = events.flatMap(event => {
            const dayNumber = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
            const eventDate = getLocalCalendarDate(seasonSettings?.schedule?.startDate, dayNumber);
            
            return event.shows?.map(show => ({
                ...show,
                dayNumber,
                eventDate,
                event,
                showKey: `${dayNumber}_${show.eventName}`,
                attendance: attendanceStats?.shows?.[`${dayNumber}_${show.eventName}`] || {
                    counts: { worldClass: 0, openClass: 0, aClass: 0 },
                    attendees: { worldClass: [], openClass: [], aClass: [] }
                },
                totalAttendance: (() => {
                    const att = attendanceStats?.shows?.[`${dayNumber}_${show.eventName}`];
                    return att ? Object.values(att.counts).reduce((sum, count) => sum + count, 0) : 0;
                })(),
                status: (() => {
                    if (isToday(eventDate)) return 'today';
                    if (isPastDate(eventDate)) return 'past';
                    return 'future';
                })(),
                isFavorite: favoriteShows.has(`${dayNumber}_${show.eventName}`),
                hasNotification: notifications.has(`${dayNumber}_${show.eventName}`),
                hasUserCorps: (() => {
                    const att = attendanceStats?.shows?.[`${dayNumber}_${show.eventName}`];
                    if (!att?.attendees || Object.keys(userCorps).length === 0) return false;
                    
                    return Object.values(att.attendees).some(classAttendees =>
                        classAttendees.some(attendee => 
                            Object.values(userCorps).some(corps => corps.name === attendee.corpsName)
                        )
                    );
                })()
            })) || [];
        });

        // Group shows based on groupBy setting
        let grouped = [];
        
        switch (groupBy) {
            case 'location':
                const locationGroups = new Map();
                allShows.forEach(show => {
                    const key = show.location || 'Unknown Location';
                    if (!locationGroups.has(key)) {
                        locationGroups.set(key, []);
                    }
                    locationGroups.get(key).push(show);
                });
                
                grouped = Array.from(locationGroups.entries()).map(([location, shows]) => ({
                    title: location,
                    subtitle: `${shows.length} show${shows.length !== 1 ? 's' : ''}`,
                    shows: shows.sort((a, b) => a.dayNumber - b.dayNumber),
                    type: 'location'
                }));
                break;
                
            case 'attendance':
                const attendanceGroups = [
                    { min: 20, max: Infinity, label: 'Large Events (20+ corps)', shows: [] },
                    { min: 10, max: 19, label: 'Medium Events (10-19 corps)', shows: [] },
                    { min: 5, max: 9, label: 'Small Events (5-9 corps)', shows: [] },
                    { min: 1, max: 4, label: 'Intimate Events (1-4 corps)', shows: [] },
                    { min: 0, max: 0, label: 'No Participants Yet', shows: [] }
                ];
                
                allShows.forEach(show => {
                    const group = attendanceGroups.find(g => 
                        show.totalAttendance >= g.min && show.totalAttendance <= g.max
                    );
                    if (group) group.shows.push(show);
                });
                
                grouped = attendanceGroups
                    .filter(group => group.shows.length > 0)
                    .map(group => ({
                        title: group.label,
                        subtitle: `${group.shows.length} event${group.shows.length !== 1 ? 's' : ''}`,
                        shows: group.shows.sort((a, b) => b.totalAttendance - a.totalAttendance),
                        type: 'attendance'
                    }));
                break;
                
            default: // 'day'
                const dayGroups = new Map();
                allShows.forEach(show => {
                    const key = show.dayNumber;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, []);
                    }
                    dayGroups.get(key).push(show);
                });
                
                grouped = Array.from(dayGroups.entries())
                    .sort(([dayA], [dayB]) => dayA - dayB)
                    .map(([dayNumber, shows]) => {
                        const eventDate = getLocalCalendarDate(seasonSettings?.schedule?.startDate, dayNumber);
                        const dayStatus = isToday(eventDate) ? 'today' : 
                                        isPastDate(eventDate) ? 'past' : 'future';
                        
                        return {
                            title: `Day ${dayNumber}`,
                            subtitle: formatDate(eventDate, { includeDay: true }),
                            shows: shows.sort((a, b) => a.eventName.localeCompare(b.eventName)),
                            type: 'day',
                            dayNumber,
                            eventDate,
                            status: dayStatus
                        };
                    });
                break;
        }

        return grouped;
    }, [
        events, isLiveSeason, seasonSettings, attendanceStats, favoriteShows, 
        notifications, userCorps, groupBy
    ]);

    const hasRecapForDay = useCallback((day) => {
        return fantasyRecaps?.recaps?.some(r => r.offSeasonDay === day && r.shows?.length > 0);
    }, [fantasyRecaps]);

    const getDisplayTitle = () => {
        switch (quickFilter) {
            case 'today': return 'Today\'s Events';
            case 'upcoming': return 'Upcoming Events';
            case 'favorites': return 'Favorite Events';
            default: return `Week ${selectedWeek} Events`;
        }
    };

    const getEmptyStateMessage = () => {
        switch (quickFilter) {
            case 'today': return 'No events scheduled for today';
            case 'upcoming': return 'No upcoming events found';
            case 'favorites': return 'No favorite events yet';
            default: return 'No events scheduled this week';
        }
    };

    const totalShows = groupedEvents.reduce((sum, group) => sum + group.shows.length, 0);
    const totalAttendance = groupedEvents.reduce((sum, group) => 
        sum + group.shows.reduce((groupSum, show) => groupSum + show.totalAttendance, 0), 0
    );

    // Bulk actions
    const handleSelectAll = useCallback(() => {
        const allShowKeys = groupedEvents.flatMap(group => 
            group.shows.map(show => show.showKey)
        );
        setSelectedShows(new Set(allShowKeys));
    }, [groupedEvents]);

    const handleSelectNone = useCallback(() => {
        setSelectedShows(new Set());
    }, []);

    const handleBulkFavorite = useCallback(() => {
        selectedShows.forEach(showKey => {
            const [dayNumber, eventName] = showKey.split('_');
            onToggleFavorite(parseInt(dayNumber), eventName);
        });
        setSelectedShows(new Set());
        setShowBulkActions(false);
    }, [selectedShows, onToggleFavorite]);

    const handleBulkNotify = useCallback(() => {
        selectedShows.forEach(showKey => {
            const [dayNumber, eventName] = showKey.split('_');
            onToggleNotification(parseInt(dayNumber), eventName);
        });
        setSelectedShows(new Set());
        setShowBulkActions(false);
    }, [selectedShows, onToggleNotification]);

    if (groupedEvents.length === 0) {
        return (
            <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        {getEmptyStateMessage()}
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        {quickFilter === 'favorites' 
                            ? 'Start adding events to your favorites by clicking the star icon on any show.'
                            : 'Check back later or try adjusting your filters to see more events.'
                        }
                    </p>
                    {quickFilter !== 'all' && (
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary hover:opacity-90 text-on-primary font-medium py-2 px-4 rounded-theme"
                        >
                            View All Events
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            {/* Enhanced Header */}
            <div className="p-6 border-b border-accent/20 dark:border-accent-dark/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            {getDisplayTitle()}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            <span>{totalShows} show{totalShows !== 1 ? 's' : ''}</span>
                            {totalAttendance > 0 && (
                                <span>{totalAttendance} total participants</span>
                            )}
                            <span>{groupedEvents.length} {groupBy === 'day' ? 'day' : groupBy}{groupedEvents.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Group By Selector */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Group by:
                            </label>
                            <select
                                value={groupBy}
                                onChange={(e) => setGroupBy(e.target.value)}
                                className="px-2 py-1 text-sm bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                            >
                                <option value="day">Day</option>
                                <option value="location">Location</option>
                                <option value="attendance">Attendance</option>
                            </select>
                        </div>

                        {/* Bulk Actions Toggle */}
                        <button
                            onClick={() => setShowBulkActions(!showBulkActions)}
                            className={`p-2 rounded transition-colors ${
                                showBulkActions 
                                    ? 'bg-primary text-on-primary' 
                                    : 'bg-background dark:bg-background-dark text-text-secondary hover:text-text-primary'
                            }`}
                            title="Bulk actions"
                        >
                            <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                  className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Bulk Actions Panel */}
                {showBulkActions && (
                    <div className="mt-4 p-4 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                    Selected: {selectedShows.size}
                                </span>
                                <button
                                    onClick={handleSelectAll}
                                    className="text-sm text-primary hover:text-primary-dark font-medium"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={handleSelectNone}
                                    className="text-sm text-text-secondary hover:text-text-primary dark:text-text-secondary-dark dark:hover:text-text-primary-dark font-medium"
                                >
                                    Select None
                                </button>
                            </div>
                            
                            {selectedShows.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleBulkFavorite}
                                        className="px-3 py-1 bg-yellow-500 text-white rounded text-sm font-medium hover:bg-yellow-600 transition-colors"
                                    >
                                        Add to Favorites
                                    </button>
                                    <button
                                        onClick={handleBulkNotify}
                                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition-colors"
                                    >
                                        Enable Notifications
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Events Content */}
            <div className="p-6">
                <div className="space-y-8">
                    {groupedEvents.map((group, groupIndex) => (
                        <div key={`${group.type}-${groupIndex}`} className="space-y-4">
                            {/* Group Header */}
                            <div className={`
                                flex items-center justify-between p-4 rounded-theme border-l-4
                                ${group.status === 'today' ? 'border-primary bg-primary/5' :
                                  group.status === 'past' ? 'border-accent bg-accent/5' :
                                  'border-accent/30 bg-background/50'}
                            `}>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                            {group.title}
                                        </h3>
                                        {group.status === 'today' && (
                                            <span className="px-2 py-1 bg-primary text-on-primary rounded-full text-xs font-bold">
                                                TODAY
                                            </span>
                                        )}
                                        {group.type === 'day' && hasRecapForDay(group.dayNumber) && (
                                            <span className="px-2 py-1 bg-green-500 text-white rounded-full text-xs font-bold">
                                                RESULTS
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        {group.subtitle}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {group.type === 'day' && hasRecapForDay(group.dayNumber) && (
                                        <button
                                            onClick={() => onViewRecap(group.dayNumber)}
                                            className="px-3 py-1 bg-green-500 text-white rounded font-medium hover:bg-green-600 transition-colors text-sm"
                                        >
                                            View Day Recap
                                        </button>
                                    )}
                                    
                                    <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                        {group.shows.length} show{group.shows.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Shows Grid */}
                            <div className={`
                                grid gap-4
                                ${compactView 
                                    ? 'grid-cols-1' 
                                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                                }
                            `}>
                                {group.shows.map((show, showIndex) => (
                                    <div key={`${show.showKey}-${showIndex}`} className="relative">
                                        {/* Selection Checkbox for Bulk Actions */}
                                        {showBulkActions && (
                                            <div className="absolute top-2 left-2 z-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShows.has(show.showKey)}
                                                    onChange={(e) => {
                                                        const newSelected = new Set(selectedShows);
                                                        if (e.target.checked) {
                                                            newSelected.add(show.showKey);
                                                        } else {
                                                            newSelected.delete(show.showKey);
                                                        }
                                                        setSelectedShows(newSelected);
                                                    }}
                                                    className="w-4 h-4 text-primary bg-white border-2 border-primary rounded focus:ring-primary focus:ring-2"
                                                />
                                            </div>
                                        )}

                                        {/* Enhanced Show Card */}
                                        <ShowCard
                                            show={show}
                                            dayNumber={show.dayNumber}
                                            isPastDay={show.status === 'past'}
                                            fantasyRecaps={fantasyRecaps}
                                            attendanceStats={attendanceStats}
                                            seasonEvents={seasonSettings?.events}
                                            seasonUid={seasonSettings?.seasonUid}
                                            seasonStartDate={seasonSettings?.schedule?.startDate}
                                            onShowModal={onShowModal}
                                            onSetModalData={onSetModalData}
                                            onViewRecap={onViewRecap}
                                            onToggleFavorite={onToggleFavorite}
                                            onToggleNotification={onToggleNotification}
                                            favoriteShows={favoriteShows}
                                            notifications={notifications}
                                            userCorps={userCorps}
                                            compactView={compactView}
                                            highlightUserCorps={true}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Group Summary for Non-Day Groupings */}
                            {group.type !== 'day' && (
                                <div className="mt-4 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/20 dark:border-accent-dark/20">
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary dark:text-text-secondary-dark">
                                        <span>
                                            <strong>Total Attendance:</strong> {group.shows.reduce((sum, show) => sum + show.totalAttendance, 0)} corps
                                        </span>
                                        <span>
                                            <strong>Date Range:</strong> Day {Math.min(...group.shows.map(s => s.dayNumber))} - Day {Math.max(...group.shows.map(s => s.dayNumber))}
                                        </span>
                                        <span>
                                            <strong>Favorites:</strong> {group.shows.filter(s => s.isFavorite).length}
                                        </span>
                                        {Object.keys(userCorps).length > 0 && (
                                            <span>
                                                <strong>Your Corps:</strong> {group.shows.filter(s => s.hasUserCorps).length} shows
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Performance Analytics Footer */}
                <div className="mt-8 pt-6 border-t border-accent/20 dark:border-accent-dark/20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {totalShows}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Total Shows
                            </div>
                        </div>
                        
                        <div className="p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="text-2xl font-bold text-green-600">
                                {totalAttendance}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Total Corps
                            </div>
                        </div>
                        
                        <div className="p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="text-2xl font-bold text-yellow-600">
                                {favoriteShows.size}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Favorites
                            </div>
                        </div>
                        
                        <div className="p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="text-2xl font-bold text-blue-600">
                                {notifications.size}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Notifications
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-accent/20 text-text-primary dark:text-text-primary-dark hover:bg-accent/30 rounded-theme font-medium transition-colors flex items-center gap-2"
                    >
                        <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" 
                              className="w-4 h-4" />
                        Refresh Data
                    </button>
                    
                    {quickFilter !== 'favorites' && favoriteShows.size > 0 && (
                        <button
                            onClick={() => {/* Navigate to favorites view */}}
                            className="px-4 py-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/30 rounded-theme font-medium transition-colors flex items-center gap-2"
                        >
                            <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                                  className="w-4 h-4" />
                            View Favorites ({favoriteShows.size})
                        </button>
                    )}
                    
                    {Object.keys(userCorps).length > 0 && (
                        <button
                            onClick={() => {/* Navigate to user corps view */}}
                            className="px-4 py-2 bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30 rounded-theme font-medium transition-colors flex items-center gap-2"
                        >
                            <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                                  className="w-4 h-4" />
                            My Corps Schedule
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventsDisplay;