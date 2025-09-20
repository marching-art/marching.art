import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps } from '../utils/profileCompatibility';
import ScheduleHeader from '../components/schedule/ScheduleHeader';
import ScheduleControls from '../components/schedule/ScheduleControls';
import WeekNavigation from '../components/schedule/WeekNavigation';
import EventsDisplay from '../components/schedule/EventsDisplay';
import ScheduleModal from '../components/schedule/ScheduleModal';
import PersonalSchedule from '../components/dashboard/PersonalSchedule';
import { useScheduleData } from '../hooks/useScheduleData';
import { formatDate, getLocalCalendarDate, isToday, isPastDate } from '../utils/dateUtils';

const SchedulePage = () => {
    const navigate = useNavigate();
    const { loggedInProfile } = useUserStore();
    
    // Core state
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [viewMode, setViewMode] = useState('calendar');
    const [quickFilter, setQuickFilter] = useState('all');
    const [selectedModal, setSelectedModal] = useState(null);
    const [modalData, setModalData] = useState(null);
    
    // Enhanced features
    const [selectedCorps, setSelectedCorps] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [favoriteShows, setFavoriteShows] = useState(new Set());
    const [notifications, setNotifications] = useState(new Set());
    const [compactView, setCompactView] = useState(false);
    const [sortBy, setSortBy] = useState('day'); // day, attendance, name, location
    const [filterByClass, setFilterByClass] = useState('all'); // all, worldClass, openClass, aClass
    const [showMyCorpsOnly, setShowMyCorpsOnly] = useState(false);
    
    // Load user preferences from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('schedule_preferences');
        if (saved) {
            try {
                const prefs = JSON.parse(saved);
                setViewMode(prefs.viewMode || 'calendar');
                setCompactView(prefs.compactView || false);
                setSortBy(prefs.sortBy || 'day');
                setFilterByClass(prefs.filterByClass || 'all');
                setFavoriteShows(new Set(prefs.favoriteShows || []));
                setNotifications(new Set(prefs.notifications || []));
            } catch (error) {
                console.warn('Error loading schedule preferences:', error);
            }
        }
    }, []);

    // Save preferences to localStorage
    const savePreferences = useCallback(() => {
        const prefs = {
            viewMode,
            compactView,
            sortBy,
            filterByClass,
            favoriteShows: Array.from(favoriteShows),
            notifications: Array.from(notifications)
        };
        localStorage.setItem('schedule_preferences', JSON.stringify(prefs));
    }, [viewMode, compactView, sortBy, filterByClass, favoriteShows, notifications]);

    useEffect(() => {
        savePreferences();
    }, [savePreferences]);

    const userCorps = useMemo(() => {
        return loggedInProfile ? getAllUserCorps(loggedInProfile) : {};
    }, [loggedInProfile]);

    const {
        seasonSettings,
        fantasyRecaps,
        attendanceStats,
        currentDay,
        isLoading,
        error
    } = useScheduleData();

    // Calculate derived values with proper timezone handling
    const currentWeek = Math.ceil(currentDay / 7);
    const maxWeeks = seasonSettings?.status === 'live-season' ? 10 : 7;
    const isLiveSeason = seasonSettings?.status === 'live-season';

    // Enhanced event filtering and sorting
    const filteredAndSortedEvents = useMemo(() => {
        if (!seasonSettings?.events) return [];
        
        let events = [...seasonSettings.events];

        // Apply basic filters
        if (quickFilter === 'today') {
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay === currentDay;
            });
        } else if (quickFilter === 'upcoming') {
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay > currentDay;
            });
        } else if (quickFilter === 'favorites') {
            events = events.filter(event => 
                event.shows?.some(show => favoriteShows.has(`${event.offSeasonDay || event.dayIndex + 1}_${show.eventName}`))
            );
        }

        // Week filter for calendar view
        if (viewMode === 'calendar' && quickFilter === 'all') {
            const startDayOfWeek = (selectedWeek - 1) * 7 + 1;
            const endDayOfWeek = selectedWeek * 7;
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay >= startDayOfWeek && eventDay <= endDayOfWeek;
            });
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            events = events.filter(event => 
                event.shows?.some(show => 
                    show.eventName.toLowerCase().includes(term) ||
                    show.location?.toLowerCase().includes(term)
                )
            );
        }

        // Class filter
        if (filterByClass !== 'all') {
            events = events.filter(event => 
                event.shows?.some(show => {
                    const attendance = attendanceStats?.shows?.[`${event.offSeasonDay || event.dayIndex + 1}_${show.eventName}`];
                    return attendance?.counts?.[filterByClass] > 0;
                })
            );
        }

        // My corps filter
        if (showMyCorpsOnly && Object.keys(userCorps).length > 0) {
            events = events.filter(event => 
                event.shows?.some(show => {
                    const attendance = attendanceStats?.shows?.[`${event.offSeasonDay || event.dayIndex + 1}_${show.eventName}`];
                    if (!attendance?.attendees) return false;
                    
                    return Object.values(attendance.attendees).some(classAttendees =>
                        classAttendees.some(attendee => 
                            Object.values(userCorps).some(corps => corps.name === attendee.corpsName)
                        )
                    );
                })
            );
        }

        // Selected corps filter
        if (selectedCorps.size > 0) {
            events = events.filter(event => 
                event.shows?.some(show => {
                    const attendance = attendanceStats?.shows?.[`${event.offSeasonDay || event.dayIndex + 1}_${show.eventName}`];
                    if (!attendance?.attendees) return false;
                    
                    return Object.values(attendance.attendees).some(classAttendees =>
                        classAttendees.some(attendee => selectedCorps.has(attendee.corpsName))
                    );
                })
            );
        }

        // Enhanced sorting
        events.sort((a, b) => {
            const aDayNumber = isLiveSeason ? a.dayIndex + 1 : a.offSeasonDay;
            const bDayNumber = isLiveSeason ? b.dayIndex + 1 : b.offSeasonDay;
            
            switch (sortBy) {
                case 'attendance':
                    const aTotal = a.shows?.reduce((sum, show) => {
                        const attendance = attendanceStats?.shows?.[`${aDayNumber}_${show.eventName}`];
                        return sum + (attendance?.counts?.worldClass || 0) + (attendance?.counts?.openClass || 0) + (attendance?.counts?.aClass || 0);
                    }, 0) || 0;
                    const bTotal = b.shows?.reduce((sum, show) => {
                        const attendance = attendanceStats?.shows?.[`${bDayNumber}_${show.eventName}`];
                        return sum + (attendance?.counts?.worldClass || 0) + (attendance?.counts?.openClass || 0) + (attendance?.counts?.aClass || 0);
                    }, 0) || 0;
                    return bTotal - aTotal;
                    
                case 'name':
                    const aName = a.shows?.[0]?.eventName || '';
                    const bName = b.shows?.[0]?.eventName || '';
                    return aName.localeCompare(bName);
                    
                case 'location':
                    const aLocation = a.shows?.[0]?.location || '';
                    const bLocation = b.shows?.[0]?.location || '';
                    return aLocation.localeCompare(bLocation);
                    
                default: // 'day'
                    return aDayNumber - bDayNumber;
            }
        });

        return events;
    }, [
        seasonSettings, quickFilter, selectedWeek, viewMode, currentDay, isLiveSeason,
        searchTerm, filterByClass, showMyCorpsOnly, selectedCorps, userCorps,
        attendanceStats, favoriteShows, sortBy
    ]);

    // Event handlers
    const handleViewRecap = useCallback((dayNumber) => {
        navigate(`/scores?day=${dayNumber}`);
    }, [navigate]);

    const handleCloseModal = useCallback(() => {
        setSelectedModal(null);
        setModalData(null);
    }, []);

    const jumpToWeek = useCallback((weekNumber) => {
        setSelectedWeek(weekNumber);
        setQuickFilter('all');
    }, []);

    const toggleFavoriteShow = useCallback((dayNumber, eventName) => {
        const showKey = `${dayNumber}_${eventName}`;
        setFavoriteShows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(showKey)) {
                newSet.delete(showKey);
            } else {
                newSet.add(showKey);
            }
            return newSet;
        });
    }, []);

    const toggleNotification = useCallback((dayNumber, eventName) => {
        const showKey = `${dayNumber}_${eventName}`;
        setNotifications(prev => {
            const newSet = new Set(prev);
            if (newSet.has(showKey)) {
                newSet.delete(showKey);
            } else {
                newSet.add(showKey);
            }
            return newSet;
        });
    }, []);

    const handleBulkActions = useCallback((action, selectedShows) => {
        switch (action) {
            case 'favorite':
                setFavoriteShows(prev => new Set([...prev, ...selectedShows]));
                break;
            case 'unfavorite':
                setFavoriteShows(prev => {
                    const newSet = new Set(prev);
                    selectedShows.forEach(show => newSet.delete(show));
                    return newSet;
                });
                break;
            case 'notify':
                setNotifications(prev => new Set([...prev, ...selectedShows]));
                break;
            case 'unnotify':
                setNotifications(prev => {
                    const newSet = new Set(prev);
                    selectedShows.forEach(show => newSet.delete(show));
                    return newSet;
                });
                break;
        }
    }, []);

    // Set initial week to current week
    useEffect(() => {
        if (currentDay > 0) {
            const currentWeekValue = Math.ceil(currentDay / 7);
            setSelectedWeek(currentWeekValue);
        }
    }, [currentDay]);

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark">
                <div className="container mx-auto px-4 py-8">
                    <div className="space-y-6">
                        {/* Enhanced Loading Skeleton */}
                        <div className="animate-pulse">
                            <div className="h-8 bg-accent/20 rounded w-1/3 mb-4"></div>
                            <div className="h-4 bg-accent/20 rounded w-1/2 mb-6"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Sidebar skeleton */}
                            <div className="lg:col-span-1">
                                <div className="animate-pulse bg-surface dark:bg-surface-dark p-4 rounded-theme">
                                    <div className="h-6 bg-accent/20 rounded w-3/4 mb-4"></div>
                                    {Array.from({ length: 4 }, (_, i) => (
                                        <div key={i} className="h-4 bg-accent/20 rounded w-full mb-2"></div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Main content skeleton */}
                            <div className="lg:col-span-3">
                                <div className="animate-pulse space-y-4">
                                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme">
                                        <div className="h-10 bg-accent/20 rounded w-full mb-4"></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Array.from({ length: 6 }, (_, i) => (
                                                <div key={i} className="p-4 border border-accent/20 rounded-theme">
                                                    <div className="h-5 bg-accent/20 rounded w-3/4 mb-2"></div>
                                                    <div className="h-4 bg-accent/20 rounded w-1/2 mb-3"></div>
                                                    <div className="h-8 bg-accent/20 rounded w-full"></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-lg mx-auto text-center">
                        <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border border-red-500/20">
                            <div className="text-6xl mb-4">⚠️</div>
                            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                Schedule Unavailable
                            </h2>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                                {error.message || 'There was an error loading the schedule data.'}
                            </p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-6 rounded-theme"
                            >
                                Retry Loading
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                    {/* Enhanced Header */}
                    <ScheduleHeader
                        seasonSettings={seasonSettings}
                        currentDay={currentDay}
                        currentWeek={currentWeek}
                        totalEvents={filteredAndSortedEvents.length}
                        viewMode={viewMode}
                        notifications={notifications}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Enhanced Sidebar */}
                        <div className="lg:col-span-1">
                            <div className="space-y-4">
                                {/* Personal Schedule */}
                                {loggedInProfile && Object.keys(userCorps).length > 0 && (
                                    <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                                        <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                            My Corps Schedule
                                        </h3>
                                        <PersonalSchedule
                                            userCorps={userCorps}
                                            seasonEvents={filteredAndSortedEvents}
                                            attendanceStats={attendanceStats}
                                            currentDay={currentDay}
                                            compact={true}
                                        />
                                    </div>
                                )}

                                {/* Enhanced Filters */}
                                <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                        Filters & Search
                                    </h3>
                                    
                                    {/* Search */}
                                    <div className="mb-4">
                                        <input
                                            type="text"
                                            placeholder="Search events..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:ring-2 focus:ring-primary focus:border-primary text-text-primary dark:text-text-primary-dark"
                                        />
                                    </div>

                                    {/* Corps Class Filter */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
                                            Corps Class
                                        </label>
                                        <select
                                            value={filterByClass}
                                            onChange={(e) => setFilterByClass(e.target.value)}
                                            className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:ring-2 focus:ring-primary focus:border-primary text-text-primary dark:text-text-primary-dark"
                                        >
                                            <option value="all">All Classes</option>
                                            <option value="worldClass">World Class</option>
                                            <option value="openClass">Open Class</option>
                                            <option value="aClass">A Class</option>
                                        </select>
                                    </div>

                                    {/* Sort By */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
                                            Sort By
                                        </label>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:ring-2 focus:ring-primary focus:border-primary text-text-primary dark:text-text-primary-dark"
                                        >
                                            <option value="day">By Day</option>
                                            <option value="attendance">By Attendance</option>
                                            <option value="name">By Event Name</option>
                                            <option value="location">By Location</option>
                                        </select>
                                    </div>

                                    {/* Quick Toggles */}
                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={showMyCorpsOnly}
                                                onChange={(e) => setShowMyCorpsOnly(e.target.checked)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-text-primary dark:text-text-primary-dark">
                                                My Corps Only
                                            </span>
                                        </label>
                                        
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={compactView}
                                                onChange={(e) => setCompactView(e.target.checked)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-text-primary dark:text-text-primary-dark">
                                                Compact View
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                        Quick Stats
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary dark:text-text-secondary-dark">Total Events:</span>
                                            <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                                {filteredAndSortedEvents.length}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary dark:text-text-secondary-dark">Favorites:</span>
                                            <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                                {favoriteShows.size}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary dark:text-text-secondary-dark">Notifications:</span>
                                            <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                                {notifications.size}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="lg:col-span-3">
                            <div className="space-y-6">
                                {/* Enhanced Controls */}
                                <ScheduleControls
                                    viewMode={viewMode}
                                    setViewMode={setViewMode}
                                    quickFilter={quickFilter}
                                    setQuickFilter={setQuickFilter}
                                    currentWeek={currentWeek}
                                    goToCurrentWeek={() => jumpToWeek(currentWeek)}
                                    seasonType={seasonSettings?.status === 'live-season' ? 'live' : 'off'}
                                    compactView={compactView}
                                    setCompactView={setCompactView}
                                    onBulkActions={handleBulkActions}
                                />

                                {/* Week Navigation */}
                                {viewMode === 'calendar' && quickFilter === 'all' && (
                                    <WeekNavigation
                                        selectedWeek={selectedWeek}
                                        setSelectedWeek={setSelectedWeek}
                                        currentWeek={currentWeek}
                                        maxWeeks={maxWeeks}
                                        jumpToWeek={jumpToWeek}
                                        seasonSettings={seasonSettings}
                                    />
                                )}

                                {/* Enhanced Events Display */}
                                <EventsDisplay
                                    events={filteredAndSortedEvents}
                                    seasonSettings={seasonSettings}
                                    fantasyRecaps={fantasyRecaps}
                                    attendanceStats={attendanceStats}
                                    currentDay={currentDay}
                                    selectedWeek={selectedWeek}
                                    quickFilter={quickFilter}
                                    compactView={compactView}
                                    favoriteShows={favoriteShows}
                                    notifications={notifications}
                                    userCorps={userCorps}
                                    onViewRecap={handleViewRecap}
                                    onShowModal={setSelectedModal}
                                    onSetModalData={setModalData}
                                    onToggleFavorite={toggleFavoriteShow}
                                    onToggleNotification={toggleNotification}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Modal */}
                    <ScheduleModal
                        isOpen={selectedModal !== null}
                        onClose={handleCloseModal}
                        modalType={selectedModal}
                        modalData={modalData}
                        favoriteShows={favoriteShows}
                        notifications={notifications}
                        onToggleFavorite={toggleFavoriteShow}
                        onToggleNotification={toggleNotification}
                        userCorps={userCorps}
                    />
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;