import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, functions } from '../../firebase'; // Assuming firebase.js is in src folder
import { httpsCallable } from 'firebase/functions';

// Re-defining UI components here for modularity. In a real app, these would be in their own files.
const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const sizeClasses = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className={`bg-white dark:bg-gray-800 border-2 border-yellow-500 rounded-md shadow-lg w-full ${sizeClasses[size]} p-6 relative text-gray-800 dark:text-yellow-300`}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 dark:text-yellow-400 hover:text-gray-800 dark:hover:text-yellow-200 transition-colors">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                <h2 className="text-2xl font-bold mb-4 text-yellow-600 dark:text-yellow-400 tracking-wider">{title}</h2>
                {children}
            </div>
        </div>
    );
};


const LiveSeasonScheduler = () => {
    const [schedule, setSchedule] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [newEvent, setNewEvent] = useState({ name: '', location: '', type: 'Standard' });
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');

    const WEEKS = 10;
    const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    useEffect(() => {
        const docRef = doc(db, 'schedules', 'live_season_template');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setSchedule(docSnap.data().events || []);
            } else {
                setSchedule([]);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const openModal = (dayIndex) => {
        if (dayIndex >= 67) return; // Make finals week uneditable
        setSelectedDay(dayIndex);
        setNewEvent({ name: '', location: '', type: 'Standard' });
        setIsModalOpen(true);
    };

    const handleAddEvent = () => {
        if (!newEvent.name.trim() || selectedDay === null) return;
        const week = Math.floor(selectedDay / 7) + 1;
        const dayName = DAYS_OF_WEEK[selectedDay % 7];
        const finalEvent = { ...newEvent, week, day: dayName, dayIndex: selectedDay };
        setSchedule(prev => [...prev, finalEvent]);
        setNewEvent({ name: '', location: '', type: 'Standard' }); // Reset for next add
    };
    
    const handleRemoveEvent = (dayIndex, eventName) => {
        setSchedule(prev => prev.filter(event => !(event.dayIndex === dayIndex && event.name === eventName)));
    };

    const handleSaveSchedule = async () => {
        setIsLoading(true);
        setMessage('');
        try {
            const scheduleRef = doc(db, 'schedules', 'live_season_template');
            await setDoc(scheduleRef, { events: schedule });
            setMessage('Schedule saved successfully!');
        } catch (error) {
            setMessage('Error saving schedule.');
            console.error(error);
        }
        setIsLoading(false);
    };

    const handleClearSchedule = () => {
        if (window.confirm('Are you sure you want to clear the entire live schedule? This cannot be undone.')) {
            setSchedule([]);
        }
    };

    const eventsByDay = schedule.reduce((acc, event) => {
        if (!acc[event.dayIndex]) {
            acc[event.dayIndex] = [];
        }
        acc[event.dayIndex].push(event);
        return acc;
    }, {});

    return (
        <div className="mt-6">
            <h3 className="text-xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Live Season Schedule (10 Weeks)</h3>
            <div className="grid grid-cols-7 gap-1 text-center font-bold mb-2">
                {DAYS_OF_WEEK.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: WEEKS * 7 }).map((_, dayIndex) => {
                    const events = eventsByDay[dayIndex] || [];
                    const isChampionshipWeek = dayIndex >= 67; // Days 68, 69, 70
                    const dayNumber = dayIndex + 1;
                    
                    let championshipEvent = null;
                    if (dayNumber === 68) championshipEvent = { name: 'Prelims', location: 'Indianapolis, IN' };
                    if (dayNumber === 69) championshipEvent = { name: 'Semi-Finals', location: 'Indianapolis, IN' };
                    if (dayNumber === 70) championshipEvent = { name: 'Finals', location: 'Indianapolis, IN' };

                    return (
                        <div 
                            key={dayIndex} 
                            onClick={() => openModal(dayIndex)}
                            className={`h-28 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-1 text-xs ${!isChampionshipWeek && 'cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900'} transition-colors overflow-y-auto ${isChampionshipWeek ? 'bg-yellow-100 dark:bg-yellow-900/50' : ''}`}
                        >
                            <span className="font-bold text-gray-500 dark:text-gray-400">{dayNumber}</span>
                            {championshipEvent && (
                                <div className="bg-yellow-200 dark:bg-yellow-800 p-1 rounded mt-1 text-black dark:text-white">
                                    <p className="font-bold truncate">{championshipEvent.name}</p>
                                    <p className="truncate">{championshipEvent.location}</p>
                                </div>
                            )}
                            {events.map(event => (
                                <div key={event.name} className="bg-blue-200 dark:bg-blue-800 p-1 rounded mt-1 text-black dark:text-white">
                                    <p className="font-bold truncate">{event.name}</p>
                                    <p className="truncate">{event.location}</p>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-end items-center space-x-4 mt-4">
                {message && <p className="text-sm font-semibold">{message}</p>}
                <button onClick={handleClearSchedule} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded">Clear Schedule</button>
                <button onClick={handleSaveSchedule} disabled={isLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                    {isLoading ? 'Saving...' : 'Save Live Schedule'}
                </button>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Manage Shows for Day ${selectedDay + 1}`}>
                <div className="space-y-4">
                    <div className="border-b border-gray-300 dark:border-gray-600 pb-4">
                        <h4 className="font-bold mb-2">Existing Shows on this Day:</h4>
                        {(eventsByDay[selectedDay] || []).length > 0 ? (
                            <ul className="space-y-2">
                                {(eventsByDay[selectedDay]).map(event => (
                                    <li key={event.name} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                        <span>{event.name} <em className="text-gray-500">({event.location})</em></span>
                                        <button onClick={() => handleRemoveEvent(selectedDay, event.name)} className="text-red-500 hover:text-red-700">
                                            <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4"/>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500">No shows scheduled for this day.</p>}
                    </div>
                    <div>
                        <h4 className="font-bold mb-2">Add New Show:</h4>
                        <input type="text" placeholder="Event Name" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-2"/>
                        <input type="text" placeholder="Location" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-2"/>
                        <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-2">
                            <option value="Standard">Standard</option>
                            <option value="Regional">Regional</option>
                        </select>
                        <button onClick={handleAddEvent} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded">Add Show</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default LiveSeasonScheduler;
