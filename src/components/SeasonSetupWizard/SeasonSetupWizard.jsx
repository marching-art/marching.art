// =============================================================================
// CORPS REGISTRATION - ESPN PRO DATA STYLE
// =============================================================================
// A rigid registration form, not a game tutorial.
// Laws: No slider animations, tabbed layout, utilitarian design

import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { ClipboardList, ChevronRight, ChevronLeft, Check, X, Trophy, Play, Plus, RotateCcw, Unlock } from 'lucide-react';
import { useSeasonStore } from '../../store/seasonStore';
import { useScheduleStore } from '../../store/scheduleStore';

// Import constants
import { ALL_CLASSES, POINT_LIMITS, getCorpsClassName, formatSeasonName } from './constants';
import { sortCorpsEntriesByClass } from '../../utils/corps';

// =============================================================================
// CLASS SELECTION TABLE DATA
// =============================================================================

const CLASS_DATA = [
  { id: 'worldClass', name: 'World Class', budget: 150, difficulty: 'Elite', reqLevel: 6 },
  { id: 'openClass', name: 'Open Class', budget: 120, difficulty: 'Advanced', reqLevel: 5 },
  { id: 'aClass', name: 'A Class', budget: 60, difficulty: 'Intermediate', reqLevel: 4 },
  { id: 'soundSport', name: 'SoundSport', budget: 90, difficulty: 'Entry', reqLevel: 0 },
];

// =============================================================================
// MAIN CORPS REGISTRATION COMPONENT
// =============================================================================

const SeasonSetupWizard = ({
  onComplete,
  profile,
  seasonData,
  corpsNeedingSetup,
  existingCorps = {},
  retiredCorps = [],
  unlockedClasses = ['soundSport']
}) => {
  // Global store data
  const globalCurrentWeek = useSeasonStore((state) => state.currentWeek);
  const getWeekShows = useScheduleStore((state) => state.getWeekShows);
  const scheduleLoading = useScheduleStore((state) => state.loading);

  // Check if user has existing corps that need decisions (computed early for initial step)
  const hasExistingCorps = Object.keys(existingCorps).some(c => existingCorps[c]?.corpsName);
  const eligibleNewClasses = ALL_CLASSES.filter(c =>
    unlockedClasses.includes(c) && !existingCorps[c]?.corpsName
  );

  // Check if corps are already active in the current season (auto-continued)
  // If so, skip corps verification (step 0) and go to show selection (step 4)
  const isCorpsAutoContined = profile?.activeSeasonId === seasonData?.seasonUid;

  // Registration state - skip step 0 if corps already auto-continued, otherwise show it for returning users
  const [step, setStep] = useState(() => {
    if (hasExistingCorps && isCorpsAutoContined) {
      return 4; // Skip to show selection - corps already auto-continued
    }
    return hasExistingCorps ? 0 : 1; // Step 0 for returning users who need to make decisions
  });
  const [processing, setProcessing] = useState(false);

  // Form data for new corps (only used if creating a new one)
  const [formData, setFormData] = useState({
    corpsName: '',
    directorName: profile?.displayName || '',
    location: '',
    selectedClass: null,
  });

  // Corps management state
  const [corpsDecisions, setCorpsDecisions] = useState({});
  const [newCorpsData, setNewCorpsData] = useState({});
  const [currentCorpsIndex, setCurrentCorpsIndex] = useState(0);
  const [finalCorpsNeedingSetup, setFinalCorpsNeedingSetup] = useState(corpsNeedingSetup);

  // Lineup and shows state
  const [selections, setSelections] = useState({});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loadingCorps, setLoadingCorps] = useState(true);
  const [selectedShows, setSelectedShows] = useState([]);

  // Use global week from season store
  const currentWeek = globalCurrentWeek || 1;

  const currentCorpsClass = finalCorpsNeedingSetup[currentCorpsIndex];

  // Group retired corps by class
  const retiredByClass = {};
  retiredCorps.forEach((rc, idx) => {
    if (!retiredByClass[rc.corpsClass]) retiredByClass[rc.corpsClass] = [];
    retiredByClass[rc.corpsClass].push({ ...rc, index: idx });
  });

  // Initialize corps decisions
  useEffect(() => {
    const initialDecisions = {};
    ALL_CLASSES.forEach(classId => {
      if (existingCorps[classId]?.corpsName) {
        initialDecisions[classId] = 'continue';
      }
    });
    setCorpsDecisions(initialDecisions);
  }, [existingCorps]);

  // Fetch corps data for lineup
  useEffect(() => {
    if (step === 3 && seasonData?.seasonUid) {
      fetchAvailableCorps();
    }
  }, [step, seasonData?.seasonUid]);

  // Get available shows from store when on step 4
  const availableShows = step === 4 ? getWeekShows(currentWeek) : [];

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
    } finally {
      setLoadingCorps(false);
    }
  };

  // Process corps verification decisions (step 0)
  const handleCorpsVerificationContinue = async () => {
    setProcessing(true);
    try {
      const decisions = [];

      // Process decisions for existing corps
      Object.entries(corpsDecisions).forEach(([classId, action]) => {
        if (action === 'continue') {
          decisions.push({ corpsClass: classId, action: 'continue' });
        } else if (action === 'retire') {
          decisions.push({ corpsClass: classId, action: 'retire' });
        } else if (action === 'new') {
          const data = newCorpsData[classId];
          if (data?.corpsName) {
            decisions.push({
              corpsClass: classId,
              action: 'new',
              corpsName: data.corpsName,
              location: data.location || '',
            });
          }
        } else if (action === 'unretire') {
          const data = newCorpsData[classId];
          if (data?.retiredIndex !== undefined) {
            decisions.push({
              corpsClass: classId,
              action: 'unretire',
              retiredIndex: data.retiredIndex,
            });
          }
        }
      });

      if (decisions.length > 0) {
        const processCorpsDecisionsFn = httpsCallable(functions, 'processCorpsDecisions');
        const result = await processCorpsDecisionsFn({ decisions });

        if (result.data.corpsNeedingSetup?.length > 0) {
          setFinalCorpsNeedingSetup(result.data.corpsNeedingSetup);
          setStep(4); // Go to show selection
          toast.success('Corps updated successfully');
          return;
        }
      }

      // No lineup needed, complete
      setStep(5);
      toast.success('Season setup complete');
    } catch (error) {
      console.error('Error processing corps decisions:', error);
      toast.error(error.message || 'Failed to process corps decisions');
    } finally {
      setProcessing(false);
    }
  };

  // Process new corps registration (step 3 - from new user flow)
  const handleSubmit = async () => {
    setProcessing(true);
    try {
      const decisions = [];

      // New corps registration
      if (formData.selectedClass && formData.corpsName) {
        decisions.push({
          corpsClass: formData.selectedClass,
          action: 'new',
          corpsName: formData.corpsName,
          location: formData.location,
        });
      }

      if (decisions.length > 0) {
        const processCorpsDecisionsFn = httpsCallable(functions, 'processCorpsDecisions');
        const result = await processCorpsDecisionsFn({ decisions });

        if (result.data.corpsNeedingSetup?.length > 0) {
          setFinalCorpsNeedingSetup(result.data.corpsNeedingSetup);
          setStep(4); // Go to show selection
          toast.success('Registration saved');
          return;
        }
      }

      // If no lineup needed, complete
      setStep(5);
      toast.success('Registration complete');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Registration failed');
    } finally {
      setProcessing(false);
    }
  };

  // Save lineup
  const saveLineup = async () => {
    try {
      setProcessing(true);
      const saveLineupFn = httpsCallable(functions, 'saveLineup');
      await saveLineupFn({ lineup: selections, corpsClass: currentCorpsClass });
      toast.success('Lineup saved');
      setStep(4);
    } catch (error) {
      toast.error(error.message || 'Failed to save lineup');
    } finally {
      setProcessing(false);
    }
  };

  // Save shows
  const saveShows = async () => {
    if (selectedShows.length === 0) {
      toast.error('Select at least one show');
      return;
    }
    try {
      setProcessing(true);
      const selectUserShows = httpsCallable(functions, 'selectUserShows');
      await selectUserShows({
        week: currentWeek,
        shows: selectedShows,
        corpsClass: currentCorpsClass
      });

      if (currentCorpsIndex < finalCorpsNeedingSetup.length - 1) {
        setCurrentCorpsIndex(currentCorpsIndex + 1);
        setStep(3);
        setSelectedShows([]);
        setSelections({});
      } else {
        setStep(5);
      }
      toast.success('Shows selected');
    } catch (error) {
      toast.error(error.message || 'Failed to save shows');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-[#0a0a0a] z-50 overflow-y-auto">
        {/* Header */}
        <div className="h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4">
          <ClipboardList className="w-5 h-5 text-[#0057B8] mr-2" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            Corps Registration
          </span>
          <span className="ml-2 text-xs text-gray-500">
            {formatSeasonName(seasonData?.name)}
          </span>
          <button
            onClick={onComplete}
            className="ml-auto p-2 text-gray-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Tabs */}
        <div className="bg-[#1a1a1a] border-b border-[#333]">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex">
              {hasExistingCorps ? (
                // Returning user tabs: Corps Management -> Shows -> Complete
                ['Manage Corps', 'Shows'].map((label, idx) => {
                  // Map to actual steps: 0, 4
                  const stepMapping = [0, 4];
                  const stepNum = stepMapping[idx];
                  const isActive = step === stepNum;
                  const isComplete = step > stepNum;
                  return (
                    <div
                      key={label}
                      className={`flex-1 py-3 text-center border-b-2 ${
                        isActive ? 'border-[#0057B8] text-white' :
                        isComplete ? 'border-green-500 text-green-500' :
                        'border-transparent text-gray-500'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isComplete && <Check className="w-3 h-3 inline mr-1" />}
                        {idx + 1}. {label}
                      </span>
                    </div>
                  );
                })
              ) : (
                // New user tabs: Identity -> Class -> Summary
                ['Identity', 'Class', 'Summary'].map((label, idx) => {
                  const stepNum = idx + 1;
                  const isActive = step === stepNum;
                  const isComplete = step > stepNum;
                  return (
                    <div
                      key={label}
                      className={`flex-1 py-3 text-center border-b-2 ${
                        isActive ? 'border-[#0057B8] text-white' :
                        isComplete ? 'border-green-500 text-green-500' :
                        'border-transparent text-gray-500'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isComplete && <Check className="w-3 h-3 inline mr-1" />}
                        {stepNum}. {label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto p-4 md:p-6">

          {/* STEP 0: Corps Verification (Returning Users) */}
          {step === 0 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Step 1: Manage Your Corps
                </h2>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-400 mb-4">
                  Welcome back! Review your corps from last season and decide how to proceed.
                </p>

                {/* Existing Corps - sorted by class order (World → Open → A → SoundSport) */}
                {sortCorpsEntriesByClass(
                  Object.entries(existingCorps).filter(([_, corps]) => corps?.corpsName)
                ).map(([classId, corps]) => {
                    const decision = corpsDecisions[classId] || 'continue';
                    const classRetired = retiredByClass[classId] || [];

                    return (
                      <div key={classId} className="bg-[#0a0a0a] border border-[#333] p-4 mb-3">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-[10px] font-bold text-[#0057B8] uppercase tracking-wider block mb-1">
                              {getCorpsClassName(classId)}
                            </span>
                            <h4 className="text-sm font-bold text-white">{corps.corpsName}</h4>
                            <p className="text-xs text-gray-500">{corps.location}</p>
                          </div>
                          <Trophy className="w-5 h-5 text-yellow-500" />
                        </div>

                        <div className={`grid gap-2 ${classRetired.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <button
                            onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'continue' })}
                            className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                              decision === 'continue'
                                ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                : 'bg-[#1a1a1a] border-2 border-transparent text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            <Play className="w-4 h-4" />
                            Continue
                          </button>
                          <button
                            onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'new' })}
                            className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                              decision === 'new'
                                ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                : 'bg-[#1a1a1a] border-2 border-transparent text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                            Start New
                          </button>
                          {classRetired.length > 0 && (
                            <button
                              onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'unretire' })}
                              className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                decision === 'unretire'
                                  ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400'
                                  : 'bg-[#1a1a1a] border-2 border-transparent text-gray-300 hover:border-gray-500'
                              }`}
                            >
                              <RotateCcw className="w-4 h-4" />
                              Revive
                            </button>
                          )}
                        </div>

                        {/* New corps form when "Start New" is selected */}
                        {decision === 'new' && (
                          <div className="mt-3 pt-3 border-t border-[#333] space-y-2">
                            <input
                              type="text"
                              placeholder="New Corps Name"
                              value={newCorpsData[classId]?.corpsName || ''}
                              onChange={(e) => setNewCorpsData({
                                ...newCorpsData,
                                [classId]: { ...newCorpsData[classId], corpsName: e.target.value }
                              })}
                              className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                            />
                            <input
                              type="text"
                              placeholder="Location"
                              value={newCorpsData[classId]?.location || ''}
                              onChange={(e) => setNewCorpsData({
                                ...newCorpsData,
                                [classId]: { ...newCorpsData[classId], location: e.target.value }
                              })}
                              className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                            />
                          </div>
                        )}

                        {/* Unretire selection */}
                        {decision === 'unretire' && classRetired.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#333]">
                            <select
                              className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-sm text-white focus:outline-none focus:border-[#0057B8]"
                              value={newCorpsData[classId]?.retiredIndex ?? ''}
                              onChange={(e) => setNewCorpsData({
                                ...newCorpsData,
                                [classId]: { retiredIndex: parseInt(e.target.value) }
                              })}
                            >
                              <option value="">Select corps to unretire...</option>
                              {classRetired.map((rc) => (
                                <option key={rc.index} value={rc.index}>
                                  {rc.corpsName} ({rc.totalSeasons} seasons)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Eligible new classes (optional expansion) */}
                {eligibleNewClasses.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-blue-500" />
                      Expand to New Classes (Optional)
                    </h3>
                    {eligibleNewClasses.map(classId => {
                      const decision = corpsDecisions[classId];
                      const classRetired = retiredByClass[classId] || [];

                      return (
                        <div key={classId} className="bg-[#0a0a0a] border border-[#333] p-4 mb-3">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                {getCorpsClassName(classId)}
                              </span>
                              <p className="text-xs text-gray-500">
                                {POINT_LIMITS[classId]} point budget
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => {
                                const updated = { ...corpsDecisions };
                                delete updated[classId];
                                setCorpsDecisions(updated);
                              }}
                              className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                !decision
                                  ? 'bg-[#1a1a1a] border-2 border-gray-500 text-gray-300'
                                  : 'bg-[#1a1a1a] border-2 border-transparent text-gray-500 hover:border-gray-500'
                              }`}
                            >
                              Skip
                            </button>
                            <button
                              onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'new' })}
                              className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                decision === 'new'
                                  ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                  : 'bg-[#1a1a1a] border-2 border-transparent text-gray-300 hover:border-gray-500'
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                              Register
                            </button>
                            {classRetired.length > 0 && (
                              <button
                                onClick={() => setCorpsDecisions({ ...corpsDecisions, [classId]: 'unretire' })}
                                className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                  decision === 'unretire'
                                    ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400'
                                    : 'bg-[#1a1a1a] border-2 border-transparent text-gray-300 hover:border-gray-500'
                                }`}
                              >
                                <RotateCcw className="w-4 h-4" />
                                Revive
                              </button>
                            )}
                          </div>

                          {/* New corps form */}
                          {decision === 'new' && (
                            <div className="mt-3 pt-3 border-t border-[#333] space-y-2">
                              <input
                                type="text"
                                placeholder="Corps Name"
                                value={newCorpsData[classId]?.corpsName || ''}
                                onChange={(e) => setNewCorpsData({
                                  ...newCorpsData,
                                  [classId]: { ...newCorpsData[classId], corpsName: e.target.value }
                                })}
                                className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                              />
                              <input
                                type="text"
                                placeholder="Location"
                                value={newCorpsData[classId]?.location || ''}
                                onChange={(e) => setNewCorpsData({
                                  ...newCorpsData,
                                  [classId]: { ...newCorpsData[classId], location: e.target.value }
                                })}
                                className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                              />
                            </div>
                          )}

                          {/* Unretire selection */}
                          {decision === 'unretire' && classRetired.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#333]">
                              <select
                                className="w-full h-9 px-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-sm text-white focus:outline-none focus:border-[#0057B8]"
                                value={newCorpsData[classId]?.retiredIndex ?? ''}
                                onChange={(e) => setNewCorpsData({
                                  ...newCorpsData,
                                  [classId]: { retiredIndex: parseInt(e.target.value) }
                                })}
                              >
                                <option value="">Select corps to unretire...</option>
                                {classRetired.map((rc) => (
                                  <option key={rc.index} value={rc.index}>
                                    {rc.corpsName} ({rc.totalSeasons} seasons)
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-[#333] flex justify-end">
                <button
                  onClick={handleCorpsVerificationContinue}
                  disabled={processing}
                  className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 hover:bg-[#0066d6]"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Identity */}
          {step === 1 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Step 1: Corps Identity
                </h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Corps Name *
                  </label>
                  <input
                    type="text"
                    value={formData.corpsName}
                    onChange={(e) => setFormData({ ...formData, corpsName: e.target.value })}
                    placeholder="e.g., Phoenix Rising"
                    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Director Name
                  </label>
                  <input
                    type="text"
                    value={formData.directorName}
                    onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                    placeholder="Your name"
                    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Home Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Indianapolis, IN"
                    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                  />
                </div>
              </div>
              <div className="px-4 py-3 border-t border-[#333] flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.corpsName.trim()}
                  className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0066d6]"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Class Selection Table */}
          {step === 2 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Step 2: Select Competition Class
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1a1a1a] border-b border-[#333]">
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Budget</th>
                      <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Difficulty</th>
                      <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CLASS_DATA.map((cls, idx) => {
                      const isUnlocked = unlockedClasses.includes(cls.id);
                      const isSelected = formData.selectedClass === cls.id;
                      const hasExisting = existingCorps[cls.id]?.corpsName;

                      return (
                        <tr
                          key={cls.id}
                          onClick={() => isUnlocked && !hasExisting && setFormData({ ...formData, selectedClass: cls.id })}
                          className={`
                            border-b border-[#333]/50 h-12
                            ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}
                            ${isUnlocked && !hasExisting ? 'cursor-pointer hover:bg-white/5' : 'opacity-50'}
                            ${isSelected ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]' : ''}
                          `}
                        >
                          <td className="px-4 py-2">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              isSelected ? 'border-[#0057B8] bg-[#0057B8]' : 'border-[#444]'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm font-bold text-white">{cls.name}</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-sm text-gray-400 tabular-nums">{cls.budget} pts</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 ${
                              cls.difficulty === 'Elite' ? 'bg-purple-500/20 text-purple-400' :
                              cls.difficulty === 'Advanced' ? 'bg-blue-500/20 text-blue-400' :
                              cls.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {cls.difficulty}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {hasExisting ? (
                              <span className="text-xs text-gray-500">Active</span>
                            ) : isUnlocked ? (
                              <span className="text-xs text-green-500">Available</span>
                            ) : (
                              <span className="text-xs text-gray-500">Locked (Lvl {cls.reqLevel})</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-[#333] flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="h-10 px-4 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center hover:border-[#444] hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!formData.selectedClass}
                  className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0066d6]"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Summary Ticket */}
          {step === 3 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Step 3: Registration Summary
                </h2>
              </div>
              <div className="p-4">
                {/* Summary Ticket */}
                <div className="bg-[#0a0a0a] border border-[#333] p-4 mb-4">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Entry Confirmation
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Corps Name</div>
                      <div className="text-sm font-bold text-white">{formData.corpsName}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Director</div>
                      <div className="text-sm text-gray-300">{formData.directorName || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Location</div>
                      <div className="text-sm text-gray-300">{formData.location || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Competition Class</div>
                      <div className="text-sm font-bold text-[#0057B8]">
                        {getCorpsClassName(formData.selectedClass)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#333]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500 uppercase">Point Budget</span>
                      <span className="text-lg font-bold text-white tabular-nums">
                        {POINT_LIMITS[formData.selectedClass]} pts
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <p className="text-xs text-gray-500 mb-4">
                  By submitting, you confirm this entry for the {formatSeasonName(seasonData?.name)} season.
                  You can modify your lineup and show selections after registration.
                </p>
              </div>
              <div className="px-4 py-3 border-t border-[#333] flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="h-10 px-4 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center hover:border-[#444] hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 hover:bg-[#0066d6]"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Submit League Entry
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Show Selection (after registration) */}
          {step === 4 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {currentWeek === 7 ? 'Championship Week' : `Select Week ${currentWeek} Shows`}
                </h2>
              </div>
              <div className="p-4">
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
                ) : availableShows.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No shows available this week</p>
                ) : (
                  <div className="space-y-2">
                    {availableShows.filter(show => show.type !== 'championship').map((show, idx) => {
                      const isSelected = selectedShows.some(
                        s => s.eventName === show.eventName && s.date === show.date
                      );
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedShows(selectedShows.filter(
                                s => !(s.eventName === show.eventName && s.date === show.date)
                              ));
                            } else if (selectedShows.length < 4) {
                              setSelectedShows([...selectedShows, {
                                eventName: show.eventName,
                                date: show.date,
                                location: show.location,
                                day: show.day
                              }]);
                            }
                          }}
                          className={`p-3 border cursor-pointer ${
                            isSelected
                              ? 'border-[#0057B8] bg-[#0057B8]/10'
                              : 'border-[#333] hover:border-[#444]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-white">{show.eventName}</div>
                              <div className="text-xs text-gray-500">{show.location} • Day {show.day}</div>
                            </div>
                            {isSelected && <Check className="w-5 h-5 text-[#0057B8]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {currentWeek !== 7 && (
                  <p className="text-xs text-gray-500 mt-4">
                    Selected: {selectedShows.length}/4 shows
                  </p>
                )}
              </div>
              <div className="px-4 py-3 border-t border-[#333] flex justify-end">
                <button
                  onClick={currentWeek === 7 ? () => setStep(5) : saveShows}
                  disabled={processing || (currentWeek !== 7 && selectedShows.length === 0)}
                  className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center disabled:opacity-50 hover:bg-[#0066d6]"
                >
                  {processing ? 'Saving...' : currentWeek === 7 ? 'Continue' : 'Confirm Shows'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Complete */}
          {step === 5 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Registration Complete
                </h2>
              </div>
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-sm flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Entry Confirmed
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Your corps is registered for {formatSeasonName(seasonData?.name)}.
                  Head to your dashboard to manage lineups and view upcoming shows.
                </p>
                <button
                  onClick={onComplete}
                  className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#0066d6]"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </Portal>
  );
};

export default SeasonSetupWizard;
