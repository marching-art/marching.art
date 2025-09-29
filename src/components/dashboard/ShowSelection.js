import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  CheckCircle, 
  XCircle,
  Clock,
  Info,
  TrendingUp,
  Award,
  Filter
} from 'lucide-react';

const ShowSelection = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [registrations, setRegistrations] = useState({});
  const [weekFilter, setWeekFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [showDetail, setShowDetail] = useState(null);
  const [selectedWeekShows, setSelectedWeekShows] = useState([]);

  const corpsClass = userProfile?.corps?.corpsClass || 'SoundSport';
  const MAX_REGISTRATIONS_PER_WEEK = 4;

  useEffect(() => {
    if (currentUser) {
      fetchSeasonSchedule();
      fetchUserRegistrations();
    }
  }, [currentUser]);

  const fetchSeasonSchedule = async () => {
    try {
      setLoading(true);

      // Get current season info
      const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
      
      if (!seasonDoc.exists()) {
        toast.error('No active season found');
        return;
      }

      const seasonData = seasonDoc.data();
      setCurrentSeason(seasonData);

      // Get schedule for current season
      const scheduleDoc = await getDoc(doc(db, 'schedules', seasonData.activeSeasonId));
      
      if (!scheduleDoc.exists()) {
        toast.error('Season schedule not found');
        return;
      }

      const scheduleData = scheduleDoc.data();
      const competitions = scheduleData.competitions || [];

      // Filter out mandatory championships (auto-enrolled)
      const selectableCompetitions = competitions.filter(comp => {
        // Days 47-49 (off-season) or 68-70 (live) are auto-enrolled championships
        const isChampionship = comp.day >= 47 && comp.day <= 49;
        return !isChampionship;
      });

      // Organize by week
      const byWeek = {};
      selectableCompetitions.forEach(comp => {
        const week = comp.week || Math.ceil(comp.day / 7);
        if (!byWeek[week]) {
          byWeek[week] = [];
        }
        byWeek[week].push(comp);
      });

      setSchedule(byWeek);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRegistrations = async () => {
    try {
      const profileDoc = await getDoc(
        doc(db, `artifacts/marching-art/users/${currentUser.uid}/profile/data`)
      );

      if (profileDoc.exists()) {
        const data = profileDoc.data();
        setRegistrations(data.competitionRegistrations || {});
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
    }
  };

  const getWeekRegistrationCount = (week) => {
    if (!schedule[week]) return 0;
    
    return schedule[week].filter(show => registrations[show.id]).length;
  };

  const canRegisterForWeek = (week) => {
    // Final week has no limit
    const maxWeeks = currentSeason?.seasonType === 'live' ? 10 : 7;
    if (week >= maxWeeks) return true;
    
    return getWeekRegistrationCount(week) < MAX_REGISTRATIONS_PER_WEEK;
  };

  const isEligibleForShow = (show) => {
    // Check if user's class is allowed
    if (!show.allowedClasses || !show.allowedClasses.includes(corpsClass)) {
      return {
        eligible: false,
        reason: `${corpsClass} corps cannot participate in this competition`
      };
    }

    // Check if show hasn't already occurred
    if (show.date) {
      const showDate = show.date.toDate ? show.date.toDate() : new Date(show.date);
      const now = new Date();
      
      if (showDate < now) {
        return {
          eligible: false,
          reason: 'This competition has already occurred'
        };
      }
    }

    // Check week limit (unless final week)
    const week = show.week || Math.ceil(show.day / 7);
    const maxWeeks = currentSeason?.seasonType === 'live' ? 10 : 7;
    
    if (week < maxWeeks && !canRegisterForWeek(week) && !registrations[show.id]) {
      return {
        eligible: false,
        reason: `Maximum ${MAX_REGISTRATIONS_PER_WEEK} registrations per week reached`
      };
    }

    return { eligible: true };
  };

  const toggleRegistration = async (show) => {
    const isCurrentlyRegistered = registrations[show.id];
    const eligibility = isEligibleForShow(show);

    if (!isCurrentlyRegistered && !eligibility.eligible) {
      toast.error(eligibility.reason);
      return;
    }

    try {
      const profileRef = doc(db, `artifacts/marching-art/users/${currentUser.uid}/profile/data`);
      
      const newRegistrations = { ...registrations };
      
      if (isCurrentlyRegistered) {
        delete newRegistrations[show.id];
        toast.success(`Withdrawn from ${show.name}`);
      } else {
        newRegistrations[show.id] = {
          showId: show.id,
          showName: show.name,
          date: show.date,
          week: show.week,
          day: show.day,
          registeredAt: new Date().toISOString()
        };
        toast.success(`Registered for ${show.name}`);
      }

      await updateDoc(profileRef, {
        competitionRegistrations: newRegistrations
      });

      setRegistrations(newRegistrations);
    } catch (error) {
      console.error('Error updating registration:', error);
      toast.error('Failed to update registration');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'TBD';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'TBD';
    }
  };

  const getFilteredWeeks = () => {
    const weeks = Object.keys(schedule).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (weekFilter === 'all') return weeks;
    return [weekFilter];
  };

  const getFilteredShows = (weekShows) => {
    if (classFilter === 'all') return weekShows;
    
    return weekShows.filter(show => 
      show.allowedClasses && show.allowedClasses.includes(classFilter)
    );
  };

  const getShowStatusIcon = (show) => {
    const eligibility = isEligibleForShow(show);
    const isRegistered = registrations[show.id];

    if (isRegistered) {
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    } else if (!eligibility.eligible) {
      return <XCircle className="w-5 h-5 text-red-400" />;
    } else {
      return <Clock className="w-5 h-5 text-blue-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  const filteredWeeks = getFilteredWeeks();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary-dark mb-2">Competition Registration</h2>
        <p className="text-text-secondary-dark">
          Select up to {MAX_REGISTRATIONS_PER_WEEK} shows per week. Championship shows are automatic.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-400 rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-primary-dark">
            <p className="font-semibold mb-1">Registration Rules:</p>
            <ul className="space-y-1 text-text-secondary-dark">
              <li>• Register for up to 4 shows per week (weeks 1-6)</li>
              <li>• Final week (week 7): unlimited registrations</li>
              <li>• Championship shows (days 47-49): automatic enrollment</li>
              <li>• Your corps class: <span className="font-semibold text-primary-dark">{corpsClass}</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary-dark mb-2">
            <Filter className="w-4 h-4 inline mr-1" />
            Filter by Week
          </label>
          <select
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="bg-surface-dark text-text-primary-dark border border-accent-dark rounded-theme px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-dark"
          >
            <option value="all">All Weeks</option>
            {Object.keys(schedule).sort((a, b) => parseInt(a) - parseInt(b)).map(week => (
              <option key={week} value={week}>Week {week}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary-dark mb-2">
            <Users className="w-4 h-4 inline mr-1" />
            Filter by Class
          </label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-surface-dark text-text-primary-dark border border-accent-dark rounded-theme px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-dark"
          >
            <option value="all">All Classes</option>
            <option value="World Class">World Class</option>
            <option value="Open Class">Open Class</option>
            <option value="A Class">A Class</option>
            <option value="SoundSport">SoundSport</option>
          </select>
        </div>
      </div>

      {/* Schedule by Week */}
      <div className="space-y-6">
        {filteredWeeks.map(week => {
          const weekShows = getFilteredShows(schedule[week]);
          const weekCount = getWeekRegistrationCount(week);
          const canRegister = canRegisterForWeek(week);

          if (weekShows.length === 0) return null;

          return (
            <div key={week} className="bg-surface-dark rounded-theme p-6 border border-accent-dark">
              {/* Week Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-accent-dark">
                <div>
                  <h3 className="text-xl font-bold text-text-primary-dark">Week {week}</h3>
                  <p className="text-sm text-text-secondary-dark">
                    {weekShows.length} competitions available
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-text-primary-dark">
                    {weekCount} / {week >= 7 ? '∞' : MAX_REGISTRATIONS_PER_WEEK}
                  </div>
                  <div className="text-xs text-text-secondary-dark">
                    Registrations
                  </div>
                  {!canRegister && week < 7 && (
                    <div className="text-xs text-red-400 mt-1">
                      Week limit reached
                    </div>
                  )}
                </div>
              </div>

              {/* Shows Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekShows.map(show => {
                  const isRegistered = registrations[show.id];
                  const eligibility = isEligibleForShow(show);
                  const isChampionship = show.isChampionship || show.isMandatory;

                  return (
                    <div
                      key={show.id}
                      className={`p-4 rounded-theme border-2 transition-all ${
                        isRegistered
                          ? 'border-green-500 bg-green-900 bg-opacity-20'
                          : !eligibility.eligible
                          ? 'border-red-400 bg-red-900 bg-opacity-10 opacity-60'
                          : 'border-accent-dark hover:border-primary-dark'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-text-primary-dark mb-1 truncate">
                            {show.name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-text-secondary-dark">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(show.date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-text-secondary-dark">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{show.location}</span>
                          </div>
                        </div>
                        {getShowStatusIcon(show)}
                      </div>

                      {/* Show badges */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {isChampionship && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 bg-opacity-30 text-yellow-400 border border-yellow-600">
                            <Trophy className="w-3 h-3 mr-1" />
                            Championship
                          </span>
                        )}
                        {show.isRegional && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900 bg-opacity-30 text-blue-400 border border-blue-600">
                            <Award className="w-3 h-3 mr-1" />
                            Regional
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
                          Day {show.day}
                        </span>
                      </div>

                      {/* Allowed classes */}
                      <div className="text-xs text-text-secondary-dark mb-3">
                        {show.allowedClasses && show.allowedClasses.length > 0 ? (
                          <span>Classes: {show.allowedClasses.join(', ')}</span>
                        ) : (
                          <span>All Classes</span>
                        )}
                      </div>

                      {/* Registration button or status */}
                      {isChampionship ? (
                        <div className="text-center text-sm text-yellow-400 font-medium">
                          Auto-enrolled
                        </div>
                      ) : !eligibility.eligible ? (
                        <div className="text-center text-sm text-red-400">
                          {eligibility.reason}
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleRegistration(show)}
                          className={`w-full py-2 px-4 rounded-theme font-medium transition-colors ${
                            isRegistered
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-primary hover:bg-primary-dark text-on-primary'
                          }`}
                        >
                          {isRegistered ? 'Withdraw' : 'Register'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredWeeks.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
          <h3 className="text-xl font-medium text-text-primary-dark mb-2">
            No Shows Available
          </h3>
          <p className="text-text-secondary-dark">
            Check back later or adjust your filters
          </p>
        </div>
      )}
    </div>
  );
};

export default ShowSelection;