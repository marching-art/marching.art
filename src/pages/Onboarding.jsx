// src/pages/Onboarding.jsx
// Streamlined 3-step onboarding: Welcome+Name, Create Corps, Draft Lineup
import React, { useState, useEffect, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Flag, ArrowRight, Check, ArrowLeft,
  Trophy, Target, Users, Star, Zap, Music,
  ChevronRight, Sparkles, HelpCircle, PartyPopper, AtSign, Loader2, CheckCircle2, XCircle
} from 'lucide-react';
import { useAuth } from '../App';
import { db, functions } from '../firebase';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';

// Caption definitions for the guided selection
const CAPTIONS = [
  { id: 'GE1', name: 'GE1', fullName: 'General Effect 1', category: 'ge', description: 'Overall impact and artistry' },
  { id: 'GE2', name: 'GE2', fullName: 'General Effect 2', category: 'ge', description: 'Visual and musical excellence' },
  { id: 'VP', name: 'VP', fullName: 'Visual Proficiency', category: 'vis', description: 'Marching technique' },
  { id: 'VA', name: 'VA', fullName: 'Visual Analysis', category: 'vis', description: 'Design and composition' },
  { id: 'CG', name: 'CG', fullName: 'Color Guard', category: 'vis', description: 'Equipment work and artistry' },
  { id: 'B', name: 'B', fullName: 'Brass', category: 'mus', description: 'Horn line performance' },
  { id: 'MA', name: 'MA', fullName: 'Music Analysis', category: 'mus', description: 'Musical composition' },
  { id: 'P', name: 'P', fullName: 'Percussion', category: 'mus', description: 'Battery and front ensemble' },
];

const CATEGORY_COLORS = {
  ge: { bg: 'bg-gold-500/20', border: 'border-gold-500/30', text: 'text-gold-400', label: 'General Effect' },
  vis: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Visual' },
  mus: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', label: 'Music' },
};

// Point limit for SoundSport
const SOUNDSPORT_POINT_LIMIT = 90;

// Guided Caption Selection Component
const GuidedCaptionSelection = ({ availableCorps, lineup, setLineup, currentCaptionIndex, setCurrentCaptionIndex }) => {
  const currentCaption = CAPTIONS[currentCaptionIndex];
  const categoryInfo = CATEGORY_COLORS[currentCaption.category];

  // Calculate current points used
  const usedPoints = Object.values(lineup).reduce((sum, val) => {
    if (!val) return sum;
    const parts = val.split('|');
    return sum + (parseInt(parts[2]) || 0);
  }, 0);

  const remainingPoints = SOUNDSPORT_POINT_LIMIT - usedPoints;

  // Get corps for selection, sorted by points
  const sortedCorps = [...availableCorps].sort((a, b) => b.points - a.points);

  // Check if a corps is already selected in another caption
  const isCorpsUsed = (corpsName) => {
    return Object.values(lineup).some(val => val && val.startsWith(corpsName + '|'));
  };

  const handleSelect = (corps) => {
    const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
    setLineup(prev => ({ ...prev, [currentCaption.id]: value }));

    // Auto-advance to next caption
    if (currentCaptionIndex < CAPTIONS.length - 1) {
      setTimeout(() => setCurrentCaptionIndex(prev => prev + 1), 300);
    }
  };

  const handleDeselect = () => {
    setLineup(prev => {
      const newLineup = { ...prev };
      delete newLineup[currentCaption.id];
      return newLineup;
    });
  };

  const selectedValue = lineup[currentCaption.id];
  const selectedCorps = selectedValue ? {
    name: selectedValue.split('|')[0],
    year: selectedValue.split('|')[1],
    points: parseInt(selectedValue.split('|')[2]) || 0
  } : null;

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-cream-400">Caption {currentCaptionIndex + 1} of 8</span>
        <span className={`text-sm font-bold ${remainingPoints < 10 ? 'text-yellow-400' : 'text-green-400'}`}>
          {remainingPoints} pts remaining
        </span>
      </div>

      {/* Caption dots */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {CAPTIONS.map((cap, idx) => {
          const isSelected = lineup[cap.id];
          const isCurrent = idx === currentCaptionIndex;
          const catColors = CATEGORY_COLORS[cap.category];

          return (
            <button
              key={cap.id}
              onClick={() => setCurrentCaptionIndex(idx)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                isCurrent
                  ? `${catColors.bg} ${catColors.border} border-2 ${catColors.text}`
                  : isSelected
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-charcoal-800 border border-charcoal-700 text-cream-500'
              }`}
            >
              {isSelected && !isCurrent ? <Check className="w-4 h-4" /> : cap.id}
            </button>
          );
        })}
      </div>

      {/* Current caption info */}
      <div className={`p-4 rounded-xl ${categoryInfo.bg} ${categoryInfo.border} border`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryInfo.bg}`}>
            <span className={`font-bold ${categoryInfo.text}`}>{currentCaption.id}</span>
          </div>
          <div>
            <h4 className={`font-bold ${categoryInfo.text}`}>{currentCaption.fullName}</h4>
            <p className="text-xs text-cream-400">{currentCaption.description}</p>
          </div>
        </div>

        {selectedCorps && (
          <div className="mt-3 flex items-center justify-between p-2 bg-charcoal-900/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-cream-100 font-semibold">{selectedCorps.name}</span>
              <span className="text-xs text-cream-500">'{selectedCorps.year?.slice(-2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gold-400">{selectedCorps.points} pts</span>
              <button
                onClick={handleDeselect}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Corps selection grid */}
      {!selectedCorps && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sortedCorps.map((corps, idx) => {
            const isUsed = isCorpsUsed(corps.corpsName);
            const wouldExceedBudget = corps.points > remainingPoints;
            const disabled = isUsed || wouldExceedBudget;

            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => !disabled && handleSelect(corps)}
                disabled={disabled}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                  disabled
                    ? 'bg-charcoal-900/30 border border-charcoal-800 opacity-50 cursor-not-allowed'
                    : `bg-charcoal-800 border border-charcoal-700 hover:border-gold-500/50 cursor-pointer`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-cream-100 text-sm">{corps.corpsName}</span>
                  <span className="text-xs text-cream-500">'{corps.sourceYear?.slice(-2)}</span>
                  {isUsed && <span className="text-xs text-cream-500/60">(already used)</span>}
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${
                  wouldExceedBudget ? 'bg-red-500/20 text-red-400' : 'bg-gold-500/20 text-gold-400'
                }`}>
                  {corps.points} pts
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Hint text */}
      <p className="text-xs text-cream-500 text-center">
        <HelpCircle className="w-3 h-3 inline mr-1" />
        Pick the historical corps you think will score best in this caption
      </p>
    </div>
  );
};

const Onboarding = () => {
  useBodyScroll();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    corpsName: '',
  });
  const [loading, setLoading] = useState(false);
  const [availableCorps, setAvailableCorps] = useState([]);
  const [lineup, setLineup] = useState({});
  const [currentCaptionIndex, setCurrentCaptionIndex] = useState(0);
  const [seasonData, setSeasonData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, valid: null, message: '' });
  const usernameCheckTimeout = React.useRef(null);

  // Global stores for schedule data
  const globalCurrentWeek = useSeasonStore((state) => state.currentWeek);
  const getWeekShows = useScheduleStore((state) => state.getWeekShows);

  // Fetch season data and available corps on mount
  useEffect(() => {
    const fetchSeasonData = async () => {
      try {
        // Get current season
        const currentSeasonRef = doc(db, 'system', 'currentSeason');
        const currentSeasonSnap = await getDoc(currentSeasonRef);

        if (currentSeasonSnap.exists()) {
          const seasonId = currentSeasonSnap.data().seasonId;

          // Get season document
          const seasonRef = doc(db, 'seasons', seasonId);
          const seasonSnap = await getDoc(seasonRef);

          if (seasonSnap.exists()) {
            setSeasonData({ ...seasonSnap.data(), seasonUid: seasonId });

            // Get corps values for lineup selection
            const corpsDataRef = doc(db, 'dci-data', seasonId);
            const corpsDataSnap = await getDoc(corpsDataRef);

            if (corpsDataSnap.exists()) {
              const data = corpsDataSnap.data();
              setAvailableCorps(data.corpsValues || []);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching season data:', error);
      }
    };

    fetchSeasonData();
  }, []);

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
      setUsernameStatus({ checking: false, valid: false, message: 'Username must be at least 3 characters' });
      return;
    }
    if (username.length > 15) {
      setUsernameStatus({ checking: false, valid: false, message: 'Username must be 15 characters or less' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus({ checking: false, valid: false, message: 'Only letters, numbers, and underscores allowed' });
      return;
    }

    // Show checking state
    setUsernameStatus({ checking: true, valid: null, message: 'Checking availability...' });

    // Debounce the server check
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const checkUsername = httpsCallable(functions, 'checkUsername');
        await checkUsername({ username });
        setUsernameStatus({ checking: false, valid: true, message: 'Username is available!' });
      } catch (error) {
        if (error.code === 'functions/already-exists') {
          setUsernameStatus({ checking: false, valid: false, message: 'This username is already taken' });
        } else if (error.code === 'functions/invalid-argument') {
          setUsernameStatus({ checking: false, valid: false, message: error.message });
        } else {
          setUsernameStatus({ checking: false, valid: false, message: 'Could not verify username' });
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
      const profileRef = doc(db, `artifacts/marching-art/users/${user.uid}/profile/data`);
      const usernameRef = doc(db, `usernames/${formData.username.toLowerCase()}`);

      const profileData = {
        uid: user.uid,
        email: user.email,
        username: formData.username.trim().toLowerCase(),
        displayName: formData.displayName.trim(),
        location: '', // Can add later in profile
        bio: '',
        favoriteCorps: '',
        createdAt: new Date(),
        xp: 0,
        xpLevel: 1,
        corpsCoin: 100, // Starting bonus!
        unlockedClasses: ['soundSport'],
        staff: [],
        achievements: [],
        stats: {
          seasonsPlayed: 0,
          championships: 0,
          topTenFinishes: 0
        },
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
                instruments: 0.90,
                uniforms: 0.90,
                props: 0.85
              }
            }
          }
        },
        engagement: {
          loginStreak: 1,
          lastLogin: new Date().toISOString(),
          totalLogins: 1,
          recentActivity: [{
            type: 'welcome',
            message: 'Welcome to marching.art!',
            timestamp: new Date().toISOString(),
            icon: 'star'
          }]
        },
        dailyOps: {},
        lastRehearsal: null,
        // Mark as first visit for dashboard tooltips
        isFirstVisit: true,
        onboardingCompletedAt: new Date().toISOString()
      };

      await setDoc(profileRef, profileData);

      // Reserve username in usernames collection
      await setDoc(usernameRef, { uid: user.uid });

      // Auto-register for current week's shows
      try {
        await autoRegisterForShows(seasonData, 'soundSport');
      } catch (regError) {
        console.warn('Could not auto-register for shows:', regError);
        // Non-blocking - continue even if this fails
      }

      // Show celebration before navigating
      setShowCelebration(true);

    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile. Please try again.');
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
      const currentWeekShows = weekShows.map(show => ({
        eventName: show.eventName,
        date: show.date,
        location: show.location,
        day: show.day
      }));

      // Register for up to 4 shows
      if (currentWeekShows.length > 0) {
        const showsToRegister = currentWeekShows.slice(0, 4);

        const selectUserShows = httpsCallable(functions, 'selectUserShows');
        await selectUserShows({
          week: currentWeek,
          shows: showsToRegister,
          corpsClass: corpsClass
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

  const steps = [
    { number: 1, title: 'Welcome', icon: Star },
    { number: 2, title: 'Create Corps', icon: Flag },
    { number: 3, title: 'Build Lineup', icon: Music }
  ];

  // Game features for the welcome step
  const gameFeatures = [
    {
      icon: Target,
      title: 'Draft Your Lineup',
      description: 'Pick historical corps performances for each scoring caption'
    },
    {
      icon: Users,
      title: 'Compete in Leagues',
      description: 'Join leagues with friends and compete for bragging rights'
    },
    {
      icon: Trophy,
      title: 'Climb the Ranks',
      description: 'Earn points based on real DCI scores and top the leaderboards'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-cream-500/10 rounded-full blur-3xl animate-float"
             style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-dark rounded-2xl p-8">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {steps.map((s, idx) => (
                  <React.Fragment key={s.number}>
                    <div className={`flex items-center gap-2 ${idx > 0 ? 'flex-1' : ''}`}>
                      {idx > 0 && (
                        <div className={`flex-1 h-1 mx-2 rounded-full ${
                          step > idx ? 'bg-gold-500' : 'bg-charcoal-700'
                        }`} />
                      )}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                        step === s.number
                          ? 'bg-gold-500 text-charcoal-900'
                          : step > s.number
                          ? 'bg-green-500 text-white'
                          : 'bg-charcoal-700 text-cream-400'
                      }`}>
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
              <div className="flex justify-between text-xs text-cream-500">
                {steps.map((s) => (
                  <span key={s.number} className={step === s.number ? 'text-gold-400 font-semibold' : ''}>
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
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500/20 rounded-2xl mb-4">
                        <Star className="w-8 h-8 text-gold-400" />
                      </div>
                      <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                        Welcome to marching.art!
                      </h2>
                      <p className="text-cream-400 text-sm">
                        Fantasy drum corps gaming
                      </p>
                    </div>

                    <div className="space-y-2">
                      {gameFeatures.map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-lg bg-charcoal-800/50"
                          >
                            <div className="p-2 rounded-lg bg-gold-500/20 flex-shrink-0">
                              <Icon className="w-4 h-4 text-gold-400" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-cream-100">{feature.title}</h4>
                              <p className="text-xs text-cream-500">{feature.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 space-y-4">
                      <div>
                        <label className="label flex items-center gap-2">
                          <User className="w-4 h-4 text-gold-400" />
                          What's your name, Director?
                        </label>
                        <input
                          type="text"
                          className="input text-lg"
                          placeholder="e.g., George Zingali"
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                          maxLength={50}
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="label flex items-center gap-2">
                          <AtSign className="w-4 h-4 text-gold-400" />
                          Choose a username
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            className={`input text-lg pr-10 ${
                              usernameStatus.valid === true ? 'border-green-500/50 focus:border-green-500' :
                              usernameStatus.valid === false ? 'border-red-500/50 focus:border-red-500' : ''
                            }`}
                            placeholder="e.g., drumcorps_fan"
                            value={formData.username}
                            onChange={handleUsernameChange}
                            maxLength={15}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {usernameStatus.checking && (
                              <Loader2 className="w-5 h-5 text-cream-400 animate-spin" />
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
                          <p className={`text-xs mt-1 ${
                            usernameStatus.valid === true ? 'text-green-400' :
                            usernameStatus.valid === false ? 'text-red-400' : 'text-cream-400'
                          }`}>
                            {usernameStatus.message}
                          </p>
                        )}
                        <p className="text-xs text-cream-500 mt-1">
                          3-15 characters, letters, numbers, and underscores only
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-green-400" />
                        <p className="text-sm text-green-300">
                          You'll get <span className="font-bold">100 CorpsCoin</span> to start!
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Create Corps */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500/20 rounded-2xl mb-4">
                        <Flag className="w-8 h-8 text-gold-400" />
                      </div>
                      <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                        Create Your Corps
                      </h2>
                      <p className="text-cream-400 text-sm">
                        Name your first fantasy drum corps
                      </p>
                    </div>

                    <div>
                      <label className="label">Corps Name *</label>
                      <input
                        type="text"
                        className="input text-lg"
                        placeholder="e.g., The Cavaliers"
                        value={formData.corpsName}
                        onChange={(e) => setFormData({ ...formData, corpsName: e.target.value })}
                        maxLength={50}
                        autoFocus
                      />
                    </div>

                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
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

                    <div className="p-4 bg-charcoal-800/50 rounded-lg">
                      <h4 className="font-semibold text-cream-200 mb-2">Next: Build Your Lineup</h4>
                      <p className="text-xs text-cream-500">
                        You'll pick historical corps performances to compete in 8 scoring captions.
                        Think of it like a fantasy football draft!
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Build Lineup (Guided Caption Selection) */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="text-center mb-2">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500/20 rounded-2xl mb-3">
                        <Music className="w-7 h-7 text-gold-400" />
                      </div>
                      <h2 className="text-xl font-display font-bold text-cream-100 mb-1">
                        Build Your Lineup
                      </h2>
                      <p className="text-cream-400 text-xs">
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
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-pulse mb-4">
                          <div className="w-12 h-12 rounded-full bg-gold-500/20 mx-auto" />
                        </div>
                        <p className="text-cream-400 text-sm">Loading available corps...</p>
                      </div>
                    )}

                    {/* Lineup summary */}
                    <div className="p-3 rounded-lg bg-charcoal-800/70 border border-charcoal-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-cream-400">Lineup Progress</span>
                        <span className={`text-sm font-bold ${isLineupComplete ? 'text-green-400' : 'text-gold-400'}`}>
                          {Object.keys(lineup).length}/8 selected
                        </span>
                      </div>
                      <div className="h-2 bg-charcoal-900 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${isLineupValid ? 'bg-green-500' : 'bg-gold-500'}`}
                          style={{ width: `${(Object.keys(lineup).length / 8) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-cream-500 mt-2 text-center">
                        You can change this anytime from your dashboard
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-6">
              {step > 1 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-3 bg-charcoal-700 text-cream-100 rounded-lg hover:bg-charcoal-600 transition-colors font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              {step < steps.length ? (
                <button
                  onClick={handleNext}
                  disabled={
                    (step === 1 && (!formData.displayName.trim() || !formData.username.trim() || usernameStatus.valid !== true)) ||
                    (step === 2 && !formData.corpsName.trim())
                  }
                  className="flex-1 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !isLineupValid}
                  className="flex-1 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
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
                  // Fill remaining slots with random selections
                  const remaining = CAPTIONS.filter(cap => !lineup[cap.id]);
                  const usedCorps = new Set(Object.values(lineup).map(v => v?.split('|')[0]).filter(Boolean));
                  let currentPoints = getLineupPoints();

                  const newLineup = { ...lineup };
                  for (const cap of remaining) {
                    const available = availableCorps
                      .filter(c => !usedCorps.has(c.corpsName) && (currentPoints + c.points <= SOUNDSPORT_POINT_LIMIT))
                      .sort((a, b) => b.points - a.points);

                    if (available.length > 0) {
                      const corps = available[0];
                      newLineup[cap.id] = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                      usedCorps.add(corps.corpsName);
                      currentPoints += corps.points;
                    }
                  }
                  setLineup(newLineup);
                  toast.success('Auto-filled remaining lineup slots!');
                }}
                className="w-full mt-3 text-cream-400 hover:text-cream-200 text-sm transition-colors"
                disabled={loading}
              >
                Auto-fill remaining slots
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={handleCelebrationComplete}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-center p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="inline-block mb-6"
              >
                <PartyPopper className="w-24 h-24 text-gold-400" />
              </motion.div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-display font-black text-gold-400 mb-3"
              >
                YOU'RE ALL SET!
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-cream-300 text-lg mb-2"
              >
                Welcome, {formData.displayName}!
              </motion.p>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-cream-400 mb-8"
              >
                {formData.corpsName} is ready to compete
              </motion.p>

              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                onClick={handleCelebrationComplete}
                className="px-8 py-4 bg-gold-500 text-charcoal-900 rounded-xl font-display font-bold uppercase tracking-wide hover:bg-gold-400 transition-colors flex items-center gap-2 mx-auto"
              >
                Go to Dashboard
                <ChevronRight className="w-5 h-5" />
              </motion.button>

              {/* Confetti particles */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: ['#FACC15', '#22C55E', '#3B82F6', '#A855F7', '#EF4444'][i % 5],
                    left: `${Math.random() * 100}%`,
                    top: '-20px'
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{
                    y: typeof window !== 'undefined' ? window.innerHeight + 100 : 800,
                    opacity: 0,
                    rotate: Math.random() * 720 - 360,
                    x: (Math.random() - 0.5) * 200
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    ease: "easeOut"
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
