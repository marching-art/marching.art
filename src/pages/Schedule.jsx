// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// SCHEDULE - SHOW REGISTRATION & BROWSING
// =============================================================================
// Browse all shows by week, register corps for competitions
// Laws: Dense data, data-terminal aesthetic, mobile-optimized touch targets

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useProfileStore } from '../store/profileStore';
import { ShowRegistrationModal, HostEventCard } from '../components/Schedule';
import { formatCountdown, formatEtShort } from '../utils/seasonClock';
import { competitionDayToDate } from '../utils/competitionCalendar';
import { useSeasonDeadlines } from '../hooks/useSeasonClock';
import { usePodiumEnabled } from '../hooks/useFeatures';
import { usePodium } from '../hooks/usePodium';
import { CHAMPIONSHIP_EVENTS } from './scheduleConstants';
import { WeekPills, ShowsList, ChampionshipWeekDisplay } from './ScheduleParts';

// =============================================================================
// MAIN SCHEDULE COMPONENT
// =============================================================================

const Schedule = () => {
  const { user } = useAuth();
  const { scoresAt, scoresInMs, scoresExact } = useSeasonDeadlines();
  const [loading, setLoading] = useState(true);
  const [selectedShow, setSelectedShow] = useState(null);
  const [registrationModal, setRegistrationModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null);

  // Profile store - uses real-time listener for automatic updates after registration
  const userProfile = useProfileStore((state) => state.profile);
  const profileLoading = useProfileStore((state) => state.loading);

  // Season store
  const seasonData = useSeasonStore((state) => state.seasonData);
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const currentWeek = useSeasonStore((state) => state.currentWeek);
  const seasonLoading = useSeasonStore((state) => state.loading);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);

  // Schedule store - pre-computed data from global listener
  const showsByWeek = useScheduleStore((state) => state.showsByWeek);
  const scheduleLoading = useScheduleStore((state) => state.loading);

  // Podium attendance lives outside the fantasy corps.selectedShows a card
  // reads, so surface it separately. Self-picks badge the SPECIFIC show (by
  // eventName — one show per night); majors/championship are auto-attended and
  // badge by day (single event that day).
  const podiumEnabled = usePodiumEnabled();
  const podium = usePodium(podiumEnabled);
  const podiumAttendance = useMemo(() => {
    const data = podium.data;
    if (!data?.exists) return null;
    const selectedShows = data.state?.selectedShows || {};
    const events = new Set(
      Object.values(selectedShows)
        .map((pick) => pick?.eventName)
        .filter(Boolean)
    );
    const autoDays = new Set(data.autoDays || []);
    if (events.size === 0 && autoDays.size === 0) return null;
    return { events, autoDays, corpsName: data.state?.corpsName || 'Podium Corps' };
  }, [podium.data]);

  // Initialize selected week to current week
  useEffect(() => {
    if (currentWeek && selectedWeek === null) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek, selectedWeek]);

  // Set loading to false when all data sources are ready
  useEffect(() => {
    if (!seasonLoading && !scheduleLoading && (!user || !profileLoading)) {
      setLoading(false);
    }
  }, [seasonLoading, scheduleLoading, profileLoading, user]);

  // Get actual date from day number — spring-training aware, shared with the
  // setup wizard and scores views via utils/competitionCalendar.
  const getActualDate = useCallback(
    (dayNumber) => competitionDayToDate(seasonData?.schedule, dayNumber),
    [seasonData]
  );

  // Format date
  const formatDate = useCallback(
    (dayNumber) => {
      const date = getActualDate(dayNumber);
      if (!date) return `Day ${dayNumber}`;
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },
    [getActualDate]
  );

  // Get week date range
  const getWeekDateRange = useCallback(
    (weekNumber) => {
      const startDay = (weekNumber - 1) * 7 + 1;
      const endDay = weekNumber * 7;
      const startDate = getActualDate(startDay);
      const endDate = getActualDate(endDay);
      if (!startDate || !endDate) return '';
      const opts = { month: 'short', day: 'numeric' };
      return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', opts)}`;
    },
    [getActualDate]
  );

  // showsByWeek and showCountsByWeek come from scheduleStore (pre-computed)
  // Ensure Week 7 is always included for championship events
  const weeks = useMemo(() => {
    const weekSet = new Set(Object.keys(showsByWeek).map(Number));
    weekSet.add(7); // Always include Week 7 for championship events
    return Array.from(weekSet).sort((a, b) => a - b);
  }, [showsByWeek]);

  // For Week 7, include both regular shows (days 43-44) and championship events
  const getWeekShowCount = useCallback(
    (week) => {
      if (week === 7) {
        // Count regular shows on days 43-44
        const regularShowsCount = (showsByWeek[7] || []).filter(
          (s) => s.day >= 43 && s.day <= 44
        ).length;
        return regularShowsCount + CHAMPIONSHIP_EVENTS.length;
      }
      return showsByWeek[week]?.length || 0;
    },
    [showsByWeek]
  );

  // Handle show click
  const handleShowClick = useCallback((show) => {
    setSelectedShow(show);
    setRegistrationModal(true);
  }, []);

  // Count registrations
  const registrationStats = useMemo(() => {
    if (!userProfile?.corps) return { total: 0, thisWeek: 0 };

    let total = 0;
    let thisWeek = 0;

    Object.values(userProfile.corps).forEach((corps) => {
      if (!corps?.selectedShows) return;
      Object.entries(corps.selectedShows).forEach(([weekKey, shows]) => {
        const count = (shows || []).length;
        total += count;
        if (weekKey === `week${currentWeek}`) {
          thisWeek += count;
        }
      });
    });

    return { total, thisWeek };
  }, [userProfile, currentWeek]);

  // Loading
  if (loading) {
    return (
      <div className="w-full py-20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-interactive border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted">Loading schedule...</p>
        </div>
      </div>
    );
  }

  // No season
  if (!seasonData) {
    return (
      <div className="w-full py-20 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Calendar className="w-12 h-12 text-muted mx-auto mb-3" />
          <h2 className="text-sm font-bold text-white mb-1">No Active Season</h2>
          <p className="text-xs text-muted">The schedule will appear once a season is active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 bg-surface-card border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-interactive" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                {formatSeasonName?.() || '2025'} Schedule
              </h1>
              <p className="text-[10px] text-muted">
                Week {currentWeek} of 7 • {getWeekDateRange(currentWeek)}
              </p>
              <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" aria-hidden="true" />
                Scores drop in{' '}
                <span className="font-bold font-data tabular-nums">
                  {formatCountdown(scoresInMs)}
                </span>{' '}
                ({scoresExact ? '' : 'by '}
                {formatEtShort(scoresAt)})
              </p>
            </div>
          </div>

          {/* Registration Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] text-muted uppercase">This Week</div>
              <div className="font-bold text-white font-data tabular-nums">
                {registrationStats.thisWeek}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted uppercase">Total</div>
              <div className="font-bold text-interactive font-data tabular-nums">
                {registrationStats.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WEEK PILLS - Fixed */}
      <div className="flex-shrink-0">
        <WeekPills
          weeks={weeks}
          currentWeek={currentWeek}
          selectedWeek={selectedWeek}
          onSelect={setSelectedWeek}
          getShowCount={getWeekShowCount}
        />
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        {selectedWeek === 7 ? (
          <ChampionshipWeekDisplay
            userProfile={userProfile}
            getActualDate={getActualDate}
            seasonUid={seasonUid}
            regularShows={showsByWeek[7] || []}
            formatDate={formatDate}
            onRegister={handleShowClick}
            podiumAttendance={podiumAttendance}
          />
        ) : (
          <ShowsList
            shows={showsByWeek[selectedWeek] || []}
            userProfile={userProfile}
            formatDate={formatDate}
            getActualDate={getActualDate}
            onRegister={handleShowClick}
            seasonUid={seasonUid}
            podiumAttendance={podiumAttendance}
          />
        )}

        {/* Director-hosted events (all classes) — flag-gated, self-hiding */}
        {user && <HostEventCard seasonUid={seasonUid} />}
      </div>

      {/* REGISTRATION MODAL */}
      {registrationModal && selectedShow && (
        <ShowRegistrationModal
          show={selectedShow}
          userProfile={userProfile}
          formattedDate={formatDate(selectedShow.day)}
          eventDate={getActualDate(selectedShow.day)}
          onClose={() => setRegistrationModal(false)}
          onSuccess={() => {
            // Fantasy corps update via the profileStore real-time listener, but
            // the Podium pick lives in the podium/state subcollection read
            // through a one-shot callable — refetch it so its badge appears
            // immediately without a full page reload.
            if (podiumEnabled) podium.reload();
            setRegistrationModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Schedule;
