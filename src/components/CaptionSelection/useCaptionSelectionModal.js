// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// useCaptionSelectionModal — all state, derived values, and handlers for
// CaptionSelectionModal. Extracted so the modal component stays a (large but)
// render-only surface; this hook owns the caption-drafting logic.
// =============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getHotCorps, getActiveLineupKeys, saveLineup } from '../../api/functions';
import { queueLineupSave } from '../../lib/offlineLineupQueue';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCorpsValues } from '../../hooks/useCorpsValues';
import { useProfileStore } from '../../store/profileStore';
import { useSeasonDeadlines } from '../../hooks/useSeasonClock';
import { useSeasonStore } from '../../store/seasonStore';
import { POINT_CAPS } from '../../utils/classRegistry';
import { generateQuickFillLineup } from './quickFillLineup';

export const CAPTIONS = [
  { id: 'GE1', name: 'General Effect 1', category: 'General Effect' },
  { id: 'GE2', name: 'General Effect 2', category: 'General Effect' },
  { id: 'VP', name: 'Visual Proficiency', category: 'Visual' },
  { id: 'VA', name: 'Visual Analysis', category: 'Visual' },
  { id: 'CG', name: 'Color Guard', category: 'Visual' },
  { id: 'B', name: 'Brass', category: 'Music' },
  { id: 'MA', name: 'Music Analysis', category: 'Music' },
  { id: 'P', name: 'Percussion', category: 'Music' },
];

export const CATEGORY_COLORS = {
  'General Effect': 'bg-yellow-500',
  Visual: 'bg-interactive',
  Music: 'bg-purple-400',
};

export function useCaptionSelectionModal({
  onClose,
  onSubmit,
  corpsClass,
  currentLineup,
  seasonId,
  initialCaption,
}) {
  const { user } = useAuth();
  const [selections, setSelections] = useState(currentLineup || {});
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [draftSuggestions, setDraftSuggestions] = useState({ hot: [], value: [], history: [] });
  const [hotCorpsData, setHotCorpsData] = useState({}); // Per-caption hot status
  const [activeLineupKeys, setActiveLineupKeys] = useState(new Set()); // Other users' lineup keys
  const [extrasLoading, setExtrasLoading] = useState(true); // hot corps + lineup keys fetch

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

  // Profile-derived state — the global profileStore already holds a live
  // onSnapshot copy of the profile doc, so no manual getProfile fetch here.
  const profile = useProfileStore((state) => state.profile);

  // Corps the user has drafted before, across all their corps (for the
  // history draft suggestions).
  const userHistory = useMemo(() => {
    const history = new Set();
    if (profile?.corps) {
      Object.values(profile.corps).forEach((c) => {
        if (c?.lineup)
          Object.values(c.lineup).forEach((sel) => {
            if (sel) history.add(sel.split('|')[0]);
          });
      });
    }
    return Array.from(history);
  }, [profile?.corps]);

  // Change limits: initial setup (no existing lineup) is exempt; the weekly
  // change counter ({seasonUid, week, used}) is combined with the live change
  // window to compute changes remaining.
  const isInitialSetup =
    !!profile && Object.keys(profile.corps?.[corpsClass]?.lineup || {}).length === 0;
  const weeklyTrades = profile?.corps?.[corpsClass]?.weeklyTrades || null;

  // Live countdown to the nightly score processing (shown next to Lock
  // Lineup) plus the current caption-change window (unlimited / weekly /
  // championship / lockouts). `trade` mirrors the backend rules in
  // functions/src/helpers/captionWindows.js and ticks with the clock.
  const { scoresInMs, scoresPending, trade: changeInfo } = useSeasonDeadlines(30000, corpsClass);
  const seasonUid = useSeasonStore((s) => s.seasonData?.seasonUid);

  // Changes remaining in the current allotment (weekly 3 / championship 2 per
  // day). The stored counter's `week` field holds changeInfo.periodKey — the
  // week number for weekly limits, the competition day during Championship
  // Week (so the per-day allotment resets nightly).
  const tradesRemaining = useMemo(() => {
    if (!changeInfo || !Number.isFinite(changeInfo.tradeLimit)) return Infinity;
    const used =
      weeklyTrades &&
      weeklyTrades.seasonUid === seasonUid &&
      weeklyTrades.week === changeInfo.periodKey
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
  const dialogRef = useRef(null);
  // Trap keyboard focus inside the dialog (WCAG 2.4.3); restores on close
  useFocusTrap(dialogRef);

  const captions = CAPTIONS;

  const pointLimit = POINT_CAPS[corpsClass];

  const categoryColors = CATEGORY_COLORS;

  // Load templates
  useEffect(() => {
    const saved = localStorage.getItem(`lineupTemplates_${user?.uid}_${corpsClass}`);
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch {}
    }
  }, [user?.uid, corpsClass]);

  // Available corps via the shared corpsValues cache entry (same query key as
  // Landing/Dashboard/Onboarding), so reopening the modal costs no re-fetch.
  const corpsQuery = useCorpsValues(seasonId);
  const availableCorps = useMemo(() => {
    const corps = (corpsQuery.data ?? [])
      .filter((c) => (c.points || 0) <= 50)
      .map((c) => ({
        ...c,
        performanceData: {
          avgScore: c.avgScore || 80,
          // Value calculation: good score per point ratio
          isValue: (c.avgScore || 80) / c.points > 4.5,
        },
      }));
    corps.sort((a, b) => b.points - a.points);
    return corps;
  }, [corpsQuery.data]);

  useEffect(() => {
    if (corpsQuery.isError) {
      toast.error('Failed to load corps data');
    }
  }, [corpsQuery.isError]);

  // Load hot status (per-caption) and other users' active lineup keys. These
  // are dynamic across users/days, so they refresh on every open.
  useEffect(() => {
    let cancelled = false;
    const fetchExtras = async () => {
      setExtrasLoading(true);
      const [hotCorpsResult, lineupKeysResult] = await Promise.all([
        getHotCorps().catch(() => ({ data: { hotCorps: {} } })),
        getActiveLineupKeys({ corpsClass }).catch(() => ({ data: { lineupKeys: [] } })),
      ]);

      if (!cancelled) {
        // Store per-caption hot data for dynamic lookups
        setHotCorpsData(hotCorpsResult.data?.hotCorps || {});
        // Store active lineup keys as a Set for O(1) lookup
        setActiveLineupKeys(new Set(lineupKeysResult.data?.lineupKeys || []));
        setExtrasLoading(false);
      }
    };
    fetchExtras();
    return () => {
      cancelled = true;
    };
  }, [corpsClass]);

  const loading = !!seasonId && (corpsQuery.isPending || extrasLoading);

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

  // Captions edited since the lineup was opened, versus the last saved lineup.
  // Drives the per-row "unsaved" dot and the change count on the confirm
  // button so the batch save reads as "confirm these N changes". Suppressed
  // during initial setup, where every slot is trivially a "change".
  const changedCaptions = useMemo(() => {
    const base = currentLineup || {};
    const changed = new Set();
    captions.forEach((c) => {
      if ((base[c.id] || null) !== (selections[c.id] || null)) changed.add(c.id);
    });
    return changed;
  }, [selections, currentLineup, captions]);
  const changeCount = isInitialSetup ? 0 : changedCaptions.size;

  // Proactive, touch-friendly reason the confirm button is unavailable — the
  // native title tooltip never fires on touch, so mobile users need this
  // spelled out next to the button rather than hidden behind a hover.
  const confirmHint = useMemo(() => {
    if (changesBlocked) {
      if (changeInfo?.status === 'locked')
        return 'Changes are locked overnight — reopen at 2 AM ET.';
      if (changeInfo?.phase === 'blackout') return 'Changes are closed on Days 43-44.';
      if (changeInfo?.phase === 'championship') return 'This class has finished competing.';
      return 'The season has ended — changes are closed.';
    }
    if (!isComplete) return `Pick all 8 captions — ${selectionCount}/8 chosen.`;
    if (isOverLimit) return `Over budget by ${totalPoints - pointLimit}. Swap for cheaper corps.`;
    if (!isInitialSetup && changeCount === 0)
      return 'No changes yet — edit a caption to enable saving.';
    return null;
  }, [
    changesBlocked,
    changeInfo,
    isComplete,
    selectionCount,
    isOverLimit,
    totalPoints,
    pointLimit,
    isInitialSetup,
    changeCount,
  ]);

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

  const handleCorpsSelect = (captionId, corps) => {
    handleSelectionChange(captionId, corps);

    // Drafting flow: jump to the next still-empty caption so filling all 8 is a
    // fast tap-through. `selections` is the pre-update snapshot, which is fine
    // here — we only test OTHER captions for emptiness.
    const currentIndex = captions.findIndex((c) => c.id === captionId);
    const searchOrder = [...captions.slice(currentIndex + 1), ...captions.slice(0, currentIndex)];
    const nextEmpty = searchOrder.find((c) => !selections[c.id]);
    if (nextEmpty) {
      setActiveCaption(nextEmpty.id);
      return;
    }

    // No empty slots left — the weekly-change case, where the point is to swap a
    // few already-filled captions and confirm them together. Return to the
    // lineup board (mobile) so the user sees every pending change accumulate and
    // can pick the next caption to swap, or hit Confirm, rather than being
    // stranded in this one caption's picker after each edit.
    setMobileView('lineup');
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
          "Caption changes are locked overnight. They reopen at 2:00 AM ET, once the night's scores are final."
        );
      } else if (changeInfo.phase === 'blackout') {
        setSaveError(
          'Caption changes are closed on Days 43-44. Championship changes open on Day 45 at 2:00 AM ET.'
        );
      } else if (changeInfo.phase === 'championship') {
        setSaveError(
          'This class has finished competing for the season — its caption changes are closed.'
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

  return {
    // refs
    dialogRef,
    // static config
    captions,
    categoryColors,
    pointLimit,
    // selections + derived
    selections,
    totalPoints,
    remainingPoints,
    isOverLimit,
    isComplete,
    selectionCount,
    changedCaptions,
    changeCount,
    // caption navigation
    activeCaption,
    activeCaptionData,
    activeCaptionSelection,
    mobileView,
    // corps list
    filteredCorps,
    corpsSearch,
    setCorpsSearch,
    hotCorpsData,
    draftSuggestions,
    // status / windows
    loading,
    saving,
    saveError,
    setSaveError,
    isInitialSetup,
    changeInfo,
    changesBlocked,
    tradesRemaining,
    confirmHint,
    scoresInMs,
    scoresPending,
    // templates + celebration
    templates,
    showTemplateModal,
    setShowTemplateModal,
    showCelebration,
    // handlers
    getSelectedCorps,
    handleSelectionChange,
    handleCaptionClick,
    handleBackToLineup,
    handleCorpsSelect,
    handleSaveTemplate,
    handleLoadTemplate,
    handleDeleteTemplate,
    handleQuickFill,
    handleSubmit,
    handleCelebrationComplete,
  };
}
