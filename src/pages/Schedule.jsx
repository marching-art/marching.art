// =============================================================================
// SCHEDULE - NFL-STYLE GROUPED LIST
// =============================================================================
// Rigorous schedule list grouped by week. No ticket stubs.
// Laws: Dense rows, week headers, no glow

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, MapPin, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '../App';
import { db, functions } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useSeasonStore } from '../store/seasonStore';
import { ShowRegistrationModal } from '../components/Schedule';
import toast from 'react-hot-toast';

// =============================================================================
// MAIN SCHEDULE COMPONENT
// =============================================================================

const Schedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);
  const [classFilter, setClassFilter] = useState('all');

  // Season store
  const seasonData = useSeasonStore((state) => state.seasonData);
  const currentWeek = useSeasonStore((state) => state.currentWeek);
  const seasonLoading = useSeasonStore((state) => state.loading);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);

  // Load user profile
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (!seasonLoading && (userProfile !== null || !user)) {
      setLoading(false);
    }
  }, [seasonLoading, userProfile, user]);

  const loadUserProfile = async () => {
    try {
      const profileRef = doc(db, `artifacts/marching-art/users/${user.uid}/profile/data`);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setUserProfile(profileSnap.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Get actual date from day number
  const getActualDate = (dayNumber) => {
    if (!seasonData?.schedule?.startDate) return null;
    const startDate = seasonData.schedule.startDate.toDate();
    const actualDate = new Date(startDate);
    actualDate.setDate(startDate.getDate() + dayNumber);
    return actualDate;
  };

  // Format date
  const formatDate = (dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Get week date range
  const getWeekDateRange = (weekNumber) => {
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = weekNumber * 7;
    const startDate = getActualDate(startDay);
    const endDate = getActualDate(endDay);
    if (!startDate || !endDate) return '';
    const opts = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', opts)}`;
  };

  // Get all shows grouped by week
  const showsByWeek = useMemo(() => {
    if (!seasonData?.events) return {};

    const grouped = {};
    seasonData.events.forEach(dayEvent => {
      const day = dayEvent.offSeasonDay || dayEvent.day || 0;
      const week = Math.ceil(day / 7);
      if (dayEvent.shows) {
        dayEvent.shows.forEach(show => {
          if (!grouped[week]) grouped[week] = [];
          grouped[week].push({
            ...show,
            day,
            week,
          });
        });
      }
    });

    // Sort shows within each week by day
    Object.keys(grouped).forEach(week => {
      grouped[week].sort((a, b) => a.day - b.day);
    });

    return grouped;
  }, [seasonData]);

  // Check if user's corps is registered for a show
  const isRegistered = (show) => {
    if (!userProfile?.corps) return false;
    return Object.values(userProfile.corps).some(corps => {
      const weekKey = `week${show.week}`;
      const selectedShows = corps.selectedShows?.[weekKey] || [];
      return selectedShows.some(s => s.eventName === show.eventName && s.date === show.date);
    });
  };

  // Handle show click
  const handleShowClick = (show) => {
    setSelectedShow(show);
    setRegistrationModal(true);
  };

  // Check if show is in the past
  const isPast = (show) => {
    const date = getActualDate(show.day);
    return date && date < new Date();
  };

  // Loading
  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading schedule...</div>;
  }

  // No season
  if (!seasonData) {
    return (
      <div className="p-8 text-center">
        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500">No active season</p>
      </div>
    );
  }

  const weeks = Object.keys(showsByWeek).map(Number).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#0057B8]" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase">
                {formatSeasonName?.() || '2025'} Season Schedule
              </h1>
              <p className="text-[10px] text-gray-500">Week {currentWeek} of 7</p>
            </div>
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="appearance-none bg-[#222] border border-[#444] text-white text-xs px-3 py-1.5 pr-8 focus:outline-none focus:border-[#0057B8]"
            >
              <option value="all">All Classes</option>
              <option value="worldClass">World Class</option>
              <option value="openClass">Open Class</option>
              <option value="aClass">A Class</option>
              <option value="soundSport">SoundSport</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* SCHEDULE LIST */}
      <div className="max-w-[1400px] mx-auto">
        {weeks.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500">No shows scheduled</p>
          </div>
        ) : (
          weeks.map((week) => {
            const shows = showsByWeek[week] || [];
            const isCurrentWeek = week === currentWeek;

            return (
              <div key={week}>
                {/* WEEK HEADER */}
                <div className={`h-8 flex items-center px-3 border-y border-[#333] ${
                  isCurrentWeek ? 'bg-[#0057B8]/20' : 'bg-[#222]'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Week {week}
                  </span>
                  <span className="text-[10px] text-gray-500 ml-2">
                    {getWeekDateRange(week)}
                  </span>
                  {isCurrentWeek && (
                    <span className="ml-2 px-1.5 py-0.5 bg-[#0057B8] text-white text-[9px] font-bold uppercase">
                      Current
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-500">
                    {shows.length} {shows.length === 1 ? 'show' : 'shows'}
                  </span>
                </div>

                {/* SHOW ROWS */}
                {shows.map((show, idx) => {
                  const registered = isRegistered(show);
                  const past = isPast(show);

                  return (
                    <div
                      key={`${show.eventName}-${show.day}-${idx}`}
                      className={`flex h-12 border-b border-[#333] items-center px-3 ${
                        past ? 'opacity-50' : 'hover:bg-white/5 cursor-pointer'
                      } ${registered ? 'bg-green-500/5' : ''}`}
                      onClick={() => !past && handleShowClick(show)}
                    >
                      {/* Date */}
                      <div className="w-24 text-xs text-gray-400 flex-shrink-0">
                        {formatDate(show.day)}
                      </div>

                      {/* Show Name */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">
                          {show.eventName}
                        </span>
                        {registered && (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Location */}
                      <div className="w-32 text-xs text-gray-500 truncate hidden md:block">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {show.location || '-'}
                      </div>

                      {/* Action */}
                      <div className="w-24 flex-shrink-0 text-right">
                        {past ? (
                          <span className="text-xs text-gray-500">Completed</span>
                        ) : registered ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowClick(show);
                            }}
                            className="h-7 px-3 text-xs font-bold text-green-400 border border-green-500/30 hover:bg-green-500/10"
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowClick(show);
                            }}
                            className="h-7 px-3 text-xs font-bold text-[#0057B8] border border-[#0057B8]/30 hover:bg-[#0057B8]/10"
                          >
                            Register
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* REGISTRATION MODAL */}
      {registrationModal && selectedShow && (
        <ShowRegistrationModal
          show={selectedShow}
          userProfile={userProfile}
          formattedDate={formatDate(selectedShow.day)}
          onClose={() => setRegistrationModal(false)}
          onSuccess={() => {
            loadUserProfile();
            setRegistrationModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Schedule;
