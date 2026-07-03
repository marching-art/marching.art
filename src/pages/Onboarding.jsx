// src/pages/Onboarding.jsx
// Streamlined 3-step onboarding: Welcome+Name, Create Corps, Draft Lineup
import React, { useState, useEffect, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  User,
  Flag,
  ArrowRight,
  Check,
  ArrowLeft,
  Star,
  Zap,
  Music,
  ChevronRight,
  Sparkles,
  PartyPopper,
  AtSign,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { getSeasonData, getCorpsValues } from '../api/season';
import { mergeProfile } from '../api/profile';
import { checkUsername, createUserProfile, selectUserShows } from '../api/functions';
import toast from 'react-hot-toast';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { autoFillLineup } from '../utils/lineupAutoFill';
import { getStoredGuestLineup, clearGuestPreviewData } from '../hooks/useGuestPreview';
import { importGuestLineup } from '../utils/guestLineupImport';
import { CAPTIONS, SOUNDSPORT_POINT_LIMIT, STEPS, GAME_FEATURES } from './onboardingConstants';
import { GuidedCaptionSelection } from './OnboardingParts';

const Onboarding = () => {
  useBodyScroll();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => ({
    // Registration already asked for the director name (stored on the Firebase
    // Auth user) — prefill so the user doesn't type it twice.
    displayName: user?.displayName || '',
    username: '',
    corpsName: '',
  }));
  const [loading, setLoading] = useState(false);
  const [availableCorps, setAvailableCorps] = useState([]);
  // 'loading' | 'ready' | 'error' — drives the step-3 corps list vs retry UI
  const [dataStatus, setDataStatus] = useState('loading');
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

  // Fetch season data and available corps (on mount, and again via the
  // step-3 Retry button — a failure here used to strand the user on a
  // perpetual "Loading available corps..." pulse).
  const fetchSeasonData = React.useCallback(async () => {
    setDataStatus('loading');
    try {
      // The active season lives at game-settings/season (public read), the
      // same source the rest of the app uses (seasonStore, SeasonSetupWizard).
      // NOTE: the old `system/currentSeason` doc has no security rule, so
      // reading it always failed with permission-denied and corps never loaded.
      const season = await getSeasonData();
      if (!season || !season.seasonUid) {
        console.error('[Onboarding] No active season found in game-settings/season');
        setDataStatus('error');
        return;
      }

      setSeasonData({ ...season, seasonUid: season.seasonUid });

      // Corps values for lineup selection live in dci-data/{seasonUid}.
      const corpsValues = await getCorpsValues(season.seasonUid);
      if (corpsValues.length) {
        const corps = corpsValues.filter((c) => (c.points || 0) <= 50);
        setAvailableCorps(corps);
        setDataStatus('ready');

        // Fulfill the guest-preview promise: picks drafted in the demo
        // carry over into this draft.
        const guestDraft = importGuestLineup(corps, getStoredGuestLineup());
        if (guestDraft.count > 0) {
          setLineup((prev) => (Object.keys(prev).length > 0 ? prev : guestDraft.lineup));
          toast.success(
            `Imported ${guestDraft.count} pick${guestDraft.count === 1 ? '' : 's'} from your demo draft!`
          );
        }
      } else {
        console.error(`[Onboarding] dci-data/${season.seasonUid} not found or empty`);
        setDataStatus('error');
      }
    } catch (error) {
      console.error('Error fetching season data:', error);
      setDataStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchSeasonData();
  }, [fetchSeasonData]);

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

  const handleNext = () => {
    if (step === 1) {
      if (!formData.displayName.trim()) {
        toast.error('Please enter your director name');
        return;
      }
      if (!formData.username.trim()) {
        toast.error('Please choose a username');
        return;
      }
      if (usernameStatus.valid !== true) {
        toast.error('Please choose a valid, available username');
        return;
      }
    }
    if (step === 2 && !formData.corpsName.trim()) {
      toast.error('Please enter a name for your corps');
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
    if (!isLineupValid) {
      toast.error('Please complete your lineup within the point budget');
      return;
    }

    // Final username validation before submit
    if (usernameStatus.valid !== true) {
      toast.error('Please choose a valid, available username');
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
      });

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
            showConcept: 'Untitled Show',
            class: 'soundSport',
            createdAt: new Date(),
            seasonId: seasonData?.seasonUid || null,
            lineup: lineup,
            execution: {
              readiness: 0.75,
              morale: 0.85,
              equipment: {
                instruments: 0.9,
                uniforms: 0.9,
                props: 0.85,
              },
            },
          },
        },
        dailyOps: {},
        lastRehearsal: null,
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

      // The guest-preview draft has served its purpose — clean up so a future
      // signed-out visit starts fresh.
      clearGuestPreviewData();

      // Show celebration before navigating
      setShowCelebration(true);
    } catch (error) {
      console.error('Error creating profile:', error);
      if (error?.code === 'functions/already-exists') {
        // Username was claimed between the availability check and submit.
        toast.error('That username was just taken. Please choose another.');
        setUsernameStatus({
          checking: false,
          valid: false,
          message: 'This username is already taken',
        });
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
    toast.success("Welcome to marching.art! Here's 100 CorpsCoin to get started!");
    startTransition(() => {
      navigate('/dashboard');
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-6 sm:p-8">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {STEPS.map((s, idx) => (
                  <React.Fragment key={s.number}>
                    <div className={`flex items-center gap-2 ${idx > 0 ? 'flex-1' : ''}`}>
                      {idx > 0 && (
                        <div
                          className={`flex-1 h-1 mx-2 rounded-full ${
                            step > idx ? 'bg-[#0057B8]' : 'bg-charcoal-700'
                          }`}
                        />
                      )}
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                          step === s.number
                            ? 'bg-[#0057B8] text-white'
                            : step > s.number
                              ? 'bg-green-500 text-white'
                              : 'bg-charcoal-700 text-gray-400'
                        }`}
                      >
                        {step > s.number ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <s.icon className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                {STEPS.map((s) => (
                  <span
                    key={s.number}
                    className={step === s.number ? 'text-[#0057B8] font-semibold' : ''}
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[380px]">
              <AnimatePresence mode="wait">
                {/* Step 1: Welcome + Director Name */}
                {step === 1 && (
                  <m.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0057B8]/20 rounded-sm mb-4">
                        <Star className="w-8 h-8 text-[#0057B8]" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Welcome to marching.art!
                      </h2>
                      <p className="text-gray-400 text-sm">Fantasy drum corps gaming</p>
                    </div>

                    <div className="space-y-2">
                      {GAME_FEATURES.map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-sm bg-charcoal-800/50"
                          >
                            <div className="p-2 rounded-sm bg-[#0057B8]/20 flex-shrink-0">
                              <Icon className="w-4 h-4 text-[#0057B8]" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
                              <p className="text-xs text-gray-500">{feature.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 space-y-4">
                      <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          <User className="w-4 h-4 text-[#0057B8]" />
                          What's your name, Director?
                        </label>
                        <input
                          type="text"
                          className="w-full h-12 px-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                          name="name"
                          autoComplete="name"
                          placeholder="e.g., George Zingali"
                          value={formData.displayName}
                          onChange={(e) =>
                            setFormData({ ...formData, displayName: e.target.value })
                          }
                          maxLength={50}
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          <AtSign className="w-4 h-4 text-[#0057B8]" />
                          Choose a username
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            className={`w-full h-12 px-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] pr-10 ${
                              usernameStatus.valid === true
                                ? 'border-green-500/50 focus:border-green-500'
                                : usernameStatus.valid === false
                                  ? 'border-red-500/50 focus:border-red-500'
                                  : ''
                            }`}
                            name="username"
                            autoComplete="username"
                            placeholder="e.g., drumcorps_fan"
                            value={formData.username}
                            onChange={handleUsernameChange}
                            maxLength={15}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {usernameStatus.checking && (
                              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            )}
                            {!usernameStatus.checking && usernameStatus.valid === true && (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            )}
                            {!usernameStatus.checking && usernameStatus.valid === false && (
                              <XCircle className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                        </div>
                        {usernameStatus.message && (
                          <p
                            className={`text-xs mt-1 ${
                              usernameStatus.valid === true
                                ? 'text-green-400'
                                : usernameStatus.valid === false
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                            }`}
                          >
                            {usernameStatus.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          3-15 characters, letters, numbers, and underscores only
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-sm bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-green-400" />
                        <p className="text-sm text-green-300">
                          You'll get <span className="font-bold">100 CorpsCoin</span> to start!
                        </p>
                      </div>
                    </div>
                  </m.div>
                )}

                {/* Step 2: Create Corps */}
                {step === 2 && (
                  <m.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0057B8]/20 rounded-sm mb-4">
                        <Flag className="w-8 h-8 text-[#0057B8]" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">Create Your Corps</h2>
                      <p className="text-gray-400 text-sm">Name your first fantasy drum corps</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Corps Name *
                      </label>
                      <input
                        type="text"
                        className="w-full h-12 px-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                        name="corpsName"
                        autoComplete="off"
                        placeholder="e.g., The Cavaliers"
                        value={formData.corpsName}
                        onChange={(e) => setFormData({ ...formData, corpsName: e.target.value })}
                        maxLength={50}
                        autoFocus
                      />
                    </div>

                    <div className="p-4 rounded-sm bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-sm bg-green-500/20">
                          <Sparkles className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-300">Starting in SoundSport</h4>
                          <p className="text-xs text-green-400/80">
                            Earn CorpsCoin to unlock higher competition classes!
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-charcoal-800/50 rounded-sm">
                      <h4 className="font-semibold text-gray-200 mb-2">Next: Build Your Lineup</h4>
                      <p className="text-xs text-gray-500">
                        You'll pick historical corps performances to compete in 8 scoring captions.
                        Think of it like a fantasy football draft!
                      </p>
                    </div>
                  </m.div>
                )}

                {/* Step 3: Build Lineup (Guided Caption Selection) */}
                {step === 3 && (
                  <m.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="text-center mb-2">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0057B8]/20 rounded-sm mb-3">
                        <Music className="w-7 h-7 text-[#0057B8]" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-1">Build Your Lineup</h2>
                      <p className="text-gray-400 text-xs">
                        Draft a corps for each caption • Budget: {SOUNDSPORT_POINT_LIMIT} points
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
                    ) : dataStatus === 'error' ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 mb-3">
                          <XCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <p className="text-white text-sm font-semibold mb-1">
                          Couldn't load the corps list
                        </p>
                        <p className="text-gray-500 text-xs mb-4">
                          Check your connection and try again — your other answers are safe.
                        </p>
                        <button
                          onClick={fetchSeasonData}
                          className="h-10 px-5 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider rounded-sm hover:bg-[#0066d6]"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-pulse mb-4">
                          <div className="w-12 h-12 rounded-full bg-[#0057B8]/20 mx-auto" />
                        </div>
                        <p className="text-gray-400 text-sm">Loading available corps...</p>
                      </div>
                    )}

                    {/* Lineup summary */}
                    <div className="p-3 rounded-sm bg-charcoal-800/70 border border-charcoal-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Lineup Progress</span>
                        <span
                          className={`text-sm font-bold ${isLineupComplete ? 'text-green-400' : 'text-yellow-400'}`}
                        >
                          {Object.keys(lineup).length}/8 selected
                        </span>
                      </div>
                      <div className="h-2 bg-charcoal-900 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${isLineupValid ? 'bg-green-500' : 'bg-yellow-500'}`}
                          style={{ width: `${(Object.keys(lineup).length / 8) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        You can change this anytime from your dashboard
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
                  className="flex items-center gap-2 px-5 py-3 bg-[#2a2a2a] border border-[#333] text-white rounded-sm hover:bg-[#333] transition-colors font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              {step < STEPS.length ? (
                <button
                  onClick={handleNext}
                  disabled={
                    (step === 1 &&
                      (!formData.displayName.trim() ||
                        !formData.username.trim() ||
                        usernameStatus.valid !== true)) ||
                    (step === 2 && !formData.corpsName.trim())
                  }
                  className="flex-1 px-6 py-3 bg-[#0057B8] text-white rounded-sm hover:bg-[#0066d6] transition-colors font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !isLineupValid}
                  className="flex-1 px-6 py-3 bg-[#0057B8] text-white rounded-sm hover:bg-[#0066d6] transition-colors font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {step === 3 && !isLineupComplete && (
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
                className="w-full mt-3 text-gray-400 hover:text-gray-200 text-sm transition-colors"
                disabled={loading || availableCorps.length === 0}
              >
                Auto-fill remaining slots
              </button>
            )}
          </div>
        </m.div>
      </div>

      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebration && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={handleCelebrationComplete}
          >
            <m.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-center p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <m.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="inline-block mb-6"
              >
                <PartyPopper className="w-24 h-24 text-[#0057B8]" />
              </m.div>

              <m.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-black text-[#0057B8] mb-3"
              >
                YOU'RE ALL SET!
              </m.h2>

              <m.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-300 text-lg mb-2"
              >
                Welcome, {formData.displayName}!
              </m.p>

              <m.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-400 mb-8"
              >
                {formData.corpsName} is ready to compete
              </m.p>

              <m.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                onClick={handleCelebrationComplete}
                className="px-8 py-4 bg-[#0057B8] text-white rounded-sm font-bold uppercase tracking-wide hover:bg-[#0066d6] transition-colors flex items-center gap-2 mx-auto"
              >
                Go to Dashboard
                <ChevronRight className="w-5 h-5" />
              </m.button>

              {/* Confetti particles */}
              {[...Array(20)].map((_, i) => (
                <m.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: ['#FACC15', '#22C55E', '#3B82F6', '#A855F7', '#EF4444'][i % 5],
                    left: `${Math.random() * 100}%`,
                    top: '-20px',
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{
                    y: typeof window !== 'undefined' ? window.innerHeight + 100 : 800,
                    opacity: 0,
                    rotate: Math.random() * 720 - 360,
                    x: (Math.random() - 0.5) * 200,
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
