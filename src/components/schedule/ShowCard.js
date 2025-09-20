import React, { useMemo, useState, useEffect } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { getAttendanceWithCaching } from '../../services/attendanceService';

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
    const [liveAttendance, setLiveAttendance] = useState(null);
    const [loadingError, setLoadingError] = useState(false);
    
    // SCALABLE: Get attendance from precomputed data or registration counters
    const baseAttendance = useMemo(() => {
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

    // Use live attendance if base attendance is empty
    const attendance = liveAttendance || baseAttendance;

    // Fixed: Better async loading with proper error handling and unique delays
    useEffect(() => {
        const totalBase = baseAttendance.counts.worldClass + baseAttendance.counts.openClass + baseAttendance.counts.aClass;
        
        if (totalBase === 0 && seasonUid && !liveAttendance && !isLoadingAttendees && !loadingError) {
            const fetchLiveAttendance = async () => {
                setIsLoadingAttendees(true);
                setLoadingError(false);
                try {
                    const showKey = `${dayNumber}_${show.eventName}`;
                    const liveData = await getAttendanceWithCaching(
                        showKey, 
                        seasonUid, 
                        show.eventName, 
                        dayNumber, 
                        seasonEvents, 
                        attendanceStats
                    );
                    setLiveAttendance(liveData);
                } catch (error) {
                    console.error('Failed to fetch live attendance:', error);
                    setLoadingError(true);
                } finally {
                    setIsLoadingAttendees(false);
                }
            };

            // Use show name hash to create consistent but unique delays
            const showHash = show.eventName.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const delay = Math.abs(showHash % 3000) + 500; // 500-3500ms delay
            
            const timer = setTimeout(fetchLiveAttendance, delay);
            return () => clearTimeout(timer);
        }
    }, [baseAttendance, dayNumber, show.eventName, seasonUid, seasonEvents, attendanceStats, liveAttendance, isLoadingAttendees, loadingError]);

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

    const handleViewCompetingCorps = () => {
        onSetModalData({ 
            type: 'attendees', 
            day: dayNumber, 
            eventName: show.eventName, 
            attendance 
        });
        onShowModal('attendees');
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

            {/* Subtle Attendance Display */}
            {totalAttendees > 0 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                        <span>Competing Corps: {totalAttendees}</span>
                        <div className="flex items-center gap-1">
                            {CORPS_CLASS_ORDER.map(corpsClass => {
                                const classData = CORPS_CLASSES[corpsClass];
                                const count = attendance.counts[corpsClass] || 0;
                                
                                if (count === 0) return null;

                                return (
                                    <span key={corpsClass} className="flex items-center gap-1 text-xs">
                                        <div className={`w-2 h-2 rounded-full ${classData.color}`}></div>
                                        <span className="font-medium">{classData.classShorthand}:{count}</span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Loading indicator - more subtle */}
            {isLoadingAttendees && (
                <div className="mb-3 text-xs text-text-secondary dark:text-text-secondary-dark italic">
                    Loading attendance...
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3">
                {/* Recap Button for Past Shows with Scores */}
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
                
                {/* Competing Corps Button */}
                {totalAttendees > 0 && (
                    <button
                        onClick={handleViewCompetingCorps}
                        className="flex-1 text-xs bg-secondary text-on-secondary font-semibold py-2 px-3 rounded-theme hover:bg-secondary/90 transition-all"
                    >
                        👥 View Corps ({totalAttendees})
                    </button>
                )}
                
                {totalAttendees === 0 && !hasScores && !isLoadingAttendees && (
                    <div className="flex-1 text-xs text-text-secondary dark:text-text-secondary-dark text-center py-2 italic">
                        No participants yet
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShowCard;