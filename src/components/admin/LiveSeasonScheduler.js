// src/components/admin/LiveSeasonScheduler.js - Updated with Championship System
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const WEEKS = 10;
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LiveSeasonScheduler = () => {
    const [schedule, setSchedule] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [modalEvent, setModalEvent] = useState({ name: '', location: '' });

    useEffect(() => {
        fetchCurrentSchedule();
    }, []);

    const fetchCurrentSchedule = async () => {
        try {
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);
            
            if (seasonSnap.exists()) {
                const seasonData = seasonSnap.data();
                if (seasonData.events) {
                    setSchedule(seasonData.events);
                } else {
                    // Initialize with championship system
                    initializeChampionshipSchedule();
                }
            }
        } catch (error) {
            console.error('Error fetching schedule:', error);
        }
    };

    const initializeChampionshipSchedule = () => {
        const newSchedule = [];
        
        for (let dayIndex = 0; dayIndex < WEEKS * 7; dayIndex++) {
            const dayNumber = dayIndex + 1;
            const week = Math.ceil(dayNumber / 7);
            
            // Championship week (final 3 days)
            if (dayNumber === 68) {
                newSchedule.push({
                    dayIndex,
                    week,
                    shows: [{
                        eventName: "DCI World Championship Prelims",
                        location: "Indianapolis, IN",
                        mandatory: true,
                        isChampionship: true,
                        eligibleCorpsClasses: ['aClass', 'openClass', 'worldClass']
                    }]
                });
            } else if (dayNumber === 69) {
                newSchedule.push({
                    dayIndex,
                    week,
                    shows: [{
                        eventName: "DCI World Championship Semifinals",
                        location: "Indianapolis, IN",
                        mandatory: true,
                        isChampionship: true,
                        eligibleCorpsClasses: ['aClass', 'openClass', 'worldClass']
                    }]
                });
            } else if (dayNumber === 70) {
                newSchedule.push({
                    dayIndex,
                    week,
                    shows: [
                        {
                            eventName: "DCI World Championship Finals",
                            location: "Indianapolis, IN",
                            mandatory: true,
                            isChampionship: true,
                            eligibleCorpsClasses: ['aClass', 'openClass', 'worldClass']
                        },
                        {
                            eventName: "SoundSport International Music & Food Festival",
                            location: "Indianapolis, IN",
                            mandatory: true,
                            isSoundSportFestival: true,
                            eligibleCorpsClasses: ['soundSport']
                        }
                    ]
                });
            } else {
                // Regular season days
                newSchedule.push({
                    dayIndex,
                    week,
                    shows: []
                });
            }
        }
        
        setSchedule(newSchedule);
    };

    const openModal = (dayIndex) => {
        const day = schedule.find(d => d.dayIndex === dayIndex);
        const dayNumber = dayIndex + 1;
        
        // Don't allow editing championship days
        if ([68, 69, 70].includes(dayNumber)) {
            setMessage('Championship days cannot be edited. These events are automatically scheduled.');
            return;
        }
        
        setSelectedDay(dayIndex);
        setModalEvent({ name: '', location: '' });
    };

    const closeModal = () => {
        setSelectedDay(null);
        setModalEvent({ name: '', location: '' });
    };

    const addEvent = () => {
        if (!modalEvent.name.trim() || !modalEvent.location.trim()) {
            setMessage('Please enter both event name and location.');
            return;
        }

        const updatedSchedule = schedule.map(day => {
            if (day.dayIndex === selectedDay) {
                return {
                    ...day,
                    shows: [...day.shows, {
                        eventName: modalEvent.name.trim(),
                        location: modalEvent.location.trim(),
                        mandatory: false,
                        eligibleCorpsClasses: ['aClass', 'openClass', 'worldClass'] // Default eligibility
                    }]
                };
            }
            return day;
        });

        setSchedule(updatedSchedule);
        closeModal();
        setMessage(`Added "${modalEvent.name}" to Day ${selectedDay + 1}.`);
    };

    const removeEvent = (dayIndex, eventIndex) => {
        const dayNumber = dayIndex + 1;
        
        // Prevent removal of championship events
        if ([68, 69, 70].includes(dayNumber)) {
            setMessage('Championship events cannot be removed.');
            return;
        }

        const updatedSchedule = schedule.map(day => {
            if (day.dayIndex === dayIndex) {
                const newShows = [...day.shows];
                newShows.splice(eventIndex, 1);
                return { ...day, shows: newShows };
            }
            return day;
        });

        setSchedule(updatedSchedule);
    };

    const saveSchedule = async () => {
        setIsLoading(true);
        setMessage('');
        
        try {
            const seasonRef = doc(db, 'game-settings', 'season');
            await updateDoc(seasonRef, {
                events: schedule,
                championshipSystem: {
                    enabled: true,
                    prelimsDay: 68,
                    semisDay: 69,
                    finalsDay: 70,
                    soundSportFestivalDay: 70,
                    prelimsAdvancement: 25,
                    semisAdvancement: 12,
                }
            });
            setMessage('Live season schedule saved successfully!');
        } catch (error) {
            setMessage('Error saving schedule.');
            console.error(error);
        }
        setIsLoading(false);
    };

    const handleClearSchedule = () => {
        if (window.confirm('Are you sure you want to clear the schedule? Championship events will be preserved.')) {
            const clearedSchedule = schedule.map(day => {
                const dayNumber = day.dayIndex + 1;
                // Keep championship events
                if ([68, 69, 70].includes(dayNumber)) {
                    return day;
                }
                // Clear regular days
                return { ...day, shows: [] };
            });
            setSchedule(clearedSchedule);
            setMessage('Regular season schedule cleared. Championship events preserved.');
        }
    };

    const eventsByDay = schedule.reduce((acc, event) => {
        acc[event.dayIndex] = event.shows;
        return acc;
    }, {});

    const getEventTypeClass = (show) => {
        if (show.isChampionship) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
        if (show.isSoundSportFestival) return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
    };

    return (
        <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    Live Season Schedule (10 Weeks)
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleClearSchedule}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600"
                    >
                        Clear Schedule
                    </button>
                    <button
                        onClick={saveSchedule}
                        disabled={isLoading}
                        className="bg-primary text-on-primary px-6 py-2 rounded-lg font-semibold disabled:opacity-50 hover:bg-primary/90"
                    >
                        {isLoading ? 'Saving...' : 'Save Schedule'}
                    </button>
                </div>
            </div>

            {/* Championship Information */}
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Championship System Active</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
                    <div>
                        <p><strong>Day 68:</strong> World Championship Prelims (All A/Open/World Class)</p>
                        <p><strong>Day 69:</strong> Semifinals (Top 25 from Prelims)</p>
                        <p><strong>Day 70:</strong> Finals (Top 12 from Semifinals)</p>
                    </div>
                    <div>
                        <p><strong>Day 70:</strong> SoundSport Festival (All SoundSport teams)</p>
                        <p><strong>Note:</strong> Championship events are automatically scheduled and cannot be edited.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-bold mb-2 text-text-secondary dark:text-text-secondary-dark">
                {DAYS_OF_WEEK.map(day => <div key={day}>{day}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: WEEKS * 7 }).map((_, dayIndex) => {
                    const events = eventsByDay[dayIndex] || [];
                    const isChampionshipWeek = dayIndex >= 67; // Days 68-70
                    const dayNumber = dayIndex + 1;
                    
                    let championshipEvent = null;
                    if (dayNumber === 68) championshipEvent = { name: 'Prelims', location: 'Indianapolis, IN' };
                    if (dayNumber === 69) championshipEvent = { name: 'Semi-Finals', location: 'Indianapolis, IN' };
                    if (dayNumber === 70) championshipEvent = { name: 'Finals + SoundSport', location: 'Indianapolis, IN' };

                    return (
                        <div 
                            key={dayIndex} 
                            onClick={() => openModal(dayIndex)}
                            className={`h-28 bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme p-1 text-xs ${!isChampionshipWeek && 'cursor-pointer hover:bg-accent dark:hover:bg-accent-dark/20'} transition-colors overflow-y-auto ${isChampionshipWeek ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : ''}`}
                        >
                            <div className="font-bold text-text-primary dark:text-text-primary-dark mb-1">
                                Day {dayNumber}
                            </div>
                            
                            {championshipEvent && (
                                <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded p-1 mb-1">
                                    <div className="font-semibold text-red-800 dark:text-red-200 text-xs">
                                        {championshipEvent.name}
                                    </div>
                                    <div className="text-red-600 dark:text-red-300 text-xs">
                                        {championshipEvent.location}
                                    </div>
                                </div>
                            )}
                            
                            {events.map((show, eventIndex) => (
                                <div 
                                    key={eventIndex} 
                                    className={`rounded p-1 mb-1 border text-xs ${getEventTypeClass(show)}`}
                                >
                                    <div className="font-semibold truncate">
                                        {show.eventName}
                                    </div>
                                    <div className="text-xs opacity-75 truncate">
                                        {show.location}
                                    </div>
                                    {!isChampionshipWeek && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeEvent(dayIndex, eventIndex);
                                            }}
                                            className="text-red-500 hover:text-red-700 text-xs mt-1"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Event Modal */}
            {selectedDay !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg max-w-md w-full mx-4">
                        <h4 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Add Event for Day {selectedDay + 1}
                        </h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                    Event Name
                                </label>
                                <input
                                    type="text"
                                    value={modalEvent.name}
                                    onChange={(e) => setModalEvent(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full p-3 border border-accent dark:border-accent-dark rounded-lg bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark"
                                    placeholder="e.g., Summer Music Games"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    value={modalEvent.location}
                                    onChange={(e) => setModalEvent(prev => ({ ...prev, location: e.target.value }))}
                                    className="w-full p-3 border border-accent dark:border-accent-dark rounded-lg bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark"
                                    placeholder="e.g., Lucas Oil Stadium, Indianapolis, IN"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={addEvent}
                                className="flex-1 bg-primary text-on-primary py-2 px-4 rounded-lg font-semibold hover:bg-primary/90"
                            >
                                Add Event
                            </button>
                            <button
                                onClick={closeModal}
                                className="flex-1 bg-secondary text-on-secondary py-2 px-4 rounded-lg font-semibold hover:bg-secondary/90"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Message */}
            {message && (
                <div className={`mt-4 p-4 rounded-lg ${
                    message.includes('Error') 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200' 
                        : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default LiveSeasonScheduler;