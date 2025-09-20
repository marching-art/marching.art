import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps } from '../utils/profileCompatibility';
import PersonalSchedule from '../components/dashboard/PersonalSchedule';
import ScheduleHeader from '../components/schedule/ScheduleHeader';
import ScheduleControls from '../components/schedule/ScheduleControls';
import WeekNavigation from '../components/schedule/WeekNavigation';
import EventsDisplay from '../components/schedule/EventsDisplay';
import ScheduleModal from '../components/schedule/ScheduleModal';
import { useScheduleData } from '../hooks/useScheduleData';

const SchedulePage = () => {
    const navigate = useNavigate();
    const { loggedInProfile } = useUserStore();
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [viewMode, setViewMode] = useState('calendar');
    const [quickFilter, setQuickFilter] = useState('all');
    const [selectedModal, setSelectedModal] = useState(null);
    const [modalData, setModalData] = useState(null);

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

    // Set initial week to current week
    useEffect(() => {
        if (currentDay > 0) {
            const currentWeekValue = Math.ceil(currentDay / 7);
            setSelectedWeek(currentWeekValue);
        }
    }, [currentDay]);

    const filteredEvents = useMemo(() => {
        if (!seasonSettings?.events) return [];
        
        const isLiveSeason = seasonSettings.status === 'live-season';
        let events = seasonSettings.events;

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
        }

        if (viewMode === 'calendar') {
            const startDayOfWeek = (selectedWeek - 1) * 7 + 1;
            const endDayOfWeek = selectedWeek * 7;
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay >= startDayOfWeek && eventDay <= endDayOfWeek;
            });
        }

        return events;
    }, [seasonSettings, selectedWeek, viewMode, quickFilter, currentDay]);

    const handleViewRecap = (day) => {
        navigate(`/scores?day=${day}`);
    };

    const goToCurrentWeek = () => {
        const currentWeekValue = Math.ceil(currentDay / 7);
        setSelectedWeek(currentWeekValue);
    };

    const jumpToWeek = (weekNumber) => {
        setSelectedWeek(weekNumber);
        setQuickFilter('all');
    };

    const handleCloseModal = () => {
        setSelectedModal(null);
        setModalData(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark">
                <div className="container mx-auto px-4 py-8">
                    <div className="space-y-6">
                        {/* Header Skeleton */}
                        <div className="animate-pulse">
                            <div className="h-8 bg-accent/20 rounded w-1/4 mb-4"></div>
                            <div className="h-4 bg-accent/20 rounded w-1/2"></div>
                        </div>
                        
                        {/* Controls Skeleton */}
                        <div className="animate-pulse bg-surface dark:bg-surface-dark p-6 rounded-theme">
                            <div className="flex gap-4 mb-4">
                                <div className="h-10 bg-accent/20 rounded w-32"></div>
                                <div className="h-10 bg-accent/20 rounded w-32"></div>
                                <div className="h-10 bg-accent/20 rounded w-32"></div>
                            </div>
                            <div className="flex gap-2">
                                {Array.from({ length: 7 }, (_, i) => (
                                    <div key={i} className="h-8 bg-accent/20 rounded w-16"></div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Events Skeleton */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme">
                            <div className="animate-pulse space-y-4">
                                {Array.from({ length: 3 }, (_, i) => (
                                    <div key={i} className="space-y-4">
                                        <div className="h-6 bg-accent/20 rounded w-1/3"></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Array.from({ length: 3 }, (_, j) => (
                                                <div key={j} className="p-4 border border-accent/20 rounded-theme">
                                                    <div className="h-5 bg-accent/20 rounded w-3/4 mb-2"></div>
                                                    <div className="h-4 bg-accent/20 rounded w-1/2 mb-3"></div>
                                                    <div className="h-8 bg-accent/20 rounded w-full"></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-md mx-auto text-center">
                        <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border border-red-500/20">
                            <div className="text-6xl mb-4">⚠️</div>
                            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                Unable to Load Schedule
                            </h2>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                                {error.message || 'There was an error loading the schedule data.'}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-primary text-on-primary px-6 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Normal render continues here...
    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                    <ScheduleHeader 
                        seasonSettings={seasonSettings}
                        userCorps={userCorps}
                        currentDay={currentDay}
                    />

                    <ScheduleControls
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        quickFilter={quickFilter}
                        setQuickFilter={setQuickFilter}
                        selectedWeek={selectedWeek}
                        setSelectedWeek={setSelectedWeek}
                        currentWeek={currentWeek}
                        maxWeeks={maxWeeks}
                        onJumpToWeek={jumpToWeek}
                    />

                    {/* Personal Schedule */}
                    {Object.keys(userCorps).length > 0 && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <PersonalSchedule
                                userCorps={userCorps}
                                seasonEvents={seasonSettings?.events}
                                currentDay={currentDay}
                                seasonMode={seasonSettings?.status === 'live-season' ? 'live' : 'off'}
                            />
                        </div>
                    )}

                    {/* Calendar View */}
                    {viewMode === 'calendar' && (
                        <>
                            {quickFilter === 'all' && (
                                <WeekNavigation
                                    selectedWeek={selectedWeek}
                                    setSelectedWeek={setSelectedWeek}
                                    currentWeek={currentWeek}
                                    maxWeeks={maxWeeks}
                                    jumpToWeek={jumpToWeek}
                                />
                            )}

                            <EventsDisplay
                                events={filteredEvents}
                                seasonSettings={seasonSettings}
                                fantasyRecaps={fantasyRecaps}
                                attendanceStats={attendanceStats}
                                currentDay={currentDay}
                                selectedWeek={selectedWeek}
                                quickFilter={quickFilter}
                                onViewRecap={handleViewRecap}
                                onShowModal={setSelectedModal}
                                onSetModalData={setModalData}
                            />
                        </>
                    )}

                    <ScheduleModal
                        isOpen={selectedModal !== null}
                        onClose={handleCloseModal}
                        modalType={selectedModal}
                        modalData={modalData}
                    />
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;