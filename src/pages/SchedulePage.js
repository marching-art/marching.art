import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Calendar, MapPin, Users, Trophy, Info, CheckCircle, Clock } from 'lucide-react';
import LoadingScreen from '../components/common/LoadingScreen';

const SchedulePage = () => {
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [participantsMap, setParticipantsMap] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current season
      const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
      
      if (!seasonDoc.exists()) {
        setError('No active season found');
        return;
      }

      const seasonData = seasonDoc.data();
      setCurrentSeason(seasonData);

      // Get schedule
      const scheduleDoc = await getDoc(doc(db, 'schedules', seasonData.activeSeasonId));
      
      if (!scheduleDoc.exists()) {
        setError('Schedule not found');
        return;
      }

      const schedule = scheduleDoc.data();
      const competitions = schedule.competitions || [];

      // Organize by week and day
      const scheduleByWeek = {};
      
      competitions.forEach(comp => {
        const week = comp.week || Math.ceil(comp.day / 7);
        const day = comp.day;
        
        if (!scheduleByWeek[week]) {
          scheduleByWeek[week] = [];
        }

        // Group by day within week
        let dayGroup = scheduleByWeek[week].find(d => d.day === day);
        
        if (!dayGroup) {
          dayGroup = {
            day: day,
            date: comp.date,
            shows: []
          };
          scheduleByWeek[week].push(dayGroup);
        }

        dayGroup.shows.push(comp);
      });

      // Sort days within each week
      Object.keys(scheduleByWeek).forEach(week => {
        scheduleByWeek[week].sort((a, b) => a.day - b.day);
      });

      setScheduleData(scheduleByWeek);

      // Fetch participants for all shows
      await fetchAllParticipants(competitions);

    } catch (error) {
      console.error('Error fetching schedule:', error);
      setError('Failed to load schedule');
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllParticipants = async (competitions) => {
    try {
      // Get all users with active season ID
      const usersSnapshot = await getDocs(
        query(
          collection(db, 'artifacts/marching-art/users'),
          where('profile.data.activeSeasonId', '==', currentSeason?.activeSeasonId)
        )
      );

      const participantsData = {};

      // For each show, find registered users
      competitions.forEach(show => {
        participantsData[show.id] = [];
      });

      usersSnapshot.forEach(userDoc => {
        const profileData = userDoc.data()?.profile?.data;
        if (!profileData) return;

        const registrations = profileData.competitionRegistrations || {};
        const corpsName = profileData.corps?.corpsName || 'Unknown Corps';
        const corpsClass = profileData.corps?.corpsClass || 'SoundSport';

        Object.keys(registrations).forEach(showId => {
          if (participantsData[showId]) {
            participantsData[showId].push({
              userId: userDoc.id,
              corpsName,
              corpsClass,
              displayName: profileData.displayName
            });
          }
        });
      });

      setParticipantsMap(participantsData);

    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const openShowModal = async (show) => {
    setSelectedShow({
      ...show,
      participants: participantsMap[show.id] || []
    });
    setShowModal(true);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'TBD';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'TBD';
      
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

  const formatShortDate = (timestamp) => {
    if (!timestamp) return 'TBD';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'TBD';
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'TBD';
    }
  };

  const getShowStatusBadge = (show) => {
    if (!show.date) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
          <Calendar className="w-3 h-3 mr-1" />
          Scheduled
        </span>
      );
    }

    const currentDate = new Date();
    const showDate = show.date.toDate ? show.date.toDate() : new Date(show.date);
    
    if (isNaN(showDate.getTime())) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
          <Calendar className="w-3 h-3 mr-1" />
          Scheduled
        </span>
      );
    }
    
    if (showDate < currentDate) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-300">
          <Trophy className="w-3 h-3 mr-1" />
          Results Available
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-300">
          <Clock className="w-3 h-3 mr-1" />
          Upcoming
        </span>
      );
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading schedule..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">Error Loading Schedule</h3>
        <p className="text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={fetchSchedule}
          className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const weeks = Object.keys(scheduleData).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary-dark mb-2">Competition Schedule</h1>
        <p className="text-text-secondary-dark text-lg">
          {currentSeason?.seasonName || 'Season 2025'} • {currentSeason?.seasonType === 'live' ? 'Live Season' : 'Off-Season'}
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-400 rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-primary-dark">
            <p>View all scheduled competitions and register for shows in your Dashboard. Click on any show to see participating corps and details.</p>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="flex flex-wrap gap-2">
        {weeks.map(week => (
          <button
            key={week}
            onClick={() => setSelectedWeek(parseInt(week))}
            className={`px-6 py-2 rounded-theme font-medium transition-colors ${
              selectedWeek === parseInt(week)
                ? 'bg-primary text-on-primary'
                : 'bg-surface-dark text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
            }`}
          >
            Week {week}
          </button>
        ))}
      </div>

      {/* Schedule Content */}
      <div className="space-y-6">
        {scheduleData[selectedWeek] && scheduleData[selectedWeek].length > 0 ? (
          scheduleData[selectedWeek].map(dayGroup => (
            <div key={dayGroup.day} className="bg-surface-dark rounded-theme p-6 shadow-theme-dark border border-accent-dark">
              {/* Day Header */}
              <div className="mb-4 pb-4 border-b border-accent-dark">
                <h3 className="text-xl font-bold text-text-primary-dark">
                  Day {dayGroup.day}
                </h3>
                <p className="text-text-secondary-dark">
                  {formatDate(dayGroup.date)}
                </p>
              </div>

              {/* Shows for this day */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dayGroup.shows.map(show => {
                  const participants = participantsMap[show.id] || [];
                  
                  return (
                    <div
                      key={show.id}
                      className="bg-background-dark rounded-theme p-4 border border-accent-dark hover:border-primary-dark transition-colors cursor-pointer"
                      onClick={() => openShowModal(show)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-text-primary-dark mb-1 truncate">
                            {show.name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-text-secondary-dark">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{show.location || 'Location TBD'}</span>
                          </div>
                        </div>
                        {getShowStatusBadge(show)}
                      </div>

                      {/* Show info */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-text-secondary-dark">
                          <Users className="w-4 h-4" />
                          <span>{participants.length} Corps Registered</span>
                        </div>
                        {show.isChampionship && (
                          <span className="text-yellow-400 font-medium">★ Championship</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
            <h3 className="text-xl font-medium text-text-primary-dark mb-2">
              No shows scheduled for Week {selectedWeek}
            </h3>
            <p className="text-text-secondary-dark">
              Check back later or select a different week.
            </p>
          </div>
        )}
      </div>

      {/* Show Details Modal */}
      {showModal && selectedShow && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark rounded-theme p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary-dark mb-2">
                  {selectedShow.name}
                </h2>
                {selectedShow.isChampionship && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-900 bg-opacity-30 text-yellow-400 border border-yellow-600">
                    <Trophy className="w-4 h-4 mr-1" />
                    Championship Event
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-secondary-dark hover:text-text-primary-dark text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Event Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-accent-dark">
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-2">Date & Time</h4>
                  <p className="text-text-secondary-dark">{formatDate(selectedShow.date)}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-2">Location</h4>
                  <p className="text-text-secondary-dark">{selectedShow.location || 'Location TBD'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-2">Day</h4>
                  <p className="text-text-secondary-dark">Day {selectedShow.day} • Week {selectedShow.week}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-2">Eligible Classes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedShow.allowedClasses && selectedShow.allowedClasses.length > 0 ? (
                      selectedShow.allowedClasses.map(cls => (
                        <span key={cls} className="px-2 py-1 bg-accent-dark text-text-primary-dark rounded text-sm">
                          {cls}
                        </span>
                      ))
                    ) : (
                      <span className="text-text-secondary-dark text-sm">All Classes</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Participating Corps */}
              {selectedShow.participants && selectedShow.participants.length > 0 ? (
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-3">
                    Participating Corps ({selectedShow.participants.length})
                  </h4>
                  
                  {/* Organize by class */}
                  {['World Class', 'Open Class', 'A Class', 'SoundSport'].map(className => {
                    const corpsInClass = selectedShow.participants.filter(p => p.corpsClass === className);
                    
                    if (corpsInClass.length === 0) return null;
                    
                    return (
                      <div key={className} className="mb-4">
                        <h5 className="text-sm font-semibold text-primary-dark mb-2">{className}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {corpsInClass.map((corps, index) => (
                            <div 
                              key={index} 
                              className="flex justify-between items-center p-3 bg-background-dark rounded border border-accent-dark"
                            >
                              <span className="font-medium text-text-primary-dark truncate">
                                {corps.corpsName}
                              </span>
                              <span className="text-xs text-text-secondary-dark ml-2">
                                {corps.displayName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-text-secondary-dark mb-3" />
                  <p className="text-text-secondary-dark">No corps registered yet</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-accent-dark flex gap-3">
                {selectedShow.date && new Date(selectedShow.date.toDate ? selectedShow.date.toDate() : selectedShow.date) < new Date() ? (
                  <button
                    onClick={() => {
                      setShowModal(false);
                      window.location.href = `/scores?day=${selectedShow.day}`;
                    }}
                    className="flex-1 bg-primary hover:bg-primary-dark text-on-primary py-3 px-4 rounded-theme font-medium transition-colors"
                  >
                    <Trophy className="w-4 h-4 inline mr-2" />
                    View Results
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowModal(false);
                      window.location.href = '/dashboard?tab=shows';
                    }}
                    className="flex-1 bg-primary hover:bg-primary-dark text-on-primary py-3 px-4 rounded-theme font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Register for This Show
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

export default SchedulePage;