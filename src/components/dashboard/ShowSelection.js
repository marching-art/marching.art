import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebaseConfig';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingScreen from '../common/LoadingScreen';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  CheckCircle, 
  Clock,
  Star,
  Award,
  Flag,
  Music,
  AlertCircle,
  Info,
  Loader2,
  X,
  Target
} from 'lucide-react';

const ShowSelection = ({ userProfile, activeCorps }) => {
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [registeredShows, setRegisteredShows] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  useEffect(() => {
    if (activeCorps?.id) {
      loadScheduleData();
    }
  }, [activeCorps?.id]);

  useEffect(() => {
    loadScheduleData();
  }, [activeCorps?.id]);

  const loadScheduleData = async () => {
  setLoading(true);
  try {
    // Get current season
    const gameSettingsRef = doc(db, 'game-settings/current');
    const gameSettingsSnap = await getDoc(gameSettingsRef);
    
    if (gameSettingsSnap.exists()) {
      const seasonData = gameSettingsSnap.data();
      setCurrentSeason(seasonData);
      
      const currentSeasonId = seasonData.activeSeasonId || seasonData.currentSeasonId;
      
      // Check if user has a lineup saved FIRST
      if (currentUser) {
        const profileRef = doc(db, `artifacts/marching-art/users/${currentUser.uid}/profile/data`);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          const savedLineup = profile.lineup || {};
          
          // Check if lineup is empty or incomplete
          const requiredCaptions = ['GE1', 'GE2', 'Visual Proficiency', 'Visual Analysis', 'Color Guard', 'Brass', 'Music Analysis', 'Percussion'];
          const hasCompleteLineup = requiredCaptions.every(caption => savedLineup[caption]);
          
          if (!hasCompleteLineup) {
            toast.error('Please complete your caption selections before registering for shows', {
              duration: 5000
            });
          }
        }
      }
      
      // Load schedule from competitions array
      const scheduleRef = doc(db, 'schedules', currentSeasonId);
      const scheduleSnap = await getDoc(scheduleRef);

      if (scheduleSnap.exists()) {
        const scheduleData = scheduleSnap.data();
        const competitions = scheduleData.competitions || [];
        
        console.log(`Loaded ${competitions.length} competitions`);
        
        // Build weeks structure from competitions array
        const weekStructure = {};
        competitions.forEach(comp => {
          const weekKey = `week${comp.week}`;
          
          if (!weekStructure[weekKey]) {
            weekStructure[weekKey] = {
              weekNumber: comp.week,
              days: {}
            };
          }
          
          const dayKey = `day${comp.day}`;
          if (!weekStructure[weekKey].days[dayKey]) {
            weekStructure[weekKey].days[dayKey] = {
              date: comp.date,
              shows: []
            };
          }
          
          // Add competition to this day
          weekStructure[weekKey].days[dayKey].shows.push({
            id: comp.id,
            eventName: comp.name,
            location: comp.location,
            date: comp.date,
            type: comp.type || 'regular',
            classRestrictions: comp.allowedClasses || null,
            status: comp.status || 'scheduled'
          });
        });
        
        setSchedule(weekStructure);
        console.log(`Built schedule with ${Object.keys(weekStructure).length} weeks`);
        
        if (Object.keys(weekStructure).length === 0) {
          toast.warning('No competitions scheduled for current season');
        }
      } else {
        console.error('Schedule document not found for season:', currentSeasonId);
        toast.error('No schedule available for current season');
      }
      
      // Load registered shows for THIS specific corps
      if (currentUser && activeCorps) {
        const participantsRef = collection(db, 'participants');
        const participantsQuery = query(
          participantsRef,
          where('userId', '==', currentUser.uid),
          where('corpsId', '==', activeCorps.id),
          where('seasonId', '==', currentSeasonId)
        );
        const participantsSnap = await getDocs(participantsQuery);
        
        const registered = [];
        participantsSnap.forEach(doc => {
          registered.push(doc.data().showId);
        });
        setRegisteredShows(registered);
        
        console.log(`User has ${registered.length} registered shows for this corps`);
      }
    }
  } catch (error) {
    console.error('Error loading schedule:', error);
    toast.error('Failed to load schedule data');
  } finally {
    setLoading(false);
  }
};

  const handleRegisterForShow = async (show) => {
    if (!currentSeason) {
      toast.error('Season data not available');
      return;
    }

    const seasonId = currentSeason.activeSeasonId || currentSeason.currentSeasonId || '2025';

    setRegistering(true);
    try {
      const registerForShow = httpsCallable(functions, 'registerForShow');
      const result = await registerForShow({
        showId: show.id,
        seasonId: seasonId
      });

      if (result.data.success) {
        toast.success(result.data.message);
        setRegisteredShows([...registeredShows, show.id]);
        setShowDetailModal(false);
      } else {
        toast.error(result.data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error registering for show:', error);
      toast.error(error.message || 'Failed to register for show');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregisterFromShow = async (show) => {
    if (!currentSeason) {
      toast.error('Season data not available');
      return;
    }

    const seasonId = currentSeason.activeSeasonId || currentSeason.currentSeasonId || '2025';

    if (!window.confirm(`Are you sure you want to unregister from ${show.eventName}?`)) {
      return;
    }

    setRegistering(true);
    try {
      const unregisterFromShow = httpsCallable(functions, 'unregisterFromShow');
      const result = await unregisterFromShow({
        showId: show.id,
        seasonId: seasonId
      });

      if (result.data.success) {
        toast.success(result.data.message);
        setRegisteredShows(registeredShows.filter(id => id !== show.id));
        setShowDetailModal(false);
      } else {
        toast.error(result.data.message || 'Unregistration failed');
      }
    } catch (error) {
      console.error('Error unregistering from show:', error);
      toast.error(error.message || 'Failed to unregister from show');
    } finally {
      setRegistering(false);
    }
  };

  const getShowIcon = (showType) => {
    const icons = {
      'Regional': MapPin,
      'Championship': Trophy,
      'Finals': Award,
      'SoundSport': Music,
      'Special': Star
    };
    return icons[showType] || Calendar;
  };

  const getShowColor = (showType) => {
    const colors = {
      'Regional': 'text-blue-500 border-blue-500',
      'Championship': 'text-purple-500 border-purple-500',
      'Finals': 'text-yellow-500 border-yellow-500',
      'SoundSport': 'text-green-500 border-green-500',
      'Special': 'text-pink-500 border-pink-500'
    };
    return colors[showType] || 'text-accent dark:text-accent-dark border-accent dark:border-accent-dark';
  };

  const isShowPast = (show) => {
    if (!show.date) return false;
    const showDate = new Date(show.date);
    return showDate < new Date();
  };

  const canRegisterForShow = (show) => {
    if (isShowPast(show)) return false;
    if (registeredShows.includes(show.id)) return false;
    
    // Check class restrictions
    if (show.classRestrictions) {
      return show.classRestrictions.includes(activeCorps.corpsClass);
    }
    
    return true;
  };

  if (!activeCorps) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          No Corps Selected
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Please create or select a corps to register for shows.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  const weeks = Object.keys(schedule).sort((a, b) => 
    parseInt(a.replace('week', '')) - parseInt(b.replace('week', ''))
  );

  const selectedWeekData = schedule[`week${selectedWeek}`] || { days: {} };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            Show Registration
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            {activeCorps.corpsName} • {registeredShows.length} Shows Registered
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-primary/5 dark:bg-primary-dark/5 border border-primary dark:border-primary-dark rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
            <p className="mb-2">
              Register your corps for competition shows! Your scores will be calculated based on your caption selections.
            </p>
            <p>
              <strong>Note:</strong> Some shows have class restrictions. Make sure your {activeCorps.corpsClass} corps is eligible before registering.
            </p>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {weeks.map((week) => {
          const weekNum = parseInt(week.replace('week', ''));
          return (
            <button
              key={week}
              onClick={() => setSelectedWeek(weekNum)}
              className={`px-4 py-2 rounded-theme font-semibold whitespace-nowrap transition-all ${
                selectedWeek === weekNum
                  ? 'bg-primary dark:bg-primary-dark text-white'
                  : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark border border-accent dark:border-accent-dark'
              }`}
            >
              Week {weekNum}
            </button>
          );
        })}
      </div>

      {/* Shows Grid */}
      <div className="space-y-6">
        {Object.entries(selectedWeekData.days || {}).map(([day, dayData]) => (
          <div key={day}>
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {dayData.date ? new Date(dayData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : `Day ${day}`}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(dayData.shows || []).map((show) => {
                const ShowIcon = getShowIcon(show.type);
                const showColor = getShowColor(show.type);
                const isRegistered = registeredShows.includes(show.id);
                const isPast = isShowPast(show);
                const canRegister = canRegisterForShow(show);

                return (
                  <div
                    key={show.id}
                    className={`bg-surface dark:bg-surface-dark p-4 rounded-theme border-2 transition-all cursor-pointer ${
                      isRegistered
                        ? 'border-green-500 bg-green-500/5'
                        : isPast
                        ? 'border-accent dark:border-accent-dark opacity-50'
                        : showColor
                    } hover:shadow-lg`}
                    onClick={() => {
                      setSelectedShow(show);
                      setShowDetailModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShowIcon className={`w-5 h-5 ${showColor.split(' ')[0]}`} />
                        <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark uppercase">
                          {show.type}
                        </span>
                      </div>
                      {isRegistered && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {isPast && !isRegistered && (
                        <Clock className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                      )}
                    </div>

                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2 line-clamp-2">
                      {show.eventName}
                    </h4>

                    <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark mb-3">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{show.location}</span>
                    </div>

                    {show.classRestrictions && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {show.classRestrictions.map(cls => (
                          <span
                            key={cls}
                            className={`text-xs px-2 py-1 rounded ${
                              cls === activeCorps.corpsClass
                                ? 'bg-primary/20 text-primary dark:text-primary-dark font-semibold'
                                : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                            }`}
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      {show.participantCount || 0} corps registered
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(selectedWeekData.days || {}).length === 0 && (
          <div className="text-center py-12 bg-surface dark:bg-surface-dark rounded-theme border-2 border-dashed border-accent dark:border-accent-dark">
            <Calendar className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
            <p className="text-text-secondary dark:text-text-secondary-dark">
              No shows scheduled for this week
            </p>
          </div>
        )}
      </div>

      {/* Show Detail Modal */}
      {showDetailModal && selectedShow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 max-w-2xl w-full my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                {selectedShow.eventName}
              </h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedShow(null);
                }}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {React.createElement(getShowIcon(selectedShow.type), { 
                    className: `w-5 h-5 ${getShowColor(selectedShow.type).split(' ')[0]}` 
                  })}
                  <span className="font-semibold">{selectedShow.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                  <span>{selectedShow.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                  <span>
                    {selectedShow.date ? new Date(selectedShow.date).toLocaleDateString() : 'TBD'}
                  </span>
                </div>
              </div>

              {selectedShow.description && (
                <p className="text-text-secondary dark:text-text-secondary-dark">
                  {selectedShow.description}
                </p>
              )}

              {selectedShow.classRestrictions && (
                <div>
                  <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                    Eligible Classes:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedShow.classRestrictions.map(cls => (
                      <span
                        key={cls}
                        className={`px-3 py-1 rounded ${
                          cls === activeCorps.corpsClass
                            ? 'bg-primary/20 text-primary dark:text-primary-dark font-semibold border-2 border-primary dark:border-primary-dark'
                            : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                        }`}
                      >
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {registeredShows.includes(selectedShow.id) && (
                <div className="p-4 bg-green-500/10 border border-green-500 rounded-theme">
                  <div className="flex items-center gap-2 text-green-500 font-semibold">
                    <CheckCircle className="w-5 h-5" />
                    <span>You are registered for this show</span>
                  </div>
                </div>
              )}

              {isShowPast(selectedShow) && !registeredShows.includes(selectedShow.id) && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-theme">
                  <div className="flex items-center gap-2 text-yellow-500 font-semibold">
                    <Clock className="w-5 h-5" />
                    <span>This show has already occurred</span>
                  </div>
                </div>
              )}

              {!canRegisterForShow(selectedShow) && 
               !isShowPast(selectedShow) && 
               !registeredShows.includes(selectedShow.id) && (
                <div className="p-4 bg-error/10 border border-error rounded-theme">
                  <div className="flex items-center gap-2 text-error font-semibold">
                    <AlertCircle className="w-5 h-5" />
                    <span>Your {activeCorps.corpsClass} corps is not eligible for this show</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-accent dark:border-accent-dark">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedShow(null);
                  }}
                  className="flex-1 px-4 py-3 border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark transition-colors"
                >
                  Close
                </button>
                
                {registeredShows.includes(selectedShow.id) ? (
                  <button
                    onClick={() => handleUnregisterFromShow(selectedShow)}
                    disabled={registering}
                    className="flex-1 px-4 py-3 bg-error hover:bg-error-dark text-white rounded-theme font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Unregistering...
                      </>
                    ) : (
                      <>
                        <X className="w-5 h-5" />
                        Unregister
                      </>
                    )}
                  </button>
                ) : canRegisterForShow(selectedShow) ? (
                  <button
                    onClick={() => handleRegisterForShow(selectedShow)}
                    disabled={registering}
                    className="flex-1 px-4 py-3 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Register
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowSelection;