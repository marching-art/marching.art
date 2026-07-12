// =============================================================================
// CAPTION SELECTION MODAL - CONSOLIDATED CAPTION-FOCUSED DESIGN
// =============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, AlertCircle, Trophy, Save, Target, Award, X, ArrowLeft, Wand2 } from 'lucide-react';
import { getProfile } from '../../api/profile';
import { getCorpsValues } from '../../api/season';
import { getHotCorps, getActiveLineupKeys, saveLineup } from '../../api/functions';
import { queueLineupSave } from '../../lib/offlineLineupQueue';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSeasonDeadlines } from '../../hooks/useSeasonClock';
import { useSeasonStore } from '../../store/seasonStore';
import { formatCountdown } from '../../utils/seasonClock';
import { CORPS_CLASS_LABELS as CLASS_LABELS } from '../../utils/corps';
import { POINT_CAPS } from '../../utils/classRegistry';
import {
  LineupCelebration,
  CorpsSelectionList,
  TemplateModal,
  DraftHelper,
  TradesRemainingIndicator,
  CaptionButton,
} from './CaptionSelectionParts';
import { generateQuickFillLineup } from './quickFillLineup';

const CaptionSelectionModal = ({
  onClose,
  onSubmit,
  corpsClass,
  currentLineup,
  seasonId,
  initialCaption,
}) => {
  const { user } = useAuth();
  const [selections, setSelections] = useState(currentLineup || {});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [draftSuggestions, setDraftSuggestions] = useState({ hot: [], value: [], history: [] });
  const [userHistory, setUserHistory] = useState([]);
  const [hotCorpsData, setHotCorpsData] = useState({}); // Per-caption hot status
  const [activeLineupKeys, setActiveLineupKeys] = useState(new Set()); // Other users' lineup keys

  // Mobile state - whether we're viewing lineup or selection list
  const [mobileView, setMobileView] = useState('lineup'); // 'lineup' or 'selection'

  // Prominent, in-modal save error (e.g. the caption-change-limit message from
  // the backend). Shown as a banner inside the modal instead of only a toast —
  // a bottom-center toast is easily lost behind the near-full-height modal.
  const [saveError, setSaveError] = useState(null);

  // Active caption for selection
  const [activeCaption, setActiveCaption] = useState(initialCaption || null);

  // Corps list search — essential on mobile where the full list is a long scroll
  const [corpsSearch, setCorpsSearch] = useState('');

  // Clear the search when switching captions so each list starts unfiltered
  useEffect(() => {
    setCorpsSearch('');
  }, [activeCaption]);

  // Change limits state
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [weeklyTrades, setWeeklyTrades] = useState(null);

  // Live countdown to the nightly score processing (shown next to Lock
  // Lineup) plus the current caption-change window (unlimited / weekly /
  // championship / lockouts). `trade` mirrors the backend rules in
  // functions/src/helpers/captionWindows.js and ticks with the clock.
  const { scoresInMs, trade: changeInfo } = useSeasonDeadlines();
  const seasonUid = useSeasonStore((s) => s.seasonData?.seasonUid);

  // Changes remaining in the current allotment (weekly 3 / championship 2)
  const tradesRemaining = useMemo(() => {
    if (!changeInfo || !Number.isFinite(changeInfo.tradeLimit)) return Infinity;
    const used =
      weeklyTrades && weeklyTrades.seasonUid === seasonUid && weeklyTrades.week === changeInfo.week
        ? weeklyTrades.used
        : 0;
    return Math.max(0, changeInfo.tradeLimit - used);
  }, [changeInfo, weeklyTrades, seasonUid]);

  // Whether the change window is shut right now (Saturday-night / nightly
  // championship lockout, Days 43-44 blackout, or season complete). Initial
  // lineup setup is always allowed.
  const changesBlocked = !isInitialSetup && !!changeInfo && changeInfo.status !== 'open';

  // Close on Escape key
  useEscapeKey(onClose);

  const captions = useMemo(
    () => [
      { id: 'GE1', name: 'General Effect 1', category: 'General Effect' },
      { id: 'GE2', name: 'General Effect 2', category: 'General Effect' },
      { id: 'VP', name: 'Visual Proficiency', category: 'Visual' },
      { id: 'VA', name: 'Visual Analysis', category: 'Visual' },
      { id: 'CG', name: 'Color Guard', category: 'Visual' },
      { id: 'B', name: 'Brass', category: 'Music' },
      { id: 'MA', name: 'Music Analysis', category: 'Music' },
      { id: 'P', name: 'Percussion', category: 'Music' },
    ],
    []
  );

  const pointLimit = POINT_CAPS[corpsClass];

  const categoryColors = {
    'General Effect': 'bg-yellow-500',
    Visual: 'bg-interactive',
    Music: 'bg-purple-400',
  };

  // Load templates
  useEffect(() => {
    const saved = localStorage.getItem(`lineupTemplates_${user?.uid}_${corpsClass}`);
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch {}
    }
  }, [user?.uid, corpsClass]);

  // Load user history and trade limits
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.uid) return;
      try {
        const data = await getProfile(user.uid);
        if (data) {
          const history = new Set();
          if (data.corps) {
            Object.values(data.corps).forEach((c) => {
              if (c?.lineup)
                Object.values(c.lineup).forEach((sel) => {
                  if (sel) history.add(sel.split('|')[0]);
                });
            });
          }
          setUserHistory(Array.from(history));

          // Check if initial setup (no existing lineup)
          const currentCorpsData = data.corps?.[corpsClass];
          const existingLineup = currentCorpsData?.lineup || {};
          setIsInitialSetup(Object.keys(existingLineup).length === 0);

          // Weekly change counter ({seasonUid, week, used}); combined with
          // the live change window to compute changes remaining.
          setWeeklyTrades(currentCorpsData?.weeklyTrades || null);
        }
      } catch (e) {
        console.error('Failed to load user data:', e);
      }
    };
    loadUserData();
  }, [user?.uid, corpsClass]);

  // Load available corps, hot status (per-caption), and active lineup keys
  useEffect(() => {
    let cancelled = false;
    const fetchCorps = async () => {
      if (!seasonId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // Fetch corps data, hot status, and active lineup keys in parallel
        const [corpsValues, hotCorpsResult, lineupKeysResult] = await Promise.all([
          getCorpsValues(seasonId),
          getHotCorps().catch(() => ({ data: { hotCorps: {} } })),
          getActiveLineupKeys({ corpsClass }).catch(() => ({ data: { lineupKeys: [] } })),
        ]);

        if (!cancelled) {
          // Store per-caption hot data for dynamic lookups
          const hotData = hotCorpsResult.data?.hotCorps || {};
          setHotCorpsData(hotData);

          // Store active lineup keys as a Set for O(1) lookup
          const lineupKeys = lineupKeysResult.data?.lineupKeys || [];
          setActiveLineupKeys(new Set(lineupKeys));

          let corps = corpsValues;
          corps = corps.filter((c) => (c.points || 0) <= 50);

          corps = corps.map((c) => ({
            ...c,
            performanceData: {
              avgScore: c.avgScore || 80,
              // Value calculation: good score per point ratio
              isValue: (c.avgScore || 80) / c.points > 4.5,
            },
          }));
          corps.sort((a, b) => b.points - a.points);
          setAvailableCorps(corps);
        }
      } catch {
        toast.error('Failed to load corps data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCorps();
    return () => {
      cancelled = true;
    };
  }, [seasonId, corpsClass]);

  // Generate suggestions based on the active caption
  const generateSuggestions = useCallback(
    (corps, caption, hotData) => {
      // Hot suggestions: corps that are hot for the current caption
      const hot = corps
        .filter((c) => {
          const corpsId = `${c.corpsName}|${c.sourceYear}`;
          return hotData[corpsId]?.[caption]?.isHot;
        })
        .slice(0, 5);

      const value = corps.filter((c) => c.performanceData?.isValue).slice(0, 5);
      const history = corps.filter((c) => userHistory.includes(c.corpsName)).slice(0, 5);
      setDraftSuggestions({ hot, value, history });
    },
    [userHistory]
  );

  // Regenerate suggestions when caption changes or data loads
  useEffect(() => {
    if (availableCorps.length > 0 && activeCaption) {
      generateSuggestions(availableCorps, activeCaption, hotCorpsData);
    }
  }, [availableCorps, activeCaption, hotCorpsData, generateSuggestions]);

  const calculateTotalPoints = useCallback(() => {
    return Object.values(selections).reduce(
      (t, s) => t + (s ? parseInt(s.split('|')[2]) || 0 : 0),
      0
    );
  }, [selections]);

  const totalPoints = calculateTotalPoints();
  const remainingPoints = pointLimit - totalPoints;
  const isOverLimit = totalPoints > pointLimit;
  const isComplete = Object.keys(selections).length === 8;
  const selectionCount = Object.keys(selections).length;

  const getSelectedCorps = (captionId) => {
    const sel = selections[captionId];
    if (!sel) return null;
    const [name, year, pts] = sel.split('|');
    return { name, year, points: parseInt(pts) || 0 };
  };

  const handleSelectionChange = useCallback(
    (captionId, corpsData) => {
      // Editing the lineup dismisses any prior save error so it doesn't linger
      setSaveError(null);
      if (!corpsData) {
        const newSel = { ...selections };
        delete newSel[captionId];
        setSelections(newSel);
      } else {
        setSelections((prev) => ({
          ...prev,
          [captionId]: `${corpsData.corpsName}|${corpsData.sourceYear}|${corpsData.points}`,
        }));
      }
    },
    [selections]
  );

  const handleCaptionClick = (captionId) => {
    setActiveCaption(captionId);
    setMobileView('selection');
  };

  const handleBackToLineup = () => {
    setActiveCaption(null);
    setMobileView('lineup');
  };

  // Move to next empty caption or stay on current
  const handleCorpsSelect = (captionId, corps) => {
    handleSelectionChange(captionId, corps);

    // Find next empty caption
    const currentIndex = captions.findIndex((c) => c.id === captionId);
    for (let i = currentIndex + 1; i < captions.length; i++) {
      if (!selections[captions[i].id]) {
        setActiveCaption(captions[i].id);
        return;
      }
    }
    // Check from beginning
    for (let i = 0; i < currentIndex; i++) {
      if (!selections[captions[i].id]) {
        setActiveCaption(captions[i].id);
        return;
      }
    }
  };

  const handleSaveTemplate = (name) => {
    const newTemplate = {
      name,
      lineup: selections,
      totalPoints: calculateTotalPoints(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem(`lineupTemplates_${user?.uid}_${corpsClass}`, JSON.stringify(updated));
    toast.success(`Template "${name}" saved!`);
  };

  const handleLoadTemplate = (template) => {
    const valid = {};
    Object.entries(template.lineup).forEach(([id, sel]) => {
      const [name] = sel.split('|');
      const c = availableCorps.find((x) => x.corpsName === name);
      if (c) valid[id] = `${c.corpsName}|${c.sourceYear}|${c.points}`;
    });
    setSelections(valid);
    setShowTemplateModal(false);
    toast.success(`Template loaded!`);
  };

  const handleDeleteTemplate = (idx) => {
    const updated = templates.filter((_, i) => i !== idx);
    setTemplates(updated);
    localStorage.setItem(`lineupTemplates_${user?.uid}_${corpsClass}`, JSON.stringify(updated));
    toast.success('Template deleted');
  };

  // Quick Fill - auto-fill empty slots via the shared lineup generator, then
  // surface the outcome (already full / duplicate / success) as a toast.
  const handleQuickFill = useCallback(() => {
    const result = generateQuickFillLineup({
      availableCorps,
      selections,
      captions,
      pointLimit,
      activeLineupKeys,
      corpsClass,
    });
    if (!result) return;

    if (result.alreadyFull) {
      toast('All positions are already filled!', { icon: '✓' });
      return;
    }
    if (result.error === 'duplicate') {
      toast.error('Could not generate a unique lineup. Try adjusting some selections manually.');
      return;
    }

    setSelections(result.newSelections);
    if (result.filledCount > 0) {
      toast.success(
        `Auto-filled ${result.filledCount} position${result.filledCount > 1 ? 's' : ''}!`
      );
    }
  }, [availableCorps, selections, captions, pointLimit, activeLineupKeys, corpsClass]);

  const handleSubmit = async () => {
    // Clear any prior error before re-attempting the save.
    setSaveError(null);
    if (changesBlocked) {
      // Mirrors the saveLineup enforcement messages.
      if (changeInfo.status === 'locked') {
        setSaveError(
          'Caption changes are locked while scores are processed. They reopen around 2:00 AM ET.'
        );
      } else if (changeInfo.phase === 'blackout') {
        setSaveError(
          'Caption changes are closed on Days 43-44. Championship changes open on Day 45 once scores are processed.'
        );
      } else {
        setSaveError('The season has ended — caption changes are closed until next season.');
      }
      return;
    }
    if (!isComplete) {
      setSaveError('Please select all 8 captions.');
      return;
    }
    if (isOverLimit) {
      setSaveError(`Lineup exceeds the ${pointLimit} point limit.`);
      return;
    }
    // Offline: store the save locally and submit automatically on reconnect.
    // Backend rules (change windows, limits) still apply at replay time.
    const saveOffline = () => {
      queueLineupSave(user.uid, corpsClass, selections);
      toast.success("You're offline — lineup saved and will submit when you reconnect.", {
        duration: 6000,
      });
      onSubmit(selections);
      onClose();
    };

    if (!navigator.onLine) {
      saveOffline();
      return;
    }

    try {
      setSaving(true);
      await saveLineup({ lineup: selections, corpsClass });
      setShowCelebration(true);
    } catch (e) {
      if (!navigator.onLine) {
        // Connection dropped mid-save
        saveOffline();
        return;
      }
      // Surface the backend message (e.g. the caption-change-limit error)
      // prominently inside the modal so it isn't lost behind it.
      setSaveError(e.message || 'Failed to save lineup. Please try again.');
      setSaving(false);
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast.success('Lineup saved!');
    onSubmit(selections);
    onClose();
  };

  // Get active caption data
  const activeCaptionData = activeCaption ? captions.find((c) => c.id === activeCaption) : null;
  const activeCaptionSelection = activeCaption ? getSelectedCorps(activeCaption) : null;

  // Corps list filtered by the search box (matches name or source year)
  const filteredCorps = useMemo(() => {
    const query = corpsSearch.trim().toLowerCase();
    if (!query) return availableCorps;
    return availableCorps.filter(
      (corps) =>
        corps.corpsName?.toLowerCase().includes(query) ||
        String(corps.sourceYear ?? '').includes(query)
    );
  }, [availableCorps, corpsSearch]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 md:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-caption-selection"
      >
        <div
          className="w-full max-w-5xl max-h-[95dvh] bg-surface-card border border-line rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-line bg-surface-raised flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {/* Mobile back button when viewing selection */}
                {mobileView === 'selection' && (
                  <button
                    onClick={handleBackToLineup}
                    className="lg:hidden min-w-touch min-h-touch -ml-2 flex items-center justify-center text-muted hover:text-white active:text-white press-feedback"
                    aria-label="Back to lineup"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2
                    id="modal-title-caption-selection"
                    className="text-xs font-bold uppercase tracking-wider text-secondary"
                  >
                    {mobileView === 'selection' && activeCaptionData
                      ? `Select for ${activeCaptionData.name}`
                      : 'Draft Your Lineup'}
                  </h2>
                  <p className="text-sm text-muted">
                    {CLASS_LABELS[corpsClass]} • Draft budget: {pointLimit}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TradesRemainingIndicator
                  tradesRemaining={tradesRemaining}
                  isInitialSetup={isInitialSetup}
                  changeInfo={changeInfo}
                />
                <button
                  onClick={handleQuickFill}
                  disabled={loading || selectionCount === 8}
                  className="min-h-touch px-3 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase flex items-center gap-1 press-feedback"
                  title="Auto-fill empty positions with balanced picks"
                >
                  <Wand2 className="w-3 h-3" /> Quick Fill
                </button>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="min-h-touch px-3 border border-line text-muted text-xs font-bold uppercase hover:border-line-strong hover:text-white active:text-white flex items-center gap-1 press-feedback"
                >
                  <Save className="w-3 h-3" /> Templates
                </button>
                <button
                  onClick={onClose}
                  className="min-w-touch min-h-touch -mr-2 flex items-center justify-center text-muted hover:text-white active:text-white press-feedback"
                  aria-label="Close lineup editor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Budget Bar */}
          <div className="px-4 py-3 bg-background border-b border-line flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-interactive" />
                <span className="text-sm text-muted">Budget:</span>
                <span
                  className={`text-lg font-data font-bold ${isOverLimit ? 'text-red-500' : remainingPoints < 10 ? 'text-warning' : 'text-interactive'}`}
                >
                  {totalPoints} / {pointLimit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold ${isComplete ? 'text-green-400' : 'text-muted'}`}
                >
                  {selectionCount}/8 selected
                </span>
                {isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-none">
                    <AlertCircle className="w-3 h-3" /> Over Budget
                  </span>
                )}
                {isComplete && !isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-none">
                    <Check className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-line overflow-hidden rounded-none">
              <div
                className={`h-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-interactive'}`}
                style={{ width: `${Math.min((totalPoints / pointLimit) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Prominent save-error banner — mirrors the lock/celebration
              messaging so change-limit and other save failures can't be lost
              behind the modal the way a bottom toast is. */}
          {saveError && (
            <div
              role="alert"
              aria-live="assertive"
              className="px-4 py-3 bg-red-500/15 border-b-2 border-red-500 flex items-start gap-3 flex-shrink-0 animate-slide-in-top"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm font-bold text-red-300 leading-snug">{saveError}</p>
              <button
                onClick={() => setSaveError(null)}
                className="min-w-touch min-h-touch -my-1 -mr-2 flex items-center justify-center text-red-400/70 hover:text-red-300 active:text-red-300 press-feedback"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-interactive border-t-transparent rounded-none animate-spin mx-auto mb-3" />
                <p className="text-xs text-muted uppercase tracking-wider">Loading corps...</p>
              </div>
            ) : (
              <div className="flex-1 flex min-h-0">
                {/* Left Panel - Your Lineup (hidden on mobile when viewing selection) */}
                <div
                  className={`w-full lg:w-80 flex-shrink-0 border-r border-line overflow-y-auto min-h-0 ${mobileView === 'selection' ? 'hidden lg:block' : ''}`}
                >
                  <div className="p-4 space-y-4">
                    {/* Draft Helper */}
                    <DraftHelper
                      suggestions={draftSuggestions}
                      onSelectSuggestion={(corps, captionId) => {
                        if (captionId) {
                          handleSelectionChange(captionId, corps);
                        }
                      }}
                      selections={selections}
                      activeCaption={activeCaption}
                    />

                    {/* Your Lineup - Caption List */}
                    <div className="bg-background border border-line">
                      <div className="p-3 border-b border-line flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                          <Award className="w-3 h-3" /> Your Lineup
                        </h3>
                        {selectionCount < 8 && (
                          <button
                            onClick={handleQuickFill}
                            disabled={loading}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-[10px] font-bold uppercase rounded-none disabled:opacity-50"
                          >
                            <Wand2 className="w-3 h-3" /> Quick Fill
                          </button>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        {captions.map((caption) => {
                          const sel = getSelectedCorps(caption.id);
                          const isActive = activeCaption === caption.id;
                          return (
                            <CaptionButton
                              key={caption.id}
                              caption={caption}
                              selected={sel}
                              isActive={isActive}
                              onClick={() => handleCaptionClick(caption.id)}
                              categoryColor={categoryColors[caption.category]}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel - Corps Selection (full screen on mobile when viewing selection) */}
                <div
                  className={`flex-1 flex flex-col overflow-hidden min-h-0 ${mobileView === 'lineup' ? 'hidden lg:flex' : ''}`}
                >
                  {activeCaption && activeCaptionData ? (
                    <>
                      {/* Caption Header */}
                      <div className="px-4 py-3 bg-surface-raised border-b border-line flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-1.5 h-6 rounded-none ${categoryColors[activeCaptionData.category]}`}
                            />
                            <div>
                              <h3 className="text-sm font-bold text-white">
                                {activeCaptionData.name}
                              </h3>
                              <p className="text-[10px] text-muted">{activeCaptionData.category}</p>
                            </div>
                          </div>
                          {activeCaptionSelection && (
                            <button
                              onClick={() => handleSelectionChange(activeCaption, null)}
                              className="flex items-center gap-2 px-2 py-1 text-red-400 hover:bg-red-500/10 rounded-none text-xs"
                            >
                              <X className="w-3 h-3" /> Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Corps Search + List */}
                      <CorpsSelectionList
                        corpsList={filteredCorps}
                        searchValue={corpsSearch}
                        onSearchChange={setCorpsSearch}
                        selections={selections}
                        activeCaption={activeCaption}
                        activeCaptionSelection={activeCaptionSelection}
                        totalPoints={totalPoints}
                        pointLimit={pointLimit}
                        hotCorpsData={hotCorpsData}
                        onSelect={(corps) => handleCorpsSelect(activeCaption, corps)}
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                      <div>
                        <Award className="w-12 h-12 text-muted mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-muted mb-1">Select a Caption</h3>
                        <p className="text-sm text-muted">
                          Click on a caption from Your Lineup to see available corps
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex items-center justify-between gap-3 flex-shrink-0 safe-area-bottom">
            <p className="text-[10px] text-muted leading-snug min-w-0 hidden sm:block">
              Locked lineups are scored nightly at 2 AM ET — next run in{' '}
              <span className="text-cyan-400 font-bold font-data tabular-nums">
                {formatCountdown(scoresInMs)}
              </span>
            </p>
            <div className="flex justify-end gap-2 flex-shrink-0 ml-auto">
              <button
                onClick={onClose}
                disabled={saving}
                className="min-h-touch px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50 press-feedback"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isComplete || isOverLimit || saving || loading || changesBlocked}
                title={
                  changesBlocked
                    ? 'Caption changes are currently closed — see the change-window indicator above'
                    : undefined
                }
                className="min-h-touch px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover active:bg-interactive-subtle disabled:opacity-50 flex items-center gap-2 press-feedback-strong"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-none animate-spin" />
                    Saving...
                  </>
                ) : changesBlocked ? (
                  <>
                    <Trophy className="w-4 h-4" />
                    Changes {changeInfo?.status === 'locked' ? 'Locked' : 'Closed'}
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    Lock Lineup ({totalPoints}/{pointLimit})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTemplateModal && (
        <TemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          onSave={handleSaveTemplate}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          currentLineup={selections}
        />
      )}

      {showCelebration && <LineupCelebration onComplete={handleCelebrationComplete} />}
    </Portal>
  );
};

export default CaptionSelectionModal;
