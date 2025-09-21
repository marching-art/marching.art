import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import { getLocalCalendarDate, formatDate, isToday, isPastDate } from '../../utils/dateUtils';
import Icon from '../ui/Icon';

const CorpsSchedule = ({ 
    seasonSettings, 
    userCorps = {},
    seasonStartDate,
    hideTitle = false // Allow hiding the duplicate title
}) => {
    const { user } = useUserStore();
    const [userRegistrations, setUserRegistrations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);

    // Load user's show registrations
    useEffect(() => {
        const loadUserRegistrations = async () => {
            if (!user || !seasonSettings?.seasonUid) return;

            setIsLoading(true);
            try {
                const registrationsQuery = query(
                    collection(db, `artifacts/prod/users/${user.uid}/show_registrations`),
                    where('seasonUid', '==', seasonSettings.seasonUid),
                    where('registered', '==', true)
                );

                const snapshot = await getDocs(registrationsQuery);
                const registrations = [];

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    registrations.push({
                        id: doc.id,
                        ...data
                    });
                });

                setUserRegistrations(registrations);
            } catch (error) {
                console.error('Error loading user registrations:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserRegistrations();
    }, [user, seasonSettings?.seasonUid]);

    // Organize schedule by day, then by show, with stable sorting
    const organizedSchedule = useMemo(() => {
        if (!userRegistrations.length || !seasonStartDate) return {};

        const schedule = {};

        // Group registrations by day
        userRegistrations.forEach(registration => {
            const { dayNumber, eventName, location, corpsName, corpsClass } = registration;
            
            if (!schedule[dayNumber]) {
                schedule[dayNumber] = {
                    day: dayNumber,
                    date: getLocalCalendarDate(seasonStartDate, dayNumber),
                    shows: {}
                };
            }

            const showKey = `${dayNumber}_${eventName}`;
            if (!schedule[dayNumber].shows[showKey]) {
                schedule[dayNumber].shows[showKey] = {
                    eventName,
                    location,
                    attendingCorps: []
                };
            }

            // Add corps to the show (avoid duplicates)
            const existingCorps = schedule[dayNumber].shows[showKey].attendingCorps
                .find(c => c.name === corpsName && c.class === corpsClass);
            
            if (!existingCorps) {
                schedule[dayNumber].shows[showKey].attendingCorps.push({
                    name: corpsName,
                    class: corpsClass,
                    classDisplay: corpsClass === 'worldClass' ? 'World Class' :
                                 corpsClass === 'openClass' ? 'Open Class' : 'A Class'
                });
            }
        });

        // Sort corps within each show by class, then by name (stable sort)
        Object.values(schedule).forEach(day => {
            Object.values(day.shows).forEach(show => {
                show.attendingCorps.sort((a, b) => {
                    // First sort by class hierarchy
                    const classOrder = { worldClass: 0, openClass: 1, aClass: 2 };
                    const classComparison = classOrder[a.class] - classOrder[b.class];
                    if (classComparison !== 0) return classComparison;
                    
                    // Then sort by corps name
                    return a.name.localeCompare(b.name);
                });
            });
        });

        return schedule;
    }, [userRegistrations, seasonStartDate]);

    // Get sorted days (stable sort)
    const sortedDays = useMemo(() => {
        return Object.values(organizedSchedule)
            .sort((a, b) => a.day - b.day);
    }, [organizedSchedule]);

    // Get upcoming shows (next 3 days)
    const upcomingShows = useMemo(() => {
        const upcoming = [];
        const today = new Date();
        
        sortedDays.forEach(day => {
            if (day.date && !isPastDate(day.date)) {
                Object.values(day.shows).forEach(show => {
                    upcoming.push({
                        ...show,
                        day: day.day,
                        date: day.date,
                        isToday: isToday(day.date)
                    });
                });
            }
        });

        return upcoming.slice(0, 5); // Limit to next 5 shows
    }, [sortedDays]);

    if (isLoading) {
        return (
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                {!hideTitle && (
                    <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        My Corps Schedule
                    </h3>
                )}
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark"></div>
                    <span className="ml-3 text-text-secondary dark:text-text-secondary-dark">
                        Loading your schedule...
                    </span>
                </div>
            </div>
        );
    }

    if (!userRegistrations.length) {
        return (
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                {!hideTitle && (
                    <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        My Corps Schedule
                    </h3>
                )}
                <div className="text-center py-8">
                    <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" className="w-12 h-12 text-text-secondary dark:text-text-secondary-dark mx-auto mb-3" />
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-2">
                        No shows registered yet
                    </p>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        Visit the Schedule page to register your corps for events
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
            {!hideTitle && (
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-6">
                    My Corps Schedule
                </h3>
            )}

            {/* Quick Overview - Next Shows */}
            <div className="mb-6">
                <h4 className="text-md font-semibold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                    <Icon path="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5" />
                    Next Shows
                </h4>
                
                {upcomingShows.length > 0 ? (
                    <div className="space-y-3">
                        {upcomingShows.map((show, index) => (
                            <div 
                                key={`${show.day}_${show.eventName}`}
                                className={`p-3 rounded-theme border transition-colors ${
                                    show.isToday 
                                        ? 'bg-primary/10 dark:bg-primary-dark/10 border-primary dark:border-primary-dark' 
                                        : 'bg-accent dark:bg-accent-dark/20 border-accent dark:border-accent-dark'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {show.isToday && (
                                            <span className="px-2 py-1 bg-primary dark:bg-primary-dark text-white text-xs font-bold rounded-theme">
                                                TODAY
                                            </span>
                                        )}
                                        <h5 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {show.eventName}
                                        </h5>
                                    </div>
                                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        Day {show.day}
                                    </span>
                                </div>
                                
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                                    {formatDate(show.date, { includeDay: true, compact: false })}
                                    {show.location && ` • ${show.location}`}
                                </p>
                                
                                <div className="flex flex-wrap gap-2">
                                    {show.attendingCorps.map((corps, corpIndex) => (
                                        <span 
                                            key={`${corps.name}_${corps.class}`}
                                            className={`px-2 py-1 text-xs font-medium rounded-theme ${
                                                corps.class === 'worldClass' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' :
                                                corps.class === 'openClass' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
                                                'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200'
                                            }`}
                                        >
                                            {corps.name} ({corps.classDisplay})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        No upcoming shows scheduled
                    </p>
                )}
            </div>

            {/* Full Schedule Toggle */}
            <div className="border-t border-accent dark:border-accent-dark pt-4">
                <button
                    onClick={() => setSelectedDay(selectedDay ? null : 'all')}
                    className="flex items-center gap-2 text-sm text-primary dark:text-primary-dark hover:text-primary-dark dark:hover:text-primary transition-colors"
                >
                    <Icon 
                        path={selectedDay ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} 
                        className="w-4 h-4" 
                    />
                    {selectedDay ? 'Hide Full Schedule' : 'View Full Schedule'}
                </button>

                {/* Full Schedule Display */}
                {selectedDay && (
                    <div className="mt-4 space-y-4">
                        {sortedDays.map(day => (
                            <div key={day.day} className="border border-accent dark:border-accent-dark rounded-theme p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-semibold text-text-primary dark:text-text-primary-dark flex items-center gap-2">
                                        <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" className="w-4 h-4" />
                                        Day {day.day}
                                        {day.date && isToday(day.date) && (
                                            <span className="px-2 py-1 bg-primary dark:bg-primary-dark text-white text-xs font-bold rounded-theme">
                                                TODAY
                                            </span>
                                        )}
                                    </h5>
                                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        {day.date && formatDate(day.date, { includeDay: true, compact: true })}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {Object.values(day.shows)
                                        .sort((a, b) => a.eventName.localeCompare(b.eventName))
                                        .map(show => (
                                        <div key={`${day.day}_${show.eventName}`} className="bg-accent dark:bg-accent-dark/20 rounded-theme p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h6 className="font-medium text-text-primary dark:text-text-primary-dark">
                                                    {show.eventName}
                                                </h6>
                                                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    {show.attendingCorps.length} corps
                                                </span>
                                            </div>
                                            
                                            {show.location && (
                                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-2 flex items-center gap-1">
                                                    <Icon path="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" className="w-4 h-4" />
                                                    {show.location}
                                                </p>
                                            )}

                                            <div className="space-y-2">
                                                {show.attendingCorps.map((corps, corpIndex) => (
                                                    <div key={`${corps.name}_${corps.class}`} className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full ${
                                                            corps.class === 'worldClass' ? 'bg-blue-500' :
                                                            corps.class === 'openClass' ? 'bg-green-500' : 'bg-purple-500'
                                                        }`}></div>
                                                        <span className="text-sm text-text-primary dark:text-text-primary-dark font-medium">
                                                            {corps.name}
                                                        </span>
                                                        <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            ({corps.classDisplay})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        
                        {sortedDays.length === 0 && (
                            <p className="text-center text-text-secondary dark:text-text-secondary-dark py-4">
                                No shows in your schedule
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CorpsSchedule;