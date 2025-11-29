// SeasonSetupWizard - Multi-step wizard for season setup
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';

// Import step components
import {
  WelcomeStep,
  CorpsVerificationStep,
  LineupSetupStep,
  ShowSelectionStep,
  CompleteStep
} from './steps';

// Import constants
import { ALL_CLASSES, getCorpsClassName } from './constants';

const SeasonSetupWizard = ({
  onComplete,
  profile,
  seasonData,
  corpsNeedingSetup,
  existingCorps = {},
  retiredCorps = [],
  unlockedClasses = ['soundSport']
}) => {
  // Step navigation
  const [step, setStep] = useState('welcome');
  const [currentCorpsIndex, setCurrentCorpsIndex] = useState(0);

  // Corps verification state
  const [corpsDecisions, setCorpsDecisions] = useState({});
  const [newCorpsData, setNewCorpsData] = useState({});
  const [finalCorpsNeedingSetup, setFinalCorpsNeedingSetup] = useState(corpsNeedingSetup);
  const [processingDecisions, setProcessingDecisions] = useState(false);

  // Lineup selection state
  const [selections, setSelections] = useState({});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loadingCorps, setLoadingCorps] = useState(true);
  const [saving, setSaving] = useState(false);

  // Show selection state
  const [availableShows, setAvailableShows] = useState([]);
  const [selectedShows, setSelectedShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  const currentCorpsClass = finalCorpsNeedingSetup[currentCorpsIndex];
  const totalCorps = finalCorpsNeedingSetup.length;
  const currentCorpsData = profile?.corps?.[currentCorpsClass];

  // Check if user needs corps verification
  const hasExistingCorps = Object.keys(existingCorps).some(c => existingCorps[c]?.corpsName);
  const hasRetiredCorps = retiredCorps.length > 0;
  const hasEligibleNewClasses = ALL_CLASSES.some(c =>
    unlockedClasses.includes(c) && !existingCorps[c]?.corpsName
  );
  const needsVerification = hasExistingCorps || hasRetiredCorps || hasEligibleNewClasses;

  // Initialize corps decisions from existing corps
  useEffect(() => {
    const initialDecisions = {};
    ALL_CLASSES.forEach(classId => {
      if (existingCorps[classId]?.corpsName) {
        initialDecisions[classId] = 'continue';
      }
    });
    setCorpsDecisions(initialDecisions);
  }, [existingCorps]);

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

        // Calculate current week based on season start date
        let calculatedWeek = 1;
        const startDate = data.schedule?.startDate?.toDate();
        const now = new Date();

        if (startDate) {
          const diffInMillis = now.getTime() - startDate.getTime();
          const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
          const currentDay = diffInDays + 1;
          calculatedWeek = Math.max(1, Math.min(7, Math.ceil(currentDay / 7)));
        }

        setCurrentWeek(calculatedWeek);

        // Calculate week day range
        const weekStartDay = (calculatedWeek - 1) * 7 + 1;
        const weekEndDay = calculatedWeek * 7;

        // Get shows for current week, filtering out past shows
        const weekShows = [];
        events.forEach(dayEvent => {
          const day = dayEvent.offSeasonDay || dayEvent.day || 0;
          if (day >= weekStartDay && day <= weekEndDay && dayEvent.shows) {
            let showDate = null;
            if (startDate) {
              showDate = new Date(startDate);
              showDate.setDate(startDate.getDate() + day);
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isPast = showDate && showDate < today;

            if (!isPast) {
              dayEvent.shows.forEach(show => {
                weekShows.push({ ...show, day, actualDate: showDate });
              });
            }
          }
        });

        setAvailableShows(weekShows);

        if (weekShows.length > 0) {
          const availableDays = [...new Set(weekShows.map(s => s.day))].sort((a, b) => a - b);
          setSelectedDay(availableDays[0]);
        } else {
          setSelectedDay(weekStartDay);
        }
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    } finally {
      setLoadingShows(false);
    }
  };

  // Process corps decisions and move to lineup setup
  const processDecisionsAndContinue = async () => {
    try {
      setProcessingDecisions(true);

      const decisions = [];
      Object.entries(corpsDecisions).forEach(([classId, action]) => {
        if (action === 'new' && newCorpsData[classId]) {
          decisions.push({
            corpsClass: classId,
            action: 'new',
            corpsName: newCorpsData[classId].corpsName,
            location: newCorpsData[classId].location,
            showConcept: newCorpsData[classId].showConcept || ''
          });
        } else if (action === 'unretire') {
          const retiredIndex = newCorpsData[classId]?.retiredIndex;
          if (retiredIndex !== undefined) {
            decisions.push({ corpsClass: classId, action: 'unretire', retiredIndex });
          }
        } else if (['continue', 'retire', 'skip'].includes(action)) {
          decisions.push({ corpsClass: classId, action });
        }
      });

      if (decisions.length === 0) {
        setFinalCorpsNeedingSetup(corpsNeedingSetup);
        setStep(corpsNeedingSetup.length > 0 ? 'corps-setup' : 'complete');
        return;
      }

      const processCorpsDecisions = httpsCallable(functions, 'processCorpsDecisions');
      const result = await processCorpsDecisions({ decisions });

      if (result.data.corpsNeedingSetup?.length > 0) {
        setFinalCorpsNeedingSetup(result.data.corpsNeedingSetup);
        setStep('corps-setup');
        toast.success('Corps decisions saved!');
      } else {
        setStep('complete');
        toast.success('Season setup complete!');
      }
    } catch (error) {
      console.error('Error processing corps decisions:', error);
      toast.error(error.message || 'Failed to process corps decisions');
    } finally {
      setProcessingDecisions(false);
    }
  };

  // Handle lineup selection change
  const handleSelectionChange = (captionId, value) => {
    if (!value) {
      const newSelections = { ...selections };
      delete newSelections[captionId];
      setSelections(newSelections);
    } else {
      setSelections({ ...selections, [captionId]: value });
    }
  };

  // Save lineup and continue to shows
  const saveLineupAndContinue = async () => {
    try {
      setSaving(true);
      const saveLineup = httpsCallable(functions, 'saveLineup');
      await saveLineup({ lineup: selections, corpsClass: currentCorpsClass });

      toast.success(`${getCorpsClassName(currentCorpsClass)} lineup saved!`);
      setStep('shows');
      setSelections({});
    } catch (error) {
      console.error('Error saving lineup:', error);
      toast.error(error.message || 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  // Toggle show selection
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

  // Save shows and continue
  const saveShowsAndContinue = async () => {
    if (selectedShows.length === 0) {
      toast.error('Please select at least one show');
      return;
    }

    try {
      setSaving(true);

      const selectUserShows = httpsCallable(functions, 'selectUserShows');
      await selectUserShows({
        week: currentWeek,
        shows: selectedShows,
        corpsClass: currentCorpsClass
      });

      toast.success(`Week ${currentWeek} shows selected for ${getCorpsClassName(currentCorpsClass)}!`);

      if (currentCorpsIndex < totalCorps - 1) {
        setCurrentCorpsIndex(currentCorpsIndex + 1);
        setStep('corps-setup');
        setSelectedShows([]);
      } else {
        setStep('complete');
      }
    } catch (error) {
      console.error('Error saving shows:', error);
      toast.error(error.message || 'Failed to save show selections');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-charcoal-950 z-50 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center p-2 sm:p-4 py-4 sm:py-8">
          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <WelcomeStep
                key="welcome"
                seasonData={seasonData}
                corpsNeedingSetup={finalCorpsNeedingSetup}
                needsVerification={needsVerification}
                onContinue={setStep}
              />
            )}

            {step === 'corps-verification' && (
              <CorpsVerificationStep
                key="corps-verification"
                existingCorps={existingCorps}
                retiredCorps={retiredCorps}
                unlockedClasses={unlockedClasses}
                corpsDecisions={corpsDecisions}
                setCorpsDecisions={setCorpsDecisions}
                newCorpsData={newCorpsData}
                setNewCorpsData={setNewCorpsData}
                onBack={() => setStep('welcome')}
                onContinue={processDecisionsAndContinue}
                processing={processingDecisions}
              />
            )}

            {step === 'corps-setup' && (
              <LineupSetupStep
                key="corps-setup"
                currentCorpsClass={currentCorpsClass}
                currentCorpsIndex={currentCorpsIndex}
                totalCorps={totalCorps}
                currentCorpsData={currentCorpsData}
                selections={selections}
                availableCorps={availableCorps}
                loading={loadingCorps}
                saving={saving}
                onSelectionChange={handleSelectionChange}
                onBack={() => setStep('welcome')}
                onSave={saveLineupAndContinue}
              />
            )}

            {step === 'shows' && (
              <ShowSelectionStep
                key="shows"
                currentCorpsClass={currentCorpsClass}
                currentCorpsIndex={currentCorpsIndex}
                totalCorps={totalCorps}
                currentWeek={currentWeek}
                availableShows={availableShows}
                selectedShows={selectedShows}
                selectedDay={selectedDay}
                loading={loadingShows}
                saving={saving}
                onDayChange={setSelectedDay}
                onToggleShow={toggleShow}
                onBack={() => setStep('corps-setup')}
                onSave={saveShowsAndContinue}
              />
            )}

            {step === 'complete' && (
              <CompleteStep
                key="complete"
                seasonData={seasonData}
                totalCorps={totalCorps}
                currentWeek={currentWeek}
                onComplete={onComplete}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </Portal>
  );
};

export default SeasonSetupWizard;
