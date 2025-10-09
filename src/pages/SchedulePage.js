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
  const [competitions, setCompetitions] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [participantsMap, setParticipantsMap] = useState({});
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
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
        // Get list of corps IDs this user owns
        const corpsIds = profile.corps ? [profile.corps.id] : [];
        setUserCorps(corpsIds);
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
      const gameSettingsRef = doc(db, 'game-settings/current');
      const gameSettingsSnap = await getDoc(gameSettingsRef);

      if (!gameSettingsSnap.exists()) {
        setError('No active season found');
        setLoading(false);
        return;
      }

      const seasonData = gameSettingsSnap.data();
      setCurrentSeason(seasonData);
      
      const currentSeasonId = seasonData.activeSeasonId || seasonData.currentSeasonId;
      console.log('Loading schedule for season:', currentSeasonId);

      // Load schedule from competitions array
      const scheduleRef = doc(db, 'schedules', currentSeasonId);
      const scheduleSnap = await getDoc(scheduleRef);

      if (scheduleSnap.exists()) {
        const scheduleData = scheduleSnap.data();
        const comps = scheduleData.competitions || [];
        
        console.log(`Loaded ${comps.length} competitions`);
        
        if (comps.length > 0) {
          setCompetitions(comps);
          
          // Set initial week based on current day
          const currentDay = seasonData.currentDay || 1;
          const currentWeek = Math.ceil(currentDay / 7);
          setSelectedWeek(currentWeek);
          
          // Fetch participants data
          await fetchParticipants(currentSeasonId);
        } else {
          setError('No competitions scheduled for this season yet');
        }
      } else {
        setError('Schedule not found for current season');
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setError('Failed to load schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
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

  const formatDate = (timestamp) => {
    if (!timestamp) return 'TBD';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
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
    const name = showName?.toLowerCase() || '';
    if (name.includes('finals')) return Trophy;
    if (name.includes('semi')) return Award;
    if (name.includes('championship')) return Flag;
    if (name.includes('regional')) return Flag;
    return Music;
  };

  const getTotalWeeks = () => {
    if (competitions.length === 0) return 7;
    return Math.max(...competitions.map(c => c.week || 1));
  };

  const getCompetitionsForWeek = (weekNumber) => {
    return competitions.filter(comp => comp.week === weekNumber);
  };

  const filteredCompetitions = (comps) => {
    if (filter === 'all') return comps;
    
    if (filter === 'myCorps') {
      return comps.filter(comp => {
        const participants = participantsMap[comp.id] || [];
        return participants.some(p => userCorps.includes(p.corpsId));
      });
    }
    
    if (filter === 'upcoming') {
      const now = new Date();
      return comps.filter(comp => {
        const showDate = comp.date ? (comp.date.toDate ? comp.date.toDate() : new Date(comp.date)) : null;
        return showDate && showDate > now;
      });
    }
    
    if (filter === 'completed') {
      const now = new Date();
      return comps.filter(comp => {
        const showDate = comp.date ? (comp.date.toDate ? comp.date.toDate() : new Date(comp.date)) : null;
        return showDate && showDate <= now;
      });
    }
    
    return comps;
  };

  const navigateWeek = (direction) => {
    const totalWeeks = getTotalWeeks();
    if (direction === 'prev') {
      setSelectedWeek(Math.max(1, selectedWeek - 1));
    } else {
      setSelectedWeek(Math.min(totalWeeks, selectedWeek + 1));
    }
  };

  const openShowDetails = (show) => {
    setSelectedShow(show);
    setShowModal(true);
  };

  const exportSchedule = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Week,Day,Event Name,Date,Location,Type,Allowed Classes,Participants\n";
    
    competitions.forEach(comp => {
      const participants = participantsMap[comp.id] || [];
      csvContent += `${comp.week},${comp.day},"${comp.name}","${formatDate(comp.date)}","${comp.location || 'TBD'}","${comp.type || 'Regular'}","${comp.allowedClasses?.join(', ') || 'All'}",${participants.length}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `schedule_${currentSeason?.activeSeasonId || 'season'}.csv`);
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
          className="bg-primary dark:bg-primary-dark text-white px-6 py-2 rounded-theme font-medium transition-colors hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const totalWeeks = getTotalWeeks();
  const weekCompetitions = filteredCompetitions(getCompetitionsForWeek(selectedWeek));

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Competition Schedule
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
          {currentSeason?.seasonName || 'Season 2025'} • {totalWeeks} Weeks • {competitions.length} Shows
        </p>
      </div>

      {/* Filter and Export */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark rounded-theme px-4 py-2"
            >
              <option value="all">All Shows</option>
              {currentUser && <option value="myCorps">My Corps Only</option>}
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <button
            onClick={exportSchedule}
            className="flex items-center gap-2 bg-secondary dark:bg-secondary-dark text-white px-4 py-2 rounded-theme font-medium hover:opacity-90"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateWeek('prev')}
            disabled={selectedWeek === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              selectedWeek === 1
                ? 'opacity-50 cursor-not-allowed bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                : 'bg-primary dark:bg-primary-dark text-white hover:opacity-90'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Week {selectedWeek}
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {weekCompetitions.length} {weekCompetitions.length === 1 ? 'Show' : 'Shows'}
            </p>
          </div>

          <button
            onClick={() => navigateWeek('next')}
            disabled={selectedWeek === totalWeeks}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
              selectedWeek === totalWeeks
                ? 'opacity-50 cursor-not-allowed bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                : 'bg-primary dark:bg-primary-dark text-white hover:opacity-90'
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Competitions List */}
        <div className="space-y-4">
          {weekCompetitions.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <p className="text-text-secondary dark:text-text-secondary-dark">
                {filter === 'myCorps' 
                  ? 'Your corps are not participating in any shows this week'
                  : 'No competitions scheduled for this week'}
              </p>
            </div>
          ) : (
            weekCompetitions.map((comp) => {
              const ShowIcon = getShowIcon(comp.name);
              const participants = participantsMap[comp.id] || [];
              const isCompleted = comp.date && new Date(comp.date.toDate ? comp.date.toDate() : comp.date) < new Date();
              const userIsRegistered = currentUser && participants.some(p => userCorps.includes(p.corpsId));
              
              return (
                <div
                  key={comp.id}
                  onClick={() => openShowDetails(comp)}
                  className={`bg-background dark:bg-background-dark rounded-theme p-4 sm:p-6 border-2 transition-all cursor-pointer ${
                    userIsRegistered 
                      ? 'border-primary dark:border-primary-dark' 
                      : 'border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-2 sm:p-3 rounded-theme flex-shrink-0">
                        <ShowIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary dark:text-primary-dark" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            {comp.name}
                          </h3>
                          {isCompleted && (
                            <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          )}
                          {userIsRegistered && (
                            <span className="flex items-center gap-1 text-xs bg-primary/20 dark:bg-primary-dark/20 text-primary dark:text-primary-dark px-2 py-1 rounded-full font-semibold">
                              <CheckCircle className="w-3 h-3" />
                              Registered
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1 sm:space-y-2 mb-3">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-text-secondary dark:text-text-secondary-dark">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Day {comp.day}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span className="truncate">{comp.location || 'TBD'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {comp.type && (
                            <span className="px-2 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-xs rounded-theme font-semibold uppercase">
                              {comp.type}
                            </span>
                          )}
                          
                          {comp.allowedClasses && comp.allowedClasses.length < 4 && (
                            <span className="px-2 py-1 bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark text-xs rounded-theme">
                              {comp.allowedClasses.join(', ')}
                            </span>
                          )}
                          
                          {participants.length > 0 && (
                            <span className="px-2 py-1 bg-secondary/10 dark:bg-secondary-dark/10 text-secondary dark:text-secondary-dark text-xs rounded-theme font-semibold flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {participants.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Show Details Modal */}
      {showModal && selectedShow && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20 p-3 rounded-theme">
                  {React.createElement(getShowIcon(selectedShow.name), {
                    className: "w-10 h-10 text-primary dark:text-primary-dark"
                  })}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                    {selectedShow.name}
                  </h2>
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    Day {selectedShow.day} • {formatDate(selectedShow.date)}
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
                    <Trophy className="w-5 h-5 text-primary dark:text-primary-dark" />
                    <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Type</h3>
                  </div>
                  <p className="text-text-secondary dark:text-text-secondary-dark capitalize">
                    {selectedShow.type || 'Regular Competition'}
                  </p>
                </div>
              </div>

              {selectedShow.allowedClasses && (
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                  <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Eligible Classes</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedShow.allowedClasses.map(cls => (
                      <span key={cls} className="px-3 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark rounded-theme font-semibold">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Participating Corps ({participantsMap[selectedShow.id]?.length || 0})
                </h3>
                
                {participantsMap[selectedShow.id] && participantsMap[selectedShow.id].length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
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
                      No corps registered yet
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="bg-primary dark:bg-primary-dark text-white px-6 py-2 rounded-theme font-medium hover:opacity-90"
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