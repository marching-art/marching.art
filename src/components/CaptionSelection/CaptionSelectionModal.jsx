// =============================================================================
// CAPTION SELECTION MODAL - CONSOLIDATED CAPTION-FOCUSED DESIGN
// =============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check, AlertCircle, TrendingUp, TrendingDown, Minus, Flame, Snowflake,
  Trophy, Zap, Clock, Save, Download, Trash2, ChevronDown, ChevronUp,
  Target, History, Award, X, PartyPopper, ArrowLeft, RefreshCw, Wand2
} from 'lucide-react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useAuth } from '../../App';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// -----------------------------------------------------------------------------
// TREND BADGE
// -----------------------------------------------------------------------------
const TrendBadge = ({ trend, momentum }) => {
  if (!trend) return null;
  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />;
      default: return <Minus className="w-3 h-3 text-gray-500" />;
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

// -----------------------------------------------------------------------------
// LINEUP CELEBRATION
// -----------------------------------------------------------------------------
const LineupCelebration = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90">
      <div className="text-center p-8">
        <div className="mb-4">
          <PartyPopper className="w-16 h-16 text-[#0057B8] mx-auto" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">LINEUP LOCKED</h2>
        <p className="text-gray-400">Your draft is set. Good luck!</p>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// CORPS OPTION ROW
// -----------------------------------------------------------------------------
const CorpsOptionRow = ({ corps, isSelected, onSelect, disabled, captionHotStatus }) => {
  return (
    <button
      onClick={() => !disabled && onSelect(corps)}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]'
          : disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white/5 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 rounded-sm ${
          isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'
        }`}>
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="font-medium text-white text-sm truncate">{corps.corpsName}</span>
        <span className="text-[10px] text-gray-500">'{corps.sourceYear?.slice(-2)}</span>
        {captionHotStatus?.isHot && (
          <span
            className="flex items-center gap-0.5 px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] rounded"
            title={captionHotStatus.improvement > 0
              ? `Up ${captionHotStatus.improvement}% in this caption recently`
              : 'Top performer in this caption recently'}
          >
            <Flame className="w-2.5 h-2.5" /> Hot
          </span>
        )}
      </div>
      <div className={`text-xs font-data font-bold ${isSelected ? 'text-[#0057B8]' : 'text-gray-400'}`}>
        {corps.points} pts
      </div>
    </button>
  );
};

// -----------------------------------------------------------------------------
// TEMPLATE MODAL
// -----------------------------------------------------------------------------
const TemplateModal = ({ isOpen, onClose, templates, onSave, onLoad, onDelete, currentLineup }) => {
  const [newTemplateName, setNewTemplateName] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Lineup Templates</h3>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Save current */}
          <div className="mb-4 p-3 bg-[#0a0a0a] border border-[#333]">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Save Current</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#333] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
              />
              <button
                onClick={() => { if (newTemplateName.trim()) { onSave(newTemplateName.trim()); setNewTemplateName(''); }}}
                disabled={!newTemplateName.trim() || Object.keys(currentLineup).length === 0}
                className="px-3 py-2 bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Saved templates */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No saved templates</p>
            ) : (
              templates.map((template, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#333]">
                  <div>
                    <div className="font-bold text-white text-sm">{template.name}</div>
                    <div className="text-[10px] text-gray-500">{Object.keys(template.lineup).length} selections • {template.totalPoints} pts</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onLoad(template)} className="p-1.5 hover:bg-[#0057B8]/20 text-[#0057B8]">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(idx)} className="p-1.5 hover:bg-red-500/20 text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end">
          <button onClick={onClose} className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// DRAFT HELPER
// -----------------------------------------------------------------------------
const DraftHelper = ({ suggestions, onSelectSuggestion, selections, activeCaption }) => {
  const [activeTab, setActiveTab] = useState('hot');
  const [isExpanded, setIsExpanded] = useState(false);

  const tabs = [
    { id: 'hot', label: 'Hot', icon: Flame, color: 'text-orange-400' },
    { id: 'value', label: 'Value', icon: Zap, color: 'text-green-400' },
    { id: 'history', label: 'History', icon: History, color: 'text-[#0057B8]' },
  ];

  const currentSuggestions = suggestions[activeTab] || [];

  return (
    <div className="bg-[#0a0a0a] border border-[#333]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Draft Helper</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <>
          <div className="flex border-t border-[#333]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-bold uppercase transition-colors ${
                    activeTab === tab.id ? `${tab.color} bg-white/5 border-b-2 border-current` : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="p-2 space-y-1 max-h-32 overflow-y-auto border-t border-[#333]">
            {currentSuggestions.length === 0 ? (
              <p className="text-center text-gray-600 py-2 text-xs">No suggestions</p>
            ) : (
              currentSuggestions.slice(0, 4).map((corps, idx) => {
                const isAlreadySelected = Object.values(selections).some(s => s && s.split('|')[0] === corps.corpsName);
                return (
                  <button
                    key={idx}
                    onClick={() => !isAlreadySelected && activeCaption && onSelectSuggestion(corps, activeCaption)}
                    disabled={isAlreadySelected || !activeCaption}
                    className={`w-full flex items-center justify-between p-2 text-xs ${
                      isAlreadySelected || !activeCaption ? 'opacity-50' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-gray-300">{corps.corpsName}</span>
                    <span className="text-gray-500 font-data">{corps.points} pts</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// TRADES REMAINING INDICATOR
// -----------------------------------------------------------------------------
const TradesRemainingIndicator = ({ tradesRemaining, isUnlimited, isInitialSetup }) => {
  if (isInitialSetup) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded">
        <RefreshCw className="w-3 h-3 text-green-400" />
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
          Initial Setup - Unlimited Changes
        </span>
      </div>
    );
  }

  if (isUnlimited) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0057B8]/10 border border-[#0057B8]/30 rounded">
        <RefreshCw className="w-3 h-3 text-[#0057B8]" />
        <span className="text-[10px] font-bold text-[#0057B8] uppercase tracking-wider">
          Unlimited Changes This Week
        </span>
      </div>
    );
  }

  const isLow = tradesRemaining <= 1;
  const colorClass = isLow ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 'text-gray-400 border-[#333] bg-[#222]';

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 border rounded ${colorClass}`}>
      <RefreshCw className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-wider">
        {tradesRemaining} Change{tradesRemaining !== 1 ? 's' : ''} Left This Week
      </span>
    </div>
  );
};

// -----------------------------------------------------------------------------
// CAPTION BUTTON (for Your Lineup panel)
// -----------------------------------------------------------------------------
const CaptionButton = ({ caption, selected, isActive, onClick, categoryColor }) => {
  const hasValue = !!selected;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-2.5 border transition-all ${
        isActive
          ? 'border-[#0057B8] bg-[#0057B8]/10'
          : hasValue
            ? 'border-green-500/30 bg-green-500/5 hover:border-[#0057B8] hover:bg-[#0057B8]/10'
            : 'border-[#333] hover:border-[#0057B8] hover:bg-[#0057B8]/10'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-1.5 h-4 rounded-full ${categoryColor}`} />
        <div className="text-left min-w-0">
          <div className="text-xs font-bold text-white">{caption.id}</div>
          <div className="text-[10px] text-gray-500 truncate">{caption.name}</div>
        </div>
      </div>
      {hasValue ? (
        <div className="flex items-center gap-2">
          <div className="text-right min-w-0">
            <div className="text-xs text-white truncate max-w-[100px]">{selected.name}</div>
            <div className="text-[10px] font-data text-[#0057B8]">{selected.points} pts</div>
          </div>
          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
        </div>
      ) : (
        <div className="text-[10px] text-[#0057B8] font-bold">+ DRAFT</div>
      )}
    </button>
  );
};

// -----------------------------------------------------------------------------
// MAIN MODAL
// -----------------------------------------------------------------------------
const CaptionSelectionModal = ({ onClose, onSubmit, corpsClass, currentLineup, seasonId, initialCaption }) => {
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

  // Active caption for selection
  const [activeCaption, setActiveCaption] = useState(initialCaption || null);

  // Trade limits state
  const [tradesRemaining, setTradesRemaining] = useState(3);
  const [isUnlimitedTrades, setIsUnlimitedTrades] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);

  // Close on Escape key
  useEscapeKey(onClose);

  const captions = [
    { id: 'GE1', name: 'General Effect 1', category: 'General Effect' },
    { id: 'GE2', name: 'General Effect 2', category: 'General Effect' },
    { id: 'VP', name: 'Visual Proficiency', category: 'Visual' },
    { id: 'VA', name: 'Visual Analysis', category: 'Visual' },
    { id: 'CG', name: 'Color Guard', category: 'Visual' },
    { id: 'B', name: 'Brass', category: 'Music' },
    { id: 'MA', name: 'Music Analysis', category: 'Music' },
    { id: 'P', name: 'Percussion', category: 'Music' },
  ];

  const pointLimits = { soundSport: 90, aClass: 60, openClass: 120, worldClass: 150 };
  const pointLimit = pointLimits[corpsClass];

  const CLASS_LABELS = { soundSport: 'SoundSport', aClass: 'A Class', openClass: 'Open Class', worldClass: 'World Class' };

  const categoryColors = {
    'General Effect': 'bg-yellow-500',
    'Visual': 'bg-[#0057B8]',
    'Music': 'bg-purple-400',
  };

  // Load templates
  useEffect(() => {
    const saved = localStorage.getItem(`lineupTemplates_${user?.uid}_${corpsClass}`);
    if (saved) { try { setTemplates(JSON.parse(saved)); } catch (e) {} }
  }, [user?.uid, corpsClass]);

  // Load user history and trade limits
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.uid) return;
      try {
        const ref = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const history = new Set();
          if (data.corps) {
            Object.values(data.corps).forEach(c => {
              if (c?.lineup) Object.values(c.lineup).forEach(sel => { if (sel) history.add(sel.split('|')[0]); });
            });
          }
          setUserHistory(Array.from(history));

          // Check if initial setup (no existing lineup)
          const currentCorpsData = data.corps?.[corpsClass];
          const existingLineup = currentCorpsData?.lineup || {};
          const hasExistingLineup = Object.keys(existingLineup).length > 0;
          setIsInitialSetup(!hasExistingLineup);

          // Get weekly trades info
          const weeklyTrades = currentCorpsData?.weeklyTrades;

          // Load season data to check trade limits
          const seasonRef = doc(db, 'game-settings/season');
          const seasonSnap = await getDoc(seasonRef);
          if (seasonSnap.exists()) {
            const seasonData = seasonSnap.data();
            const now = new Date();
            const seasonStartDate = seasonData.schedule?.startDate?.toDate();

            if (seasonStartDate) {
              const diffInMillis = now.getTime() - seasonStartDate.getTime();
              const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
              const currentWeek = Math.ceil(currentDay / 7);

              // Determine if unlimited trades
              let unlimited = false;
              if (!hasExistingLineup) unlimited = true;
              if (seasonData.status === 'off-season' && currentWeek === 1) unlimited = true;
              if (seasonData.status === 'live-season' && [1, 2, 3].includes(currentWeek)) unlimited = true;

              setIsUnlimitedTrades(unlimited);

              if (!unlimited && weeklyTrades) {
                const tradesUsed = (weeklyTrades.seasonUid === seasonData.seasonUid &&
                  weeklyTrades.week === currentWeek) ? weeklyTrades.used : 0;
                setTradesRemaining(3 - tradesUsed);
              } else if (!unlimited) {
                setTradesRemaining(3);
              }
            }
          }
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
      if (!seasonId) { setLoading(false); return; }
      try {
        setLoading(true);

        // Fetch corps data, hot status, and active lineup keys in parallel
        const corpsRef = doc(db, 'dci-data', seasonId);
        const getHotCorpsFn = httpsCallable(functions, 'getHotCorps');
        const getActiveLineupKeysFn = httpsCallable(functions, 'getActiveLineupKeys');

        const [corpsSnap, hotCorpsResult, lineupKeysResult] = await Promise.all([
          getDoc(corpsRef),
          getHotCorpsFn().catch(() => ({ data: { hotCorps: {} } })),
          getActiveLineupKeysFn({ corpsClass }).catch(() => ({ data: { lineupKeys: [] } }))
        ]);

        if (!cancelled && corpsSnap.exists()) {
          // Store per-caption hot data for dynamic lookups
          const hotData = hotCorpsResult.data?.hotCorps || {};
          setHotCorpsData(hotData);

          // Store active lineup keys as a Set for O(1) lookup
          const lineupKeys = lineupKeysResult.data?.lineupKeys || [];
          setActiveLineupKeys(new Set(lineupKeys));

          let corps = corpsSnap.data().corpsValues || [];

          corps = corps.map(c => ({
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
      } catch (e) { toast.error('Failed to load corps data'); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchCorps();
    return () => { cancelled = true; };
  }, [seasonId, corpsClass]);

  // Generate suggestions based on the active caption
  const generateSuggestions = useCallback((corps, caption, hotData) => {
    // Hot suggestions: corps that are hot for the current caption
    const hot = corps.filter(c => {
      const corpsId = `${c.corpsName}|${c.sourceYear}`;
      return hotData[corpsId]?.[caption]?.isHot;
    }).slice(0, 5);

    const value = corps.filter(c => c.performanceData?.isValue).slice(0, 5);
    const history = corps.filter(c => userHistory.includes(c.corpsName)).slice(0, 5);
    setDraftSuggestions({ hot, value, history });
  }, [userHistory]);

  // Regenerate suggestions when caption changes or data loads
  useEffect(() => {
    if (availableCorps.length > 0 && activeCaption) {
      generateSuggestions(availableCorps, activeCaption, hotCorpsData);
    }
  }, [availableCorps, activeCaption, hotCorpsData, generateSuggestions]);

  const calculateTotalPoints = useCallback(() => {
    return Object.values(selections).reduce((t, s) => t + (s ? parseInt(s.split('|')[2]) || 0 : 0), 0);
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

  const handleSelectionChange = useCallback((captionId, corpsData) => {
    if (!corpsData) {
      const newSel = { ...selections };
      delete newSel[captionId];
      setSelections(newSel);
    } else {
      setSelections(prev => ({ ...prev, [captionId]: `${corpsData.corpsName}|${corpsData.sourceYear}|${corpsData.points}` }));
    }
  }, [selections]);

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
    const currentIndex = captions.findIndex(c => c.id === captionId);
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
    const newTemplate = { name, lineup: selections, totalPoints: calculateTotalPoints(), createdAt: new Date().toISOString() };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem(`lineupTemplates_${user?.uid}_${corpsClass}`, JSON.stringify(updated));
    toast.success(`Template "${name}" saved!`);
  };

  const handleLoadTemplate = (template) => {
    const valid = {};
    Object.entries(template.lineup).forEach(([id, sel]) => {
      const [name] = sel.split('|');
      const c = availableCorps.find(x => x.corpsName === name);
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

  // Generate a lineup key matching the server format for duplicate checking
  const generateLineupKey = useCallback((lineup) => {
    return `${corpsClass}_${Object.values(lineup).filter(Boolean).sort().join("_")}`;
  }, [corpsClass]);

  // Quick Fill - auto-fill empty slots randomly while targeting 95-100% of point limit
  // Guarantees all captions are filled by reserving budget for remaining slots
  // Also ensures the generated lineup doesn't match any existing lineups
  const handleQuickFill = useCallback(() => {
    if (availableCorps.length === 0) return;

    const emptyCaptions = captions.filter(c => !selections[c.id]);

    if (emptyCaptions.length === 0) {
      toast('All positions are already filled!', { icon: '✓' });
      return;
    }

    // Helper to check if picking a corps leaves enough budget for remaining slots
    const isViablePick = (corps, slotsAfterThis, budgetAfterPick, usedCorpsSet) => {
      if (slotsAfterThis === 0) return true;

      // Get corps that will still be available after this pick
      const remainingCorps = availableCorps
        .filter(c => !usedCorpsSet.has(c.corpsName) && c.corpsName !== corps.corpsName)
        .sort((a, b) => a.points - b.points);

      // Calculate minimum points needed to fill remaining slots
      const minForRemaining = remainingCorps
        .slice(0, slotsAfterThis)
        .reduce((sum, c) => sum + c.points, 0);

      return budgetAfterPick >= minForRemaining;
    };

    // Helper to generate a random lineup that fills all slots
    const generateRandomLineup = () => {
      const newSelections = { ...selections };

      // Track which corps have been used
      const usedCorps = new Set(
        Object.values(newSelections)
          .filter(Boolean)
          .map(s => s.split('|')[0])
      );

      let usedPoints = Object.values(newSelections).reduce(
        (t, s) => t + (s ? parseInt(s.split('|')[2]) || 0 : 0), 0
      );
      let remainingBudget = pointLimit - usedPoints;

      // Shuffle empty captions for random ordering
      const shuffledCaptions = [...emptyCaptions].sort(() => Math.random() - 0.5);

      for (let i = 0; i < shuffledCaptions.length; i++) {
        const caption = shuffledCaptions[i];
        const slotsAfterThis = shuffledCaptions.length - i - 1;

        // Get all viable candidates (picking them leaves enough for remaining slots)
        const viableCandidates = availableCorps
          .filter(c => !usedCorps.has(c.corpsName) && c.points <= remainingBudget)
          .filter(c => isViablePick(c, slotsAfterThis, remainingBudget - c.points, usedCorps));

        if (viableCandidates.length === 0) {
          // Shouldn't happen with proper math, but safety fallback
          continue;
        }

        // Calculate target to aim for 95-100% utilization
        // Ideal per slot = distribute remaining budget evenly across remaining slots
        const idealPerSlot = Math.floor(remainingBudget / (slotsAfterThis + 1));

        // Prefer higher-point corps (to maximize budget usage) but within viable range
        // Sort by points descending and filter to those near ideal or above
        const sortedByPoints = [...viableCandidates].sort((a, b) => b.points - a.points);

        // Take candidates that are at least 70% of ideal (but still viable)
        const minPreferred = Math.floor(idealPerSlot * 0.7);
        let preferredCandidates = sortedByPoints.filter(c => c.points >= minPreferred);

        // If no candidates meet preference, use all viable (prioritizing higher points)
        if (preferredCandidates.length === 0) {
          preferredCandidates = sortedByPoints;
        }

        // Randomly select from preferred candidates
        const randomIndex = Math.floor(Math.random() * preferredCandidates.length);
        const selected = preferredCandidates[randomIndex];

        newSelections[caption.id] = `${selected.corpsName}|${selected.sourceYear}|${selected.points}`;
        usedCorps.add(selected.corpsName);
        remainingBudget -= selected.points;
      }

      return newSelections;
    };

    // Try to generate a unique lineup (retry up to 50 times to avoid duplicates)
    const maxAttempts = 50;
    let attempt = 0;
    let newSelections;
    let lineupKey;

    do {
      newSelections = generateRandomLineup();
      lineupKey = generateLineupKey(newSelections);
      attempt++;
    } while (activeLineupKeys.has(lineupKey) && attempt < maxAttempts);

    // Check if we found a unique lineup
    if (activeLineupKeys.has(lineupKey)) {
      toast.error('Could not generate a unique lineup. Try adjusting some selections manually.');
      return;
    }

    setSelections(newSelections);

    const filledCount = emptyCaptions.filter(c => newSelections[c.id]).length;
    if (filledCount > 0) {
      toast.success(`Auto-filled ${filledCount} position${filledCount > 1 ? 's' : ''}!`);
    }
  }, [availableCorps, selections, captions, pointLimit, activeLineupKeys, generateLineupKey]);

  const handleSubmit = async () => {
    if (!isComplete) { toast.error('Please select all 8 captions'); return; }
    if (isOverLimit) { toast.error(`Lineup exceeds ${pointLimit} point limit`); return; }
    try {
      setSaving(true);
      const fn = httpsCallable(functions, 'saveLineup');
      await fn({ lineup: selections, corpsClass });
      setShowCelebration(true);
    } catch (e) {
      toast.error(e.message || 'Failed to save lineup');
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
  const activeCaptionData = activeCaption ? captions.find(c => c.id === activeCaption) : null;
  const activeCaptionSelection = activeCaption ? getSelectedCorps(activeCaption) : null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 md:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-caption-selection"
      >
        <div className="w-full max-w-5xl max-h-[95vh] bg-[#1a1a1a] border border-[#333] rounded-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {/* Mobile back button when viewing selection */}
                {mobileView === 'selection' && (
                  <button
                    onClick={handleBackToLineup}
                    className="lg:hidden p-1.5 -ml-1.5 text-gray-400 hover:text-white"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 id="modal-title-caption-selection" className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    {mobileView === 'selection' && activeCaptionData
                      ? `Select for ${activeCaptionData.name}`
                      : 'Draft Your Lineup'}
                  </h2>
                  <p className="text-sm text-gray-500">{CLASS_LABELS[corpsClass]} • {pointLimit} pts budget</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TradesRemainingIndicator
                  tradesRemaining={tradesRemaining}
                  isUnlimited={isUnlimitedTrades}
                  isInitialSetup={isInitialSetup}
                />
                <button
                  onClick={handleQuickFill}
                  disabled={loading || selectionCount === 8}
                  className="h-8 px-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase flex items-center gap-1"
                  title="Auto-fill empty positions with balanced picks"
                >
                  <Wand2 className="w-3 h-3" /> Quick Fill
                </button>
                <button onClick={() => setShowTemplateModal(true)} className="h-8 px-3 border border-[#333] text-gray-400 text-xs font-bold uppercase hover:border-[#444] hover:text-white flex items-center gap-1">
                  <Save className="w-3 h-3" /> Templates
                </button>
                <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Budget Bar */}
          <div className="px-4 py-3 bg-[#0a0a0a] border-b border-[#333] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-[#0057B8]" />
                <span className="text-sm text-gray-400">Budget:</span>
                <span className={`text-lg font-data font-bold ${isOverLimit ? 'text-red-500' : remainingPoints < 10 ? 'text-yellow-500' : 'text-[#0057B8]'}`}>
                  {totalPoints} / {pointLimit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${isComplete ? 'text-green-400' : 'text-gray-500'}`}>
                  {selectionCount}/8 selected
                </span>
                {isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded">
                    <AlertCircle className="w-3 h-3" /> Over Budget
                  </span>
                )}
                {isComplete && !isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">
                    <Check className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-[#333] overflow-hidden rounded">
              <div className={`h-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-[#0057B8]'}`} style={{ width: `${Math.min((totalPoints / pointLimit) * 100, 100)}%` }} />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-500 uppercase tracking-wider">Loading corps...</p>
              </div>
            ) : (
              <div className="flex-1 flex min-h-0">
                {/* Left Panel - Your Lineup (hidden on mobile when viewing selection) */}
                <div className={`w-full lg:w-80 flex-shrink-0 border-r border-[#333] overflow-y-auto min-h-0 ${mobileView === 'selection' ? 'hidden lg:block' : ''}`}>
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
                    <div className="bg-[#0a0a0a] border border-[#333]">
                      <div className="p-3 border-b border-[#333] flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                          <Award className="w-3 h-3" /> Your Lineup
                        </h3>
                        {selectionCount < 8 && (
                          <button
                            onClick={handleQuickFill}
                            disabled={loading}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-[10px] font-bold uppercase rounded disabled:opacity-50"
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
                <div className={`flex-1 flex flex-col overflow-hidden min-h-0 ${mobileView === 'lineup' ? 'hidden lg:flex' : ''}`}>
                  {activeCaption && activeCaptionData ? (
                    <>
                      {/* Caption Header */}
                      <div className="px-4 py-3 bg-[#222] border-b border-[#333] flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-6 rounded-full ${categoryColors[activeCaptionData.category]}`} />
                            <div>
                              <h3 className="text-sm font-bold text-white">{activeCaptionData.name}</h3>
                              <p className="text-[10px] text-gray-500">{activeCaptionData.category}</p>
                            </div>
                          </div>
                          {activeCaptionSelection && (
                            <button
                              onClick={() => handleSelectionChange(activeCaption, null)}
                              className="flex items-center gap-2 px-2 py-1 text-red-400 hover:bg-red-500/10 rounded text-xs"
                            >
                              <X className="w-3 h-3" /> Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Corps List */}
                      <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="divide-y divide-[#222]">
                          {availableCorps.map((corps, idx) => {
                            const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                            const isCurrentSel = selections[activeCaption] === value;
                            const wouldExceed = !isCurrentSel && (totalPoints - (activeCaptionSelection?.points || 0) + corps.points > pointLimit);
                            // Get caption-specific hot status for this corps
                            const corpsId = `${corps.corpsName}|${corps.sourceYear}`;
                            const captionHotStatus = hotCorpsData[corpsId]?.[activeCaption];
                            return (
                              <CorpsOptionRow
                                key={idx}
                                corps={corps}
                                isSelected={isCurrentSel}
                                onSelect={() => handleCorpsSelect(activeCaption, corps)}
                                disabled={wouldExceed}
                                captionHotStatus={captionHotStatus}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                      <div>
                        <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-gray-400 mb-1">Select a Caption</h3>
                        <p className="text-sm text-gray-600">
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
          <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end gap-2 flex-shrink-0">
            <button onClick={onClose} disabled={saving} className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isComplete || isOverLimit || saving || loading}
              className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
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
