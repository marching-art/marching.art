import React, { useMemo } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';

const ShowCard = ({
    show,
    dayNumber,
    isPastDay,
    fantasyRecaps,
    attendanceStats,
    seasonEvents, // ADD: For reading registration counters
    seasonUid,
    onShowModal,
    onSetModalData
}) => {

    console.log(`[ShowCard ${show.eventName}] DAY:`, dayNumber);
    console.log(`[ShowCard ${show.eventName}] FANTASY_RECAPS:`, fantasyRecaps);
    console.log(`[ShowCard ${show.eventName}] ATTENDANCE_STATS:`, attendanceStats);
    console.log(`[ShowCard ${show.eventName}] SEASON_UID:`, seasonUid);
    
    if (fantasyRecaps && fantasyRecaps.recaps) {
        console.log(`[ShowCard ${show.eventName}] AVAILABLE_RECAP_DAYS:`, fantasyRecaps.recaps.map(r => r.offSeasonDay));
    }
    
    // SCALABLE: Get attendance from precomputed data or registration counters
    const attendance = useMemo(() => {
        // Priority 1: Use precomputed attendance stats (most efficient)
        const showKey = `${dayNumber}_${show.eventName}`;
        const precomputed = attendanceStats?.shows?.[showKey];
        if (precomputed) {
            return precomputed;
        }

        // Priority 2: Use registration counters from season events (efficient)
        const event = seasonEvents?.find(e => e.offSeasonDay === dayNumber);
        const showData = event?.shows?.find(s => s.eventName === show.eventName);
        if (showData?.registrationCounts) {
            return {
                counts: showData.registrationCounts,
                attendees: { worldClass: [], openClass: [], aClass: [] } // No individual attendee data
            };
        }

        // Priority 3: Default empty (no expensive queries)
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    }, [dayNumber, show.eventName, attendanceStats, seasonEvents]);

    // SCALABLE: Get scores from fantasy recaps (single document read)
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

    const handleViewScores = () => {
        if (hasScores) {
            onSetModalData({ type: 'scores', day: dayNumber, eventName: show.eventName, scores });
            onShowModal('scores');
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

            {/* Fantasy Recaps Status */}
            {!fantasyRecaps && (
                <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
                    Scores data loading...
                </div>
            )}

            {/* Corps Attendance Counts */}
            {totalAttendees > 0 && (
                <div className="mb-3">
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                        Competing Corps:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {CORPS_CLASS_ORDER.map(corpsClass => {
                            const classData = CORPS_CLASSES[corpsClass];
                            const count = attendance.counts[corpsClass];
                            
                            if (count === 0) return null;

                            return (
                                <div key={corpsClass} className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${classData.color}`}></div>
                                    <span className="text-xs font-medium text-text-primary dark:text-text-primary-dark">
                                        {classData.classShorthand}: {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3">
                {hasScores && (
                    <button
                        onClick={handleViewScores}
                        className="flex-1 text-xs bg-primary text-on-primary font-semibold py-2 px-3 rounded-theme hover:bg-primary/90 transition-all"
                    >
                        📊 View Scores
                    </button>
                )}
                
                {totalAttendees > 0 && !hasScores && (
                    <button
                        onClick={handleViewCompetingCorps}
                        className="flex-1 text-xs bg-secondary text-on-secondary font-semibold py-2 px-3 rounded-theme hover:bg-secondary/90 transition-all"
                    >
                        👥 Competing Corps
                    </button>
                )}
                
                {totalAttendees === 0 && !hasScores && (
                    <div className="flex-1 text-xs text-text-secondary dark:text-text-secondary-dark text-center py-2 italic">
                        No participants yet
                    </div>
                )}
            </div>

            {/* Total Participants Badge */}
            {totalAttendees > 0 && (
                <div className="mt-2 text-center">
                    <span className="text-xs bg-accent/20 text-text-primary dark:text-text-primary-dark px-2 py-1 rounded-full">
                        {totalAttendees} total participant{totalAttendees !== 1 ? 's' : ''}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ShowCard;