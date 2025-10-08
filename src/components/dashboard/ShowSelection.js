import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebaseConfig';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { useDataStore } from '../../store/dataStore'; // ADD THIS
import toast from 'react-hot-toast';
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
  Loader,
  X
} from 'lucide-react';

const ShowSelection = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  
  // RENAMED: Use destructured functions from data store with aliases to avoid conflicts
  const { 
    fetchCurrentSeason: getCachedSeason, 
    fetchSchedule: getCachedSchedule 
  } = useDataStore();
  
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [registeredShows, setRegisteredShows] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  useEffect(() => {
    loadScheduleData();
  }, []);

  // RENAMED: Changed function name to avoid conflicts
  const loadScheduleData = async () => {
    try {
      setLoading(true);

      // OPTIMIZED: Use cached season data
      const seasonData = await getCachedSeason();
      if (!seasonData) {
        toast.error('No active season found');
        setLoading(false);
        return;
      }

      const seasonId = seasonData.seasonId || seasonData.currentSeasonId;
      setCurrentSeason(seasonData);

      console.log('Season ID:', seasonId);

      // OPTIMIZED: Use cached schedule data
      const scheduleData = await getCachedSchedule(seasonId);
      
      if (!scheduleData) {
        console.error('No schedule found for season:', seasonId);
        toast.error('Schedule not available for this season');
        setLoading(false);
        return;
      }

      // CRITICAL FIX: The database has "competitions" not "shows"
      // Transform the data structure to match what the component expects
      const transformedSchedule = {};
      
      if (scheduleData.weeks) {
        // If weeks structure exists, use it
        Object.keys(scheduleData.weeks).forEach(weekKey => {
          const weekData = scheduleData.weeks[weekKey];
          transformedSchedule[weekKey] = {
            weekNumber: weekData.weekNumber,
            shows: weekData.competitions || weekData.shows || []  // Support both field names
          };
        });
      } else if (scheduleData.competitions) {
        // If only competitions array exists, group by week
        const competitions = scheduleData.competitions;
        
        competitions.forEach(comp => {
          const weekKey = `week${comp.week}`;
          if (!transformedSchedule[weekKey]) {
            transformedSchedule[weekKey] = {
              weekNumber: comp.week,
              shows: []
            };
          }
          transformedSchedule[weekKey].shows.push(comp);
        });
      }

      console.log('Transformed schedule:', transformedSchedule);
      setSchedule(transformedSchedule);

      // TODO: Fetch user's registered shows from their profile or a registrations collection
      // For now, using empty array
      setRegisteredShows([]);

    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterForShow = async (show) => {
    if (!currentUser || !profile) {
      toast.error('Please complete your profile first');
      return;
    }

    if (!profile.corps || !profile.corps.corpsName || profile.corps.corpsName === 'New Corps') {
      toast.error('Please complete your corps setup first');
      return;
    }

    try {
      setRegistering(true);

      const registerForShow = httpsCallable(functions, 'registerForShow');
      const result = await registerForShow({
        showId: show.id,
        seasonId: currentSeason.seasonId || currentSeason.currentSeasonId
      });

      if (result.data.success) {
        toast.success(result.data.message);
        setRegisteredShows([...registeredShows, show.id]);
        
        // Award XP notification
        if (result.data.xpAwarded) {
          toast.success(`+${result.data.xpAwarded} XP!`, { icon: '⭐' });
        }
      }
    } catch (error) {
      console.error('Error registering for show:', error);
      toast.error(error.message || 'Failed to register for show');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregisterFromShow = async (show) => {
    if (!currentUser) {
      toast.error('Please log in first');
      return;
    }

    try {
      setRegistering(true);

      const unregisterFromShow = httpsCallable(functions, 'unregisterFromShow');
      const result = await unregisterFromShow({
        showId: show.id,
        seasonId: currentSeason.seasonId || currentSeason.currentSeasonId
      });

      if (result.data.success) {
        toast.success(result.data.message);
        setRegisteredShows(registeredShows.filter(id => id !== show.id));
      }
    } catch (error) {
      console.error('Error unregistering from show:', error);
      toast.error(error.message || 'Failed to unregister from show');
    } finally {
      setRegistering(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'TBD';
    }
  };

  const formatTime = (time) => {
    if (!time) return 'TBA';
    return time;
  };

  const getShowIcon = (showName) => {
    if (!showName) return Music;
    const lower = showName.toLowerCase();
    if (lower.includes('finals')) return Trophy;
    if (lower.includes('semi')) return Award;
    if (lower.includes('quarter')) return Star;
    if (lower.includes('regional') || lower.includes('championship') || lower.includes('classic')) return Flag;
    return Music;
  };

  const isShowRegistered = (showId) => {
    return registeredShows.includes(showId);
  };

  const canRegisterForShow = (show) => {
    if (!profile || !profile.corps) return false;
    
    // Check if corps class matches show requirements
    if (show.allowedClasses && !show.allowedClasses.includes(profile.corps.corpsClass)) {
      return false;
    }
    
    // Check if show is in the future or current week
    const now = new Date();
    const showDate = show.date ? (show.date.toDate ? show.date.toDate() : new Date(show.date)) : null;
    
    if (showDate && showDate < now) {
      return false; // Can't register for past shows
    }
    
    return true;
  };

  const getWeekKeys = () => {
    return Object.keys(schedule)
      .filter(key => key.startsWith('week'))
      .sort((a, b) => {
        const weekA = parseInt(a.replace('week', ''));
        const weekB = parseInt(b.replace('week', ''));
        return weekA - weekB;
      });
  };

  const openShowDetails = (show) => {
    setSelectedShow(show);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary dark:text-primary-dark" />
        <span className="ml-2 text-text-secondary dark:text-text-secondary-dark">Loading schedule...</span>
      </div>
    );
  }

  if (!currentSeason) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
          No Active Season
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Show registration will be available once a season is active
        </p>
      </div>
    );
  }

  const weekKeys = getWeekKeys();
  const currentWeekData = schedule[`week${selectedWeek}`];
  const currentWeekShows = currentWeekData ? currentWeekData.shows || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary dark:from-primary-dark to-secondary dark:to-secondary-dark p-6 rounded-theme">
        <h2 className="text-2xl font-bold text-white mb-2">Show Selection</h2>
        <p className="text-white text-opacity-90">
          Register your corps for competitions • {registeredShows.length} shows registered
        </p>
      </div>

      {/* Important Info */}
      {profile && (!profile.corps || !profile.corps.corpsName || profile.corps.corpsName === 'New Corps') && (
        <div className="bg-orange-500 bg-opacity-10 border-2 border-orange-500 rounded-theme p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-1">
              Complete Your Corps Setup
            </h4>
            <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
              You need to set up your corps name and select your class before you can register for shows.
              Go to the Overview tab to complete your setup.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark text-center">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {registeredShows.length}
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Shows Registered</p>
        </div>
        
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark text-center">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-primary dark:text-primary-dark" />
          <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {weekKeys.length}
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Weeks of Competition</p>
        </div>
        
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-primary dark:text-primary-dark" />
          <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {profile?.corps?.corpsClass || 'N/A'}
          </div>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Your Class</p>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Select Week
          </h3>
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
            Week {selectedWeek} of {weekKeys.length}
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weekKeys.map((weekKey) => {
            const weekNum = schedule[weekKey].weekNumber;
            const weekShows = schedule[weekKey].shows || [];
            const registeredCount = weekShows.filter(show => isShowRegistered(show.id)).length;
            
            return (
              <button
                key={weekKey}
                onClick={() => setSelectedWeek(weekNum)}
                className={`flex-shrink-0 px-4 py-3 rounded-theme font-medium transition-all ${
                  selectedWeek === weekNum
                    ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark shadow-lg'
                    : 'bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark hover:bg-primary hover:bg-opacity-20 dark:hover:bg-primary-dark dark:hover:bg-opacity-20'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg">Week {weekNum}</div>
                  {registeredCount > 0 && (
                    <div className="text-xs mt-1 opacity-80">
                      {registeredCount} registered
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shows List */}
      {currentWeekShows && currentWeekShows.length > 0 ? (
        <div className="space-y-4">
          {currentWeekShows.map((show, index) => {
            // FIX: Use show.name as primary, fallback to eventName for backward compatibility
            const showName = show.name || show.eventName || 'Competition Event';
            const ShowIcon = getShowIcon(showName);
            const isRegistered = isShowRegistered(show.id);
            const canRegister = canRegisterForShow(show) && !isRegistered;
            
            return (
              <div
                key={show.id || index}
                className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark hover:shadow-lg dark:hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-primary dark:hover:border-primary-dark"
                onClick={() => openShowDetails(show)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
                      <ShowIcon className="w-8 h-8 text-primary dark:text-primary-dark" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                          {showName}
                        </h3>
                        {isRegistered && (
                          <span className="flex items-center gap-1 text-sm bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Registered
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-1 text-sm text-text-secondary dark:text-text-secondary-dark">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(show.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{show.location || 'Location TBA'}</span>
                        </div>
                        {show.allowedClasses && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Classes: {show.allowedClasses.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {isRegistered ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnregisterFromShow(show);
                        }}
                        disabled={registering}
                        className="bg-red-500 bg-opacity-20 text-red-400 px-4 py-2 rounded-theme font-medium hover:bg-opacity-30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {registering ? 'Processing...' : 'Unregister'}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canRegister) {
                            handleRegisterForShow(show);
                          }
                        }}
                        disabled={!canRegister || registering}
                        className={`px-4 py-2 rounded-theme font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          canRegister
                            ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90'
                            : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                        }`}
                      >
                        {registering ? 'Processing...' : (canRegister ? 'Register' : 'Not Available')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-12 text-center shadow-theme dark:shadow-theme-dark">
          <Info className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
          <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">
            No Shows This Week
          </h3>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            Check other weeks for available competitions
          </p>
        </div>
      )}

      {/* Show Detail Modal */}
      {showDetailModal && selectedShow && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-4 rounded-theme">
                  {React.createElement(getShowIcon(selectedShow.name || selectedShow.eventName), {
                    className: "w-10 h-10 text-primary dark:text-primary-dark"
                  })}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                    {selectedShow.name || selectedShow.eventName || 'Competition Event'}
                  </h2>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {formatDate(selectedShow.date)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Show Details */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Location</h3>
                  </div>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {selectedShow.location || 'To be announced'}
                  </p>
                </div>
                
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Date & Time</h3>
                  </div>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {formatDate(selectedShow.date)}
                  </p>
                  <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
                    {formatTime(selectedShow.time)}
                  </p>
                </div>
                
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Competition Type</h3>
                  </div>
                  <p className="text-text-secondary dark:text-text-secondary-dark capitalize">
                    {selectedShow.type || 'Regular Competition'}
                  </p>
                </div>
                
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Eligible Classes</h3>
                  </div>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {selectedShow.allowedClasses ? selectedShow.allowedClasses.join(', ') : 'All Classes'}
                  </p>
                </div>
              </div>

              {/* Show Description */}
              {selectedShow.description && (
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">About This Show</h3>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {selectedShow.description}
                  </p>
                </div>
              )}

              {/* Registration Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 rounded-theme border-2 border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark hover:bg-opacity-10 dark:hover:bg-opacity-10 transition-colors"
                >
                  Close
                </button>
                {!isShowRegistered(selectedShow.id) && canRegisterForShow(selectedShow) && (
                  <button
                    onClick={() => {
                      handleRegisterForShow(selectedShow);
                      setShowDetailModal(false);
                    }}
                    disabled={registering}
                    className="px-6 py-2 rounded-theme bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registering ? 'Processing...' : 'Register for Show'}
                  </button>
                )}
                {isShowRegistered(selectedShow.id) && (
                  <button
                    onClick={() => {
                      handleUnregisterFromShow(selectedShow);
                      setShowDetailModal(false);
                    }}
                    disabled={registering}
                    className="px-6 py-2 rounded-theme bg-red-500 bg-opacity-20 text-red-400 hover:bg-opacity-30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registering ? 'Processing...' : 'Unregister from Show'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowSelection;