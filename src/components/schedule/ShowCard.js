import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { getAttendanceWithCaching } from '../../services/attendanceService';

// Global persistent state across all ShowCard instances
const globalAttendanceState = new Map();

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
    const [attendanceVersion, setAttendanceVersion] = useState(0); // Force re-renders
    const hasFetchedRef = useRef(false);
    
    const showKey = `${dayNumber}_${show.eventName}`;
    
    // SCALABLE: Get attendance from multiple sources
    const baseAttendance = useMemo(() => {
        // Check global state first
        const globalData = globalAttendanceState.get(showKey);
        if (globalData) {
            return globalData;
        }

        // Priority 1: Use precomputed attendance stats
        const precomputed = attendanceStats?.shows?.[showKey];
        if (precomputed) {
            globalAttendanceState.set(showKey, precomputed);
            return precomputed;
        }

        // Priority 2: Use registration counters from season events
        const event = seasonEvents?.find(e => e.offSeasonDay === dayNumber);
        const showData = event?.shows?.find(s => s.eventName === show.eventName);
        if (showData?.registrationCounts) {
            const registrationData = {
                counts: showData.registrationCounts,
                attendees: { worldClass: [], openClass: [], aClass: [] }
            };
            globalAttendanceState.set(showKey, registrationData);
            return registrationData;
        }

        // Priority 3: Default empty
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    }, [dayNumber, show.eventName, attendanceStats, seasonEvents, showKey, attendanceVersion]);

    // Fetch live attendance data if needed
    useEffect(() => {
        const totalBase = baseAttendance.counts.worldClass + baseAttendance.counts.openClass + baseAttendance.counts.aClass;
        
        if (totalBase === 0 && seasonUid && !hasFetchedRef.current && !isLoadingAttendees) {
            const fetchLiveAttendance = async () => {
                hasFetchedRef.current = true;
                setIsLoadingAttendees(true);
                
                try {
                    const liveData = await getAttendanceWithCaching(
                        showKey, 
                        seasonUid, 
                        show.eventName, 
                        dayNumber, 
                        seasonEvents, 
                        attendanceStats
                    );
                    
                    // Store in global state and force re-render
                    globalAttendanceState.set(showKey, liveData);
                    setAttendanceVersion(prev => prev + 1);
                } catch (error) {
                    console.warn(`Could not load attendance for ${show.eventName}:`, error.message);
                } finally {
                    setIsLoadingAttendees(false);
                }
            };

            // Stagger requests to avoid overwhelming Firestore and prevent race conditions
            const showHash = (show.eventName + dayNumber).split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const delay = Math.abs(showHash % 5000) + 1000; // 1000-6000ms delay for better distribution
            
            const timer = setTimeout(fetchLiveAttendance, delay);
            return () => clearTimeout(timer);
        }
    }, [baseAttendance, dayNumber, show.eventName, seasonUid, seasonEvents, attendanceStats, showKey, isLoadingAttendees]);

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

    const totalAttendees = baseAttendance.counts.worldClass + baseAttendance.counts.openClass + baseAttendance.counts.aClass;
    const hasScores = scores && Object.values(scores).some(classResults => classResults.length > 0);

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
            attendance: baseAttendance 
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
                                const count = baseAttendance.counts[corpsClass] || 0;
                                
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

            {/* Loading indicator */}
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