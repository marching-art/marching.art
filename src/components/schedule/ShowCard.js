import React, { useState } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { fetchAttendanceForShow, getCachedAttendanceData, cacheAttendanceData } from '../../services/attendanceService';

const ShowCard = ({
    show,
    dayNumber,
    isPastDay,
    fantasyRecaps,
    attendanceStats,
    seasonUid,
    onShowModal,
    onSetModalData
}) => {
    const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
    const getScoresForShow = (day, eventName) => {
        const recap = fantasyRecaps?.recaps?.find(r => r.offSeasonDay === day);
        if (!recap) return null;

        const showData = recap.shows.find(s => s.eventName === eventName);
        if (!showData?.results?.length) return null;

        // Group by corps class and sort by score
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
    };

    const getAttendanceForShow = (day, eventName) => {
        const showKey = `${day}_${eventName}`;
        return attendanceStats?.shows?.[showKey] || {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    };

    const handleViewScores = () => {
        const scores = getScoresForShow(dayNumber, show.eventName);
        if (scores) {
            onSetModalData({ type: 'scores', day: dayNumber, eventName: show.eventName, scores });
            onShowModal('scores');
        }
    };

    const handleViewCompetingCorps = async () => {
        const showKey = `${dayNumber}_${show.eventName}`;
        
        // First try cached data
        let attendance = getCachedAttendanceData(showKey);
        
        if (!attendance) {
            // Try pre-computed stats
            attendance = attendanceStats?.shows?.[showKey];
        }
        
        if (!attendance) {
            // Fetch on-demand if not available
            setIsLoadingAttendance(true);
            try {
                const week = Math.ceil(dayNumber / 7);
                attendance = await fetchAttendanceForShow(seasonUid, show.eventName, week);
                cacheAttendanceData(showKey, attendance);
            } catch (error) {
                console.error('Error fetching attendance:', error);
                attendance = {
                    counts: { worldClass: 0, openClass: 0, aClass: 0 },
                    attendees: { worldClass: [], openClass: [], aClass: [] }
                };
            } finally {
                setIsLoadingAttendance(false);
            }
        }

        onSetModalData({ 
            type: 'attendees', 
            day: dayNumber, 
            eventName: show.eventName, 
            attendance 
        });
        onShowModal('attendees');
    };

    const attendance = getAttendanceForShow(dayNumber, show.eventName);
    const scores = getScoresForShow(dayNumber, show.eventName);
    const totalAttendees = attendance.counts.worldClass + attendance.counts.openClass + attendance.counts.aClass;
    const hasScores = scores && Object.values(scores).some(classResults => classResults.length > 0);

    return (
        <div 
            className={`p-4 rounded-theme border transition-all hover:shadow-md ${
                isPastDay 
                    ? 'border-accent/30 bg-surface/50 dark:bg-surface-dark/50'
                    : 'border-accent/50 dark:border-accent-dark/30 bg-surface dark:bg-surface-dark hover:border-primary/50'
            }`}
        >
            {/* Show Title */}
            <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                {show.eventName?.replace(/DCI/g, 'marching.art')}
            </h4>
            
            {/* Location */}
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3 flex items-center gap-1">
                📍 {show.location}
            </p>

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
                        disabled={isLoadingAttendance}
                        className="flex-1 text-xs bg-secondary text-on-secondary font-semibold py-2 px-3 rounded-theme hover:bg-secondary/90 transition-all disabled:opacity-50"
                    >
                        {isLoadingAttendance ? '⏳ Loading...' : '👥 Competing Corps'}
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