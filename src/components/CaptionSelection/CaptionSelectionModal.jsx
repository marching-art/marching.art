// =============================================================================
// CAPTION SELECTION MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check, AlertCircle, TrendingUp, TrendingDown, Minus, Info, Flame, Snowflake,
  Trophy, Zap, Clock, Save, Download, Trash2, ChevronDown, ChevronUp,
  Target, History, Award, X, PartyPopper
} from 'lucide-react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useAuth } from '../../App';

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
const CorpsOptionRow = ({ corps, isSelected, onSelect, disabled }) => {
  return (
    <button
      onClick={() => !disabled && onSelect(corps)}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
        isSelected
          ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]'
          : disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white/5 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 ${
          isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'
        }`}>
          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
        <span className="font-medium text-white text-sm truncate">{corps.corpsName}</span>
        <span className="text-[10px] text-gray-500">'{corps.sourceYear?.slice(-2)}</span>
        {corps.performanceData?.isHot && (
          <span className="flex items-center gap-0.5 px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[10px]">
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
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

        <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end">
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
const DraftHelper = ({ suggestions, onSelectSuggestion, selections }) => {
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
                    onClick={() => !isAlreadySelected && onSelectSuggestion(corps)}
                    disabled={isAlreadySelected}
                    className={`w-full flex items-center justify-between p-2 text-xs ${
                      isAlreadySelected ? 'opacity-50' : 'hover:bg-white/5'
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

  // Determine initial category based on initialCaption prop
  const getInitialCategory = () => {
    if (!initialCaption) return 'General Effect';
    const caption = captions.find(c => c.id === initialCaption);
    return caption?.category || 'General Effect';
  };

  const [expandedCategory, setExpandedCategory] = useState(getInitialCategory);

  const pointLimits = { soundSport: 90, aClass: 60, openClass: 120, worldClass: 150 };
  const pointLimit = pointLimits[corpsClass];

  const CLASS_LABELS = { soundSport: 'SoundSport', aClass: 'A Class', openClass: 'Open Class', worldClass: 'World Class' };

  // Load templates
  useEffect(() => {
    const saved = localStorage.getItem(`lineupTemplates_${user?.uid}_${corpsClass}`);
    if (saved) { try { setTemplates(JSON.parse(saved)); } catch (e) {} }
  }, [user?.uid, corpsClass]);

  // Load user history
  useEffect(() => {
    const loadHistory = async () => {
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
        }
      } catch (e) {}
    };
    loadHistory();
  }, [user?.uid]);

  // Load available corps
  useEffect(() => {
    let cancelled = false;
    const fetchCorps = async () => {
      if (!seasonId) { setLoading(false); return; }
      try {
        setLoading(true);
        const ref = doc(db, 'dci-data', seasonId);
        const snap = await getDoc(ref);
        if (!cancelled && snap.exists()) {
          let corps = snap.data().corpsValues || [];
          corps = corps.map(c => ({
            ...c,
            performanceData: {
              avgScore: c.avgScore || (Math.random() * 20 + 70),
              isHot: Math.random() > 0.7,
              isValue: (c.avgScore || 80) / c.points > 4.5,
            },
          }));
          corps.sort((a, b) => b.points - a.points);
          setAvailableCorps(corps);
          generateSuggestions(corps);
        }
      } catch (e) { toast.error('Failed to load corps data'); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchCorps();
    return () => { cancelled = true; };
  }, [seasonId]);

  const generateSuggestions = useCallback((corps) => {
    const hot = corps.filter(c => c.performanceData?.isHot).slice(0, 5);
    const value = corps.filter(c => c.performanceData?.isValue).slice(0, 5);
    const history = corps.filter(c => userHistory.includes(c.corpsName)).slice(0, 5);
    setDraftSuggestions({ hot, value, history });
  }, [userHistory]);

  useEffect(() => {
    if (availableCorps.length > 0) generateSuggestions(availableCorps);
  }, [availableCorps, userHistory, generateSuggestions]);

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

  const captionsByCategory = useMemo(() => ({
    'General Effect': captions.filter(c => c.category === 'General Effect'),
    'Visual': captions.filter(c => c.category === 'Visual'),
    'Music': captions.filter(c => c.category === 'Music'),
  }), []);

  const categoryColors = {
    'General Effect': { accent: 'text-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500' },
    'Visual': { accent: 'text-[#0057B8]', border: 'border-[#0057B8]/30', bg: 'bg-[#0057B8]' },
    'Music': { accent: 'text-purple-400', border: 'border-purple-400/30', bg: 'bg-purple-400' },
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 md:p-4" onClick={onClose}>
        <div className="w-full max-w-6xl max-h-[95vh] bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Draft Your Lineup</h2>
                <p className="text-sm text-gray-500">{CLASS_LABELS[corpsClass]} • {pointLimit} pts budget</p>
              </div>
              <div className="flex items-center gap-2">
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
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold">
                    <AlertCircle className="w-3 h-3" /> Over Budget
                  </span>
                )}
                {isComplete && !isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold">
                    <Check className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-[#333] overflow-hidden">
              <div className={`h-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-[#0057B8]'}`} style={{ width: `${Math.min((totalPoints / pointLimit) * 100, 100)}%` }} />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-500 uppercase tracking-wider">Loading corps...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                  <DraftHelper suggestions={draftSuggestions} onSelectSuggestion={(corps) => {
                    const empty = captions.find(c => !selections[c.id]);
                    if (empty) { handleSelectionChange(empty.id, corps); setExpandedCategory(empty.category); }
                    else toast('All slots filled');
                  }} selections={selections} />

                  {/* Lineup Summary */}
                  <div className="bg-[#0a0a0a] border border-[#333] p-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                      <Award className="w-3 h-3" /> Your Lineup
                    </h3>
                    <div className="space-y-1">
                      {captions.map((caption) => {
                        const sel = getSelectedCorps(caption.id);
                        const colors = categoryColors[caption.category];
                        return (
                          <div key={caption.id} className={`flex items-center justify-between p-1.5 border ${sel ? 'border-green-500/30 bg-green-500/5' : 'border-[#333]'}`}>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${colors.bg}`} />
                              <span className="text-[10px] font-bold text-gray-400">{caption.id}</span>
                            </div>
                            {sel ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-white truncate max-w-[80px]">{sel.name}</span>
                                <span className="text-[10px] font-data text-[#0057B8]">{sel.points}</span>
                                <button onClick={() => handleSelectionChange(caption.id, null)} className="p-0.5 text-red-400 hover:text-red-300">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-600">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Main Selection Area */}
                <div className="lg:col-span-3 space-y-3">
                  {['General Effect', 'Visual', 'Music'].map((category) => {
                    const categoryCaptions = captionsByCategory[category];
                    const colors = categoryColors[category];
                    const selectedCount = categoryCaptions.filter(c => selections[c.id]).length;
                    const isExpanded = expandedCategory === category;

                    return (
                      <div key={category} className={`border ${colors.border}`}>
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : category)}
                          className="w-full flex items-center justify-between p-3 hover:bg-white/5"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-1 h-6 ${colors.bg}`} />
                            <span className="font-bold text-white">{category}</span>
                            <span className="text-xs text-gray-500">{selectedCount}/{categoryCaptions.length}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedCount === categoryCaptions.length && <Check className="w-4 h-4 text-green-500" />}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-[#333]">
                            {categoryCaptions.map((caption) => {
                              const selected = getSelectedCorps(caption.id);
                              return (
                                <div key={caption.id} className="border-b border-[#333] last:border-b-0">
                                  <div className="px-3 py-2 bg-[#0a0a0a] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {selected ? <Check className="w-4 h-4 text-green-500" /> : <div className={`w-4 h-4 border-2 ${colors.border}`} />}
                                      <span className="text-sm font-medium text-white">{caption.name}</span>
                                    </div>
                                    {selected && (
                                      <span className="text-xs text-gray-400">
                                        {selected.name} <span className="text-[#0057B8] font-data">{selected.points} pts</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="divide-y divide-[#222] max-h-48 overflow-y-auto">
                                    {availableCorps.map((corps, idx) => {
                                      const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                                      const isCurrentSel = selections[caption.id] === value;
                                      const wouldExceed = !isCurrentSel && (totalPoints - (selected?.points || 0) + corps.points > pointLimit);
                                      return (
                                        <CorpsOptionRow
                                          key={idx}
                                          corps={corps}
                                          isSelected={isCurrentSel}
                                          onSelect={() => handleSelectionChange(caption.id, corps)}
                                          disabled={wouldExceed}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2 flex-shrink-0">
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
