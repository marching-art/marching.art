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
        setLoading(false);
        return;
      }

      const seasonData = seasonDoc.data();
      
      // Check if activeSeasonId exists
      if (!seasonData.activeSeasonId) {
        setError('Season ID not configured');
        setLoading(false);
        return;
      }
      
      setCurrentSeason(seasonData);

      // Get schedule
      const scheduleDoc = await getDoc(doc(db, 'schedules', seasonData.activeSeasonId));
      
      if (!scheduleDoc.exists()) {
        setError('Schedule not found for current season');
        setLoading(false);
        return;
      }

      setScheduleData(scheduleDoc.data() || {});
      
      // Fetch all participants for the season
      await fetchParticipants(seasonData.activeSeasonId);
      
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (seasonId) => {
    try {
      // Only proceed if we have a valid seasonId
      if (!seasonId) {
        console.warn('No season ID provided for fetching participants');
        return;
      }

      // Query for participants in this season
      const participantsQuery = query(
        collection(db, 'participants'),
        where('seasonId', '==', seasonId)
      );
      
      const participantsSnapshot = await getDocs(participantsQuery);
      const participants = {};
      
      participantsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
          participants[data.userId] = {
            id: doc.id,
            ...data
          };
        }
      });
      
      setParticipantsMap(participants);
      
    } catch (err) {
      console.error('Error fetching participants:', err);
      // Don't set error here, just log it - participants are optional data
    }
  };

  const getShowDetails = (showId) => {
    if (!scheduleData.shows) return null;
    return scheduleData.shows[showId];
  };

  const renderWeekSchedule = () => {
    const weekKey = `week${selectedWeek}`;
    const weekData = scheduleData[weekKey];
    
    if (!weekData || !weekData.shows) {
      return (
        <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No shows scheduled for Week {selectedWeek}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weekData.shows.map((showId, index) => {
          const show = getShowDetails(showId);
          if (!show) return null;
          
          return (
            <div
              key={`${showId}-${index}`}
              className="bg-surface dark:bg-surface-dark rounded-theme p-4 cursor-pointer hover:shadow-md transition-shadow border border-accent dark:border-accent-dark"
              onClick={() => {
                setSelectedShow(show);
                setShowModal(true);
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">
                  {show.name}
                </h3>
                {show.isChampionship && (
                  <Trophy className="w-5 h-5 text-primary dark:text-primary-dark" />
                )}
              </div>
              
              <div className="space-y-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(show.date).toLocaleDateString()}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{show.location}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{show.participants?.length || 0} Corps</span>
                </div>
              </div>
              
              {show.status === 'completed' && (
                <div className="mt-3 pt-3 border-t border-accent dark:border-accent-dark">
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Results Available</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading schedule..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Info className="w-16 h-16 text-text-secondary dark:text-text-secondary-dark mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Schedule Unavailable
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
            {error}
          </p>
          <button
            onClick={fetchSchedule}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Season Schedule
          </h1>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            {currentSeason?.name || 'Current Season'} • {currentSeason?.year}
          </p>
        </div>

        {/* Week Selector */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...Array(12)].map((_, i) => {
              const weekNum = i + 1;
              const hasShows = scheduleData[`week${weekNum}`]?.shows?.length > 0;
              
              return (
                <button
                  key={weekNum}
                  onClick={() => setSelectedWeek(weekNum)}
                  disabled={!hasShows}
                  className={`px-4 py-2 rounded-theme whitespace-nowrap transition-all ${
                    selectedWeek === weekNum
                      ? 'bg-primary dark:bg-primary-dark text-white'
                      : hasShows
                        ? 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark'
                        : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
                  }`}
                >
                  Week {weekNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Week Schedule Display */}
        {renderWeekSchedule()}

        {/* Show Details Modal */}
        {showModal && selectedShow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface dark:bg-surface-dark rounded-theme max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                      {selectedShow.name}
                    </h2>
                    {selectedShow.isChampionship && (
                      <div className="flex items-center gap-2 mt-2 text-primary dark:text-primary-dark">
                        <Trophy className="w-5 h-5" />
                        <span className="font-medium">Championship Event</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Event Details
                    </h3>
                    <div className="space-y-2 text-text-secondary dark:text-text-secondary-dark">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(selectedShow.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{selectedShow.time || 'Time TBA'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedShow.location}</span>
                      </div>
                    </div>
                  </div>

                  {selectedShow.participants && selectedShow.participants.length > 0 && (
                    <div>
                      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-2">
                        Participating Corps ({selectedShow.participants.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedShow.participants.map((corpId, index) => (
                          <div
                            key={`${corpId}-${index}`}
                            className="bg-background dark:bg-background-dark px-3 py-2 rounded text-sm text-text-secondary dark:text-text-secondary-dark"
                          >
                            {participantsMap[corpId]?.name || corpId}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedShow.status === 'completed' && (
                    <div className="pt-4 border-t border-accent dark:border-accent-dark">
                      <button className="btn btn-primary w-full">
                        View Results
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;