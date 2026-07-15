// Step 4 of the season setup wizard: weekly show selection. Extracted from
// SeasonSetupWizard.jsx — owns its modal state and schedule derivations.

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, Check, ChevronRight, MapPin, Trophy } from 'lucide-react';
import { getProfile } from '../../api/profile';
import { ShowRegistrationModal } from '../Schedule';
import { useScheduleStore } from '../../store/scheduleStore';
import { Heading } from '../ui';
import { compareCorpsClasses } from '../../utils/corps';
import { isEventPast } from '../../utils/scheduleUtils';

// Class config for badges
const CLASS_CONFIG = {
  openClass: { name: 'Open', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  aClass: { name: 'A Class', color: 'text-interactive', bgColor: 'bg-interactive/10' },
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
  const getActualDate = useCallback(
    (dayNumber) => {
      if (!seasonData?.schedule?.startDate) return null;
      const startDate = seasonData.schedule.startDate.toDate();
      // Competition Day N falls on the Nth competition day, which starts AFTER the
      // spring-training period: startDate + springTrainingDays + (N - 1). Omitting
      // this offset dated every show ~3 weeks early, so still-upcoming shows read as
      // past and the "Register at least one corps" gate could never be satisfied.
      // Mirrors src/pages/Schedule.jsx getActualDate — keep the two in sync.
      const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
      // startDate is stored at UTC midnight; build a LOCAL-midnight date from its UTC
      // calendar parts so weekday/day formatting reflects the intended calendar date
      // in every timezone (getDate()/setDate() would shift a day early in NA zones).
      return new Date(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + springTrainingDays + dayNumber - 1
      );
    },
    [seasonData]
  );

  // Format date for display
  const formatDate = useCallback(
    (dayNumber) => {
      const date = getActualDate(dayNumber);
      if (!date) return `Day ${dayNumber}`;
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },
    [getActualDate]
  );

  // Group shows by day
  const showsByDay = useMemo(() => {
    if (!availableShows || availableShows.length === 0) return {};
    const grouped = {};
    availableShows
      .filter((show) => show.type !== 'championship')
      .forEach((show) => {
        const day = show.day;
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(show);
      });
    return grouped;
  }, [availableShows]);

  const sortedDays = useMemo(() => {
    return Object.keys(showsByDay)
      .map(Number)
      .sort((a, b) => a - b);
  }, [showsByDay]);

  // Whether any show this week is still upcoming (registrable). If every show
  // has already been performed, the "register at least one corps" gate can
  // never be satisfied — so we explain that and let the director proceed rather
  // than leaving them stuck on this step.
  const hasUpcomingShows = useMemo(() => {
    return sortedDays.some((day) => !isEventPast(getActualDate(day)));
  }, [sortedDays, getActualDate]);

  // Check if a corps is registered for a show
  const isCorpsRegisteredForShow = useCallback(
    (show) => {
      if (!localUserProfile?.corps) return false;
      return Object.values(localUserProfile.corps).some((corps) => {
        if (!corps) return false;
        const weekKey = `week${show.week}`;
        const selectedShows = corps.selectedShows?.[weekKey] || [];
        return selectedShows.some((s) => s.eventName === show.eventName && s.date === show.date);
      });
    },
    [localUserProfile]
  );

  // Get registered corps for a show (sorted by class hierarchy: World → Open → A → SS)
  const getRegisteredCorpsForShow = useCallback(
    (show) => {
      if (!localUserProfile?.corps) return [];
      return Object.entries(localUserProfile.corps)
        .filter(([_corpsClass, corpsData]) => {
          if (!corpsData) return false;
          const weekKey = `week${show.week}`;
          const selectedShows = corpsData.selectedShows?.[weekKey] || [];
          return selectedShows.some((s) => s.eventName === show.eventName && s.date === show.date);
        })
        .map(([corpsClass]) => corpsClass)
        .sort(compareCorpsClasses);
    },
    [localUserProfile]
  );

  // Count total registrations for the week
  const totalWeekRegistrations = useMemo(() => {
    if (!localUserProfile?.corps) return 0;
    let count = 0;
    Object.values(localUserProfile.corps).forEach((corps) => {
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
  }, [user?.uid, setLocalUserProfile]);

  return (
    <>
      <div className="bg-surface-card border border-line rounded-none">
        {/* Header with week info and registration count */}
        <div className="bg-surface-raised px-4 py-3 border-b border-line">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-interactive" />
              <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
                {currentWeek === 7 ? 'Championship Week' : `Week ${currentWeek} Schedule`}
              </h2>
            </div>
            {currentWeek !== 7 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted">Registrations:</span>
                <span className="font-bold text-interactive tabular-nums">
                  {totalWeekRegistrations}
                </span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted mt-1">Tap a show to register your corps</p>
        </div>

        <div className="p-3">
          {/* Championship Week (Week 7) - Auto-enrollment message */}
          {currentWeek === 7 ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-interactive/20 rounded-none flex items-center justify-center">
                <Trophy className="w-8 h-8 text-interactive" />
              </div>
              <Heading level="title" as="h3" className="mb-2">
                Championship Week - Auto Enrollment
              </Heading>
              <p className="text-sm text-muted mb-4 max-w-md mx-auto">
                All championship events (Days 45-49) have automatic enrollment based on your corps
                class and advancement results.
              </p>
              <div className="bg-background border border-line p-4 text-left max-w-md mx-auto">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
                  Championship Schedule
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Day 45</span>
                    <span className="text-white">Open & A Class Prelims</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Day 46</span>
                    <span className="text-white">Open & A Class Finals (Top 8/4)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Day 47</span>
                    <span className="text-white">World Championship Prelims</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Day 48</span>
                    <span className="text-white">World Championship Semifinals (Top 25)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Day 49</span>
                    <span className="text-white">World Championship Finals (Top 12)</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 mt-2">
                    <span className="text-muted">Day 49</span>
                    <span className="text-white">SoundSport Festival (All SoundSport)</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted mt-4">
                Your corps will automatically compete based on class eligibility and prior day
                results.
              </p>
            </div>
          ) : scheduleLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-interactive border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted">Loading schedule...</p>
            </div>
          ) : sortedDays.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">No shows available this week</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDays.map((day) => {
                const date = getActualDate(day);
                const isPast = isEventPast(date);
                const dayOfWeek = date
                  ? date.toLocaleDateString('en-US', { weekday: 'short' })
                  : '';
                const monthDay = date
                  ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : `Day ${day}`;

                return (
                  <div key={day} className="flex gap-2">
                    {/* Condensed Day Indicator */}
                    <div
                      className={`
                            flex-shrink-0 w-14 flex flex-col items-center justify-center
                            py-2 px-1 rounded-none border
                            ${
                              isPast
                                ? 'bg-surface-card border-line text-muted'
                                : 'bg-interactive/10 border-interactive/30'
                            }
                          `}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase ${isPast ? 'text-muted' : 'text-interactive'}`}
                      >
                        {dayOfWeek}
                      </span>
                      <span className={`text-xs font-bold ${isPast ? 'text-muted' : 'text-white'}`}>
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
                                    bg-surface-sunken border rounded-none overflow-hidden
                                    ${isPast ? 'opacity-60 border-line' : 'hover:border-line-strong cursor-pointer active:bg-surface-card border-line'}
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
                                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted">
                                      <MapPin className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                      <span className="truncate">{show.location}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Status Badge */}
                                {isPast ? (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-line text-muted rounded-none">
                                    Done
                                  </span>
                                ) : isRegistered ? (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-green-500/10 text-green-400 rounded-none flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" />
                                    Going
                                  </span>
                                ) : (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-interactive/10 text-interactive rounded-none">
                                    Register
                                  </span>
                                )}
                              </div>

                              {/* Registered Corps Badges */}
                              {registeredCorps.length > 0 && (
                                <div className="flex items-center gap-1 mt-2 flex-wrap">
                                  {registeredCorps.map((corpsClass) => {
                                    const config = CLASS_CONFIG[corpsClass] || {
                                      name: corpsClass,
                                      color: 'text-muted',
                                      bgColor: 'bg-charcoal-500/10',
                                    };
                                    return (
                                      <span
                                        key={corpsClass}
                                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-bold uppercase rounded-none ${config.bgColor} ${config.color}`}
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
        <div className="px-4 py-3 border-t border-line flex justify-between items-center gap-3">
          {currentWeek !== 7 &&
            totalWeekRegistrations === 0 &&
            (hasUpcomingShows ? (
              <p className="text-[10px] text-muted">Register at least one corps to continue</p>
            ) : (
              <p className="text-[10px] text-warning">
                Every show this week has already been performed, so there's nothing left to register
                for. That's expected when you join mid-season — you can register for upcoming shows
                from your dashboard once setup is done. Tap Continue to finish.
              </p>
            ))}
          <div className="ml-auto">
            <button
              onClick={() => setStep(5)}
              disabled={currentWeek !== 7 && totalWeekRegistrations === 0 && hasUpcomingShows}
              className="h-10 px-6 bg-interactive text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 hover:bg-interactive-hover"
            >
              Continue
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
