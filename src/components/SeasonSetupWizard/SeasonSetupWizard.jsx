import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ChevronRight, ChevronLeft, Check, Star, Trophy,
  Music, Calendar, Target, Zap, Crown, PartyPopper, Rocket,
  TrendingUp, TrendingDown, Minus, AlertCircle, Info, Flame, Snowflake
} from 'lucide-react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';

// Trend badge component
const TrendBadge = ({ trend, momentum }) => {
  if (!trend) return null;
  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />;
      default: return <Minus className="w-3 h-3 text-cream-500/60" />;
    }
  };
  return (
    <div className="flex items-center gap-0.5">
      {getTrendIcon()}
      {momentum?.status === 'hot' && <Flame className="w-3 h-3 text-orange-500" />}
      {momentum?.status === 'cold' && <Snowflake className="w-3 h-3 text-blue-400" />}
    </div>
  );
};

const SeasonSetupWizard = ({
  onComplete,
  profile,
  seasonData,
  corpsNeedingSetup // Array of corps class names that need lineup setup
}) => {
  const [step, setStep] = useState('welcome'); // welcome, corps-setup, shows, complete
  const [currentCorpsIndex, setCurrentCorpsIndex] = useState(0);
  const [setupProgress, setSetupProgress] = useState({});
  const [loading, setLoading] = useState(false);

  // Caption selection state
  const [selections, setSelections] = useState({});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loadingCorps, setLoadingCorps] = useState(true);
  const [saving, setSaving] = useState(false);

  // Show selection state
  const [availableShows, setAvailableShows] = useState([]);
  const [selectedShows, setSelectedShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);

  const currentCorpsClass = corpsNeedingSetup[currentCorpsIndex];
  const totalCorps = corpsNeedingSetup.length;
  const currentWeek = 1; // Always start with week 1 for new season

  // Caption definitions
  const captions = [
    { id: 'GE1', name: 'General Effect 1', category: 'General Effect', color: 'gold', description: 'Overall impact and artistry' },
    { id: 'GE2', name: 'General Effect 2', category: 'General Effect', color: 'gold', description: 'Visual and musical excellence' },
    { id: 'VP', name: 'Visual Proficiency', category: 'Visual', color: 'blue', description: 'Marching technique and execution' },
    { id: 'VA', name: 'Visual Analysis', category: 'Visual', color: 'blue', description: 'Design and composition' },
    { id: 'CG', name: 'Color Guard', category: 'Visual', color: 'blue', description: 'Equipment work and artistry' },
    { id: 'B', name: 'Brass', category: 'Music', color: 'purple', description: 'Horn line performance' },
    { id: 'MA', name: 'Music Analysis', category: 'Music', color: 'purple', description: 'Musical composition and design' },
    { id: 'P', name: 'Percussion', category: 'Music', color: 'purple', description: 'Battery and front ensemble' }
  ];

  // Point limits by class
  const pointLimits = {
    soundSport: 90,
    aClass: 60,
    openClass: 120,
    worldClass: 150
  };

  // Class name map
  const classNameMap = {
    soundSport: 'SoundSport',
    aClass: 'A Class',
    openClass: 'Open Class',
    worldClass: 'World Class'
  };

  const getCorpsClassName = (classId) => classNameMap[classId] || classId;

  const pointLimit = pointLimits[currentCorpsClass] || 90;

  // Calculate points
  const calculateTotalPoints = () => {
    return Object.values(selections).reduce((total, selection) => {
      if (!selection) return total;
      const parts = selection.split('|');
      return total + (parseInt(parts[2]) || 0);
    }, 0);
  };

  const totalPoints = calculateTotalPoints();
  const remainingPoints = pointLimit - totalPoints;
  const isOverLimit = totalPoints > pointLimit;
  const isLineupComplete = Object.keys(selections).length === 8;

  // Get corps data for current class
  const currentCorpsData = profile?.corps?.[currentCorpsClass];

  // Fetch available corps for lineup
  useEffect(() => {
    if (step === 'corps-setup' && seasonData?.seasonUid) {
      fetchAvailableCorps();
    }
  }, [step, seasonData?.seasonUid, currentCorpsClass]);

  // Fetch shows when on shows step
  useEffect(() => {
    if (step === 'shows' && seasonData) {
      fetchAvailableShows();
    }
  }, [step, seasonData]);

  const fetchAvailableCorps = async () => {
    try {
      setLoadingCorps(true);
      const corpsDataRef = doc(db, 'dci-data', seasonData.seasonUid);
      const corpsDataSnap = await getDoc(corpsDataRef);

      if (corpsDataSnap.exists()) {
        const data = corpsDataSnap.data();
        const corps = data.corpsValues || [];
        corps.sort((a, b) => b.points - a.points);
        setAvailableCorps(corps);
      }
    } catch (error) {
      console.error('Error fetching corps:', error);
      toast.error('Failed to load corps data');
    } finally {
      setLoadingCorps(false);
    }
  };

  const fetchAvailableShows = async () => {
    try {
      setLoadingShows(true);
      const seasonRef = doc(db, 'game-settings/season');
      const seasonSnap = await getDoc(seasonRef);

      if (seasonSnap.exists()) {
        const data = seasonSnap.data();
        const events = data.events || [];

        // Get week 1 shows (days 1-7)
        const weekShows = [];
        events.forEach(dayEvent => {
          const day = dayEvent.offSeasonDay || dayEvent.day || 0;
          if (day >= 1 && day <= 7 && dayEvent.shows) {
            dayEvent.shows.forEach(show => {
              weekShows.push({
                ...show,
                day: day
              });
            });
          }
        });
        setAvailableShows(weekShows);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    } finally {
      setLoadingShows(false);
    }
  };

  const handleSelectionChange = (captionId, corpsData) => {
    if (!corpsData) {
      const newSelections = { ...selections };
      delete newSelections[captionId];
      setSelections(newSelections);
    } else {
      setSelections({
        ...selections,
        [captionId]: `${corpsData.corpsName}|${corpsData.sourceYear}|${corpsData.points}`
      });
    }
  };

  const getSelectedCorps = (captionId) => {
    const selection = selections[captionId];
    if (!selection) return null;
    const parts = selection.split('|');
    return { name: parts[0], year: parts[1], points: parseInt(parts[2]) || 0 };
  };

  const toggleShow = (show) => {
    const showIdentifier = {
      eventName: show.eventName || show.name,
      date: show.date,
      location: show.location,
      day: show.day
    };

    const isSelected = selectedShows.some(
      s => s.eventName === showIdentifier.eventName && s.date === showIdentifier.date
    );

    if (isSelected) {
      setSelectedShows(selectedShows.filter(
        s => !(s.eventName === showIdentifier.eventName && s.date === showIdentifier.date)
      ));
    } else if (selectedShows.length < 4) {
      setSelectedShows([...selectedShows, showIdentifier]);
    } else {
      toast.error('You can only select up to 4 shows per week');
    }
  };

  const saveLineupAndContinue = async () => {
    if (!isLineupComplete || isOverLimit) return;

    try {
      setSaving(true);
      const saveLineup = httpsCallable(functions, 'saveLineup');
      await saveLineup({
        lineup: selections,
        corpsClass: currentCorpsClass
      });

      // Mark this corps as setup
      setSetupProgress({
        ...setupProgress,
        [currentCorpsClass]: { lineup: selections }
      });

      toast.success(`${getCorpsClassName(currentCorpsClass)} lineup saved!`);

      // Move to show selection
      setStep('shows');
      setSelections({});
    } catch (error) {
      console.error('Error saving lineup:', error);
      toast.error(error.message || 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  const saveShowsAndContinue = async () => {
    if (selectedShows.length === 0) {
      toast.error('Please select at least one show');
      return;
    }

    try {
      setSaving(true);

      // Map class names for backend
      const backendClassMap = {
        soundSport: 'soundSport',
        aClass: 'aClass',
        openClass: 'openClass',
        worldClass: 'worldClass'
      };

      const selectUserShows = httpsCallable(functions, 'selectUserShows');
      await selectUserShows({
        week: currentWeek,
        shows: selectedShows,
        corpsClass: backendClassMap[currentCorpsClass] || currentCorpsClass
      });

      toast.success(`Week 1 shows selected for ${getCorpsClassName(currentCorpsClass)}!`);

      // Check if more corps need setup
      if (currentCorpsIndex < totalCorps - 1) {
        // Move to next corps
        setCurrentCorpsIndex(currentCorpsIndex + 1);
        setStep('corps-setup');
        setSelectedShows([]);
      } else {
        // All done!
        setStep('complete');
      }
    } catch (error) {
      console.error('Error saving shows:', error);
      toast.error(error.message || 'Failed to save show selections');
    } finally {
      setSaving(false);
    }
  };

  const formatSeasonName = (name) => {
    if (!name) return 'New Season';
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Render welcome screen
  const renderWelcome = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center max-w-2xl mx-auto px-2"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gradient-gold rounded-full flex items-center justify-center"
      >
        <Rocket className="w-8 h-8 md:w-12 md:h-12 text-charcoal-900" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-gradient mb-2 md:mb-4"
      >
        Welcome to {formatSeasonName(seasonData?.name)}!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base md:text-xl text-cream-300 mb-6 md:mb-8"
      >
        A new season means fresh opportunities for glory!
        Let's get your corps ready to compete.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 md:mb-8"
      >
        <div className="glass rounded-xl p-3 md:p-4">
          <Star className="w-6 h-6 md:w-8 md:h-8 text-gold-500 mx-auto mb-1 md:mb-2" />
          <h3 className="font-semibold text-cream-100 text-sm md:text-base">Build Your Lineup</h3>
          <p className="text-xs md:text-sm text-cream-500/60">Select DCI corps for each caption</p>
        </div>
        <div className="glass rounded-xl p-3 md:p-4">
          <Calendar className="w-6 h-6 md:w-8 md:h-8 text-blue-500 mx-auto mb-1 md:mb-2" />
          <h3 className="font-semibold text-cream-100 text-sm md:text-base">Pick Your Shows</h3>
          <p className="text-xs md:text-sm text-cream-500/60">Choose events to compete in</p>
        </div>
        <div className="glass rounded-xl p-3 md:p-4">
          <Trophy className="w-6 h-6 md:w-8 md:h-8 text-purple-500 mx-auto mb-1 md:mb-2" />
          <h3 className="font-semibold text-cream-100 text-sm md:text-base">Chase Glory</h3>
          <p className="text-xs md:text-sm text-cream-500/60">Climb the leaderboards</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-charcoal-900/50 rounded-xl p-3 md:p-4 mb-6 md:mb-8"
      >
        <h3 className="font-semibold text-cream-100 mb-2 text-sm md:text-base">
          {totalCorps} Corps to Set Up
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {corpsNeedingSetup.map((classId) => (
            <span key={classId} className="badge badge-ghost text-xs md:text-sm">
              {getCorpsClassName(classId)}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        onClick={() => setStep('corps-setup')}
        className="btn-primary text-sm md:text-lg px-6 md:px-8 py-3 md:py-4 w-full sm:w-auto"
      >
        <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2" />
        Let's Get Started
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
      </motion.button>
    </motion.div>
  );

  // Render corps setup (lineup selection)
  const renderCorpsSetup = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-5xl mx-auto px-2"
    >
      {/* Progress indicator */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs md:text-sm text-cream-500/60">
            Corps {currentCorpsIndex + 1} of {totalCorps}
          </span>
          <span className="text-xs md:text-sm font-semibold text-gold-500">
            {getCorpsClassName(currentCorpsClass)}
          </span>
        </div>
        <div className="h-1.5 md:h-2 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentCorpsIndex + 0.5) / totalCorps) * 100}%` }}
            className="h-full bg-gradient-gold"
          />
        </div>
      </div>

      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-gradient mb-1 md:mb-2">
          Build Your {getCorpsClassName(currentCorpsClass)} Lineup
        </h2>
        <p className="text-sm md:text-base text-cream-300">
          Select one corps for each caption within your {pointLimit}-point budget.
        </p>
        {currentCorpsData && (
          <p className="text-xs md:text-sm text-cream-500/60 mt-1 truncate">
            Corps: {currentCorpsData.corpsName} from {currentCorpsData.location}
          </p>
        )}
      </div>

      {/* Point Budget */}
      <div className="mb-4 md:mb-6 p-3 md:p-4 bg-charcoal-900/50 rounded-xl border border-cream-500/10">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <div>
            <h3 className="text-sm md:text-lg font-semibold text-cream-100">Point Budget</h3>
            <p className="text-xs md:text-sm text-cream-500/60">{pointLimit} points available</p>
          </div>
          <div className={`text-xl md:text-3xl font-bold ${
            isOverLimit ? 'text-red-500' :
            remainingPoints < 10 ? 'text-yellow-500' :
            'text-gold-500'
          }`}>
            {totalPoints} / {pointLimit}
          </div>
        </div>
        <div className="h-2 md:h-3 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${Math.min((totalPoints / pointLimit) * 100, 100)}%` }}
            className={`h-full ${
              isOverLimit ? 'bg-red-500' :
              remainingPoints < 10 ? 'bg-yellow-500' :
              'bg-gradient-gold'
            }`}
          />
        </div>
        {isOverLimit && (
          <p className="mt-2 text-xs md:text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 md:w-4 md:h-4" />
            Over budget! Remove some high-point corps.
          </p>
        )}
      </div>

      {/* Caption Selection */}
      {loadingCorps ? (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-cream-500/60">Loading available corps...</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 relative">
          {['General Effect', 'Visual', 'Music'].map((category) => {
            const categoryCaptions = captions.filter(c => c.category === category);
            const categoryColor = category === 'General Effect' ? 'gold' : category === 'Visual' ? 'blue' : 'purple';

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-charcoal-900 z-10 py-2 -mx-2 px-2">
                  <div className={`w-1 h-5 rounded flex-shrink-0 ${
                    categoryColor === 'gold' ? 'bg-gold-500' :
                    categoryColor === 'blue' ? 'bg-blue-500' :
                    'bg-purple-500'
                  }`} />
                  <h3 className="font-semibold text-cream-100 text-sm">{category}</h3>
                </div>

                {categoryCaptions.map((caption) => {
                  const selected = getSelectedCorps(caption.id);

                  return (
                    <div
                      key={caption.id}
                      className={`p-3 rounded-lg border transition-all ${
                        selected
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-cream-500/10 bg-charcoal-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {selected ? (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-cream-500/30 flex-shrink-0" />
                          )}
                          <span className="font-medium text-cream-100 text-sm truncate">{caption.name}</span>
                          <span className="text-xs text-cream-500/60 flex-shrink-0">({caption.id})</span>
                        </div>
                        {selected && (
                          <span className="text-gold-500 font-bold text-sm flex-shrink-0">{selected.points} pts</span>
                        )}
                      </div>

                      <select
                        className="select w-full text-sm"
                        value={selections[caption.id] || ''}
                        onChange={(e) => {
                          if (!e.target.value) {
                            handleSelectionChange(caption.id, null);
                          } else {
                            const corps = availableCorps.find(c =>
                              `${c.corpsName}|${c.sourceYear}|${c.points}` === e.target.value
                            );
                            if (corps) handleSelectionChange(caption.id, corps);
                          }
                        }}
                      >
                        <option value="">Select {caption.name}...</option>
                        {availableCorps.map((corps, idx) => {
                          const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                          const isCurrentSelection = selections[caption.id] === value;
                          const wouldExceed = !isCurrentSelection &&
                            (totalPoints - (selected?.points || 0) + corps.points > pointLimit);

                          return (
                            <option key={idx} value={value} disabled={wouldExceed}>
                              {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                              {wouldExceed ? ' [Exceeds limit]' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 md:gap-3">
        <button
          onClick={() => setStep('welcome')}
          className="btn-ghost text-xs md:text-sm px-2 md:px-4"
        >
          <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Back
        </button>
        <button
          onClick={saveLineupAndContinue}
          disabled={!isLineupComplete || isOverLimit || saving}
          className="btn-primary flex-1 text-xs md:text-sm py-2 md:py-3"
        >
          {saving ? (
            <>
              <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
              Saving...
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Save Lineup & Select Shows</span>
              <span className="sm:hidden">Save & Continue</span>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );

  // Render show selection
  const renderShowSelection = () => {
    // Group shows by day
    const showsByDay = {};
    availableShows.forEach(show => {
      const day = show.day || 1;
      if (!showsByDay[day]) showsByDay[day] = [];
      showsByDay[day].push(show);
    });

    const availableDays = Object.keys(showsByDay).map(Number).sort((a, b) => a - b);
    const currentDayShows = showsByDay[selectedDay] || [];

    // Count selections per day
    const selectionsPerDay = {};
    selectedShows.forEach(show => {
      const day = show.day || 1;
      selectionsPerDay[day] = (selectionsPerDay[day] || 0) + 1;
    });

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="w-full max-w-4xl mx-auto px-2"
      >
        {/* Progress */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm text-cream-500/60">
              Corps {currentCorpsIndex + 1} of {totalCorps} - Shows
            </span>
            <span className="text-xs md:text-sm font-semibold text-gold-500">
              {getCorpsClassName(currentCorpsClass)}
            </span>
          </div>
          <div className="h-1.5 md:h-2 bg-charcoal-800 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${((currentCorpsIndex + 0.75) / totalCorps) * 100}%` }}
              className="h-full bg-gradient-gold"
            />
          </div>
        </div>

        {/* Header with selection count */}
        <div className="mb-4 md:mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-gradient mb-1">
              Select Week 1 Shows
            </h2>
            <p className="text-xs md:text-sm text-cream-300">
              Choose up to 4 shows for {getCorpsClassName(currentCorpsClass)}
            </p>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${
            selectedShows.length === 0 ? 'text-cream-500/40' :
            selectedShows.length >= 4 ? 'text-gold-500' :
            'text-blue-500'
          }`}>
            {selectedShows.length}/4
          </div>
        </div>

        {/* Day Navigation */}
        {!loadingShows && availableDays.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {availableDays.map(day => {
                const daySelections = selectionsPerDay[day] || 0;
                const isActive = selectedDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gold-500 text-charcoal-900'
                        : 'bg-charcoal-800 text-cream-300 hover:bg-charcoal-700'
                    }`}
                  >
                    Day {day}
                    {daySelections > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                        isActive ? 'bg-charcoal-900/30 text-charcoal-900' : 'bg-gold-500/20 text-gold-500'
                      }`}>
                        {daySelections}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Shows for selected day */}
        {loadingShows ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-3 border-gold-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-cream-500/60">Loading shows...</p>
          </div>
        ) : availableShows.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
            <p className="text-cream-500/60">No shows available for Week 1</p>
          </div>
        ) : currentDayShows.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-10 h-10 text-cream-500/40 mx-auto mb-2" />
            <p className="text-sm text-cream-500/60">No shows on Day {selectedDay}</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {currentDayShows.map((show, index) => {
              const isSelected = selectedShows.some(
                s => s.eventName === (show.eventName || show.name) && s.date === show.date
              );

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => toggleShow(show)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-cream-100 text-sm truncate">
                        {show.eventName || show.name}
                      </h4>
                      {show.location && (
                        <p className="text-xs text-cream-500/60 truncate">{show.location}</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500'
                        : 'border-cream-500/30'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-charcoal-900" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 md:gap-3">
          <button
            onClick={() => setStep('corps-setup')}
            className="btn-ghost text-xs md:text-sm px-2 md:px-4"
          >
            <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" />
            Back
          </button>
          <button
            onClick={saveShowsAndContinue}
            disabled={selectedShows.length === 0 || saving}
            className="btn-primary flex-1 text-xs md:text-sm py-2 md:py-3"
          >
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : currentCorpsIndex < totalCorps - 1 ? (
              <>
                Save & Next Corps
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
              </>
            ) : (
              <>
                Complete Setup
                <Check className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  };

  // Render completion screen
  const renderComplete = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-2xl mx-auto px-2"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-gold-500 to-yellow-400 rounded-full flex items-center justify-center"
      >
        <PartyPopper className="w-8 h-8 md:w-12 md:h-12 text-charcoal-900" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-gradient mb-2 md:mb-4"
      >
        You're All Set!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base md:text-xl text-cream-300 mb-6 md:mb-8"
      >
        Your corps are ready to compete in {formatSeasonName(seasonData?.name)}!
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8"
      >
        <div className="glass rounded-xl p-3 md:p-4">
          <div className="text-xl md:text-3xl font-bold text-gold-500 mb-1">{totalCorps}</div>
          <div className="text-xs md:text-base text-cream-500/60">Corps Ready</div>
        </div>
        <div className="glass rounded-xl p-3 md:p-4">
          <div className="text-xl md:text-3xl font-bold text-blue-500 mb-1">Week 1</div>
          <div className="text-xs md:text-base text-cream-500/60">Shows Selected</div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 md:p-4 mb-6 md:mb-8"
      >
        <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mx-auto mb-2" />
        <p className="text-xs md:text-sm text-cream-300">
          Don't forget to rehearse your corps regularly to boost performance!
          You can also select shows for future weeks from your dashboard.
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        onClick={onComplete}
        className="btn-primary text-sm md:text-lg px-6 md:px-8 py-3 md:py-4 w-full sm:w-auto"
      >
        <Zap className="w-4 h-4 md:w-5 md:h-5 mr-2" />
        Go to Dashboard
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
      </motion.button>
    </motion.div>
  );

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-charcoal-950 z-50 overflow-y-auto"
      >
        <div className="min-h-screen flex items-center justify-center p-2 sm:p-4 py-4 sm:py-8">
          <AnimatePresence mode="wait">
            {step === 'welcome' && renderWelcome()}
            {step === 'corps-setup' && renderCorpsSetup()}
            {step === 'shows' && renderShowSelection()}
            {step === 'complete' && renderComplete()}
          </AnimatePresence>
        </div>
      </motion.div>
    </Portal>
  );
};

export default SeasonSetupWizard;
