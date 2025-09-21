import React, { useState, useEffect, useMemo } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { formatDate, isPastDate, isToday, isFutureDate, formatTimeUntil, isEventLive, getLocalCalendarDate } from '../../utils/dateUtils';
import ShowRegistrationSystem from './ShowRegistrationSystem';
import Icon from '../ui/Icon';

const ShowCard = ({
    show,
    dayNumber,
    isPastDay,
    fantasyRecaps,
    attendanceStats,
    seasonEvents,
    seasonUid,
    seasonStartDate,
    onShowModal,
    onSetModalData,
    onViewRecap,
    onToggleFavorite,
    onToggleNotification,
    favoriteShows = new Set(),
    notifications = new Set(),
    userCorps = {},
    compactView = false,
    highlightUserCorps = false
}) => {
    const [showRegistrationDetails, setShowRegistrationDetails] = useState(false);
    const [attendanceData, setAttendanceData] = useState(null);
    const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

    const showKey = `${dayNumber}_${show.eventName}`;
    const isFavorite = favoriteShows.has(showKey);
    const hasNotification = notifications.has(showKey);
    
    // Calculate event date and status using fixed date utilities
    const eventDate = useMemo(() => {
        if (!seasonStartDate) return null;
        return getLocalCalendarDate(seasonStartDate, dayNumber);
    }, [seasonStartDate, dayNumber]);

    const eventStatus = useMemo(() => {
        if (!eventDate) return 'unknown';
        if (isToday(eventDate)) return 'today';
        if (isPastDate(eventDate)) return 'past';
        if (isFutureDate(eventDate)) return 'future';
        return 'unknown';
    }, [eventDate]);

    const isLive = useMemo(() => {
        return eventDate && isEventLive(eventDate);
    }, [eventDate]);

    // Enhanced attendance data loading
    const loadAttendanceData = async () => {
        if (attendanceData || isLoadingAttendance) return;
        
        setIsLoadingAttendance(true);
        try {
            // This would integrate with your attendance service
            // For now, using placeholder data structure
            const mockData = {
                counts: { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: { worldClass: [], openClass: [], aClass: [] },
                source: 'live'
            };
            
            setAttendanceData(mockData);
        } catch (error) {
            console.error('Error loading attendance data:', error);
        } finally {
            setIsLoadingAttendance(false);
        }
    };

    // Check if user has corps attending this show
    const userCorpsAttending = useMemo(() => {
        if (!userCorps || Object.keys(userCorps).length === 0) return [];
        
        const attending = [];
        Object.entries(userCorps).forEach(([corpsClass, corpsData]) => {
            if (corpsData.name) {
                // You would check actual registration data here
                attending.push({
                    class: corpsClass,
                    name: corpsData.name,
                    location: corpsData.location
                });
            }
        });
        
        return attending;
    }, [userCorps]);

    // Event class restrictions check
    const getEventClassRestrictions = () => {
        if (show.classRestrictions) {
            return show.classRestrictions;
        }
        
        const eventName = show.eventName.toLowerCase();
        if (eventName.includes('open class') || 
            eventName.includes('open & a class') ||
            eventName.includes('open/a class')) {
            return ['openClass', 'aClass'];
        }
        
        return ['worldClass', 'openClass', 'aClass']; // No restrictions
    };

    const allowedClasses = getEventClassRestrictions();
    const hasClassRestrictions = allowedClasses.length < 3;

    const handleRegistrationUpdate = (showKey, isRegistered) => {
        // Trigger parent component updates
        if (onShowModal && isRegistered) {
            // Could trigger a refresh of attendance data
            setAttendanceData(null);
        }
    };

    return (
        <div className={`bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme overflow-hidden transition-all duration-200 hover:shadow-lg ${
            eventStatus === 'today' ? 'ring-2 ring-primary dark:ring-primary-dark' : ''
        } ${compactView ? 'p-4' : 'p-6'}`}>
            {/* Event Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className={`font-bold text-text-primary dark:text-text-primary-dark ${
                            compactView ? 'text-lg' : 'text-xl'
                        }`}>
                            {show.eventName}
                        </h3>
                        
                        {/* Event Status Badges */}
                        <div className="flex items-center gap-2">
                            {eventStatus === 'today' && (
                                <span className="px-2 py-1 bg-primary dark:bg-primary-dark text-white text-xs font-bold rounded-theme">
                                    TODAY
                                </span>
                            )}
                            
                            {isLive && (
                                <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-theme animate-pulse">
                                    LIVE
                                </span>
                            )}
                            
                            {hasClassRestrictions && (
                                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded-theme">
                                    {allowedClasses.map(c => 
                                        c === 'worldClass' ? 'World' : 
                                        c === 'openClass' ? 'Open' : 'A Class'
                                    ).join(' & ')} Only
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Event Details */}
                    <div className="space-y-1 text-sm text-text-secondary dark:text-text-secondary-dark">
                        <div className="flex items-center gap-2">
                            <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" className="w-4 h-4" />
                            <span>Day {dayNumber}</span>
                            {eventDate && (
                                <span>• {formatDate(eventDate, { includeDay: true, compact: compactView })}</span>
                            )}
                        </div>
                        
                        {show.location && (
                            <div className="flex items-center gap-2">
                                <Icon path="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" className="w-4 h-4" />
                                <span>{show.location}</span>
                            </div>
                        )}
                        
                        {eventDate && isFutureDate(eventDate) && (
                            <div className="flex items-center gap-2">
                                <Icon path="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4" />
                                <span>{formatTimeUntil(eventDate)} until event</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-4">
                    <button
                        onClick={() => onToggleFavorite && onToggleFavorite(showKey)}
                        className={`p-2 rounded-theme transition-colors ${
                            isFavorite 
                                ? 'text-yellow-500 hover:text-yellow-600' 
                                : 'text-text-secondary dark:text-text-secondary-dark hover:text-yellow-500'
                        }`}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <Icon 
                            path={isFavorite ? "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" : "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"}
                            className="w-5 h-5" 
                        />
                    </button>
                    
                    <button
                        onClick={() => onToggleNotification && onToggleNotification(showKey)}
                        className={`p-2 rounded-theme transition-colors ${
                            hasNotification 
                                ? 'text-blue-500 hover:text-blue-600' 
                                : 'text-text-secondary dark:text-text-secondary-dark hover:text-blue-500'
                        }`}
                        title={hasNotification ? 'Disable notifications' : 'Enable notifications'}
                    >
                        <Icon 
                            path={hasNotification ? "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" : "M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31A8.967 8.967 0 002.312 15.75 7.963 7.963 0 006 11.25V9a6 6 0 0112 0v2.25a8.967 8.967 0 002.312 4.5c.248.92.248 1.921 0 2.841a24.248 24.248 0 01-3.844.148m-6.712 0L18 15.75a3 3 0 11-6.712 0z"}
                            className="w-5 h-5" 
                        />
                    </button>
                    
                    {onShowModal && (
                        <button
                            onClick={() => {
                                onSetModalData && onSetModalData({ show, dayNumber, eventDate });
                                onShowModal('showDetail');
                            }}
                            className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors"
                            title="View show details"
                        >
                            <Icon path="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* User Corps Attending Highlight */}
            {highlightUserCorps && userCorpsAttending.length > 0 && (
                <div className="mb-4 p-3 bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20 rounded-theme">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" className="w-4 h-4 text-primary dark:text-primary-dark" />
                        <span className="text-sm font-medium text-primary dark:text-primary-dark">
                            Your Corps Attending
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {userCorpsAttending.map((corps, index) => (
                            <span 
                                key={index}
                                className={`px-2 py-1 text-xs font-medium rounded-theme ${
                                    corps.class === 'worldClass' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' :
                                    corps.class === 'openClass' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
                                    'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200'
                                }`}
                            >
                                {corps.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Registration System - Only loads individually for each show */}
            <div className="border-t border-accent dark:border-accent-dark pt-4">
                <ShowRegistrationSystem
                    show={show}
                    dayNumber={dayNumber}
                    seasonUid={seasonUid}
                    onRegistrationUpdate={handleRegistrationUpdate}
                    userCorps={userCorps}
                    seasonEvents={seasonEvents}
                />
            </div>

            {/* Show Actions */}
            {!compactView && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                    <div className="flex items-center gap-3">
                        {fantasyRecaps && onViewRecap && (
                            <button
                                onClick={() => onViewRecap(dayNumber)}
                                className="text-sm text-primary dark:text-primary-dark hover:text-primary-dark dark:hover:text-primary transition-colors"
                            >
                                View Recap
                            </button>
                        )}
                        
                        {eventStatus === 'past' && (
                            <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                Event Completed
                            </span>
                        )}
                    </div>
                    
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        Show #{dayNumber}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShowCard;