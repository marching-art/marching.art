import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import toast from 'react-hot-toast';
import Icon from '../ui/Icon';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';

const ShowRegistrationSystem = ({ 
    show, 
    dayNumber, 
    seasonUid, 
    onRegistrationUpdate,
    userCorps = {},
    seasonEvents = [],
    onRegistrationAttempt,
    weeklyLimit = 10,
    hideRegistration = false // NEW: Allow hiding registration from dashboard
}) => {
    const { loggedInProfile, user } = useUserStore();
    const [isRegistering, setIsRegistering] = useState(false);
    const [userRegistrations, setUserRegistrations] = useState({});
    const [registrationStates, setRegistrationStates] = useState({}); // Track registration status per corps class
    const [showCounts, setShowCounts] = useState({ worldClass: 0, openClass: 0, aClass: 0 });
    const [attendingCorps, setAttendingCorps] = useState({ worldClass: [], openClass: [], aClass: [] });
    const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
    const [weeklyRegistrationCount, setWeeklyRegistrationCount] = useState(0);

    const showKey = `${dayNumber}_${show.eventName}`;
    const registerForShows = httpsCallable(functions, 'registerForShows');

    // Check if event has class restrictions - Enhanced for Open Class events
    const getEventClassRestrictions = () => {
        if (show.classRestrictions) {
            return show.classRestrictions;
        }
        
        const eventName = show.eventName.toLowerCase();
        if (eventName.includes('open class') || 
            eventName.includes('open & a class') ||
            eventName.includes('open/a class')) {
            return ['openClass', 'aClass'];
        }
        
        return ['worldClass', 'openClass', 'aClass']; // No restrictions
    };

    const allowedClasses = getEventClassRestrictions();

    // Load user registrations and check states
    useEffect(() => {
        const loadUserRegistrations = async () => {
            if (!user || !seasonUid) return;

            try {
                const userRegistrationsQuery = query(
                    collection(db, `artifacts/prod/users/${user.uid}/show_registrations`),
                    where('seasonUid', '==', seasonUid)
                );
                
                const snapshot = await getDocs(userRegistrationsQuery);
                const registrations = {};
                const states = {};
                let weeklyCount = 0;
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    registrations[data.showKey] = data;
                    
                    // Count weekly registrations
                    if (data.registered && data.dayNumber) {
                        const weekStart = Math.floor((dayNumber - 1) / 7) * 7 + 1;
                        const weekEnd = weekStart + 6;
                        
                        if (data.dayNumber >= weekStart && data.dayNumber <= weekEnd) {
                            weeklyCount++;
                        }
                    }
                    
                    // Set registration state for this show
                    if (data.showKey === showKey && data.registered) {
                        states[data.corpsClass] = 'registered';
                    }
                });
                
                setUserRegistrations(registrations);
                setRegistrationStates(states);
                setWeeklyRegistrationCount(weeklyCount);
            } catch (error) {
                console.error('Error loading user registrations:', error);
            }
        };

        loadUserRegistrations();
    }, [user, seasonUid, showKey, dayNumber]);

    // Load show attendance with individual corps details
    useEffect(() => {
        const loadShowAttendance = async () => {
            setIsLoadingAttendance(true);
            try {
                // Get show counts from season events
                const event = seasonEvents.find(e => e.offSeasonDay === dayNumber);
                const showData = event?.shows?.find(s => s.eventName === show.eventName);
                
                if (showData?.registrationCounts) {
                    setShowCounts(showData.registrationCounts);
                }

                // Load detailed attendance from users for this specific show
                const usersSnapshot = await getDocs(collection(db, 'artifacts/prod/users'));
                const attendeesByClass = { worldClass: [], openClass: [], aClass: [] };
                const counts = { worldClass: 0, openClass: 0, aClass: 0 };

                usersSnapshot.forEach((userDoc) => {
                    try {
                        const userData = userDoc.data();
                        const userShowRegistrations = userData.show_registrations;
                        
                        if (!userShowRegistrations || !userShowRegistrations[showKey]) return;
                        
                        const registration = userShowRegistrations[showKey];
                        if (!registration.registered) return;

                        // Add to attendance
                        const corpsClass = registration.corpsClass;
                        if (allowedClasses.includes(corpsClass) && registration.corpsName) {
                            attendeesByClass[corpsClass].push({
                                uid: userDoc.id,
                                username: registration.username || 'Unknown Director',
                                corpsName: registration.corpsName,
                                corpsLocation: registration.corpsLocation || ''
                            });
                            counts[corpsClass]++;
                        }
                    } catch (error) {
                        console.error('Error processing user data:', error);
                    }
                });

                setAttendingCorps(attendeesByClass);
                setShowCounts(counts);

            } catch (error) {
                console.error('Error loading show attendance:', error);
            } finally {
                setIsLoadingAttendance(false);
            }
        };

        loadShowAttendance();
    }, [showKey, seasonUid, dayNumber, show.eventName, seasonEvents, allowedClasses]);

    // Handle registration for shows with enhanced validation
    const handleRegistration = async (corpsClass, register) => {
        if (!user || !userCorps[corpsClass]) {
            toast.error('Corps information not found');
            return;
        }

        // Check weekly limit before registering
        if (register && weeklyRegistrationCount >= weeklyLimit) {
            if (onRegistrationAttempt) {
                const result = onRegistrationAttempt(dayNumber, show.eventName, corpsClass);
                if (!result.success) {
                    toast.error(result.error);
                    return;
                }
            } else {
                toast.error(`Maximum ${weeklyLimit} events per week allowed. You've reached your limit for this week.`);
                return;
            }
        }

        // Validate corps data before registration
        const corpsData = userCorps[corpsClass];
        if (!corpsData.name || !corpsData.name.trim()) {
            toast.error('Corps name is required for registration');
            return;
        }

        setIsRegistering(true);
        setRegistrationStates(prev => ({
            ...prev,
            [corpsClass]: register ? 'registering' : 'unregistering'
        }));

        try {
            const registrationData = {
                seasonUid,
                showKey,
                dayNumber,
                eventName: show.eventName,
                location: show.location || '',
                corpsClass,
                corpsName: corpsData.name.trim(), // Ensure no undefined values
                corpsLocation: corpsData.location?.trim() || '',
                username: loggedInProfile?.username || loggedInProfile?.displayName || 'Unknown Director',
                registered: register,
                registeredAt: new Date()
            };

            if (register) {
                // Register for show
                await setDoc(
                    doc(db, `artifacts/prod/users/${user.uid}/show_registrations`, showKey),
                    registrationData
                );
                
                // Update local state
                setUserRegistrations(prev => ({
                    ...prev,
                    [showKey]: registrationData
                }));

                setRegistrationStates(prev => ({
                    ...prev,
                    [corpsClass]: 'registered'
                }));

                // Update show counts optimistically
                setShowCounts(prev => ({
                    ...prev,
                    [corpsClass]: prev[corpsClass] + 1
                }));

                // Update weekly count
                setWeeklyRegistrationCount(prev => prev + 1);

                toast.success(`Registered ${corpsData.name} for ${show.eventName}`);
            } else {
                // Unregister from show
                await updateDoc(
                    doc(db, `artifacts/prod/users/${user.uid}/show_registrations`, showKey),
                    { 
                        registered: false, 
                        unregisteredAt: new Date(),
                        lastUpdated: new Date()
                    }
                );

                // Update local state
                setUserRegistrations(prev => {
                    const updated = { ...prev };
                    if (updated[showKey]) {
                        updated[showKey].registered = false;
                    }
                    return updated;
                });

                setRegistrationStates(prev => {
                    const updated = { ...prev };
                    delete updated[corpsClass];
                    return updated;
                });

                // Update show counts optimistically
                setShowCounts(prev => ({
                    ...prev,
                    [corpsClass]: Math.max(0, prev[corpsClass] - 1)
                }));

                // Update weekly count
                setWeeklyRegistrationCount(prev => Math.max(0, prev - 1));

                toast.success(`Unregistered ${corpsData.name} from ${show.eventName}`);
            }

            // Trigger parent update
            if (onRegistrationUpdate) {
                onRegistrationUpdate(showKey, register);
            }

        } catch (error) {
            console.error('Error handling registration:', error);
            
            // Reset state on error
            setRegistrationStates(prev => {
                const updated = { ...prev };
                delete updated[corpsClass];
                return updated;
            });

            // Show specific error messages
            if (error.code === 'permission-denied') {
                toast.error('Permission denied. Please check your account permissions.');
            } else if (error.message?.includes('Unsupported field value: undefined')) {
                toast.error('Corps information is incomplete. Please update your corps details.');
            } else {
                toast.error('Failed to update registration. Please try again.');
            }
        } finally {
            setIsRegistering(false);
        }
    };

    // Get registration status for a corps class
    const getRegistrationStatus = (corpsClass) => {
        const state = registrationStates[corpsClass];
        const registration = userRegistrations[showKey];
        
        if (state === 'registering') return 'registering';
        if (state === 'unregistering') return 'unregistering';
        if (state === 'registered' || (registration && registration.registered && registration.corpsClass === corpsClass)) {
            return 'registered';
        }
        
        return 'unregistered';
    };

    // Get available corps for registration (only allowed classes)
    const availableCorps = Object.entries(userCorps).filter(([corpsClass]) => 
        allowedClasses.includes(corpsClass)
    );

    const totalAttendees = showCounts.worldClass + showCounts.openClass + showCounts.aClass;

    // Don't render registration section if hideRegistration is true (for dashboard)
    if (hideRegistration || !user || availableCorps.length === 0) {
        return (
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                        Corps Attendance
                    </h4>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {allowedClasses.map(corpsClass => (
                        <div key={corpsClass} className="text-center">
                            <div className={`w-6 h-6 rounded-full mx-auto mb-2 ${
                                corpsClass === 'worldClass' ? 'bg-blue-500' :
                                corpsClass === 'openClass' ? 'bg-green-500' : 'bg-purple-500'
                            }`}></div>
                            <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                {showCounts[corpsClass]}
                            </p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                {corpsClass === 'worldClass' ? 'World' :
                                 corpsClass === 'openClass' ? 'Open' : 'A Class'}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-4">
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                            {totalAttendees}
                        </span> total corps registered
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Registration Interface */}
            <div className="bg-accent dark:bg-accent-dark/20 rounded-theme p-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                        Corps Registration
                    </h4>
                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        {weeklyRegistrationCount}/{weeklyLimit} events this week
                    </div>
                </div>
                
                {/* Class Restrictions Notice */}
                {allowedClasses.length < 3 && (
                    <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-theme">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-4 h-4 inline mr-1" />
                            This event is restricted to: {allowedClasses.map(c => 
                                c === 'worldClass' ? 'World Class' : 
                                c === 'openClass' ? 'Open Class' : 'A Class'
                            ).join(', ')} corps only
                        </p>
                    </div>
                )}

                {/* Weekly Limit Warning */}
                {weeklyRegistrationCount >= weeklyLimit - 1 && (
                    <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-theme">
                        <p className="text-sm text-red-800 dark:text-red-200">
                            <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-4 h-4 inline mr-1" />
                            {weeklyRegistrationCount >= weeklyLimit 
                                ? 'You have reached your weekly registration limit.' 
                                : 'You are close to your weekly registration limit.'}
                        </p>
                    </div>
                )}

                <div className="grid gap-3">
                    {availableCorps.map(([corpsClass, corpsData]) => {
                        const status = getRegistrationStatus(corpsClass);
                        const isRegistered = status === 'registered';
                        const isProcessing = status === 'registering' || status === 'unregistering';
                        const canRegister = weeklyRegistrationCount < weeklyLimit || isRegistered;
                        
                        return (
                            <div key={corpsClass} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                        corpsClass === 'worldClass' ? 'bg-blue-500' :
                                        corpsClass === 'openClass' ? 'bg-green-500' : 'bg-purple-500'
                                    }`}></div>
                                    <div>
                                        <p className="font-medium text-text-primary dark:text-text-primary-dark">
                                            {corpsData.name}
                                        </p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            {corpsClass === 'worldClass' ? 'World Class' :
                                             corpsClass === 'openClass' ? 'Open Class' : 'A Class'}
                                            {corpsData.location && ` • ${corpsData.location}`}
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => handleRegistration(corpsClass, !isRegistered)}
                                    disabled={isProcessing || (!canRegister && !isRegistered)}
                                    className={`px-4 py-2 rounded-theme font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        isRegistered
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : canRegister
                                                ? 'bg-primary dark:bg-primary-dark text-white hover:bg-primary-dark dark:hover:bg-primary'
                                                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    {isProcessing ? (
                                        <div className="flex items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            {status === 'registering' ? 'Registering...' : 'Unregistering...'}
                                        </div>
                                    ) : isRegistered ? (
                                        <div className="flex items-center gap-2">
                                            <Icon path="M4.5 12.75l6 6 9-13.5" className="w-4 h-4" />
                                            Registered
                                        </div>
                                    ) : canRegister ? (
                                        'Register'
                                    ) : (
                                        'Weekly Limit Reached'
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Attendance Summary */}
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                        Corps Attendance
                    </h4>
                    <button
                        onClick={() => setShowAttendanceDetails(!showAttendanceDetails)}
                        className="flex items-center gap-2 text-sm text-primary dark:text-primary-dark hover:text-primary-dark dark:hover:text-primary transition-colors"
                    >
                        {showAttendanceDetails ? 'Hide Details' : 'Show Details'}
                        <Icon 
                            path={showAttendanceDetails ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} 
                            className="w-4 h-4" 
                        />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                    {allowedClasses.map(corpsClass => (
                        <div key={corpsClass} className="text-center">
                            <div className={`w-6 h-6 rounded-full mx-auto mb-2 ${
                                corpsClass === 'worldClass' ? 'bg-blue-500' :
                                corpsClass === 'openClass' ? 'bg-green-500' : 'bg-purple-500'
                            }`}></div>
                            <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                {showCounts[corpsClass]}
                            </p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                {corpsClass === 'worldClass' ? 'World' :
                                 corpsClass === 'openClass' ? 'Open' : 'A Class'}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                            {totalAttendees}
                        </span> total corps registered
                    </p>
                </div>

                {/* Detailed Attendance List */}
                {showAttendanceDetails && (
                    <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                        {isLoadingAttendance ? (
                            <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary dark:border-primary-dark"></div>
                                <span className="ml-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                                    Loading attendance details...
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {allowedClasses.map(corpsClass => {
                                    const corps = attendingCorps[corpsClass] || [];
                                    if (corps.length === 0) return null;

                                    return (
                                        <div key={corpsClass}>
                                            <h5 className="font-medium text-text-primary dark:text-text-primary-dark mb-2 flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    corpsClass === 'worldClass' ? 'bg-blue-500' :
                                                    corpsClass === 'openClass' ? 'bg-green-500' : 'bg-purple-500'
                                                }`}></div>
                                                {corpsClass === 'worldClass' ? 'World Class' :
                                                 corpsClass === 'openClass' ? 'Open Class' : 'A Class'} 
                                                ({corps.length})
                                            </h5>
                                            <div className="grid gap-2">
                                                {corps.map((attendee, index) => (
                                                    <div key={index} className="flex items-center justify-between p-2 bg-accent dark:bg-accent-dark/20 rounded-theme">
                                                        <div>
                                                            <p className="font-medium text-text-primary dark:text-text-primary-dark text-sm">
                                                                {attendee.corpsName}
                                                            </p>
                                                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                                Director: {attendee.username}
                                                                {attendee.corpsLocation && ` • ${attendee.corpsLocation}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {totalAttendees === 0 && (
                                    <p className="text-center text-text-secondary dark:text-text-secondary-dark text-sm py-4">
                                        No corps registered for this event yet
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShowRegistrationSystem;