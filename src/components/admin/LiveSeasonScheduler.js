import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const sizeClasses = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme shadow-theme w-full ${sizeClasses[size]} p-6 relative text-text-primary dark:text-text-primary-dark`}>
                <button onClick={onClose} className="absolute top-3 right-3 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                <h2 className="text-2xl font-bold mb-4 text-primary dark:text-primary-dark">{title}</h2>
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
        if (dayIndex >= 67) return;
        setSelectedDay(dayIndex);
        setNewEvent({ name: '', location: '', type: 'Standard' });
        setIsModalOpen(true);
    };

    const handleAddEvent = () => {
        if (!newEvent.name.trim() || selectedDay === null) return;
        const week = Math.floor(selectedDay / 7) + 1;
        const dayName = DAYS_OF_WEEK[selectedDay % 7];
        const finalEvent = { ...newEvent, week, day: dayName, dayIndex: selectedDay };
        
        const dayData = schedule.find(d => d.dayIndex === selectedDay);
        if (dayData) {
            const updatedDay = { ...dayData, shows: [...dayData.shows, { name: newEvent.name, location: newEvent.location }] };
            setSchedule(prev => prev.map(d => d.dayIndex === selectedDay ? updatedDay : d));
        } else {
            setSchedule(prev => [...prev, { dayIndex: selectedDay, shows: [{ name: newEvent.name, location: newEvent.location }] }]);
        }

        setNewEvent({ name: '', location: '', type: 'Standard' });
    };
    
    const handleRemoveEvent = (dayIndex, eventName) => {
         const dayData = schedule.find(d => d.dayIndex === dayIndex);
         if(dayData) {
            const updatedShows = dayData.shows.filter(s => s.name !== eventName);
            const updatedDay = { ...dayData, shows: updatedShows };
            setSchedule(prev => prev.map(d => d.dayIndex === dayIndex ? updatedDay : d));
         }
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
        acc[event.dayIndex] = event.shows;
        return acc;
    }, {});


    return (
        <div className="mt-6">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Live Season Schedule (10 Weeks)</h3>
            <div className="grid grid-cols-7 gap-1 text-center font-bold mb-2 text-text-secondary dark:text-text-secondary-dark">
                {DAYS_OF_WEEK.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: WEEKS * 7 }).map((_, dayIndex) => {
                    const events = eventsByDay[dayIndex] || [];
                    const isChampionshipWeek = dayIndex >= 67;
                    const dayNumber = dayIndex + 1;
                    
                    let championshipEvent = null;
                    if (dayNumber === 68) championshipEvent = { name: 'Prelims', location: 'Indianapolis, IN' };
                    if (dayNumber === 69) championshipEvent = { name: 'Semi-Finals', location: 'Indianapolis, IN' };
                    if (dayNumber === 70) championshipEvent = { name: 'Finals', location: 'Indianapolis, IN' };

                    return (
                        <div 
                            key={dayIndex} 
                            onClick={() => openModal(dayIndex)}
                            className={`h-28 bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme p-1 text-xs ${!isChampionshipWeek && 'cursor-pointer hover:bg-accent dark:hover:bg-accent-dark/20'} transition-colors overflow-y-auto ${isChampionshipWeek ? 'bg-secondary/10 dark:bg-secondary-dark/10' : ''}`}
                        >
                            <span className="font-bold text-text-secondary dark:text-text-secondary-dark">{dayNumber}</span>
                            {championshipEvent && (
                                <div className="bg-secondary/20 dark:bg-secondary-dark/20 p-1 rounded-theme mt-1 text-text-primary dark:text-text-primary-dark">
                                    <p className="font-bold truncate">{championshipEvent.name}</p>
                                    <p className="truncate">{championshipEvent.location}</p>
                                </div>
                            )}
                            {events.map(event => (
                                <div key={event.name} className="bg-primary/20 p-1 rounded-theme mt-1 text-text-primary dark:text-text-primary-dark">
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
                <button onClick={handleClearSchedule} className="border-theme border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-2 px-4 rounded-theme transition-colors">Clear Schedule</button>
                <button onClick={handleSaveSchedule} disabled={isLoading} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">
                    {isLoading ? 'Saving...' : 'Save Live Schedule'}
                </button>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Manage Shows for Day ${selectedDay + 1}`}>
                <div className="space-y-4">
                    <div className="border-b border-accent dark:border-accent-dark pb-4">
                        <h4 className="font-bold mb-2 text-text-primary dark:text-text-primary-dark">Existing Shows on this Day:</h4>
                        {(eventsByDay[selectedDay] || []).length > 0 ? (
                            <ul className="space-y-2">
                                {(eventsByDay[selectedDay]).map(event => (
                                    <li key={event.name} className="flex justify-between items-center bg-background dark:bg-background-dark p-2 rounded-theme">
                                        <span>{event.name} <em className="text-text-secondary dark:text-text-secondary-dark">({event.location})</em></span>
                                        <button onClick={() => handleRemoveEvent(selectedDay, event.name)} className="text-red-500 hover:text-red-700">
                                            <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4"/>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-text-secondary dark:text-text-secondary-dark">No shows scheduled for this day.</p>}
                    </div>
                    <div>
                        <h4 className="font-bold mb-2 text-text-primary dark:text-text-primary-dark">Add New Show:</h4>
                        <input type="text" placeholder="Event Name" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 mb-2 focus:ring-2 focus:ring-primary focus:border-primary"/>
                        <input type="text" placeholder="Location" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 mb-2 focus:ring-2 focus:ring-primary focus:border-primary"/>
                        <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})} className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 mb-2 focus:ring-2 focus:ring-primary focus:border-primary">
                            <option value="Standard">Standard</option>
                            <option value="Regional">Regional</option>
                        </select>
                        <button onClick={handleAddEvent} className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme">Add Show</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default LiveSeasonScheduler;