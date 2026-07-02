// Step 4 of the season setup wizard: weekly show selection. Extracted from
// SeasonSetupWizard.jsx — owns its modal state and schedule derivations.

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, Check, ChevronRight, MapPin, Trophy } from 'lucide-react';
import { getProfile } from '../../api/profile';
import { ShowRegistrationModal } from '../Schedule';
import { useScheduleStore } from '../../store/scheduleStore';
import { compareCorpsClasses } from '../../utils/corps';
import { isEventPast } from '../../utils/scheduleUtils';

// Class config for badges
const CLASS_CONFIG = {
    openClass: { name: 'Open', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
    aClass: { name: 'A Class', color: 'text-[#0057B8]', bgColor: 'bg-[#0057B8]/10' },
    soundSport: { name: 'SS', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  };

const ShowSelectionStep = ({
  seasonData,
  currentWeek,
  user,
  localUserProfile,
  setLocalUserProfile,
  setStep,
}) => {
  const getWeekShows = useScheduleStore((state) => state.getWeekShows);
  const scheduleLoading = useScheduleStore((state) => state.loading);
  const [showModal, setShowModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  const availableShows = getWeekShows(currentWeek);

  // Helper to get actual date from day number
  const getActualDate = useCallback((dayNumber) => {
    if (!seasonData?.schedule?.startDate) return null;
    const startDate = seasonData.schedule.startDate.toDate();
    const actualDate = new Date(startDate);
    actualDate.setDate(startDate.getDate() + dayNumber);
    return actualDate;
  }, [seasonData]);

  // Format date for display
  const formatDate = useCallback((dayNumber) => {
    const date = getActualDate(dayNumber);
    if (!date) return `Day ${dayNumber}`;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [getActualDate]);

  // Group shows by day
  const showsByDay = useMemo(() => {
    if (!availableShows || availableShows.length === 0) return {};
    const grouped = {};
    availableShows
      .filter(show => show.type !== 'championship')
      .forEach(show => {
        const day = show.day;
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(show);
      });
    return grouped;
  }, [availableShows]);

  const sortedDays = useMemo(() => {
    return Object.keys(showsByDay).map(Number).sort((a, b) => a - b);
  }, [showsByDay]);

  // Check if a corps is registered for a show
  const isCorpsRegisteredForShow = useCallback((show) => {
    if (!localUserProfile?.corps) return false;
    return Object.values(localUserProfile.corps).some(corps => {
      if (!corps) return false;
      const weekKey = `week${show.week}`;
      const selectedShows = corps.selectedShows?.[weekKey] || [];
      return selectedShows.some(s => s.eventName === show.eventName && s.date === show.date);
    });
  }, [localUserProfile]);

  // Get registered corps for a show (sorted by class hierarchy: World → Open → A → SS)
  const getRegisteredCorpsForShow = useCallback((show) => {
    if (!localUserProfile?.corps) return [];
    return Object.entries(localUserProfile.corps)
      .filter(([corpsClass, corpsData]) => {
        if (!corpsData) return false;
        const weekKey = `week${show.week}`;
        const selectedShows = corpsData.selectedShows?.[weekKey] || [];
        return selectedShows.some(s => s.eventName === show.eventName && s.date === show.date);
      })
      .map(([corpsClass]) => corpsClass)
      .sort(compareCorpsClasses);
  }, [localUserProfile]);

  // Count total registrations for the week
  const totalWeekRegistrations = useMemo(() => {
    if (!localUserProfile?.corps) return 0;
    let count = 0;
    Object.values(localUserProfile.corps).forEach(corps => {
      if (!corps) return;
      const weekKey = `week${currentWeek}`;
      const selectedShows = corps.selectedShows?.[weekKey] || [];
      count += selectedShows.length;
    });
    return count;
  }, [localUserProfile, currentWeek]);

  // Handle show click to open modal
  const handleShowClick = useCallback((show) => {
    setSelectedShow(show);
    setShowModal(true);
  }, []);

  // Handle modal success - refresh local profile
  const handleModalSuccess = useCallback(async () => {
    try {
      if (user?.uid) {
        const profileData = await getProfile(user.uid);
        if (profileData) {
          setLocalUserProfile(profileData);
        }
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
    setShowModal(false);
  }, [user?.uid]);

  return (
    <>
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              {/* Header with week info and registration count */}
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0057B8]" />
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {currentWeek === 7 ? 'Championship Week' : `Week ${currentWeek} Schedule`}
                    </h2>
                  </div>
                  {currentWeek !== 7 && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-500">Registrations:</span>
                      <span className="font-bold text-[#0057B8] tabular-nums">{totalWeekRegistrations}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Tap a show to register your corps
                </p>
              </div>

              <div className="p-3">
                {/* Championship Week (Week 7) - Auto-enrollment message */}
                {currentWeek === 7 ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#0057B8]/20 rounded-sm flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-[#0057B8]" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Championship Week - Auto Enrollment
                    </h3>
                    <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
                      All championship events (Days 45-49) have automatic enrollment based on your corps class and advancement results.
                    </p>
                    <div className="bg-[#0a0a0a] border border-[#333] p-4 text-left max-w-md mx-auto">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Championship Schedule
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Day 45</span>
                          <span className="text-white">Open & A Class Prelims</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Day 46</span>
                          <span className="text-white">Open & A Class Finals (Top 8/4)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Day 47</span>
                          <span className="text-white">World Championship Prelims</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Day 48</span>
                          <span className="text-white">World Championship Semifinals (Top 25)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Day 49</span>
                          <span className="text-white">World Championship Finals (Top 12)</span>
                        </div>
                        <div className="flex justify-between border-t border-[#333] pt-2 mt-2">
                          <span className="text-gray-400">Day 49</span>
                          <span className="text-white">SoundSport Festival (All SoundSport)</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      Your corps will automatically compete based on class eligibility and prior day results.
                    </p>
                  </div>
                ) : scheduleLoading ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Loading schedule...</p>
                  </div>
                ) : sortedDays.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No shows available this week</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedDays.map(day => {
                      const date = getActualDate(day);
                      const isPast = isEventPast(date);
                      const dayOfWeek = date ? date.toLocaleDateString('en-US', { weekday: 'short' }) : '';
                      const monthDay = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Day ${day}`;

                      return (
                        <div key={day} className="flex gap-2">
                          {/* Condensed Day Indicator */}
                          <div className={`
                            flex-shrink-0 w-14 flex flex-col items-center justify-center
                            py-2 px-1 rounded-sm border
                            ${isPast
                              ? 'bg-[#1a1a1a] border-[#333] text-gray-500'
                              : 'bg-[#0057B8]/10 border-[#0057B8]/30'
                            }
                          `}>
                            <span className={`text-[9px] font-bold uppercase ${isPast ? 'text-gray-500' : 'text-[#0057B8]'}`}>
                              {dayOfWeek}
                            </span>
                            <span className={`text-xs font-bold ${isPast ? 'text-gray-400' : 'text-white'}`}>
                              {monthDay}
                            </span>
                          </div>

                          {/* Shows for this day */}
                          <div className="flex-1 space-y-2">
                            {showsByDay[day].map((show, idx) => {
                              const isRegistered = isCorpsRegisteredForShow(show);
                              const registeredCorps = getRegisteredCorpsForShow(show);

                              return (
                                <div
                                  key={`${show.eventName}-${idx}`}
                                  onClick={() => !isPast && handleShowClick(show)}
                                  className={`
                                    bg-[#111] border rounded-sm overflow-hidden
                                    ${isPast ? 'opacity-60 border-[#333]' : 'hover:border-[#444] cursor-pointer active:bg-[#1a1a1a] border-[#333]'}
                                    ${isRegistered && !isPast ? 'border-l-2 border-l-green-500' : ''}
                                  `}
                                >
                                  <div className="px-3 py-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-bold text-white truncate leading-tight">
                                          {show.eventName}
                                        </h3>
                                        {show.location && (
                                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
                                            <MapPin className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                            <span className="truncate">{show.location}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Status Badge */}
                                      {isPast ? (
                                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#333] text-gray-400 rounded-sm">
                                          Done
                                        </span>
                                      ) : isRegistered ? (
                                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-green-500/10 text-green-400 rounded-sm flex items-center gap-0.5">
                                          <Check className="w-2.5 h-2.5" />
                                          Going
                                        </span>
                                      ) : (
                                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] rounded-sm">
                                          Register
                                        </span>
                                      )}
                                    </div>

                                    {/* Registered Corps Badges */}
                                    {registeredCorps.length > 0 && (
                                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                                        {registeredCorps.map((corpsClass) => {
                                          const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
                                          return (
                                            <span
                                              key={corpsClass}
                                              className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-bold uppercase rounded ${config.bgColor} ${config.color}`}
                                            >
                                              <Check className="w-2 h-2" />
                                              {config.name}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#333] flex justify-between items-center">
                {currentWeek !== 7 && totalWeekRegistrations === 0 && (
                  <p className="text-[10px] text-gray-500">
                    Register at least one corps to continue
                  </p>
                )}
                <div className="ml-auto">
                  <button
                    onClick={() => setStep(5)}
                    disabled={currentWeek !== 7 && totalWeekRegistrations === 0}
                    className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 hover:bg-[#0066d6]"
                  >
                    {currentWeek === 7 ? 'Continue' : 'Complete Setup'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
      {showModal && selectedShow && (
            <ShowRegistrationModal
              show={selectedShow}
              userProfile={localUserProfile}
              formattedDate={formatDate(selectedShow.day)}
              onClose={() => setShowModal(false)}
              onSuccess={handleModalSuccess}
            />
          )}
    </>
  );
};

export default ShowSelectionStep;
