// src/components/admin/LiveSeasonScheduler.js
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

const LiveSeasonScheduler = () => {
    const [scheduleSettings, setScheduleSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        startDate: '',
        endDate: '',
        description: ''
    });

    useEffect(() => {
        fetchScheduleSettings();
    }, []);

    const fetchScheduleSettings = async () => {
        try {
            const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
            if (seasonDoc.exists()) {
                const data = seasonDoc.data();
                setScheduleSettings(data.schedule || {});
                
                // Populate edit form
                if (data.schedule) {
                    setEditForm({
                        startDate: data.schedule.startDate ? formatDateForInput(data.schedule.startDate) : '',
                        endDate: data.schedule.endDate ? formatDateForInput(data.schedule.endDate) : '',
                        description: data.schedule.description || ''
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching schedule settings:', error);
            toast.error('Failed to load schedule settings');
        }
    };

    const formatDateForInput = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toISOString().split('T')[0];
    };

    const formatDateForDisplay = (timestamp) => {
        if (!timestamp) return 'Not set';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleSaveSchedule = async () => {
        if (!editForm.startDate || !editForm.endDate) {
            toast.error('Please provide both start and end dates');
            return;
        }

        const startDate = new Date(editForm.startDate);
        const endDate = new Date(editForm.endDate);

        if (endDate <= startDate) {
            toast.error('End date must be after start date');
            return;
        }

        setIsLoading(true);
        try {
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonDoc = await getDoc(seasonRef);
            
            if (seasonDoc.exists()) {
                const currentData = seasonDoc.data();
                const updatedSchedule = {
                    ...currentData.schedule,
                    startDate: startDate,
                    endDate: endDate,
                    description: editForm.description,
                    lastUpdated: new Date()
                };

                await updateDoc(seasonRef, {
                    schedule: updatedSchedule
                });

                setScheduleSettings(updatedSchedule);
                setIsEditing(false);
                toast.success('Schedule updated successfully');
            }
        } catch (error) {
            console.error('Error updating schedule:', error);
            toast.error('Failed to update schedule');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateDuration = () => {
        if (!scheduleSettings?.startDate || !scheduleSettings?.endDate) return 'N/A';
        
        const start = scheduleSettings.startDate.toDate ? scheduleSettings.startDate.toDate() : new Date(scheduleSettings.startDate);
        const end = scheduleSettings.endDate.toDate ? scheduleSettings.endDate.toDate() : new Date(scheduleSettings.endDate);
        
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return `${diffDays} days`;
    };

    const getSeasonStatus = () => {
        if (!scheduleSettings?.startDate || !scheduleSettings?.endDate) return 'Unknown';
        
        const now = new Date();
        const start = scheduleSettings.startDate.toDate ? scheduleSettings.startDate.toDate() : new Date(scheduleSettings.startDate);
        const end = scheduleSettings.endDate.toDate ? scheduleSettings.endDate.toDate() : new Date(scheduleSettings.endDate);
        
        if (now < start) return 'Upcoming';
        if (now > end) return 'Ended';
        return 'Active';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                    Live Season Scheduler
                </h2>
                
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Edit Schedule
                    </button>
                )}
            </div>

            {/* Current Schedule Display */}
            {!isEditing && (
                <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg border border-accent dark:border-accent-dark">
                    <h3 className="text-lg font-semibold mb-4 text-text-primary dark:text-text-primary-dark">
                        Current Schedule
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Start Date
                            </label>
                            <p className="text-text-primary dark:text-text-primary-dark">
                                {formatDateForDisplay(scheduleSettings?.startDate)}
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                End Date
                            </label>
                            <p className="text-text-primary dark:text-text-primary-dark">
                                {formatDateForDisplay(scheduleSettings?.endDate)}
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Duration
                            </label>
                            <p className="text-text-primary dark:text-text-primary-dark">
                                {calculateDuration()}
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Status
                            </label>
                            <p className={`font-medium ${
                                getSeasonStatus() === 'Active' ? 'text-green-600 dark:text-green-400' :
                                getSeasonStatus() === 'Upcoming' ? 'text-blue-600 dark:text-blue-400' :
                                'text-red-600 dark:text-red-400'
                            }`}>
                                {getSeasonStatus()}
                            </p>
                        </div>
                    </div>

                    {scheduleSettings?.description && (
                        <div className="mt-4">
                            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                Description
                            </label>
                            <p className="text-text-primary dark:text-text-primary-dark mt-1">
                                {scheduleSettings.description}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Edit Form */}
            {isEditing && (
                <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg border border-accent dark:border-accent-dark">
                    <h3 className="text-lg font-semibold mb-4 text-text-primary dark:text-text-primary-dark">
                        Edit Schedule
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="start-date" className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    id="start-date"
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="w-full border border-accent dark:border-accent-dark rounded-lg px-3 py-2 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="end-date" className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    id="end-date"
                                    value={editForm.endDate}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="w-full border border-accent dark:border-accent-dark rounded-lg px-3 py-2 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                Description (Optional)
                            </label>
                            <textarea
                                id="description"
                                rows={3}
                                value={editForm.description}
                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Add notes about this schedule..."
                                className="w-full border border-accent dark:border-accent-dark rounded-lg px-3 py-2 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                            />
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setIsEditing(false)}
                                disabled={isLoading}
                                className="border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-lg hover:bg-surface dark:hover:bg-surface-dark transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            
                            <button
                                onClick={handleSaveSchedule}
                                disabled={isLoading}
                                className="bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Panel */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            About Live Season Scheduling
                        </h3>
                        <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                            <p>
                                The live season scheduler manages the timing for live competition seasons. 
                                During live seasons, scores are processed in real-time and competitions 
                                happen on scheduled dates. Make sure to coordinate with actual DCI schedules.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveSeasonScheduler;