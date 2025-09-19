import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';

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
    const [computedAttendance, setComputedAttendance] = useState(null);

    const getScoresForShow = (day, eventName) => {
        const recap = fantasyRecaps?.recaps?.find(r => r.offSeasonDay === day);
        if (!recap) return null;

        const showData = recap.shows.find(s => s.eventName === eventName);
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
    };

    const computeAttendanceForShow = async () => {
        if (!seasonUid || isLoadingAttendance || computedAttendance) return;

        setIsLoadingAttendance(true);
        try {
            const week = Math.ceil(dayNumber / 7);
            const attendance = {
                counts: { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: { worldClass: [], openClass: [], aClass: [] }
            };

            // Query all profiles for this season
            const profilesQuery = query(
                collection(db, 'artifacts', 'marching-art', 'users'),
                // Note: We can't query nested fields directly, so we'll get all users and filter
            );
            
            const snapshot = await getDocs(profilesQuery);
            
            snapshot.docs.forEach(doc => {
                const userData = doc.data();
                const profile = userData.profile;
                
                // Check if user is in this season
                if (profile?.activeSeasonId !== seasonUid) return;
                
                // Check each corps class
                CORPS_CLASS_ORDER.forEach(corpsClass => {
                    const corps = profile.corps?.[corpsClass];
                    if (!corps?.selectedShows || !corps.corpsName) return;

                    // Check if this corps selected this show for this week
                    const weekShows = corps.selectedShows[`week${week}`] || [];
                    const hasSelectedThisShow = weekShows.some(s => s.eventName === show.eventName);

                    if (hasSelectedThisShow) {
                        attendance.counts[corpsClass]++;
                        attendance.attendees[corpsClass].push({
                            uid: doc.id,
                            username: profile.username || 'Unknown',
                            corpsName: corps.corpsName
                        });
                    }
                });
            });

            setComputedAttendance(attendance);
        } catch (error) {
            console.error('Error computing attendance:', error);
            setComputedAttendance({
                counts: { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: { worldClass: [], openClass: [], aClass: [] }
            });
        } finally {
            setIsLoadingAttendance(false);
        }
    };

    // Compute attendance when component mounts or show changes
    useEffect(() => {
        if (!isPastDay && seasonUid) { // Only compute for future shows
            computeAttendanceForShow();
        }
    }, [show.eventName, dayNumber, seasonUid]);

    const getAttendanceForShow = () => {
        // Try pre-computed stats first
        const showKey = `${dayNumber}_${show.eventName}`;
        const precomputed = attendanceStats?.shows?.[showKey];
        if (precomputed) return precomputed;

        // Use computed attendance
        if (computedAttendance) return computedAttendance;

        // Default empty
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    };

    const handleViewScores = () => {
        const scores = getScoresForShow(dayNumber, show.eventName);
        if (scores && Object.values(scores).some(classResults => classResults.length > 0)) {
            onSetModalData({ type: 'scores', day: dayNumber, eventName: show.eventName, scores });
            onShowModal('scores');
        }
    };

    const handleViewCompetingCorps = () => {
        const attendance = getAttendanceForShow();
        onSetModalData({ 
            type: 'attendees', 
            day: dayNumber, 
            eventName: show.eventName, 
            attendance 
        });
        onShowModal('attendees');
    };

    const attendance = getAttendanceForShow();
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
            <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                {show.eventName?.replace(/DCI/g, 'marching.art')}
            </h4>
            
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3 flex items-center gap-1">
                📍 {show.location}
            </p>

            {/* Corps Attendance Counts */}
            {(totalAttendees > 0 || isLoadingAttendance) && (
                <div className="mb-3">
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                        {isLoadingAttendance ? 'Loading participants...' : 'Competing Corps:'}
                    </div>
                    {isLoadingAttendance ? (
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Computing attendance...
                        </div>
                    ) : totalAttendees > 0 ? (
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
                    ) : null}
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
                
                {totalAttendees === 0 && !hasScores && !isLoadingAttendance && (
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