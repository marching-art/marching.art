import React, { useState, useEffect } from 'react';
import { db } from 'firebaseConfig';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Calendar, MapPin, Trophy, Users } from 'lucide-react';

const SchedulePage = () => {
  const [scheduleData, setScheduleData] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);
  const [error, setError] = useState('');

  const currentSeason = '2025';
  const totalWeeks = 10; // Live season weeks

  useEffect(() => {
    fetchScheduleData();
  }, [currentSeason]);

  const fetchScheduleData = async () => {
    try {
      setError('');
      const scheduleRef = collection(db, 'schedules');
      
      // Simple query without potentially non-existent fields
      const snapshot = await getDocs(scheduleRef);
      
      const scheduleByWeek = {};
      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        
        // Safely get week number, default to 1 if not present
        const week = data.week || 1;
        
        // Only include shows for current season if season field exists
        if (!data.season || data.season === currentSeason) {
          if (!scheduleByWeek[week]) {
            scheduleByWeek[week] = [];
          }
          scheduleByWeek[week].push(data);
        }
      });
      
      // Sort shows within each week by date if date exists
      Object.keys(scheduleByWeek).forEach(week => {
        scheduleByWeek[week].sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date();
          const dateB = b.date ? new Date(b.date) : new Date();
          return dateA - dateB;
        });
      });
      
      setScheduleData(scheduleByWeek);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setError('Failed to load schedule data. Please try again.');
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const openShowModal = (show) => {
    setSelectedShow(show);
    setShowModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'TBD';
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'TBD';
    }
  };

  const getShowStatusBadge = (show) => {
    if (!show.date) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
          <Calendar className="w-3 h-3 mr-1" />
          Scheduled
        </span>
      );
    }

    const currentDate = new Date();
    const showDate = new Date(show.date);
    
    if (isNaN(showDate.getTime())) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
          <Calendar className="w-3 h-3 mr-1" />
          Scheduled
        </span>
      );
    }
    
    if (showDate < currentDate) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <Trophy className="w-3 h-3 mr-1" />
          Results Available
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Calendar className="w-3 h-3 mr-1" />
          Upcoming
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">Error Loading Schedule</h3>
        <p className="text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={fetchScheduleData}
          className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary-dark mb-2">Competition Schedule</h1>
        <p className="text-text-secondary-dark text-lg">
          {currentSeason} Season • Week {selectedWeek} of {totalWeeks}
        </p>
      </div>

      {/* Week Navigation */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => (
          <button
            key={week}
            onClick={() => setSelectedWeek(week)}
            className={`px-4 py-2 rounded-theme font-medium transition-colors ${
              selectedWeek === week
                ? 'bg-primary text-on-primary'
                : 'bg-surface-dark text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
            }`}
          >
            Week {week}
          </button>
        ))}
      </div>

      {/* Schedule Content */}
      <div className="grid gap-6">
        {scheduleData[selectedWeek] && scheduleData[selectedWeek].length > 0 ? (
          scheduleData[selectedWeek].map(show => (
            <div
              key={show.id}
              className="bg-surface-dark rounded-theme p-6 shadow-theme-dark border border-accent-dark hover:border-primary-dark transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-text-primary-dark mb-2">
                    {show.showName || 'Competition Show'}
                  </h3>
                  <div className="flex items-center gap-4 text-text-secondary-dark">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(show.date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{show.location || 'Location TBD'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{show.participatingCorps?.length || 0} Corps</span>
                    </div>
                  </div>
                </div>
                {getShowStatusBadge(show)}
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-text-secondary-dark">
                  {show.classes && show.classes.length > 0 && (
                    <p>Classes: {show.classes.join(', ')}</p>
                  )}
                </div>
                <button
                  onClick={() => openShowModal(show)}
                  className="bg-primary hover:bg-primary-dark text-on-primary px-4 py-2 rounded-theme font-medium transition-colors"
                >
                  {show.date && new Date(show.date) < new Date() ? 'View Results' : 'View Details'}
                </button>
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
              <h2 className="text-2xl font-bold text-text-primary-dark">
                {selectedShow.showName || 'Competition Show'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-secondary-dark hover:text-text-primary-dark text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-2">Event Details</h4>
                  <p className="text-text-secondary-dark">{formatDate(selectedShow.date)}</p>
                  <p className="text-text-secondary-dark">{selectedShow.location || 'Location TBD'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-2">Competition Classes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedShow.classes && selectedShow.classes.length > 0 ? (
                      selectedShow.classes.map(cls => (
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

              {selectedShow.participatingCorps && selectedShow.participatingCorps.length > 0 && (
                <div>
                  <h4 className="font-semibold text-text-primary-dark mb-3">
                    Participating Corps ({selectedShow.participatingCorps.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {selectedShow.participatingCorps.map((corps, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-background-dark rounded border border-accent-dark">
                        <span className="font-medium text-text-primary-dark">
                          {typeof corps === 'string' ? corps : corps.name || 'Unknown Corps'}
                        </span>
                        <span className="text-sm text-text-secondary-dark">
                          {typeof corps === 'object' && corps.class ? corps.class : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedShow.date && new Date(selectedShow.date) < new Date() && (
                <div className="pt-4 border-t border-accent-dark">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      // Navigate to scores page for this show
                      window.location.href = `/scores?show=${selectedShow.id}`;
                    }}
                    className="w-full bg-primary hover:bg-primary-dark text-on-primary py-3 px-4 rounded-theme font-medium transition-colors"
                  >
                    View Complete Results
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePage;