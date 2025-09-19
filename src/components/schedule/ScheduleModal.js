import React from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';

const ScheduleModal = ({ isOpen, onClose, modalType, modalData }) => {
    if (!isOpen || !modalData) return null;

    const renderScoresModal = () => {
        if (!modalData?.scores) return null;

        return (
            <div className="space-y-6">
                <div className="text-center">
                    <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                        {modalData.eventName.replace(/DCI/g, 'marching.art')}
                    </h4>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Day {modalData.day}</p>
                </div>

                {CORPS_CLASS_ORDER.map(corpsClass => {
                    const classData = CORPS_CLASSES[corpsClass];
                    const results = modalData.scores[corpsClass];
                    
                    if (!results?.length) return null;

                    return (
                        <div key={corpsClass} className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-3 h-3 rounded-full ${classData.color}`}></div>
                                <h5 className="font-bold text-text-primary dark:text-text-primary-dark">
                                    {classData.name} ({results.length})
                                </h5>
                            </div>
                            <div className="space-y-2">
                                {results.map((result, index) => (
                                    <div key={result.uid} className="flex justify-between items-center p-2 bg-surface dark:bg-surface-dark rounded-theme">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                                    #{index + 1} {result.corpsName}
                                                </span>
                                                <div className="font-bold text-primary dark:text-primary-dark">
                                                    {result.totalScore?.toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                                                GE: {result.geScore?.toFixed(1)} | 
                                                Visual: {result.visualScore?.toFixed(1)} | 
                                                Music: {result.musicScore?.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderAttendeesModal = () => {
        if (!modalData?.attendance) return null;

        const { attendance } = modalData;
        const totalAttendees = attendance.counts.worldClass + attendance.counts.openClass + attendance.counts.aClass;

        return (
            <div className="space-y-6">
                <div className="text-center">
                    <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                        {modalData.eventName.replace(/DCI/g, 'marching.art')}
                    </h4>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        Day {modalData.day} • {totalAttendees} total participant{totalAttendees !== 1 ? 's' : ''}
                    </p>
                </div>

                {CORPS_CLASS_ORDER.map(corpsClass => {
                    const classData = CORPS_CLASSES[corpsClass];
                    const attendees = attendance.attendees[corpsClass];
                    
                    if (!attendees?.length) return null;

                    return (
                        <div key={corpsClass} className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-3 h-3 rounded-full ${classData.color}`}></div>
                                <h5 className="font-bold text-text-primary dark:text-text-primary-dark">
                                    {classData.name} ({attendees.length})
                                </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {attendees.map(attendee => (
                                    <div key={attendee.uid} className="p-3 bg-surface dark:bg-surface-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                        <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                            {attendee.corpsName}
                                        </div>
                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            {attendee.username}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {totalAttendees === 0 && (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-2">🏟️</div>
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            No corps registered for this show yet
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark max-w-4xl max-h-[80vh] overflow-auto w-full">
                <div className="p-6">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            {modalType === 'scores' ? 'Show Results' : 'Competing Corps'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-theme hover:bg-background dark:hover:bg-background-dark transition-all"
                        >
                            ×
                        </button>
                    </div>
                    
                    {/* Modal Content */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {modalType === 'scores' ? renderScoresModal() : renderAttendeesModal()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleModal;