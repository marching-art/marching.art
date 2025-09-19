import React, { useState, useEffect, useMemo } from 'react';
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
    const [debugInfo, setDebugInfo] = useState('');

    const log = (message, data) => {
        console.log(`[ShowCard ${show.eventName}] ${message}`, data);
        // Only update debug info if it's actually different to prevent render loops
        const newDebugEntry = `${message}: ${JSON.stringify(data, null, 2)}`;
        setDebugInfo(prev => {
            if (prev.includes(newDebugEntry)) return prev;
            return prev + `\n${newDebugEntry}`;
        });
    };

    // Memoize scores calculation to prevent infinite loops
    const scores = useMemo(() => {
        if (!fantasyRecaps) {
            // Only log once when fantasyRecaps is null, not on every render
            if (process.env.NODE_ENV === 'development') {
                console.log(`[ShowCard ${show.eventName}] No fantasyRecaps data available`);
            }
            return null;
        }

        const recap = fantasyRecaps?.recaps?.find(r => r.offSeasonDay === dayNumber);
        if (!recap) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[ShowCard ${show.eventName}] No recap found for day ${dayNumber}`);
            }
            return null;
        }

        const showData = recap.shows?.find(s => s.eventName === show.eventName);
        if (!showData?.results?.length) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[ShowCard ${show.eventName}] No show data or results found`);
            }
            return null;
        }

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

    const computeAttendanceForShow = async () => {
        if (!seasonUid) {
            log('ERROR: No seasonUid provided', { seasonUid });
            return;
        }

        if (isLoadingAttendance || computedAttendance) {
            return;
        }

        log('Starting attendance computation', { show: show.eventName, dayNumber, seasonUid });
        setIsLoadingAttendance(true);
        
        try {
            const week = Math.ceil(dayNumber / 7);
            log('Computed week from day', { dayNumber, week });

            const attendance = {
                counts: { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: { worldClass: [], openClass: [], aClass: [] }
            };

            const usersCollection = collection(db, 'artifacts', 'marching-art', 'users');
            const snapshot = await getDocs(usersCollection);

            if (snapshot.empty) {
                log('ERROR: No user documents found', null);
                setComputedAttendance(attendance);
                return;
            }

            let processedUsers = 0;
            let usersInSeason = 0;
            let usersWithCorps = 0;

            snapshot.docs.forEach(doc => {
                processedUsers++;
                const userData = doc.data();
                const profile = userData.profile;

                if (!profile || profile.activeSeasonId !== seasonUid) {
                    return;
                }

                usersInSeason++;

                if (!profile.corps) {
                    return;
                }

                usersWithCorps++;

                CORPS_CLASS_ORDER.forEach(corpsClass => {
                    const corps = profile.corps[corpsClass];
                    
                    if (!corps?.corpsName || !corps.selectedShows) {
                        return;
                    }

                    const weekKey = `week${week}`;
                    const weekShows = corps.selectedShows[weekKey] || [];
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

            log('Attendance computation complete', { 
                processedUsers,
                usersInSeason,
                usersWithCorps,
                finalAttendance: attendance
            });

            setComputedAttendance(attendance);
        } catch (error) {
            log('ERROR during attendance computation', { 
                error: error.message, 
                stack: error.stack 
            });
            console.error('Full attendance computation error:', error);
            
            setComputedAttendance({
                counts: { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: { worldClass: [], openClass: [], aClass: [] }
            });
        } finally {
            setIsLoadingAttendance(false);
        }
    };

    useEffect(() => {
        if (!isPastDay && seasonUid) {
            computeAttendanceForShow();
        }
    }, [show.eventName, dayNumber, seasonUid, isPastDay]);

    const getAttendanceForShow = () => {
        const showKey = `${dayNumber}_${show.eventName}`;
        const precomputed = attendanceStats?.shows?.[showKey];
        
        if (precomputed) {
            return precomputed;
        }

        if (computedAttendance) {
            return computedAttendance;
        }

        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    };

    const handleViewScores = () => {
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

            {/* Debug Info Toggle - Only show in development */}
            {process.env.NODE_ENV === 'development' && (
                <details className="mb-2">
                    <summary className="text-xs text-red-600 cursor-pointer">Debug Info</summary>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 overflow-auto max-h-32">
                        {debugInfo || 'No debug info yet'}
                    </pre>
                </details>
            )}

            {/* Status Message for Missing Data */}
            {!fantasyRecaps && (
                <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
                    Scores data not yet available
                </div>
            )}

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