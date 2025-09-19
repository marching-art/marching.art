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
    const [debugInfo, setDebugInfo] = useState('');

    const log = (message, data) => {
        console.log(`[ShowCard ${show.eventName}] ${message}`, data);
        setDebugInfo(prev => prev + `\n${message}: ${JSON.stringify(data, null, 2)}`);
    };

    const getScoresForShow = (day, eventName) => {
        log('Getting scores for show', { day, eventName });
        
        if (!fantasyRecaps) {
            log('ERROR: No fantasyRecaps data', null);
            return null;
        }

        log('Available fantasyRecaps', {
            hasRecaps: !!fantasyRecaps.recaps,
            recapCount: fantasyRecaps.recaps?.length || 0,
            availableDays: fantasyRecaps.recaps?.map(r => r.offSeasonDay) || []
        });

        const recap = fantasyRecaps?.recaps?.find(r => r.offSeasonDay === day);
        if (!recap) {
            log('ERROR: No recap found for day', { day, availableDays: fantasyRecaps.recaps?.map(r => r.offSeasonDay) });
            return null;
        }

        log('Found recap for day', { day, showCount: recap.shows?.length || 0 });

        const showData = recap.shows.find(s => s.eventName === eventName);
        if (!showData) {
            log('ERROR: No show data found', { 
                eventName, 
                availableShows: recap.shows?.map(s => s.eventName) || [] 
            });
            return null;
        }

        if (!showData.results?.length) {
            log('ERROR: No results in show data', { showData });
            return null;
        }

        log('Found show results', { resultCount: showData.results.length, results: showData.results });

        const scoresByClass = { worldClass: [], openClass: [], aClass: [] };
        showData.results.forEach(result => {
            if (scoresByClass[result.corpsClass]) {
                scoresByClass[result.corpsClass].push(result);
            } else {
                log('WARNING: Unknown corps class', { corpsClass: result.corpsClass, result });
            }
        });

        CORPS_CLASS_ORDER.forEach(corpsClass => {
            scoresByClass[corpsClass].sort((a, b) => b.totalScore - a.totalScore);
        });

        log('Processed scores by class', scoresByClass);
        return scoresByClass;
    };

    const computeAttendanceForShow = async () => {
        if (!seasonUid) {
            log('ERROR: No seasonUid provided', { seasonUid });
            return;
        }

        if (isLoadingAttendance || computedAttendance) {
            log('Skipping attendance computation', { isLoadingAttendance, hasComputedAttendance: !!computedAttendance });
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

            // Query all user documents first
            const usersCollection = collection(db, 'artifacts', 'marching-art', 'users');
            log('Querying users collection', { collectionPath: 'artifacts/marching-art/users' });
            
            const snapshot = await getDocs(usersCollection);
            log('Users query result', { 
                totalDocs: snapshot.size,
                docs: snapshot.docs.map(doc => ({ id: doc.id, hasProfile: !!doc.data().profile }))
            });

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
                
                log(`Processing user ${doc.id}`, { 
                    hasProfile: !!profile,
                    activeSeasonId: profile?.activeSeasonId,
                    targetSeasonId: seasonUid
                });

                if (!profile) {
                    log(`User ${doc.id} has no profile`, null);
                    return;
                }

                if (profile.activeSeasonId !== seasonUid) {
                    log(`User ${doc.id} not in target season`, { 
                        userSeason: profile.activeSeasonId, 
                        targetSeason: seasonUid 
                    });
                    return;
                }

                usersInSeason++;
                log(`User ${doc.id} is in target season`, { username: profile.username });

                if (!profile.corps) {
                    log(`User ${doc.id} has no corps data`, null);
                    return;
                }

                usersWithCorps++;

                CORPS_CLASS_ORDER.forEach(corpsClass => {
                    const corps = profile.corps[corpsClass];
                    
                    if (!corps) {
                        log(`User ${doc.id} has no ${corpsClass} corps`, null);
                        return;
                    }

                    if (!corps.corpsName) {
                        log(`User ${doc.id} ${corpsClass} corps has no name`, { corps });
                        return;
                    }

                    if (!corps.selectedShows) {
                        log(`User ${doc.id} ${corpsClass} corps has no selectedShows`, { corps });
                        return;
                    }

                    const weekKey = `week${week}`;
                    const weekShows = corps.selectedShows[weekKey] || [];
                    
                    log(`User ${doc.id} ${corpsClass} week ${week} shows`, { 
                        weekKey,
                        showCount: weekShows.length,
                        shows: weekShows.map(s => s.eventName),
                        targetShow: show.eventName
                    });

                    const hasSelectedThisShow = weekShows.some(s => s.eventName === show.eventName);

                    if (hasSelectedThisShow) {
                        log(`User ${doc.id} ${corpsClass} selected this show!`, { 
                            corpsName: corps.corpsName,
                            username: profile.username 
                        });

                        attendance.counts[corpsClass]++;
                        attendance.attendees[corpsClass].push({
                            uid: doc.id,
                            username: profile.username || 'Unknown',
                            corpsName: corps.corpsName
                        });
                    } else {
                        log(`User ${doc.id} ${corpsClass} did NOT select this show`, { 
                            availableShows: weekShows.map(s => s.eventName)
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
        log('ShowCard mounted/updated', { 
            show: show.eventName, 
            dayNumber, 
            isPastDay, 
            seasonUid,
            hasFantasyRecaps: !!fantasyRecaps,
            hasAttendanceStats: !!attendanceStats
        });

        if (!isPastDay && seasonUid) {
            log('Triggering attendance computation for future show', null);
            computeAttendanceForShow();
        } else {
            log('Skipping attendance computation', { isPastDay, seasonUid });
        }
    }, [show.eventName, dayNumber, seasonUid]);

    const getAttendanceForShow = () => {
        const showKey = `${dayNumber}_${show.eventName}`;
        const precomputed = attendanceStats?.shows?.[showKey];
        
        if (precomputed) {
            log('Using precomputed attendance', { showKey, precomputed });
            return precomputed;
        }

        if (computedAttendance) {
            log('Using computed attendance', { computedAttendance });
            return computedAttendance;
        }

        log('Using default empty attendance', null);
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    };

    const handleViewScores = () => {
        log('View scores clicked', null);
        const scores = getScoresForShow(dayNumber, show.eventName);
        if (scores && Object.values(scores).some(classResults => classResults.length > 0)) {
            log('Opening scores modal', { scores });
            onSetModalData({ type: 'scores', day: dayNumber, eventName: show.eventName, scores });
            onShowModal('scores');
        } else {
            log('ERROR: No scores to display', { scores });
        }
    };

    const handleViewCompetingCorps = () => {
        log('View competing corps clicked', null);
        const attendance = getAttendanceForShow();
        log('Opening attendees modal', { attendance });
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

    log('Final render state', {
        hasScores,
        totalAttendees,
        isLoadingAttendance,
        isPastDay
    });

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

            {/* Debug Info Toggle */}
            <details className="mb-2">
                <summary className="text-xs text-red-600 cursor-pointer">Debug Info</summary>
                <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 overflow-auto max-h-32">
                    {debugInfo || 'No debug info yet'}
                </pre>
            </details>

            {/* Corps Attendance Counts */}
            {(totalAttendees > 0 || isLoadingAttendance) && (
                <div className="mb-3">
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                        {isLoadingAttendance ? 'Loading participants...' : 'Competing Corps:'}
                    </div>
                    {isLoadingAttendance ? (
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Computing attendance... (check console for details)
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