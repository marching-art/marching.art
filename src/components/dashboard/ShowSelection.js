import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebaseConfig';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
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
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [registeredShows, setRegisteredShows] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  useEffect(() => {
    fetchScheduleData();
  }, []);

  const fetchScheduleData = async () => {
    try {
      setLoading(true);

      // Get current season
      const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
      if (!seasonDoc.exists()) {
        toast.error('No active season found');
        return;
      }

      const seasonData = seasonDoc.data();
      setCurrentSeason(seasonData);

      // Get schedule
      const scheduleDoc = await getDoc(doc(db, 'schedules', seasonData.activeSeasonId));
      if (scheduleDoc.exists()) {
        setSchedule(scheduleDoc.data());
      }

      // Get user's registered shows
      if (currentUser) {
        const participantsQuery = query(
          collection(db, 'participants'),
          where('userId', '==', currentUser.uid),
          where('seasonId', '==', seasonData.activeSeasonId)
        );
        const participantsSnap = await getDocs(participantsQuery);
        const registered = participantsSnap.docs.map(doc => doc.data().showId);
        setRegisteredShows(registered);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Failed to load schedule');
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
      toast.error('Please set up your corps before registering for shows');
      return;
    }

    try {
      setRegistering(true);

      // Call cloud function to register for show
      const registerFunction = httpsCallable(functions, 'registerForShow');
      const result = await registerFunction({
        showId: show.id,
        seasonId: currentSeason.activeSeasonId
      });

      if (result.data.success) {
        toast.success(`Successfully registered for ${show.eventName}!`);
        setRegisteredShows([...registeredShows, show.id]);
        setShowDetailModal(false);
      } else {
        toast.error(result.data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error registering for show:', error);
      toast.error('Failed to register for show');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregisterFromShow = async (show) => {
    try {
      setRegistering(true);

      // Call cloud function to unregister from show
      const unregisterFunction = httpsCallable(functions, 'unregisterFromShow');
      const result = await unregisterFunction({
        showId: show.id,
        seasonId: currentSeason.activeSeasonId
      });

      if (result.data.success) {
        toast.success(`Unregistered from ${show.eventName}`);
        setRegisteredShows(registeredShows.filter(id => id !== show.id));
        setShowDetailModal(false);
      } else {
        toast.error(result.data.message || 'Failed to unregister');
      }
    } catch (error) {
      console.error('Error unregistering from show:', error);
      toast.error('Failed to unregister from show');
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
    if (lower.includes('regional')) return Flag;
    return Music;
  };

  const isShowRegistered = (showId) => {
    return registeredShows.includes(showId);
  };

  const canRegisterForShow = (show) => {
    if (!profile || !profile.corps) return false;
    
    // Check if corps class matches show requirements
    if (show.classes && !show.classes.includes(profile.corps.corpsClass)) {
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
                    ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark shadow-lg scale-105'
                    : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg font-bold">Week {weekNum}</div>
                  {registeredCount > 0 && (
                    <div className="text-xs mt-1 flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {registeredCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shows for Selected Week */}
      {currentWeekShows.length > 0 ? (
        <div className="grid gap-4">
          {currentWeekShows.map((show, index) => {
            const ShowIcon = getShowIcon(show.eventName);
            const isRegistered = isShowRegistered(show.id);
            const canRegister = canRegisterForShow(show);
            
            return (
              <div
                key={index}
                className={`bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark transition-all ${
                  isRegistered 
                    ? 'border-2 border-green-500' 
                    : 'border-2 border-transparent hover:border-primary dark:hover:border-primary-dark'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-theme ${
                      isRegistered 
                        ? 'bg-green-500 bg-opacity-10' 
                        : 'bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20'
                    }`}>
                      <ShowIcon className={`w-8 h-8 ${
                        isRegistered ? 'text-green-500' : 'text-primary dark:text-primary-dark'
                      }`} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                          {show.eventName || 'Competition Event'}
                        </h3>
                        {isRegistered && (
                          <span className="flex items-center gap-1 text-sm bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Registered
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(show.date)}</span>
                          {show.time && (
                            <>
                              <span className="mx-2">•</span>
                              <Clock className="w-4 h-4" />
                              <span>{formatTime(show.time)}</span>
                            </>
                          )}
                        </div>
                        
                        {show.location && (
                          <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                            <MapPin className="w-4 h-4" />
                            <span>{show.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {show.classes && (
                        <div className="flex gap-2 mb-3">
                          {show.classes.map(cls => {
                            const isMyClass = profile?.corps?.corpsClass === cls;
                            return (
                              <span 
                                key={cls}
                                className={`text-xs px-2 py-1 rounded-full ${
                                  isMyClass
                                    ? 'bg-primary dark:bg-primary-dark bg-opacity-20 text-primary dark:text-primary-dark font-semibold'
                                    : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                                }`}
                              >
                                {cls}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      
                      {!canRegister && !isRegistered && (
                        <div className="flex items-center gap-2 text-orange-500 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span>
                            {show.classes && !show.classes.includes(profile?.corps?.corpsClass)
                              ? 'Your class cannot participate in this show'
                              : 'Registration closed for this show'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {isRegistered ? (
                      <>
                        <button
                          onClick={() => openShowDetails(show)}
                          className="px-4 py-2 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleUnregisterFromShow(show)}
                          disabled={registering}
                          className="px-4 py-2 bg-red-500 text-white rounded-theme font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {registering ? 'Processing...' : 'Unregister'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openShowDetails(show)}
                        disabled={!canRegister}
                        className={`px-4 py-2 rounded-theme font-medium transition-opacity ${
                          canRegister
                            ? 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90'
                            : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {canRegister ? 'Register' : 'Not Available'}
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
                  {React.createElement(getShowIcon(selectedShow.eventName), {
                    className: "w-10 h-10 text-primary dark:text-primary-dark"
                  })}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                    {selectedShow.eventName || 'Competition Event'}
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
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Time</h3>
                  </div>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {formatTime(selectedShow.time)}
                  </p>
                </div>
              </div>

              {selectedShow.classes && (
                <div>
                  <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-3">
                    Eligible Classes
                  </h3>
                  <div className="flex gap-2">
                    {selectedShow.classes.map(cls => (
                      <span 
                        key={cls}
                        className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 text-primary dark:text-primary-dark px-3 py-2 rounded-theme font-medium"
                      >
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedShow.description && (
                <div>
                  <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-3">
                    Event Details
                  </h3>
                  <p className="text-text-secondary dark:text-text-secondary-dark bg-background dark:bg-background-dark p-4 rounded-theme">
                    {selectedShow.description}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isShowRegistered(selectedShow.id) ? (
                  <>
                    <button
                      onClick={() => handleUnregisterFromShow(selectedShow)}
                      disabled={registering}
                      className="flex-1 bg-red-500 text-white px-6 py-3 rounded-theme font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {registering ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader className="w-5 h-5 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        'Unregister from Show'
                      )}
                    </button>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-6 py-3 bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleRegisterForShow(selectedShow)}
                      disabled={registering || !canRegisterForShow(selectedShow)}
                      className="flex-1 bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-6 py-3 rounded-theme font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {registering ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader className="w-5 h-5 animate-spin" />
                          Registering...
                        </span>
                      ) : (
                        'Register for Show'
                      )}
                    </button>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-6 py-3 bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark rounded-theme font-medium hover:opacity-90 transition-opacity"
                    >
                      Cancel
                    </button>
                  </>
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