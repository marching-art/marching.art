import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { getAttendanceWithCaching } from '../../services/attendanceService';
import { formatDate, isPastDate, isToday, isFutureDate, formatTimeUntil, isEventLive } from '../../utils/dateUtils';
import Icon from '../ui/Icon';

// Enhanced global state management with persistence
const globalAttendanceState = new Map();
const attendanceLoadingStates = new Map();
const retryAttempts = new Map();

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
    const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
    const [attendanceVersion, setAttendanceVersion] = useState(0);
    const [loadingError, setLoadingError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const hasFetchedRef = useRef(false);
    const timeoutRef = useRef(null);
    
    const showKey = `${dayNumber}_${show.eventName}`;
    const isFavorite = favoriteShows.has(showKey);
    const hasNotification = notifications.has(showKey);
    
    // Calculate event date and status
    const eventDate = useMemo(() => {
        if (!seasonStartDate) return null;
        const startDate = seasonStartDate instanceof Date ? seasonStartDate : seasonStartDate.toDate();
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayNumber - 1);
        return date;
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

    // Enhanced attendance data with multi-source fallback
    const attendanceData = useMemo(() => {
        // Check global state first (fastest)
        const globalData = globalAttendanceState.get(showKey);
        if (globalData) {
            return globalData;
        }

        // Priority 1: Use precomputed attendance stats
        const precomputed = attendanceStats?.shows?.[showKey];
        if (precomputed && precomputed.attendees) {
            const data = {
                counts: precomputed.counts || { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: precomputed.attendees || { worldClass: [], openClass: [], aClass: [] },
                source: 'precomputed'
            };
            globalAttendanceState.set(showKey, data);
            return data;
        }

        // Priority 2: Use registration counters from season events
        const event = seasonEvents?.find(e => e.offSeasonDay === dayNumber);
        const showData = event?.shows?.find(s => s.eventName === show.eventName);
        if (showData?.registrationCounts) {
            const data = {
                counts: showData.registrationCounts,
                attendees: { worldClass: [], openClass: [], aClass: [] },
                source: 'registration'
            };
            globalAttendanceState.set(showKey, data);
            return data;
        }

        // Priority 3: Default empty
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] },
            source: 'empty'
        };
    }, [dayNumber, show.eventName, attendanceStats, seasonEvents, showKey, attendanceVersion]);

    // Enhanced live attendance fetching with retry logic
    const fetchLiveAttendance = useCallback(async () => {
        const currentRetries = retryAttempts.get(showKey) || 0;
        if (currentRetries >= 3) {
            console.warn(`Max retries reached for ${showKey}`);
            return;
        }

        // Check if already loading
        if (attendanceLoadingStates.get(showKey)) {
            return;
        }

        attendanceLoadingStates.set(showKey, true);
        setIsLoadingAttendees(true);
        setLoadingError(null);
        
        try {
            const liveData = await getAttendanceWithCaching(
                showKey, 
                seasonUid, 
                show.eventName, 
                dayNumber, 
                seasonEvents, 
                attendanceStats
            );
            
            if (liveData && (liveData.attendees.worldClass.length > 0 || 
                liveData.attendees.openClass.length > 0 || 
                liveData.attendees.aClass.length > 0)) {
                
                const enhancedData = {
                    ...liveData,
                    source: 'live',
                    lastUpdated: Date.now()
                };
                
                globalAttendanceState.set(showKey, enhancedData);
                setAttendanceVersion(prev => prev + 1);
                retryAttempts.delete(showKey);
            }
        } catch (error) {
            console.warn(`Failed to load attendance for ${show.eventName}:`, error.message);
            setLoadingError(error.message);
            retryAttempts.set(showKey, currentRetries + 1);
            setRetryCount(prev => prev + 1);
        } finally {
            attendanceLoadingStates.delete(showKey);
            setIsLoadingAttendees(false);
        }
    }, [showKey, seasonUid, show.eventName, dayNumber, seasonEvents, attendanceStats]);

    // Smart attendance loading with staggered requests
    useEffect(() => {
        const totalAttendance = attendanceData.counts.worldClass + 
                              attendanceData.counts.openClass + 
                              attendanceData.counts.aClass;
        
        // Only fetch if we have no data and conditions are right
        if (totalAttendance === 0 && 
            seasonUid && 
            !hasFetchedRef.current && 
            !isLoadingAttendees &&
            attendanceData.source === 'empty') {
            
            hasFetchedRef.current = true;
            
            // Stagger requests to prevent overwhelming the server
            const showHash = (show.eventName + dayNumber).split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const delay = Math.abs(showHash % 3000) + 500; // 500-3500ms delay
            
            timeoutRef.current = setTimeout(fetchLiveAttendance, delay);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [attendanceData, seasonUid, isLoadingAttendees, fetchLiveAttendance]);

    // Get fantasy scores for the show
    const scores = useMemo(() => {
        if (!fantasyRecaps?.recaps) return null;

        const recap = fantasyRecaps.recaps.find(r => r.offSeasonDay === dayNumber);
        if (!recap) return null;

        const showData = recap.shows?.find(s => s.eventName === show.eventName);
        return showData?.results || null;
    }, [fantasyRecaps, dayNumber, show.eventName]);

    // Check if user has corps in this show
    const hasUserCorps = useMemo(() => {
        if (!userCorps || Object.keys(userCorps).length === 0) return false;
        
        return Object.values(attendanceData.attendees).some(classAttendees =>
            classAttendees.some(attendee => 
                Object.values(userCorps).some(corps => corps.name === attendee.corpsName)
            )
        );
    }, [attendanceData.attendees, userCorps]);

    // Calculate total attendance
    const totalAttendance = attendanceData.counts.worldClass + 
                           attendanceData.counts.openClass + 
                           attendanceData.counts.aClass;

    // Handle modal opening
    const handleShowAttendees = useCallback(() => {
        onSetModalData({
            eventName: show.eventName,
            location: show.location,
            day: dayNumber,
            date: eventDate,
            attendance: attendanceData,
            scores: scores,
            userCorps: userCorps,
            isFavorite: isFavorite,
            hasNotification: hasNotification
        });
        onShowModal('attendees');
    }, [show, dayNumber, eventDate, attendanceData, scores, userCorps, isFavorite, hasNotification, onSetModalData, onShowModal]);

    // Handle viewing scores
    const handleViewScores = useCallback(() => {
        if (scores) {
            onSetModalData({
                eventName: show.eventName,
                location: show.location,
                day: dayNumber,
                date: eventDate,
                scores: scores,
                attendance: attendanceData
            });
            onShowModal('scores');
        } else {
            onViewRecap(dayNumber);
        }
    }, [scores, show, dayNumber, eventDate, attendanceData, onSetModalData, onShowModal, onViewRecap]);

    // Retry attendance loading
    const handleRetryAttendance = useCallback(() => {
        hasFetchedRef.current = false;
        retryAttempts.delete(showKey);
        setLoadingError(null);
        setRetryCount(0);
        fetchLiveAttendance();
    }, [showKey, fetchLiveAttendance]);

    if (compactView) {
        return (
            <div className={`
                p-3 rounded-theme border transition-all duration-200 hover:shadow-md
                ${eventStatus === 'today' ? 'border-primary bg-primary/5' : 
                  eventStatus === 'past' ? 'border-accent/30 bg-background/50' : 
                  'border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark'}
                ${isLive ? 'ring-2 ring-red-500 ring-opacity-50' : ''}
                ${hasUserCorps && highlightUserCorps ? 'ring-2 ring-blue-500 ring-opacity-30' : ''}
            `}>
                <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {isLive && (
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs font-bold text-red-500">LIVE</span>
                                </div>
                            )}
                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark truncate">
                                {show.eventName.replace(/DCI/g, 'marching.art')}
                            </h4>
                            {isFavorite && (
                                <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                                  className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {show.location} • {formatDate(eventDate, { compact: true })}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {totalAttendance > 0 && (
                            <button
                                onClick={handleShowAttendees}
                                className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium hover:bg-primary/30 transition-colors"
                            >
                                {totalAttendance}
                            </button>
                        )}
                        
                        {scores && (
                            <button
                                onClick={handleViewScores}
                                className="px-2 py-1 bg-green-500/20 text-green-600 rounded text-xs font-medium hover:bg-green-500/30 transition-colors"
                            >
                                Results
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`
            p-6 rounded-theme border transition-all duration-300 hover:shadow-lg group
            ${eventStatus === 'today' ? 'border-primary bg-primary/5' : 
              eventStatus === 'past' ? 'border-accent/30 bg-background/50' : 
              'border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark'}
            ${isLive ? 'ring-2 ring-red-500 ring-opacity-50 shadow-lg' : ''}
            ${hasUserCorps && highlightUserCorps ? 'ring-2 ring-blue-500 ring-opacity-30' : ''}
        `}>
            {/* Header Section */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        {isLive && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                LIVE NOW
                            </div>
                        )}
                        {eventStatus === 'today' && !isLive && (
                            <div className="px-2 py-1 bg-primary text-on-primary rounded-full text-xs font-bold">
                                TODAY
                            </div>
                        )}
                        {hasUserCorps && (
                            <div className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">
                                MY CORPS
                            </div>
                        )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark group-hover:text-primary transition-colors">
                        {show.eventName.replace(/DCI/g, 'marching.art')}
                    </h3>
                    
                    <div className="flex items-center gap-4 text-sm text-text-secondary dark:text-text-secondary-dark">
                        <div className="flex items-center gap-1">
                            <Icon path="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" className="w-4 h-4" />
                            {show.location}
                        </div>
                        <div className="flex items-center gap-1">
                            <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 005.25 9h13.5a2.25 2.25 0 002.25 2.25v7.5" className="w-4 h-4" />
                            {formatDate(eventDate, { includeDay: true })}
                        </div>
                        {eventStatus === 'future' && (
                            <div className="text-primary font-medium">
                                {formatTimeUntil(eventDate)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onToggleFavorite(dayNumber, show.eventName)}
                        className={`p-2 rounded-full transition-colors ${
                            isFavorite 
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                : 'bg-background dark:bg-background-dark text-text-secondary hover:text-yellow-500 hover:bg-yellow-500/10'
                        }`}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                              className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={() => onToggleNotification(dayNumber, show.eventName)}
                        className={`p-2 rounded-full transition-colors ${
                            hasNotification 
                                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                : 'bg-background dark:bg-background-dark text-text-secondary hover:text-blue-500 hover:bg-blue-500/10'
                        }`}
                        title={hasNotification ? 'Remove notification' : 'Add notification'}
                    >
                        <Icon path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" 
                              className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Attendance Section */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                        Competing Corps
                    </h4>
                    {isLoadingAttendees && (
                        <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm">Loading...</span>
                        </div>
                    )}
                </div>

                {loadingError && (
                    <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon path="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" 
                                      className="w-4 h-4 text-red-500" />
                                <span className="text-sm text-red-600 dark:text-red-400">
                                    Failed to load attendance data
                                </span>
                            </div>
                            <button
                                onClick={handleRetryAttendance}
                                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {totalAttendance > 0 ? (
                    <div className="space-y-3">
                        {/* Corps Class Summary */}
                        <div className="grid grid-cols-3 gap-3">
                            {CORPS_CLASS_ORDER.map(corpsClass => {
                                const classData = CORPS_CLASSES[corpsClass];
                                const count = attendanceData.counts[corpsClass] || 0;
                                const attendees = attendanceData.attendees[corpsClass] || [];
                                
                                // Check if user has corps in this class
                                const hasUserCorpsInClass = attendees.some(attendee => 
                                    Object.values(userCorps).some(corps => corps.name === attendee.corpsName)
                                );
                                
                                return (
                                    <div key={corpsClass} className={`
                                        text-center p-3 rounded-theme border transition-all
                                        ${hasUserCorpsInClass ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-accent/30 dark:border-accent-dark/30 bg-background dark:bg-background-dark'}
                                        ${count > 0 ? 'hover:shadow-md cursor-pointer' : 'opacity-60'}
                                    `}>
                                        <div className={`w-4 h-4 mx-auto rounded-full ${classData.color} mb-2`}></div>
                                        <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                            {classData.name}
                                        </div>
                                        <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                            {count}
                                        </div>
                                        {hasUserCorpsInClass && (
                                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                Your Corps
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Quick Preview of Corps Names */}
                        {attendanceData.source !== 'registration' && totalAttendance <= 12 && (
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                <span className="font-medium">Participating: </span>
                                {Object.values(attendanceData.attendees)
                                    .flat()
                                    .slice(0, 8)
                                    .map(attendee => attendee.corpsName)
                                    .join(', ')}
                                {Object.values(attendanceData.attendees).flat().length > 8 && 
                                    ` and ${Object.values(attendanceData.attendees).flat().length - 8} more...`}
                            </div>
                        )}

                        {/* View Details Button */}
                        <button
                            onClick={handleShowAttendees}
                            className="w-full py-2 px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-theme font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Icon path="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" 
                                  className="w-4 h-4" />
                            View All Corps ({totalAttendance})
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-6 text-text-secondary dark:text-text-secondary-dark">
                        <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                              className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">
                            {isLoadingAttendees ? 'Loading corps list...' : 'No participating corps yet'}
                        </div>
                        {attendanceData.source === 'empty' && !isLoadingAttendees && (
                            <button
                                onClick={handleRetryAttendance}
                                className="mt-2 text-sm text-primary hover:text-primary-dark font-medium"
                            >
                                Check for Updates
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                {scores ? (
                    <button
                        onClick={handleViewScores}
                        className="flex-1 py-2 px-4 bg-green-500 text-white hover:bg-green-600 rounded-theme font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Icon path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.228a9.014 9.014 0 012.916.52 6.003 6.003 0 01-4.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0A6.772 6.772 0 0112 14.25m0 0a6.772 6.772 0 01-4.478-1.622m0 0a6.726 6.726 0 01-2.748-1.35m0 0A6.003 6.003 0 012.25 9c0-1.357.445-2.611 1.198-3.625m0 0A9.014 9.014 0 015.364 4.85m0 0A9.014 9.014 0 0112 2.25" 
                              className="w-4 h-4" />
                        View Results
                    </button>
                ) : isPastDay ? (
                    <button
                        onClick={() => onViewRecap(dayNumber)}
                        className="flex-1 py-2 px-4 bg-secondary text-on-secondary hover:opacity-90 rounded-theme font-medium transition-opacity flex items-center justify-center gap-2"
                    >
                        <Icon path="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" 
                              className="w-4 h-4" />
                        View Recap
                    </button>
                ) : (
                    <div className="flex-1 py-2 px-4 bg-accent/20 text-text-secondary rounded-theme font-medium text-center">
                        {eventStatus === 'today' ? 'Event Today' : 'Upcoming Event'}
                    </div>
                )}

                {totalAttendance > 0 && (
                    <button
                        onClick={handleShowAttendees}
                        className="py-2 px-4 bg-accent/20 text-text-primary dark:text-text-primary-dark hover:bg-accent/30 rounded-theme font-medium transition-colors"
                        title="View competing corps"
                    >
                        <Icon path="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" 
                              className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Data Source Indicator */}
            {attendanceData.source && (
                <div className="mt-3 pt-3 border-t border-accent/20 dark:border-accent-dark/20">
                    <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-secondary-dark">
                        <span>
                            Data source: {attendanceData.source === 'live' ? 'Live' : 
                                        attendanceData.source === 'precomputed' ? 'Cached' :
                                        attendanceData.source === 'registration' ? 'Registration' : 'Default'}
                        </span>
                        {attendanceData.lastUpdated && (
                            <span>
                                Updated: {new Date(attendanceData.lastUpdated).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShowCard;