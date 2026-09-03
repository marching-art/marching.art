// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/pages/Onboarding.jsx
// Streamlined 3-step onboarding: Welcome+Name, Create Corps, Draft Lineup
import { DRAFT_POOL_MAX_POINTS } from '../components/CaptionSelection/useCaptionSelectionModal';
import React, { useState, useEffect, useMemo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumePendingRedirect } from '../lib/pendingRedirect';
import {
  takeStashedBirthDate,
  clearStashedBirthDate,
  checkBirthDate,
  MIN_AGE_YEARS,
} from '../utils/ageGate';
import { m, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ArrowLeft, Music, PartyPopper, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Heading } from '../components/ui';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { getSeasonData } from '../api/season';
import { useCorpsValues } from '../hooks/useCorpsValues';
import { mergeProfile } from '../api/profile';
import {
  checkUsername,
  createUserProfile,
  selectUserShows,
  joinRookieLeague,
} from '../api/functions';
import toast from 'react-hot-toast';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { autoFillLineup } from '../utils/lineupAutoFill';
import { NEW_DIRECTOR_CORPSCOIN } from '../utils/economyMirrors';
import { getStoredGuestLineup, clearGuestPreviewData } from '../hooks/useGuestPreview';
import { importGuestLineup } from '../utils/guestLineupImport';
import {
  CAPTIONS,
  SOUNDSPORT_POINT_LIMIT,
  getStepSequence,
  GAME_MODE_PODIUM,
  GAME_MODE_SOUNDSPORT,
} from './onboardingConstants';
import { usePodiumEnabled } from '../hooks/useFeatures';
// Activation funnel: onboarding is the one flow where a drop-off is an
// account never created, so both the step reached AND the reason a step was
// refused are reported (`reason` is what says which gate is costing signups).
import { trackFunnelEvent, errorCodeOf, CLIENT_FUNNEL_EVENTS } from '../api/funnel';
import { GuidedCaptionSelection } from './OnboardingParts';
import {
  StepWelcome,
  StepChooseGame,
  StepPodiumHandoff,
  StepCorps,
  CelebrationModal,
} from './OnboardingSteps';

const Onboarding = () => {
  useBodyScroll();
  const { user } = useAuth();
  const navigate = useNavigate();
  // marching.art is two games in one. When Podium Class is enabled, onboarding
  // offers the choice up front instead of steering everyone into SoundSport.
  const podiumEnabled = usePodiumEnabled();
  // null until the director picks (or when Podium is disabled — the legacy
  // SoundSport-only flow ignores this). 'podium' | 'soundSport'.
  const [gameMode, setGameMode] = useState(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => ({
    // Registration already asked for the director name (stored on the Firebase
    // Auth user) — prefill so the user doesn't type it twice.
    displayName: user?.displayName || '',
    username: '',
    corpsName: '',
    // Date of birth from the sign-up form (utils/ageGate). The server refuses
    // to create a profile without one, so when the per-tab stash is gone (a
    // reload, a different tab, storage blocked) the welcome step asks again.
    birthDate: takeStashedBirthDate() || '',
  }));
  // True when sign-up didn't hand us a date — the welcome step shows the field.
  const [askBirthDate] = useState(() => !takeStashedBirthDate());
  const [loading, setLoading] = useState(false);
  // 'loading' | 'ready' | 'error' — season-doc side of the step-3 data load
  const [seasonStatus, setSeasonStatus] = useState('loading');
  const [lineup, setLineup] = useState({});
  const [currentCaptionIndex, setCurrentCaptionIndex] = useState(0);
  const [seasonData, setSeasonData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    valid: null,
    message: '',
  });
  const usernameCheckTimeout = React.useRef(null);

  // Global stores for schedule data
  const globalCurrentWeek = useSeasonStore((state) => state.currentWeek);
  const getWeekShows = useScheduleStore((state) => state.getWeekShows);

  // Backfill the director name if the auth user finishes loading after mount
  useEffect(() => {
    if (user?.displayName) {
      setFormData((prev) => (prev.displayName ? prev : { ...prev, displayName: user.displayName }));
    }
  }, [user?.displayName]);

  // The visible step sequence depends on whether Podium is enabled and which
  // game the director picked. `step` is a 1-based index into this list.
  const steps = useMemo(() => getStepSequence(podiumEnabled, gameMode), [podiumEnabled, gameMode]);
  const currentStepId = steps[step - 1]?.id;
  const isLastStep = step >= steps.length;

  // Fetch season data (on mount, and again via the step-3 Retry button — a
  // failure here used to strand the user on a perpetual "Loading available
  // corps..." pulse).
  const fetchSeasonData = React.useCallback(async () => {
    setSeasonStatus('loading');
    try {
      // The active season lives at game-settings/season (public read), the
      // same source the rest of the app uses (seasonStore, SeasonSetupWizard).
      // NOTE: the old `system/currentSeason` doc has no security rule, so
      // reading it always failed with permission-denied and corps never loaded.
      const season = await getSeasonData();
      if (!season || !season.seasonUid) {
        // Not a failure: the game is between seasons (rollover in progress,
        // or no season configured yet). Telling the director to "check
        // their connection" here looped them on Retry forever.
        console.warn('[Onboarding] No active season in game-settings/season — between seasons');
        setSeasonStatus('none');
        return;
      }

      setSeasonData({ ...season, seasonUid: season.seasonUid });
      setSeasonStatus('ready');
    } catch (error) {
      console.error('Error fetching season data:', error);
      setSeasonStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchSeasonData();
  }, [fetchSeasonData]);

  // Corps values for lineup selection live in dci-data/{seasonUid} — served
  // from the shared corpsValues cache entry (same key as Landing/Dashboard).
  const corpsQuery = useCorpsValues(seasonData?.seasonUid);
  const availableCorps = useMemo(
    () => (corpsQuery.data ?? []).filter((c) => (c.points || 0) <= DRAFT_POOL_MAX_POINTS),
    [corpsQuery.data]
  );

  // 'loading' | 'ready' | 'none' | 'error' — drives the step-3 corps list vs
  // the between-seasons notice vs the retry UI. An empty corpsValues doc
  // counts as an error, same as before; 'none' is a season gap, which lets
  // the director found their corps now and draft when the season opens.
  const dataStatus =
    seasonStatus === 'none'
      ? 'none'
      : seasonStatus === 'error' ||
          corpsQuery.isError ||
          (corpsQuery.isSuccess && corpsQuery.data.length === 0)
        ? 'error'
        : corpsQuery.isSuccess
          ? 'ready'
          : 'loading';
  const betweenSeasons = dataStatus === 'none';

  // Retry re-fetches whichever half failed (season doc and/or corps values).
  const { refetch: refetchCorpsValues } = corpsQuery;
  const retryDataLoad = React.useCallback(() => {
    fetchSeasonData();
    if (seasonData?.seasonUid) {
      refetchCorpsValues();
    }
  }, [fetchSeasonData, seasonData?.seasonUid, refetchCorpsValues]);

  // Fulfill the guest-preview promise: picks drafted in the demo carry over
  // into this draft (once, when the corps list first arrives).
  const guestImportDone = React.useRef(false);
  useEffect(() => {
    if (guestImportDone.current || availableCorps.length === 0) return;
    guestImportDone.current = true;
    const guestDraft = importGuestLineup(availableCorps, getStoredGuestLineup());
    if (guestDraft.count > 0) {
      setLineup((prev) => (Object.keys(prev).length > 0 ? prev : guestDraft.lineup));
      toast.success(
        `Imported ${guestDraft.count} pick${guestDraft.count === 1 ? '' : 's'} from your demo draft!`
      );
    }
  }, [availableCorps]);

  // Username validation function
  const validateUsername = async (username) => {
    // Clear any pending timeout
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    // Reset if empty
    if (!username.trim()) {
      setUsernameStatus({ checking: false, valid: null, message: '' });
      return;
    }

    // Basic format validation (3-15 chars, alphanumeric + underscore)
    if (username.length < 3) {
      setUsernameStatus({
        checking: false,
        valid: false,
        message: 'Username must be at least 3 characters',
      });
      return;
    }
    if (username.length > 15) {
      setUsernameStatus({
        checking: false,
        valid: false,
        message: 'Username must be 15 characters or less',
      });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus({
        checking: false,
        valid: false,
        message: 'Only letters, numbers, and underscores allowed',
      });
      return;
    }

    // Show checking state
    setUsernameStatus({ checking: true, valid: null, message: 'Checking availability...' });

    // Debounce the server check
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        await checkUsername({ username });
        setUsernameStatus({ checking: false, valid: true, message: 'Username is available!' });
      } catch (error) {
        if (error.code === 'functions/already-exists') {
          setUsernameStatus({
            checking: false,
            valid: false,
            message: 'This username is already taken',
          });
        } else if (error.code === 'functions/invalid-argument') {
          setUsernameStatus({ checking: false, valid: false, message: error.message });
        } else {
          setUsernameStatus({
            checking: false,
            valid: false,
            message: 'Could not verify username',
          });
        }
      }
    }, 500);
  };

  // Handle username input change
  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData({ ...formData, username: value });
    validateUsername(value);
  };

  // Report each step as it is reached, so the funnel shows where directors stop.
  // Keyed on `step` alone: an error path that sends the flow back to step 1
  // (a username taken mid-submit) re-reports that step, which is correct — it
  // is a second attempt at the same gate.
  useEffect(() => {
    trackFunnelEvent(CLIENT_FUNNEL_EVENTS.ONBOARDING_STEP, { step, outcome: 'reached' });
  }, [step]);

  // Report a step the director could not advance past. Low-cardinality reason
  // codes only — they name the gate, never the value the director typed.
  /**
   * The server's own age-gate verdicts (helpers/ageGate): an unparseable date
   * is `invalid-argument`, a missing or underage one is `failed-precondition`
   * with a "date of birth" / "years old" message. Sent back to step 1 so the
   * director can fix the field instead of seeing a generic failure.
   * @param {any} error
   */
  const isBirthDateError = (error) =>
    (error?.code === 'functions/failed-precondition' ||
      error?.code === 'functions/invalid-argument') &&
    /date of birth|years old/i.test(String(error?.message || ''));

  const trackBlocked = (reason) => {
    trackFunnelEvent(CLIENT_FUNNEL_EVENTS.ONBOARDING_STEP, {
      step,
      outcome: 'blocked',
      reason,
    });
  };

  const handleNext = () => {
    if (currentStepId === 'welcome') {
      if (!formData.displayName.trim()) {
        toast.error('Please enter your director name');
        trackBlocked('missing_display_name');
        return;
      }
      if (!formData.username.trim()) {
        toast.error('Please choose a username');
        trackBlocked('missing_username');
        return;
      }
      if (usernameStatus.valid !== true) {
        toast.error('Please choose a valid, available username');
        trackBlocked('username_unavailable');
        return;
      }
      const age = checkBirthDate(formData.birthDate);
      if (!age.ok) {
        toast.error(
          age.reason === 'underage'
            ? `You must be at least ${MIN_AGE_YEARS} years old to create an account.`
            : 'Please enter your date of birth.'
        );
        trackBlocked(age.reason === 'underage' ? 'underage' : 'missing_birth_date');
        return;
      }
    }
    if (currentStepId === 'choose' && !gameMode) {
      toast.error('Please choose a game to start with');
      trackBlocked('missing_game_mode');
      return;
    }
    if (currentStepId === 'corps' && !formData.corpsName.trim()) {
      toast.error('Please enter a name for your corps');
      trackBlocked('missing_corps_name');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  // Calculate total lineup points
  const getLineupPoints = () => {
    return Object.values(lineup).reduce((sum, val) => {
      if (!val) return sum;
      const parts = val.split('|');
      return sum + (parseInt(parts[2]) || 0);
    }, 0);
  };

  const isLineupComplete = Object.keys(lineup).length === 8;
  const isLineupValid = isLineupComplete && getLineupPoints() <= SOUNDSPORT_POINT_LIMIT;

  const handleSubmit = async () => {
    if (!betweenSeasons && !isLineupValid) {
      toast.error('Please complete your lineup within the point budget');
      trackBlocked(isLineupComplete ? 'lineup_over_budget' : 'lineup_incomplete');
      return;
    }

    // Final username validation before submit
    if (usernameStatus.valid !== true) {
      toast.error('Please choose a valid, available username');
      trackBlocked('username_unavailable');
      return;
    }

    setLoading(true);
    try {
      // Create the base profile + reserve the username atomically on the server.
      // The `usernames/` collection is backend-only per security rules, so this
      // MUST go through the callable rather than a client write. The callable is
      // idempotent, so a retry after a partial failure is safe.
      await createUserProfile({
        username: formData.username.trim().toLowerCase(),
        displayName: formData.displayName.trim(),
        // Date of birth (sign-up form or the welcome step) — recorded on the
        // owner-only private doc; the server refuses a profile without it.
        birthDate: formData.birthDate,
      });
      clearStashedBirthDate();

      // Layer on the onboarding-specific data. Writing to the owner's own
      // profile doc is permitted by security rules; merge so we don't clobber
      // the fields the callable just set (uniform, trophies, currency, etc.).
      await mergeProfile(user.uid, {
        location: '', // Can add later in profile
        bio: '',
        favoriteCorps: '',
        staff: [],
        corps: {
          soundSport: {
            name: formData.corpsName.trim(),
            corpsName: formData.corpsName.trim(),
            class: 'soundSport',
            createdAt: new Date(),
            seasonId: seasonData?.seasonUid || null,
            lineup: lineup,
            // NOTE: no execution/morale/equipment/rehearsal seeds — those
            // systems were cut from the fantasy classes (see GAMIFICATION.md
            // "Removed / out of scope"); Podium keeps its own state under the
            // user's /podium subcollection. Nothing ever read these fields.
          },
        },
        // Mark as first visit for dashboard tooltips
        isFirstVisit: true,
        onboardingCompletedAt: new Date().toISOString(),
      });

      // Auto-register for current week's shows
      try {
        await autoRegisterForShows(seasonData, 'soundSport');
      } catch (regError) {
        console.warn('Could not auto-register for shows:', regError);
        // Non-blocking - continue even if this fails
      }

      // Point the dashboard at SoundSport. A director who arrived via /podium
      // (which pre-sets this key to 'podiumClass') but then chose SoundSport
      // must land on the corps they just built, not the Podium founding flow.
      try {
        localStorage.setItem(`selectedCorps_${user.uid}`, 'soundSport');
      } catch {
        // localStorage unavailable — the dashboard defaults to the first corps,
        // which is SoundSport here anyway.
      }

      // The guest-preview draft has served its purpose — clean up so a future
      // signed-out visit starts fresh.
      clearGuestPreviewData();

      trackFunnelEvent(CLIENT_FUNNEL_EVENTS.ONBOARDING_COMPLETED, {
        lineup_points: getLineupPoints(),
        game_mode: GAME_MODE_SOUNDSPORT,
      });

      // Show celebration before navigating
      setShowCelebration(true);
    } catch (error) {
      console.error('Error creating profile:', error);
      trackFunnelEvent(CLIENT_FUNNEL_EVENTS.ONBOARDING_STEP, {
        step,
        outcome: 'error',
        reason: errorCodeOf(error),
      });
      if (error?.code === 'functions/already-exists') {
        // Username was claimed between the availability check and submit.
        toast.error('That username was just taken. Please choose another.');
        setUsernameStatus({
          checking: false,
          valid: false,
          message: 'This username is already taken',
        });
        setStep(1);
      } else if (isBirthDateError(error)) {
        toast.error(error.message || 'Please enter a valid date of birth.');
        setStep(1);
      } else {
        toast.error('Failed to create profile. Please try again.');
      }
      setLoading(false);
    }
  };

  // Podium branch: create the director profile and hand off to the four-step
  // founding flow on the dashboard. No SoundSport corps is created and no
  // fantasy show auto-registration runs — a Podium corps is founded (and
  // auto-entered at the majors) by registerPodiumCorps on the dashboard.
  const handlePodiumSubmit = async () => {
    if (usernameStatus.valid !== true) {
      toast.error('Please choose a valid, available username');
      trackBlocked('username_unavailable');
      return;
    }

    setLoading(true);
    try {
      // Base profile + username reservation (server-side, idempotent) — same
      // callable the SoundSport branch uses.
      await createUserProfile({
        username: formData.username.trim().toLowerCase(),
        displayName: formData.displayName.trim(),
        // Date of birth (sign-up form or the welcome step) — recorded on the
        // owner-only private doc; the server refuses a profile without it.
        birthDate: formData.birthDate,
      });
      clearStashedBirthDate();

      // Onboarding-specific fields. Deliberately no `corps.soundSport` (the
      // director chose Podium) and no `isFirstVisit` — the fantasy first-visit
      // tour points at the drafted-lineup surface, which a Podium director
      // doesn't have. Podium gets its OWN first-run tour instead, keyed on
      // `podiumFirstVisit`; the dashboard fires it once the corps is founded
      // and the daily-loop panels it points at are on screen (the tour targets
      // the rehearsal/caption/condition/trajectory panels, which don't exist
      // until founding, so the flag alone can't fire it prematurely).
      await mergeProfile(user.uid, {
        location: '',
        bio: '',
        favoriteCorps: '',
        staff: [],
        podiumFirstVisit: true,
        onboardingCompletedAt: new Date().toISOString(),
      });

      // Point the dashboard at the Podium tab so it renders the founding flow
      // straight away — the dashboard restores its active class from this key
      // and honors 'podiumClass' even before a Podium corps exists.
      try {
        localStorage.setItem(`selectedCorps_${user.uid}`, 'podiumClass');
      } catch {
        // localStorage unavailable — the dashboard falls back to its default
        // tab; the director can still pick Podium from the corps switcher.
      }

      clearGuestPreviewData();

      trackFunnelEvent(CLIENT_FUNNEL_EVENTS.ONBOARDING_COMPLETED, {
        game_mode: GAME_MODE_PODIUM,
      });

      setShowCelebration(true);
    } catch (error) {
      console.error('Error creating Podium profile:', error);
      trackFunnelEvent(CLIENT_FUNNEL_EVENTS.ONBOARDING_STEP, {
        step,
        outcome: 'error',
        reason: errorCodeOf(error),
      });
      if (error?.code === 'functions/already-exists') {
        toast.error('That username was just taken. Please choose another.');
        setUsernameStatus({
          checking: false,
          valid: false,
          message: 'This username is already taken',
        });
        setStep(1);
      } else if (isBirthDateError(error)) {
        toast.error(error.message || 'Please enter a valid date of birth.');
        setStep(1);
      } else {
        toast.error('Failed to create profile. Please try again.');
      }
      setLoading(false);
    }
  };

  // Auto-register user for current week's shows
  const autoRegisterForShows = async (season, corpsClass) => {
    if (!season?.schedule || !season?.seasonUid) return;

    try {
      // Use currentWeek from global store (already calculated)
      const currentWeek = globalCurrentWeek;

      // Get shows from global schedule store (skip championship shows)
      const weekShows = getWeekShows(currentWeek, { skipChampionship: true });

      if (weekShows.length === 0) {
        console.log('[Onboarding] No shows found for week', currentWeek);
        return;
      }

      // Map to the format expected by the backend
      const currentWeekShows = weekShows.map((show) => ({
        eventName: show.eventName,
        date: show.date,
        location: show.location,
        day: show.day,
      }));

      // Register for up to 4 shows
      if (currentWeekShows.length > 0) {
        const showsToRegister = currentWeekShows.slice(0, 4);

        await selectUserShows({
          week: currentWeek,
          shows: showsToRegister,
          corpsClass: corpsClass,
        });
      }
    } catch (error) {
      console.error('Error auto-registering for shows:', error);
      throw error;
    }
  };

  const handleCelebrationComplete = () => {
    toast.success(
      `Welcome to marching.art! Here's ${NEW_DIRECTOR_CORPSCOIN.toLocaleString()} CorpsCoin to get started!`
    );
    // A director who arrived on a shared deep link (a league invite, a
    // profile) and had to create an account first lands there, not on the
    // dashboard — see lib/pendingRedirect.
    const target = consumePendingRedirect() || '/dashboard';
    startTransition(() => {
      navigate(target);
    });
  };

  // One-tap rookie league placement from the celebration screen. The join
  // runs in the background — head onward either way.
  const handleJoinRookieLeague = () => {
    joinRookieLeague()
      .then((result) => {
        toast.success(result.data.message || 'Joined the Rookie Circuit!');
      })
      .catch(() => {
        toast.error('Could not join a league right now — find one on the Leagues page.');
      });
    handleCelebrationComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-surface-card border border-line rounded-none p-6 sm:p-8">
            {/* Progress Bar — driven by the dynamic step sequence, so it grows
                a "Choose Game" node once Podium is enabled and re-shapes when the
                director picks a game. */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {steps.map((s, idx) => {
                  const stepNumber = idx + 1;
                  return (
                    <React.Fragment key={s.id}>
                      <div className={`flex items-center gap-2 ${idx > 0 ? 'flex-1' : ''}`}>
                        {idx > 0 && (
                          <div
                            className={`flex-1 h-1 mx-2 rounded-full ${
                              step > idx ? 'bg-interactive' : 'bg-charcoal-700'
                            }`}
                          />
                        )}
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                            step === stepNumber
                              ? 'bg-interactive text-white'
                              : step > stepNumber
                                ? 'bg-green-500 text-white'
                                : 'bg-charcoal-700 text-muted'
                          }`}
                        >
                          {step > stepNumber ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <s.icon className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted">
                {steps.map((s, idx) => (
                  <span
                    key={s.id}
                    className={step === idx + 1 ? 'text-interactive font-semibold' : ''}
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            </div>

            {/* Step Content — keyed on the current step id (not a fixed index)
                so the branch a director takes renders the right panel. */}
            <div className="min-h-[380px]">
              <AnimatePresence mode="wait">
                {/* Welcome + Director Name */}
                {currentStepId === 'welcome' && (
                  <StepWelcome
                    key="welcome"
                    formData={formData}
                    setFormData={setFormData}
                    usernameStatus={usernameStatus}
                    onUsernameChange={handleUsernameChange}
                    askBirthDate={askBirthDate}
                  />
                )}

                {/* Choose Your Game (Podium vs SoundSport) */}
                {currentStepId === 'choose' && (
                  <StepChooseGame key="choose" gameMode={gameMode} setGameMode={setGameMode} />
                )}

                {/* Podium branch: hand off to the dashboard founding flow */}
                {currentStepId === 'found' && (
                  <StepPodiumHandoff key="found" displayName={formData.displayName} />
                )}

                {/* SoundSport branch: Create Corps */}
                {currentStepId === 'corps' && (
                  <StepCorps key="corps" formData={formData} setFormData={setFormData} />
                )}

                {/* SoundSport branch: Build Lineup (Guided Caption Selection) */}
                {currentStepId === 'lineup' && (
                  <m.div
                    key="lineup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="text-center mb-2">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-interactive/20 rounded-none mb-3">
                        <Music className="w-7 h-7 text-interactive" />
                      </div>
                      <Heading level="title" className="mb-1">
                        Build Your Lineup
                      </Heading>
                      <p className="text-muted text-xs">
                        Draft a corps for each caption • Budget: {SOUNDSPORT_POINT_LIMIT}
                      </p>
                    </div>

                    {availableCorps.length > 0 ? (
                      <GuidedCaptionSelection
                        availableCorps={availableCorps}
                        lineup={lineup}
                        setLineup={setLineup}
                        currentCaptionIndex={currentCaptionIndex}
                        setCurrentCaptionIndex={setCurrentCaptionIndex}
                      />
                    ) : dataStatus === 'none' ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-interactive/10 border border-interactive/30 mb-3">
                          <Music className="w-6 h-6 text-interactive" />
                        </div>
                        <p className="text-white text-sm font-semibold mb-1">
                          The next season hasn't opened yet
                        </p>
                        <p className="text-muted text-xs mb-4">
                          Found your corps now — you'll draft your eight captions the day the season
                          opens and the corps list goes live.
                        </p>
                        <button
                          onClick={retryDataLoad}
                          className="h-9 px-4 border border-line text-muted text-xs font-bold uppercase tracking-wider rounded-none hover:border-line-strong hover:text-white"
                        >
                          Check again
                        </button>
                      </div>
                    ) : dataStatus === 'error' ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 mb-3">
                          <XCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <p className="text-white text-sm font-semibold mb-1">
                          Couldn't load the corps list
                        </p>
                        <p className="text-muted text-xs mb-4">
                          Check your connection and try again — your other answers are safe.
                        </p>
                        <button
                          onClick={retryDataLoad}
                          className="h-10 px-5 bg-interactive text-white text-sm font-bold uppercase tracking-wider rounded-none hover:bg-interactive-hover"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-pulse mb-4">
                          <div className="w-12 h-12 rounded-full bg-interactive/20 mx-auto" />
                        </div>
                        <p className="text-muted text-sm">Loading available corps...</p>
                      </div>
                    )}

                    {/* Lineup summary */}
                    <div className="p-3 rounded-none bg-charcoal-800/70 border border-charcoal-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted">Lineup Progress</span>
                        <span
                          className={`text-sm font-bold ${isLineupComplete ? 'text-green-400' : 'text-secondary'}`}
                        >
                          {Object.keys(lineup).length}/8 selected
                        </span>
                      </div>
                      <div className="h-2 bg-charcoal-900 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${isLineupValid ? 'bg-green-500' : 'bg-surface-elevated'}`}
                          style={{ width: `${(Object.keys(lineup).length / 8) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted mt-2 text-center">
                        You can adjust this from your dashboard — changes are unlimited for the
                        first two weeks, then limited to 3 per week, and 2 per day during
                        Championship Week
                      </p>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-6">
              {step > 1 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-3 bg-surface-elevated border border-line text-white rounded-none hover:bg-line transition-colors font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              {!isLastStep ? (
                <button
                  onClick={handleNext}
                  disabled={
                    (currentStepId === 'welcome' &&
                      (!formData.displayName.trim() ||
                        !formData.username.trim() ||
                        !formData.birthDate ||
                        usernameStatus.valid !== true)) ||
                    (currentStepId === 'choose' && !gameMode) ||
                    (currentStepId === 'corps' && !formData.corpsName.trim())
                  }
                  className="flex-1 px-6 py-3 bg-interactive text-white rounded-none hover:bg-interactive-hover transition-colors font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : currentStepId === 'found' ? (
                /* Podium branch finish — create the profile and hand off */
                <button
                  onClick={handlePodiumSubmit}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-interactive text-white rounded-none hover:bg-interactive-hover transition-colors font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Take the Podium
                      <PartyPopper className="w-5 h-5" />
                    </>
                  )}
                </button>
              ) : (
                /* SoundSport branch finish */
                <button
                  onClick={handleSubmit}
                  disabled={loading || (!isLineupValid && !betweenSeasons)}
                  className="flex-1 px-6 py-3 bg-interactive text-white rounded-none hover:bg-interactive-hover transition-colors font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Start Playing
                      <PartyPopper className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Skip lineup option */}
            {currentStepId === 'lineup' && !isLineupComplete && availableCorps.length > 0 && (
              <button
                onClick={() => {
                  // Exact fill: all remaining captions with distinct corps,
                  // maximizing points within the budget (hits the full budget
                  // whenever the available point values allow it).
                  const result = autoFillLineup(
                    availableCorps,
                    lineup,
                    CAPTIONS.map((cap) => cap.id),
                    SOUNDSPORT_POINT_LIMIT
                  );
                  setLineup(result.lineup);
                  if (result.filledAll) {
                    toast.success(
                      `Lineup complete — ${result.totalPoints}/${SOUNDSPORT_POINT_LIMIT} points used!`
                    );
                  } else {
                    toast.error(
                      'Could not fill every caption within the point budget. Try changing a pick and auto-filling again.'
                    );
                  }
                }}
                className="w-full mt-3 text-muted hover:text-secondary text-sm transition-colors"
                disabled={loading || availableCorps.length === 0}
              >
                Auto-fill remaining slots
              </button>
            )}
          </div>
        </m.div>
      </div>

      {/* Celebration Modal — the Podium branch hands off to the founding flow,
          so its copy and CTA differ, and it skips the SoundSport-only rookie
          league offer. */}
      <CelebrationModal
        show={showCelebration}
        displayName={formData.displayName}
        corpsName={formData.corpsName}
        onComplete={handleCelebrationComplete}
        onJoinLeague={gameMode === GAME_MODE_PODIUM ? undefined : handleJoinRookieLeague}
        headline={gameMode === GAME_MODE_PODIUM ? 'WELCOME, DIRECTOR!' : "YOU'RE ALL SET!"}
        detail={
          gameMode === GAME_MODE_PODIUM
            ? 'Your director profile is ready — time to found your corps'
            : undefined
        }
        ctaLabel={gameMode === GAME_MODE_PODIUM ? 'Found Your Corps' : 'Go to Dashboard'}
      />
    </div>
  );
};

export default Onboarding;
