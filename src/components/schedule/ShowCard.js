import React, { useMemo, useState } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { getAttendanceWithCaching } from '../../utils/attendanceService';

const ShowCard = ({
    show,
    dayNumber,
    isPastDay,
    fantasyRecaps,
    attendanceStats,
    seasonEvents,
    seasonUid,
    onShowModal,
    onSetModalData,
    onViewRecap
}) => {
    const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
    
    // SCALABLE: Get attendance from precomputed data or registration counters
    const attendance = useMemo(() => {
        const showKey = `${dayNumber}_${show.eventName}`;
        const precomputed = attendanceStats?.shows?.[showKey];
        if (precomputed) {
            return precomputed;
        }

        const event = seasonEvents?.find(e => e.offSeasonDay === dayNumber);
        const showData = event?.shows?.find(s => s.eventName === show.eventName);
        if (showData?.registrationCounts) {
            return {
                counts: showData.registrationCounts,
                attendees: { worldClass: [], openClass: [], aClass: [] }
            };
        }

        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    }, [dayNumber, show.eventName, attendanceStats, seasonEvents]);

    const scores = useMemo(() => {
        if (!fantasyRecaps?.recaps) return null;

        const recap = fantasyRecaps.recaps.find(r => r.offSeasonDay === dayNumber);
        if (!recap) return null;

        const showData = recap.shows?.find(s => s.eventName === show.eventName);
        if (!showData?.results?.length) return null;

        const scoresByClass = { worldClass: [], openClass: [], aClass: [] };
        showData.results.forEach(result => {
            if (scoresByClass[result.corpsClass]) {
                scoresByClass[result.corpsClass].push(result);
            }
        });

        CORPS_CLASS_ORDER.forEach(corpsClass => {
            scoresByClass[corpsClass].sort((a, b) => b.totalScore - a.totalScore);
        });

        return scoresByClass;
    }, [fantasyRecaps, dayNumber, show.eventName]);

    const totalAttendees = attendance.counts.worldClass + attendance.counts.openClass + attendance.counts.aClass;
    const hasScores = scores && Object.values(scores).some(classResults => classResults.length > 0);
    const hasDetailedAttendees = Object.values(attendance.attendees).some(classAttendees => classAttendees.length > 0);

    const handleViewScores = () => {
        if (hasScores) {
            onSetModalData({ type: 'scores', day: dayNumber, eventName: show.eventName, scores });
            onShowModal('scores');
        }
    };

    const handleViewRecap = () => {
        if (onViewRecap) {
            onViewRecap(dayNumber);
        }
    };

    const handleViewCompetingCorps = async () => {
        if (hasDetailedAttendees) {
            // Use existing detailed data
            onSetModalData({ 
                type: 'attendees', 
                day: dayNumber, 
                eventName: show.eventName, 
                attendance 
            });
            onShowModal('attendees');
        } else if (totalAttendees > 0) {
            // Lazy load detailed attendance data
            setIsLoadingAttendees(true);
            try {
                const showKey = `${dayNumber}_${show.eventName}`;
                const detailedAttendance = await getAttendanceWithCaching(
                    showKey, 
                    seasonUid, 
                    show.eventName, 
                    dayNumber, 
                    seasonEvents, 
                    attendanceStats
                );
                
                onSetModalData({ 
                    type: 'attendees', 
                    day: dayNumber, 
                    eventName: show.eventName, 
                    attendance: detailedAttendance 
                });
                onShowModal('attendees');
            } catch (error) {
                console.error('Failed to load detailed attendance:', error);
                // Fallback to counts only
                onSetModalData({ 
                    type: 'attendees', 
                    day: dayNumber, 
                    eventName: show.eventName, 
                    attendance 
                });
                onShowModal('attendees');
            } finally {
                setIsLoadingAttendees(false);
            }
        }
    };

    return (
        <div 
            className={`p-4 rounded-theme border transition-all hover:shadow-md ${
                isPastDay 
                    ? 'border-accent/30 bg-surface/50 dark:bg-surface-dark/50'
                    : 'border-accent/50 dark:border-accent-dark/30 bg-surface dark:bg-surface-dark hover:border-primary/50'
            }`}
        >
            <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                {show.eventName?.replace(/DCI/g, 'marching.art')}
            </h4>
            
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3 flex items-center gap-1">
                📍 {show.location}
            </p>

            {/* Enhanced Corps Attendance Display */}
            {totalAttendees > 0 && (
                <div className="mb-3 p-2 bg-background dark:bg-background-dark rounded-theme">
                    <div className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2 text-center">
                        Competing Corps: {totalAttendees}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {CORPS_CLASS_ORDER.map(corpsClass => {
                            const classData = CORPS_CLASSES[corpsClass];
                            const count = attendance.counts[corpsClass] || 0;
                            
                            return (
                                <div key={corpsClass} className="text-center">
                                    <div className={`w-4 h-4 mx-auto rounded-full ${classData.color} mb-1`}></div>
                                    <div className="text-xs font-bold text-text-primary dark:text-text-primary-dark">
                                        {classData.classShorthand}
                                    </div>
                                    <div className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                                        {count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3">
                {/* Recap Button for Past Shows */}
                {isPastDay && hasScores && (
                    <button
                        onClick={handleViewRecap}
                        className="flex-1 text-xs bg-green-600 text-white font-semibold py-2 px-3 rounded-theme hover:bg-green-700 transition-all"
                    >
                        📊 View Recap
                    </button>
                )}

                {/* Scores Button */}
                {hasScores && (
                    <button
                        onClick={handleViewScores}
                        className="flex-1 text-xs bg-primary text-on-primary font-semibold py-2 px-3 rounded-theme hover:bg-primary/90 transition-all"
                    >
                        📊 View Scores
                    </button>
                )}
                
                {/* Enhanced Competing Corps Button */}
                {totalAttendees > 0 && (
                    <button
                        onClick={handleViewCompetingCorps}
                        disabled={isLoadingAttendees}
                        className="flex-1 text-xs bg-secondary text-on-secondary font-semibold py-2 px-3 rounded-theme hover:bg-secondary/90 transition-all disabled:opacity-50"
                    >
                        {isLoadingAttendees ? (
                            <>🔄 Loading...</>
                        ) : (
                            <>👥 View Corps ({totalAttendees})</>
                        )}
                    </button>
                )}
                
                {totalAttendees === 0 && !hasScores && (
                    <div className="flex-1 text-xs text-text-secondary dark:text-text-secondary-dark text-center py-2 italic">
                        No participants yet
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShowCard;