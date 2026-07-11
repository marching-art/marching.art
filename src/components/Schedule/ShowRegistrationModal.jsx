// =============================================================================
// SHOW REGISTRATION MODAL - DIRECTOR'S COMMAND CENTER
// =============================================================================
// Full show details, registration controls, attendees, and results
// Mobile-optimized with BottomSheet for native swipe-to-dismiss

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Check, X, AlertTriangle, Trophy, Clock, Ticket } from 'lucide-react';
import { selectUserShows } from '../../api/functions';
import { getPodiumState, setPodiumShows } from '../../api/podium';
import { usePodiumEnabled } from '../../hooks/useFeatures';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { BottomSheet } from '../ui/BottomSheet';
import { useHaptic } from '../../hooks/useHaptic';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getMaxShowsForWeek } from '../../utils/captionPricing';
import { getShowRegistrationDeadline, formatEtDayTime } from '../../utils/seasonClock';
import { compareCorpsClasses } from '../../utils/corps';
import RunningOrder from './RunningOrder';

const CLASS_CONFIG = {
  worldClass: {
    name: 'World Class',
    shortName: 'World',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  openClass: {
    name: 'Open Class',
    shortName: 'Open',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  aClass: {
    name: 'A Class',
    shortName: 'A Class',
    color: 'text-[#0057B8]',
    bgColor: 'bg-[#0057B8]/10',
  },
  soundSport: {
    name: 'SoundSport',
    shortName: 'SS',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  podiumClass: {
    name: 'Podium Class',
    shortName: 'Podium',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
};

// Podium tour rules (mirror of functions store.js; server re-validates):
// majors + championship week are auto-attended, the Eastern Classic spans two
// nights, and self-picked shows are capped per week.
const PODIUM_EASTERN_DAYS = [41, 42];
const podiumMaxPicksForWeek = (week) => (week === 7 ? 0 : week >= 4 ? 3 : 4);

// =============================================================================
// CORPS SELECTION ITEM
// =============================================================================

const CorpsSelectionItem = ({
  corpsClass,
  corpsData,
  isSelected,
  onToggle,
  show,
  isDisabled,
  maxShows,
}) => {
  const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400' };
  const weekKey = `week${show.week}`;
  const currentShows = corpsData.selectedShows?.[weekKey] || [];
  const showsThisWeek = currentShows.length;
  const isAtMax = showsThisWeek >= maxShows;
  // Match by eventName only - dates can have type mismatches (Timestamp vs string)
  const isAlreadyAtShow = currentShows.some((s) => s.eventName === show.eventName);

  return (
    <button
      onClick={() => !isDisabled && onToggle(corpsClass)}
      disabled={isDisabled}
      className={`
        flex items-center gap-3 p-4 w-full text-left transition-colors min-h-[60px]
        ${
          isSelected
            ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]'
            : 'hover:bg-white/5 active:bg-white/10'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Checkbox */}
      <div
        className={`
        w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
        ${isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'}
      `}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
      </div>

      {/* Corps Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm truncate">
            {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
          </span>
          <span className={`text-[10px] font-bold uppercase ${config.color}`}>
            {config.shortName}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[11px] ${isAtMax && !isAlreadyAtShow ? 'text-red-400' : 'text-gray-500'}`}
          >
            {showsThisWeek}/{maxShows} shows this week
          </span>
          {isAtMax && !isAlreadyAtShow && (
            <span className="text-[10px] text-red-400 font-bold px-1.5 py-0.5 bg-red-400/10">
              MAX
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// =============================================================================
// MAIN MODAL COMPONENT
// =============================================================================

const ShowRegistrationModal = ({
  show,
  userProfile,
  formattedDate,
  eventDate,
  onClose,
  onSuccess,
}) => {
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [saving, setSaving] = useState(false);
  const { trigger: haptic } = useHaptic();

  // Get max shows based on the show's week (7 for final week, 4 otherwise)
  const maxShows = useMemo(() => getMaxShowsForWeek(show.week), [show.week]);

  // Registration stays open until the nightly score processing after show day
  const registrationDeadline = useMemo(() => getShowRegistrationDeadline(eventDate), [eventDate]);

  // Check if this is a championship show with auto-enrollment
  const isChampionship = show.isChampionship === true;
  // allowedClasses comes from schedule transform, eligibleClasses is the backend field name
  const eligibleClasses = useMemo(
    () => show.allowedClasses || show.eligibleClasses || [],
    [show.allowedClasses, show.eligibleClasses]
  );

  // Detect mobile for BottomSheet vs Modal
  const isMobile = useIsMobile();

  // Fantasy corps only — the Podium corps schedules through setPodiumShows
  // (day-based tour picks), never through selectUserShows, which rejects it.
  const userCorpsClasses = useMemo(
    () =>
      userProfile?.corps
        ? Object.keys(userProfile.corps)
            .filter((c) => c !== 'podiumClass')
            .sort(compareCorpsClasses)
        : [],
    [userProfile?.corps]
  );

  // ---------------------------------------------------------------------------
  // Podium corps attendance (per-show, like fantasy — one show per night)
  // ---------------------------------------------------------------------------
  const podiumEnabled = usePodiumEnabled();
  const podiumDay = Number.isInteger(show.day) ? show.day : null;
  // {selectedShows, autoDays, competitionDay, corpsName} — the Podium row's
  // single source of truth. getPodiumState (server day-context + subcollection)
  // is authoritative; we no longer gate on the profile's corps.podiumClass copy,
  // which can lag or be absent even when the corps is fielded this season.
  const [podiumInfo, setPodiumInfo] = useState(null);
  const [podiumAttend, setPodiumAttend] = useState(false);
  const [podiumInitial, setPodiumInitial] = useState(false);

  useEffect(() => {
    if (!podiumEnabled || podiumDay === null) return undefined;
    let cancelled = false;
    getPodiumState()
      .then((res) => {
        // Callables resolve to an HttpsCallableResult — the payload is res.data,
        // not res itself. Reading res.exists directly always saw undefined, so
        // the row never rendered and Podium corps could only attend the
        // auto-assigned majors/championship, never self-selected regular shows.
        const state = res?.data;
        if (cancelled || !state?.exists) return;
        const selectedShows = state.state?.selectedShows || {};
        // Attending THIS show only when the day's pick names this exact event
        // (one show per night — a different pick that day means "not here").
        const pick = selectedShows[podiumDay];
        const attending = Boolean(pick && pick.eventName === show.eventName);
        setPodiumInfo({
          selectedShows,
          autoDays: state.autoDays || [],
          competitionDay: state.competitionDay ?? 0,
          corpsName: state.state?.corpsName || 'Podium Corps',
        });
        setPodiumAttend(attending);
        setPodiumInitial(attending);
      })
      .catch(() => {
        // Feature off or transient failure — the Podium row simply doesn't render.
      });
    return () => {
      cancelled = true;
    };
  }, [podiumEnabled, podiumDay, show.eventName]);

  const podiumIsMyAutoDay = Boolean(podiumInfo?.autoDays?.includes(podiumDay));
  const podiumIsEasternOffNight =
    PODIUM_EASTERN_DAYS.includes(podiumDay) && podiumInfo && !podiumIsMyAutoDay;
  // A day is "passed" only once it is strictly before the current competition
  // day — the show's own competition day is still open (it locks at the 2 AM ET
  // score processing the next day, exactly when competitionDay ticks forward),
  // matching the fantasy registration deadline. Using <= locked Podium out a
  // full day early, so a show fantasy corps could still register for read as
  // "This day has passed" for the Podium corps.
  const podiumIsPast = podiumInfo ? podiumDay < podiumInfo.competitionDay : false;
  const podiumMaxPicks = podiumMaxPicksForWeek(show.week);
  // The week's OTHER still-open picks (as {day, eventName, location}), re-sent
  // on save because setPodiumShows replaces the whole week. Excludes this day
  // (one show per night — toggling this show replaces any other pick that day)
  // and strictly-past days (which the server rejects).
  const podiumOtherWeekPicks = useMemo(
    () =>
      Object.entries(podiumInfo?.selectedShows || {})
        .map(([d, pick]) => ({ day: Number(d), ...pick }))
        .filter(
          (p) =>
            Math.ceil(p.day / 7) === show.week &&
            p.day !== podiumDay &&
            p.day >= (podiumInfo?.competitionDay ?? 0)
        ),
    [podiumInfo, show.week, podiumDay]
  );
  const podiumPicksThisWeek = podiumOtherWeekPicks.length + (podiumAttend ? 1 : 0);
  const podiumChanged = Boolean(podiumInfo) && podiumAttend !== podiumInitial;

  const togglePodium = () => {
    if (!podiumInfo || podiumIsMyAutoDay || podiumIsEasternOffNight || podiumIsPast) return;
    haptic('light');
    if (!podiumAttend && podiumOtherWeekPicks.length >= podiumMaxPicks) {
      haptic('error');
      toast.error(
        `Your Podium corps already has ${podiumOtherWeekPicks.length} picks in week ${show.week}.`
      );
      return;
    }
    setPodiumAttend((v) => !v);
  };

  // For championship shows, determine which corps are enrolled/eligible
  const enrolledCorps = useMemo(() => {
    if (!isChampionship) return [];
    return userCorpsClasses.filter((corpsClass) => eligibleClasses.includes(corpsClass));
  }, [isChampionship, userCorpsClasses, eligibleClasses]);

  const ineligibleCorps = useMemo(() => {
    if (!isChampionship) return [];
    return userCorpsClasses.filter((corpsClass) => !eligibleClasses.includes(corpsClass));
  }, [isChampionship, userCorpsClasses, eligibleClasses]);

  // Initialize with already registered corps
  useEffect(() => {
    const alreadyRegistered = [];
    userCorpsClasses.forEach((corpsClass) => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];
      // Match by eventName only - dates can have type mismatches (Timestamp vs string)
      const isRegistered = selectedShows.some((s) => s.eventName === show.eventName);
      if (isRegistered) {
        alreadyRegistered.push(corpsClass);
      }
    });
    setSelectedCorps(alreadyRegistered);
  }, [show, userProfile, userCorpsClasses]);

  const toggleCorps = (corpsClass) => {
    haptic('light');
    if (selectedCorps.includes(corpsClass)) {
      setSelectedCorps(selectedCorps.filter((c) => c !== corpsClass));
    } else {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];
      // Match by eventName only - dates can have type mismatches (Timestamp vs string)
      const isAlreadyAtShow = currentShows.some((s) => s.eventName === show.eventName);
      if (currentShows.length >= maxShows && !isAlreadyAtShow) {
        haptic('error');
        toast.error(`This corps already has ${maxShows} shows registered for week ${show.week}`);
        return;
      }
      setSelectedCorps([...selectedCorps, corpsClass]);
    }
  };

  const selectAll = () => {
    const canSelect = userCorpsClasses.filter((corpsClass) => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];
      // Match by eventName only - dates can have type mismatches (Timestamp vs string)
      const isAlreadyAtShow = currentShows.some((s) => s.eventName === show.eventName);
      return (
        currentShows.length < maxShows || isAlreadyAtShow || selectedCorps.includes(corpsClass)
      );
    });
    setSelectedCorps(canSelect);
  };

  const clearAll = () => {
    setSelectedCorps([]);
  };

  const handleSave = async () => {
    haptic('medium');
    setSaving(true);
    try {
      // Prepare all updates first, then execute in parallel to avoid race conditions
      const updatePromises = userCorpsClasses.map((corpsClass) => {
        const corpsData = userProfile.corps[corpsClass];
        const weekKey = `week${show.week}`;
        const currentShows = corpsData.selectedShows?.[weekKey] || [];
        // Filter by eventName only - dates can have type mismatches (Timestamp vs string)
        const filteredShows = currentShows.filter((s) => s.eventName !== show.eventName);
        const newShows = selectedCorps.includes(corpsClass)
          ? [
              ...filteredShows,
              {
                eventName: show.eventName,
                date: show.date,
                location: show.location,
                day: show.day,
              },
            ]
          : filteredShows;
        return selectUserShows({
          week: show.week,
          shows: newShows,
          corpsClass,
        });
      });

      if (podiumChanged) {
        // Per-show picks: keep the week's other shows, add/remove THIS show.
        const otherPicks = podiumOtherWeekPicks.map((p) => ({
          day: p.day,
          eventName: p.eventName,
          location: p.location,
        }));
        const shows = podiumAttend
          ? [...otherPicks, { day: podiumDay, eventName: show.eventName, location: show.location }]
          : otherPicks;
        updatePromises.push(setPodiumShows({ week: show.week, shows }));
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises);
      if (podiumChanged) setPodiumInitial(podiumAttend);

      haptic('success');
      toast.success('Registration updated!');
      onSuccess();
    } catch (error) {
      console.error('Error updating registration:', error);
      haptic('error');
      toast.error(error.message || 'Failed to update registration');
    } finally {
      setSaving(false);
    }
  };

  // Check if any corps registered
  const hasChanges = useMemo(() => {
    const initialRegistered = userCorpsClasses.filter((corpsClass) => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];
      // Match by eventName only - dates can have type mismatches (Timestamp vs string)
      return selectedShows.some((s) => s.eventName === show.eventName);
    });
    return (
      JSON.stringify(initialRegistered.sort()) !== JSON.stringify(selectedCorps.sort()) ||
      podiumChanged
    );
  }, [selectedCorps, userCorpsClasses, userProfile, show, podiumChanged]);

  // Shared header content for both mobile and desktop
  const HeaderContent = () => (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-white leading-tight">{show.eventName}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0057B8]" />
              {formattedDate}
            </span>
            {show.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                <span className="truncate max-w-[180px]">{show.location}</span>
              </span>
            )}
          </div>
        </div>
        {!isMobile && (
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 text-gray-500 hover:text-white active:text-white rounded-sm hover:bg-white/10 min-w-touch min-h-touch flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Week Info Badge */}
      <div className="mt-3 flex items-center gap-2">
        <span className="px-2 py-1 bg-[#0057B8]/10 text-[#0057B8] text-[10px] font-bold uppercase">
          Week {show.week}
        </span>
        <span className="text-[10px] text-gray-500">Max {maxShows} shows per corps</span>
      </div>

      {/* Two-night event notice (e.g. the Eastern Classic, days 41-42) */}
      {show.multiNight?.nights?.length > 1 && (
        <div className="mt-2 px-3 py-2 bg-[#c9a227]/10 border border-[#c9a227]/30 text-[10px] text-[#c9a227]">
          Two-night event (Days {show.multiNight.nights.join(' & ')}): registering counts as ONE
          show and covers both nights. Each corps performs once, on its assigned night — night
          lineups are announced on Day {show.multiNight.nights[0] - 2}.
        </div>
      )}
    </>
  );

  // Shared body content
  const BodyContent = () => (
    <>
      {/* Real running order (scraped from dci.org) — shown when available */}
      {show.lineup?.length > 0 && (
        <div className="px-4 pt-4">
          <RunningOrder show={show} />
        </div>
      )}

      {/* marching.art Major banner (§5.11): exclusive day, full-field
          convergence — the season's shared reference points */}
      {show.eventTier === 'regional' && !isChampionship && (
        <div className="mx-4 mt-4 flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30">
          <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-400 mb-0.5">marching.art Major</p>
            <p className="text-xs text-gray-400">
              The only event on this day — the whole field converges here, and every class is scored
              on the same night at the same show.
            </p>
          </div>
        </div>
      )}

      {/* Championship Auto-Enrollment Display */}
      {isChampionship ? (
        <div className="px-4 py-6">
          {/* Auto-Enrollment Banner */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-400 mb-1">Championship Event</p>
              <p className="text-xs text-gray-400">
                Eligible corps are automatically enrolled. No manual registration required.
              </p>
            </div>
          </div>

          {/* Enrolled Corps */}
          {enrolledCorps.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                <Check className="w-3 h-3 inline mr-1 text-green-500" />
                Automatically Enrolled
              </div>
              <div className="space-y-2">
                {enrolledCorps.map((corpsClass) => {
                  const corpsData = userProfile.corps[corpsClass];
                  const config = CLASS_CONFIG[corpsClass];
                  return (
                    <div
                      key={corpsClass}
                      className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30"
                    >
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-white text-sm">
                          {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                        </span>
                        <span className={`ml-2 text-[10px] font-bold uppercase ${config.color}`}>
                          {config.shortName}
                        </span>
                      </div>
                      <span className="text-[10px] text-green-400 font-bold px-2 py-1 bg-green-500/20">
                        ENROLLED
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ineligible Corps */}
          {ineligibleCorps.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                <X className="w-3 h-3 inline mr-1 text-red-400" />
                Not Eligible
              </div>
              <div className="space-y-2">
                {ineligibleCorps.map((corpsClass) => {
                  const corpsData = userProfile.corps[corpsClass];
                  const config = CLASS_CONFIG[corpsClass];
                  return (
                    <div
                      key={corpsClass}
                      className="flex items-center gap-3 p-3 bg-[#222] border border-[#333] opacity-60"
                    >
                      <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-400 text-sm">
                          {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                        </span>
                        <span className={`ml-2 text-[10px] font-bold uppercase ${config.color}`}>
                          {config.shortName}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">
                        Class not eligible
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Corps Message */}
          {userCorpsClasses.length === 0 && (
            <div className="text-center py-6">
              <AlertTriangle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No corps registered yet.</p>
              <Link
                to="/"
                onClick={onClose}
                className="inline-block mt-3 px-4 py-2 bg-[#0057B8] text-white text-xs font-bold uppercase"
              >
                Create a Corps
              </Link>
            </div>
          )}

          {/* Eligible Classes Info */}
          <div className="mt-4 p-3 bg-[#111] border border-[#333]">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Eligible Classes for This Event
            </p>
            <div className="flex flex-wrap gap-2">
              {eligibleClasses.map((cls) => {
                const config = CLASS_CONFIG[cls];
                return (
                  <span
                    key={cls}
                    className={`px-2 py-1 text-xs font-bold ${config?.bgColor || 'bg-gray-500/10'} ${config?.color || 'text-gray-400'}`}
                  >
                    {config?.name || cls}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : userCorpsClasses.length === 0 && !podiumInfo ? (
        <div className="text-center py-10 px-4">
          <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No Corps Registered</p>
          <p className="text-xs text-gray-600 mt-1 max-w-[280px] mx-auto">
            Create a corps from the Dashboard to start registering for shows.
          </p>
          <Link
            to="/"
            onClick={onClose}
            className="inline-block mt-4 px-4 py-2 bg-[#0057B8] text-white text-xs font-bold uppercase hover:bg-[#0066d6] press-feedback"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#333]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Select Corps to Attend
            </span>
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => {
                  haptic('light');
                  selectAll();
                }}
                className="text-[#0057B8] hover:text-[#0066d6] font-bold py-2 px-2 -mx-2 rounded hover:bg-[#0057B8]/10 min-h-touch press-feedback"
              >
                Select All
              </button>
              <span className="text-gray-700">|</span>
              <button
                onClick={() => {
                  haptic('light');
                  clearAll();
                }}
                className="text-gray-500 hover:text-white font-bold py-2 px-2 -mx-2 rounded hover:bg-white/5 min-h-touch press-feedback"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Corps List */}
          <div className="divide-y divide-[#333]">
            {userCorpsClasses.map((corpsClass) => {
              const corpsData = userProfile.corps[corpsClass];
              const isSelected = selectedCorps.includes(corpsClass);

              return (
                <CorpsSelectionItem
                  key={corpsClass}
                  corpsClass={corpsClass}
                  corpsData={corpsData}
                  isSelected={isSelected}
                  onToggle={toggleCorps}
                  show={show}
                  isDisabled={false}
                  maxShows={maxShows}
                />
              );
            })}

            {/* Podium corps — day-based tour pick, separate rules from lineups */}
            {podiumInfo && (
              <button
                onClick={togglePodium}
                disabled={podiumIsMyAutoDay || podiumIsEasternOffNight || podiumIsPast}
                className={`
                  flex items-center gap-3 p-4 w-full text-left transition-colors min-h-[60px]
                  ${
                    podiumAttend
                      ? 'bg-yellow-400/5 border-l-2 border-l-yellow-400'
                      : 'hover:bg-white/5 active:bg-white/10'
                  }
                  ${podiumIsMyAutoDay || podiumIsEasternOffNight || podiumIsPast ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div
                  className={`
                  w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
                  ${podiumAttend || podiumIsMyAutoDay ? 'bg-yellow-500 border-yellow-500' : 'border-[#444]'}
                `}
                >
                  {(podiumAttend || podiumIsMyAutoDay) && (
                    <Check className="w-3.5 h-3.5 text-black" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">
                      {podiumInfo.corpsName}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-yellow-400">Podium</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {podiumIsMyAutoDay
                      ? 'Auto-attended — major / championship'
                      : podiumIsEasternOffNight
                        ? 'Eastern Classic — not your assigned night'
                        : podiumIsPast
                          ? 'This day has passed'
                          : `${podiumPicksThisWeek}/${podiumMaxPicks} tour picks this week`}
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Info Section */}
          <div className="px-4 py-3 bg-[#111] border-t border-[#333]">
            <div className="flex items-start gap-3 p-3 bg-[#0057B8]/5 border border-[#0057B8]/20">
              <Ticket className="w-4 h-4 text-[#0057B8] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-400 leading-relaxed">
                <p>
                  Each corps can attend up to{' '}
                  <span className="text-[#0057B8] font-bold">{maxShows} shows per week</span>.
                  Scores from attended shows contribute to your season standings.
                </p>
                {registrationDeadline && (
                  <p className="mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400 flex-shrink-0" aria-hidden="true" />
                    <span>
                      You can add or change attendance until scores process:{' '}
                      <span className="text-cyan-400 font-bold">
                        {formatEtDayTime(registrationDeadline)}
                      </span>
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Registration Summary */}
          {selectedCorps.length > 0 && (
            <div className="px-4 py-3 bg-[#111] border-t border-[#333]">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Registering
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCorps.map((corpsClass) => {
                  const corpsData = userProfile.corps[corpsClass];
                  const config = CLASS_CONFIG[corpsClass];
                  return (
                    <span
                      key={corpsClass}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${config.bgColor} ${config.color}`}
                    >
                      <Check className="w-3 h-3" />
                      {corpsData.corpsName || corpsData.name || config.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  // Shared footer content
  const FooterContent = () => {
    // Championship shows don't need Save/Cancel - just a Close button
    if (isChampionship) {
      return (
        <button
          onClick={() => {
            haptic('light');
            onClose();
          }}
          className="w-full h-12 bg-[#333] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#444] active:bg-[#222] press-feedback flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      );
    }

    return userCorpsClasses.length > 0 || podiumInfo ? (
      <div className="flex gap-3">
        <button
          onClick={() => {
            haptic('light');
            onClose();
          }}
          disabled={saving}
          className="flex-1 h-12 border border-[#444] text-gray-300 text-sm font-bold uppercase tracking-wider hover:border-[#555] hover:text-white disabled:opacity-50 active:bg-[#333] press-feedback"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 h-12 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:bg-[#004494] press-feedback-strong"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-sm animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {hasChanges ? 'Save Changes' : 'No Changes'}
            </>
          )}
        </button>
      </div>
    ) : null;
  };

  // Mobile: Use BottomSheet with native swipe-to-dismiss
  if (isMobile) {
    return (
      <BottomSheet isOpen={true} onClose={onClose} snapPoints={[85]} showCloseButton={true}>
        {/* Header */}
        <div className="px-4 pb-3 border-b border-[#333] flex-shrink-0">
          <HeaderContent />
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum">
          <BodyContent />
        </div>

        {/* Footer */}
        {(isChampionship || userCorpsClasses.length > 0 || podiumInfo) && (
          <div className="px-4 py-4 border-t border-[#333] bg-[#1a1a1a] flex-shrink-0 safe-area-bottom">
            <FooterContent />
          </div>
        )}
      </BottomSheet>
    );
  }

  // Desktop: Use Portal with centered modal
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[90dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-[#333] bg-[#222] flex-shrink-0">
            <HeaderContent />
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <BodyContent />
          </div>

          {/* Footer */}
          {(isChampionship || userCorpsClasses.length > 0 || podiumInfo) && (
            <div className="px-4 py-4 border-t border-[#333] bg-[#111] flex-shrink-0">
              <FooterContent />
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default ShowRegistrationModal;
