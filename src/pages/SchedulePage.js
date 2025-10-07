import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  Info, 
  CheckCircle, 
  Clock,
  Star,
  Award,
  Flag,
  Music,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';
import LoadingScreen from '../components/common/LoadingScreen';

const SchedulePage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [participantsMap, setParticipantsMap] = useState({});
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'myCorps', 'upcoming', 'completed'
  const [userCorps, setUserCorps] = useState([]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserCorps();
    }
  }, [currentUser]);

  const fetchUserCorps = async () => {
    if (!currentUser) return;
    
    try {
      const profileRef = doc(db, `artifacts/marching-art/users/${currentUser.uid}/profile/data`);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        setUserCorps(profile.activeCorps || []);
      }
    } catch (error) {
      console.error('Error fetching user corps:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current season
      const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
      
      if (!seasonDoc.exists()) {
        setError('No active season found');
        setLoading(false);
        return;
      }

      const seasonData = seasonDoc.data();
      
      if (!seasonData.activeSeasonId) {
        setError('Season ID not configured');
        setLoading(false);
        return;
      }
      
      setCurrentSeason(seasonData);

      // Get schedule
      const scheduleDoc = await getDoc(doc(db, 'schedules', seasonData.activeSeasonId));
      
      if (!scheduleDoc.exists()) {
        // Create basic schedule structure if it doesn't exist
        const basicSchedule = createBasicSchedule(seasonData);
        setScheduleData(basicSchedule);
        setSelectedWeek(1);
      } else {
        const schedule = scheduleDoc.data() || {};
        setScheduleData(schedule);
        
        // Set current week based on season progress
        const currentWeek = getCurrentWeek(schedule);
        setSelectedWeek(currentWeek);
      }
      
      // Fetch all participants for the season
      await fetchParticipants(seasonData.activeSeasonId);
      
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Failed to load schedule');
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const createBasicSchedule = (seasonData) => {
    // Create a basic 10-week schedule structure
    const schedule = {};
    const startDate = seasonData.startDate || new Date('2025-06-01');
    
    for (let week = 1; week <= 10; week++) {
      const weekDate = new Date(startDate);
      weekDate.setDate(weekDate.getDate() + (week - 1) * 7);
      
      schedule[`week${week}`] = {
        weekNumber: week,
        weekDate: weekDate,
        shows: []
      };
    }
    
    return schedule;
  };

  const getCurrentWeek = (schedule) => {
    const now = new Date();
    let currentWeek = 1;
    
    Object.keys(schedule).forEach(key => {
      if (key.startsWith('week')) {
        const weekData = schedule[key];
        if (weekData.weekDate && new Date(weekData.weekDate) <= now) {
          currentWeek = weekData.weekNumber;
        }
      }
    });
    
    return currentWeek;
  };

  const fetchParticipants = async (seasonId) => {
    try {
      const participantsQuery = query(
        collection(db, 'participants'),
        where('seasonId', '==', seasonId)
      );
      
      const participantsSnap = await getDocs(participantsQuery);
      const participantsData = {};
      
      participantsSnap.forEach(doc => {
        const data = doc.data();
        if (!participantsData[data.showId]) {
          participantsData[data.showId] = [];
        }
        participantsData[data.showId].push(data);
      });
      
      setParticipantsMap(participantsData);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
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
    if (showName && showName.toLowerCase().includes('finals')) return Trophy;
    if (showName && showName.toLowerCase().includes('semi')) return Award;
    if (showName && showName.toLowerCase().includes('quarter')) return Star;
    if (showName && showName.toLowerCase().includes('regional')) return Flag;
    return Music;
  };

  const getWeekKeys = () => {
    return Object.keys(scheduleData)
      .filter(key => key.startsWith('week'))
      .sort((a, b) => {
        const weekA = parseInt(a.replace('week', ''));
        const weekB = parseInt(b.replace('week', ''));
        return weekA - weekB;
      });
  };

  const filteredShows = (shows) => {
    if (!shows) return [];
    
    if (filter === 'all') return shows;
    
    if (filter === 'myCorps') {
      return shows.filter(show => {
        const participants = participantsMap[show.id] || [];
        return participants.some(p => userCorps.includes(p.corpsId));
      });
    }
    
    if (filter === 'upcoming') {
      const now = new Date();
      return shows.filter(show => {
        const showDate = show.date ? (show.date.toDate ? show.date.toDate() : new Date(show.date)) : null;
        return showDate && showDate > now;
      });
    }
    
    if (filter === 'completed') {
      const now = new Date();
      return shows.filter(show => {
        const showDate = show.date ? (show.date.toDate ? show.date.toDate() : new Date(show.date)) : null;
        return showDate && showDate <= now;
      });
    }
    
    return shows;
  };

  const navigateWeek = (direction) => {
    const weekKeys = getWeekKeys();
    const currentIndex = weekKeys.findIndex(key => scheduleData[key].weekNumber === selectedWeek);
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(weekKeys.length - 1, currentIndex + 1);
    }
    
    setSelectedWeek(scheduleData[weekKeys[newIndex]].weekNumber);
  };

  const openShowDetails = (show) => {
    setSelectedShow(show);
    setShowModal(true);
  };

  const exportSchedule = () => {
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Week,Event Name,Date,Location,Time,Participants\n";
    
    getWeekKeys().forEach(weekKey => {
      const weekData = scheduleData[weekKey];
      weekData.shows.forEach(show => {
        const participants = participantsMap[show.id] || [];
        csvContent += `${weekData.weekNumber},"${show.eventName}","${formatDate(show.date)}","${show.location || 'TBD'}","${formatTime(show.time)}",${participants.length}\n`;
      });
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `marching_art_schedule_${currentSeason?.activeSeasonId || 'season'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Schedule exported successfully!');
  };

  if (loading) {
    return <LoadingScreen message="Loading schedule..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary dark:text-text-primary-dark mb-2">Error Loading Schedule</h3>
        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={fetchSchedule}
          className="bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-6 py-2 rounded-theme font-medium transition-colors hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const weekKeys = getWeekKeys();
  const currentWeekData = scheduleData[`week${selectedWeek}`];
  const currentWeekShows = currentWeekData ? filteredShows(currentWeekData.shows) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Competition Schedule
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
          {currentSeason?.seasonName || 'Season 2025'} • {weekKeys.length} Weeks of Competition
        </p>
      </div>

      {/* Filter and Export */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark rounded-theme px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
            >
              <option value="all">All Shows</option>
              {currentUser && <option value="myCorps">My Corps Only</option>}
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <button
            onClick={exportSchedule}
            className="flex items-center gap-2 bg-secondary dark:bg-secondary-dark text-on-secondary dark:text-on-secondary-dark px-4 py-2 rounded-theme font-medium transition-colors hover:opacity-90"
          >
            <Download className="w-5 h-5" />
            Export Schedule
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            disabled={selectedWeek === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              selectedWeek === 1
                ? 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
                : 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous Week
          </button>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Week {selectedWeek}
            </h2>
            {currentWeekData && (
              <p className="text-text-secondary dark:text-text-secondary-dark">
                {formatDate(currentWeekData.weekDate)}
              </p>
            )}
          </div>
          
          <button
            onClick={() => navigateWeek('next')}
            disabled={selectedWeek === weekKeys.length}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              selectedWeek === weekKeys.length
                ? 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
                : 'bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark hover:opacity-90'
            }`}
          >
            Next Week
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Shows for Selected Week */}
      {currentWeekShows.length > 0 ? (
        <div className="grid gap-4">
          {currentWeekShows.map((show, index) => {
            const ShowIcon = getShowIcon(show.eventName);
            const participants = participantsMap[show.id] || [];
            const isCompleted = show.date && new Date(show.date.toDate ? show.date.toDate() : show.date) < new Date();
            
            return (
              <div
                key={index}
                onClick={() => openShowDetails(show)}
                className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark hover:shadow-lg dark:hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-primary dark:hover:border-primary-dark"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
                      <ShowIcon className="w-8 h-8 text-primary dark:text-primary-dark" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                          {show.eventName || 'Competition Event'}
                        </h3>
                        {isCompleted && (
                          <span className="flex items-center gap-1 text-sm bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Completed
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
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary dark:text-primary-dark" />
                          <span className="font-medium text-text-primary dark:text-text-primary-dark">
                            {participants.length} Participating Corps
                          </span>
                        </div>
                        
                        {show.classes && (
                          <div className="flex gap-2">
                            {show.classes.map(cls => (
                              <span 
                                key={cls}
                                className="text-xs bg-accent dark:bg-accent-dark px-2 py-1 rounded-full text-text-secondary dark:text-text-secondary-dark"
                              >
                                {cls}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center w-12 h-12 bg-background dark:bg-background-dark rounded-full">
                    <span className="text-2xl font-bold text-primary dark:text-primary-dark">
                      {index + 1}
                    </span>
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
            {filter === 'myCorps' 
              ? 'Your corps are not participating in any shows this week' 
              : 'Check back later for updated schedule information'}
          </p>
        </div>
      )}

      {/* Show Details Modal */}
      {showModal && selectedShow && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
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
                onClick={() => setShowModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark text-3xl leading-none"
              >
                ×
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

              {/* Participating Corps */}
              <div>
                <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Participating Corps ({participantsMap[selectedShow.id]?.length || 0})
                </h3>
                
                {participantsMap[selectedShow.id] && participantsMap[selectedShow.id].length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {participantsMap[selectedShow.id].map((participant, index) => (
                      <div 
                        key={index}
                        className="bg-background dark:bg-background-dark p-3 rounded-theme flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-primary-dark">
                            {participant.corpsName}
                          </p>
                          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {participant.corpsClass}
                          </p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-background dark:bg-background-dark p-8 rounded-theme text-center">
                    <Info className="w-12 h-12 mx-auto text-text-secondary dark:text-text-secondary-dark mb-2" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                      No participating corps registered yet
                    </p>
                  </div>
                )}
              </div>

              {/* Show Description */}
              {selectedShow.description && (
                <div>
                  <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-3">
                    Event Details
                  </h3>
                  <p className="text-text-secondary dark:text-text-secondary-dark bg-background dark:bg-background-dark p-4 rounded-theme">
                    {selectedShow.description}
                  </p>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="mt-6 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="bg-primary dark:bg-primary-dark text-on-primary dark:text-on-primary-dark px-6 py-2 rounded-theme font-medium transition-colors hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePage;