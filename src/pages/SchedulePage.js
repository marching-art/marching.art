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
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading schedule...</p>
                </div>
            </div>
        );
    }

    if (error || !seasonSettings) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        {error ? 'Error Loading Schedule' : 'No Active Season'}
                    </h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        {error?.message || "There's no active season schedule to display."}
                    </p>
                </div>
            </div>
        );
    }

    const isLiveSeason = seasonSettings.status === 'live-season';
    const maxWeeks = isLiveSeason ? 10 : 7;
    const currentWeek = Math.ceil(currentDay / 7);

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    <ScheduleHeader 
                        seasonName={seasonSettings.name}
                        isLiveSeason={isLiveSeason}
                        currentDay={currentDay}
                    />

                    <ScheduleControls
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        quickFilter={quickFilter}
                        setQuickFilter={setQuickFilter}
                        goToCurrentWeek={goToCurrentWeek}
                        hasUserCorps={Object.keys(userCorps).length > 0}
                    />

                    {/* Personal Schedule View */}
                    {viewMode === 'personal' && Object.keys(userCorps).length > 0 && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <PersonalSchedule
                                userCorps={userCorps}
                                seasonEvents={seasonSettings.events || []}
                                currentDay={currentDay}
                                seasonStartDate={seasonSettings.schedule?.startDate}
                                seasonMode={isLiveSeason ? 'live' : 'off'}
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