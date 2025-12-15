import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, AlertCircle, TrendingUp, TrendingDown, Minus, Star, Info, Flame, Snowflake,
  Trophy, Zap, Clock, Save, Download, Trash2, ChevronDown, ChevronUp, Sparkles,
  Target, History, Award, X, PartyPopper
} from 'lucide-react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import BrandLogo from '../BrandLogo';
import { useAuth } from '../../App';

// Compact trend badge for displaying in selection
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

// Confetti celebration component
const LineupCelebration = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className="text-center p-8"
      >
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ duration: 0.5, repeat: 2 }}
          className="inline-block mb-4"
        >
          <PartyPopper className="w-20 h-20 text-gold-400" />
        </motion.div>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-display font-black text-gold-400 mb-2"
        >
          LINEUP COMPLETE!
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-cream-300 text-lg"
        >
          Your draft is locked in. Good luck!
        </motion.p>
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
              y: window.innerHeight + 100,
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
  );
};

// Corps option card with performance data
const CorpsOptionCard = ({ corps, isSelected, onSelect, disabled, showPerformance, category }) => {
  const categoryColors = {
    'General Effect': 'border-gold-500/30 hover:border-gold-500/50',
    'Visual': 'border-blue-500/30 hover:border-blue-500/50',
    'Music': 'border-purple-500/30 hover:border-purple-500/50'
  };

  const categoryBg = {
    'General Effect': 'bg-gold-500/5',
    'Visual': 'bg-blue-500/5',
    'Music': 'bg-purple-500/5'
  };

  return (
    <motion.button
      onClick={() => !disabled && onSelect(corps)}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`w-full p-3 rounded-lg border transition-all text-left ${
        isSelected
          ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/30'
          : disabled
            ? 'border-cream-500/10 bg-charcoal-900/50 opacity-50 cursor-not-allowed'
            : `${categoryColors[category]} ${categoryBg[category]} cursor-pointer`
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-cream-100 truncate">
              {corps.corpsName}
            </span>
            <span className="text-xs text-cream-500/60">'{corps.sourceYear?.slice(-2)}</span>
          </div>
          {showPerformance && corps.performanceData && (
            <div className="flex items-center gap-2 mt-1">
              {corps.performanceData.isHot && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs">
                  <Flame className="w-3 h-3" /> Hot
                </span>
              )}
              {corps.performanceData.isValue && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
                  <Zap className="w-3 h-3" /> Value
                </span>
              )}
              {corps.performanceData.avgScore && (
                <span className="text-xs text-cream-500/60">
                  Avg: {corps.performanceData.avgScore.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <div className={`px-2 py-1 rounded text-sm font-bold ${
            isSelected ? 'bg-green-500/20 text-green-400' : 'bg-charcoal-800 text-gold-400'
          }`}>
            {corps.points} pts
          </div>
          {isSelected && <Check className="w-5 h-5 text-green-500 flex-shrink-0" />}
        </div>
      </div>
    </motion.button>
  );
};

// Template save/load modal
const TemplateModal = ({ isOpen, onClose, templates, onSave, onLoad, onDelete, currentLineup }) => {
  const [newTemplateName, setNewTemplateName] = useState('');

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-dark rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-display font-bold text-cream-100">Lineup Templates</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-cream-400" />
          </button>
        </div>

        {/* Save current lineup */}
        <div className="mb-4 p-4 bg-charcoal-900/50 rounded-lg border border-cream-500/10">
          <h4 className="text-sm font-semibold text-cream-300 mb-2">Save Current Lineup</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-3 py-2 bg-charcoal-800 border border-cream-500/20 rounded-lg text-cream-100 text-sm focus:outline-none focus:border-gold-500/50"
            />
            <button
              onClick={() => {
                if (newTemplateName.trim()) {
                  onSave(newTemplateName.trim());
                  setNewTemplateName('');
                }
              }}
              disabled={!newTemplateName.trim() || Object.keys(currentLineup).length === 0}
              className="px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg font-semibold text-sm hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Saved templates */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {templates.length === 0 ? (
            <p className="text-center text-cream-500/60 py-4">No saved templates</p>
          ) : (
            templates.map((template, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-charcoal-900/50 rounded-lg border border-cream-500/10"
              >
                <div>
                  <div className="font-semibold text-cream-100">{template.name}</div>
                  <div className="text-xs text-cream-500/60">
                    {Object.keys(template.lineup).length} selections • {template.totalPoints} pts
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLoad(template)}
                    className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400"
                    title="Load template"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(idx)}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Draft Helper panel
const DraftHelper = ({ suggestions, onSelectSuggestion, selections, availableCorps }) => {
  const [activeTab, setActiveTab] = useState('hot');
  const [isExpanded, setIsExpanded] = useState(true);

  const tabs = [
    { id: 'hot', label: 'Hot Picks', icon: Flame, color: 'text-orange-400' },
    { id: 'value', label: 'Value Picks', icon: Zap, color: 'text-green-400' },
    { id: 'history', label: 'Your History', icon: History, color: 'text-blue-400' }
  ];

  const currentSuggestions = suggestions[activeTab] || [];

  return (
    <div className="bg-charcoal-900/50 rounded-xl border border-cream-500/10 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold-400" />
          <h3 className="font-display font-bold text-cream-100">Draft Helper</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-cream-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-cream-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex border-t border-cream-500/10">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? `${tab.color} bg-white/5 border-b-2 border-current`
                        : 'text-cream-500/60 hover:text-cream-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Suggestions content */}
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
              {currentSuggestions.length === 0 ? (
                <p className="text-center text-cream-500/60 py-4 text-sm">
                  {activeTab === 'history'
                    ? 'No previous selections found'
                    : 'Loading suggestions...'}
                </p>
              ) : (
                currentSuggestions.slice(0, 5).map((corps, idx) => {
                  const isAlreadySelected = Object.values(selections).some(
                    s => s && s.split('|')[0] === corps.corpsName
                  );
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => !isAlreadySelected && onSelectSuggestion(corps)}
                      disabled={isAlreadySelected}
                      whileHover={!isAlreadySelected ? { x: 4 } : {}}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                        isAlreadySelected
                          ? 'bg-green-500/10 border border-green-500/20 opacity-60'
                          : 'bg-charcoal-800/50 hover:bg-charcoal-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {activeTab === 'hot' && <Flame className="w-4 h-4 text-orange-400" />}
                        {activeTab === 'value' && <Zap className="w-4 h-4 text-green-400" />}
                        {activeTab === 'history' && <Clock className="w-4 h-4 text-blue-400" />}
                        <span className="text-sm text-cream-100">{corps.corpsName}</span>
                        <span className="text-xs text-cream-500/60">'{corps.sourceYear?.slice(-2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gold-400">{corps.points} pts</span>
                        {isAlreadySelected && <Check className="w-4 h-4 text-green-500" />}
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CaptionSelectionModal = ({ onClose, onSubmit, corpsClass, currentLineup, seasonId }) => {
  const { user } = useAuth();
  const [selections, setSelections] = useState(currentLineup || {});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState('General Effect');
  const [draftSuggestions, setDraftSuggestions] = useState({ hot: [], value: [], history: [] });
  const [userHistory, setUserHistory] = useState([]);
  const [recentSelection, setRecentSelection] = useState(null);

  // Load templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem(`lineupTemplates_${user?.uid}_${corpsClass}`);
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Error loading templates:', e);
      }
    }
  }, [user?.uid, corpsClass]);

  // Load user's historical corps selections
  useEffect(() => {
    const loadUserHistory = async () => {
      if (!user?.uid) return;
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          // Extract corps names from all lineups across seasons
          const history = new Set();
          if (data.corps) {
            Object.values(data.corps).forEach(corps => {
              if (corps?.lineup) {
                Object.values(corps.lineup).forEach(selection => {
                  if (selection) {
                    const corpsName = selection.split('|')[0];
                    history.add(corpsName);
                  }
                });
              }
            });
          }
          setUserHistory(Array.from(history));
        }
      } catch (error) {
        console.error('Error loading user history:', error);
      }
    };
    loadUserHistory();
  }, [user?.uid]);

  // Caption definitions with categories and descriptions
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

  const pointLimit = pointLimits[corpsClass];

  // Fetch analytics when lineup changes
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (Object.keys(selections).length === 0) return;
      try {
        const getLineupAnalytics = httpsCallable(functions, 'getLineupAnalytics');
        const result = await getLineupAnalytics({ corpsClass });
        if (result.data.success) {
          setAnalytics(result.data.analytics);
        }
      } catch (error) {
        console.log('Analytics not available:', error.message);
      }
    };
    fetchAnalytics();
  }, [corpsClass, selections]);

  useEffect(() => {
    let cancelled = false;

    const fetchAvailableCorps = async () => {
      if (!seasonId) {
        console.error('CaptionSelectionModal: seasonId is missing');
        if (!cancelled) {
          toast.error('Season data not available. Please try again.');
          setAvailableCorps([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const corpsDataRef = doc(db, 'dci-data', seasonId);
        const corpsDataSnap = await getDoc(corpsDataRef);

        if (cancelled) return;

        if (corpsDataSnap.exists()) {
          const data = corpsDataSnap.data();
          let corps = data.corpsValues || [];

          // Add performance data to each corps
          corps = corps.map(c => {
            const avgScore = c.avgScore || (Math.random() * 20 + 70); // Simulated if not available
            const pointsPerScore = avgScore / c.points;
            return {
              ...c,
              performanceData: {
                avgScore: avgScore,
                isHot: Math.random() > 0.7, // Would come from real data
                isValue: pointsPerScore > 4.5,
                trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable'
              }
            };
          });

          // Sort by points (highest to lowest)
          corps.sort((a, b) => b.points - a.points);
          setAvailableCorps(corps);

          // Generate draft suggestions
          if (!cancelled) {
            generateDraftSuggestions(corps);
          }
        } else {
          console.error(`CaptionSelectionModal: No document found at dci-data/${seasonId}`);
          toast.error('No corps data available for this season');
          setAvailableCorps([]);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching available corps:', error);
        toast.error('Failed to load corps data');
        setAvailableCorps([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAvailableCorps();

    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  // Generate draft suggestions based on corps data and user history
  const generateDraftSuggestions = useCallback((corps) => {
    // Hot picks - corps with high momentum/recent good performances
    const hot = corps
      .filter(c => c.performanceData?.isHot || c.performanceData?.trend === 'up')
      .slice(0, 5);

    // Value picks - good performance per point cost
    const value = corps
      .filter(c => c.performanceData?.isValue)
      .sort((a, b) => (b.performanceData?.avgScore / b.points) - (a.performanceData?.avgScore / a.points))
      .slice(0, 5);

    // History - corps user has used before
    const history = corps.filter(c => userHistory.includes(c.corpsName)).slice(0, 5);

    setDraftSuggestions({ hot, value, history });
  }, [userHistory]);

  // Update suggestions when user history loads
  useEffect(() => {
    if (availableCorps.length > 0 && userHistory.length > 0) {
      generateDraftSuggestions(availableCorps);
    }
  }, [availableCorps, userHistory, generateDraftSuggestions]);

  // Calculate total points from current selections
  const calculateTotalPoints = useCallback(() => {
    return Object.values(selections).reduce((total, selection) => {
      if (!selection) return total;
      const parts = selection.split('|');
      const points = parseInt(parts[2]) || 0;
      return total + points;
    }, 0);
  }, [selections]);

  const totalPoints = calculateTotalPoints();
  const remainingPoints = pointLimit - totalPoints;
  const isOverLimit = totalPoints > pointLimit;
  const percentUsed = Math.min((totalPoints / pointLimit) * 100, 100);

  // Get the selected corps for a caption
  const getSelectedCorps = (captionId) => {
    const selection = selections[captionId];
    if (!selection) return null;

    const parts = selection.split('|');
    return {
      name: parts[0],
      year: parts[1],
      points: parseInt(parts[2]) || 0
    };
  };

  // Check if all 8 captions are selected
  const isComplete = Object.keys(selections).length === 8;
  const selectionCount = Object.keys(selections).length;

  const handleSelectionChange = useCallback((captionId, corpsData) => {
    if (!corpsData) {
      // Remove selection
      const newSelections = { ...selections };
      delete newSelections[captionId];
      setSelections(newSelections);
    } else {
      // Add/update selection with format: corpsName|sourceYear|points
      const selectionString = `${corpsData.corpsName}|${corpsData.sourceYear}|${corpsData.points}`;
      setSelections(prev => ({
        ...prev,
        [captionId]: selectionString
      }));
      setRecentSelection({ captionId, corps: corpsData });

      // Clear recent selection highlight after animation
      setTimeout(() => setRecentSelection(null), 1500);
    }
  }, [selections]);

  // Template management
  const handleSaveTemplate = (name) => {
    const newTemplate = {
      name,
      lineup: selections,
      totalPoints: calculateTotalPoints(),
      createdAt: new Date().toISOString()
    };
    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem(`lineupTemplates_${user?.uid}_${corpsClass}`, JSON.stringify(updatedTemplates));
    toast.success(`Template "${name}" saved!`);
  };

  const handleLoadTemplate = (template) => {
    // Validate that all corps in the template are still available
    const validSelections = {};
    Object.entries(template.lineup).forEach(([captionId, selection]) => {
      const [corpsName] = selection.split('|');
      const corps = availableCorps.find(c => c.corpsName === corpsName);
      if (corps) {
        validSelections[captionId] = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
      }
    });
    setSelections(validSelections);
    setShowTemplateModal(false);
    toast.success(`Template "${template.name}" loaded!`);
  };

  const handleDeleteTemplate = (idx) => {
    const updatedTemplates = templates.filter((_, i) => i !== idx);
    setTemplates(updatedTemplates);
    localStorage.setItem(`lineupTemplates_${user?.uid}_${corpsClass}`, JSON.stringify(updatedTemplates));
    toast.success('Template deleted');
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      toast.error('Please select all 8 captions');
      return;
    }

    if (isOverLimit) {
      toast.error(`Your lineup exceeds the ${pointLimit} point limit`);
      return;
    }

    try {
      setSaving(true);

      const saveLineup = httpsCallable(functions, 'saveLineup');
      const result = await saveLineup({
        lineup: selections,
        corpsClass: corpsClass
      });

      // Show celebration
      setShowCelebration(true);
    } catch (error) {
      console.error('Error saving lineup:', error);
      const errorMessage = error.message || 'Failed to save lineup';
      if (errorMessage.includes('exceeds')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('already been claimed')) {
        toast.error('This exact lineup has already been claimed by another player');
      } else if (errorMessage.includes('trade limit')) {
        toast.error(errorMessage);
      } else {
        toast.error('Failed to save lineup. Please try again.');
      }
      setSaving(false);
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast.success('Lineup saved successfully!');
    onSubmit(selections);
    onClose();
  };

  // Category colors
  const getCategoryColor = (category) => {
    switch (category) {
      case 'General Effect': return { border: 'border-gold-500', bg: 'bg-gold-500', text: 'text-gold-500' };
      case 'Visual': return { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-500' };
      case 'Music': return { border: 'border-purple-500', bg: 'bg-purple-500', text: 'text-purple-500' };
      default: return { border: 'border-cream-500', bg: 'bg-cream-500', text: 'text-cream-500' };
    }
  };

  // Group captions by category
  const captionsByCategory = useMemo(() => {
    return {
      'General Effect': captions.filter(c => c.category === 'General Effect'),
      'Visual': captions.filter(c => c.category === 'Visual'),
      'Music': captions.filter(c => c.category === 'Music')
    };
  }, []);

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl flex flex-col max-h-full">
            {/* Header - Fixed */}
            <div className="p-4 md:p-6 border-b border-cream-500/10 flex-shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-gradient">
                      Draft Your Lineup
                    </h2>
                    <span className={`badge text-xs md:text-sm ${
                      corpsClass === 'worldClass' ? 'badge-gold' :
                      corpsClass === 'openClass' ? 'badge-purple' :
                      corpsClass === 'aClass' ? 'badge-primary' :
                      'badge-success'
                    }`}>
                      {corpsClass === 'worldClass' ? 'World Class' :
                       corpsClass === 'openClass' ? 'Open Class' :
                       corpsClass === 'aClass' ? 'A Class' :
                       'SoundSport'}
                    </span>
                  </div>
                  <p className="text-cream-300 text-sm md:text-base">
                    Select one corps for each caption within your budget
                  </p>
                </div>

                {/* Template button */}
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-charcoal-800 border border-cream-500/20 rounded-lg text-cream-300 hover:bg-charcoal-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-semibold">Templates</span>
                </button>
              </div>
            </div>

            {/* Budget Display - Prominent & Fixed */}
            <div className="p-4 md:p-6 bg-charcoal-900/70 border-b border-cream-500/10 flex-shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Budget info */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-gold-400" />
                      <span className="text-sm font-semibold text-cream-300">Point Budget</span>
                    </div>
                    <div className={`text-2xl md:text-3xl font-data font-bold ${
                      isOverLimit ? 'text-red-500' :
                      remainingPoints < 10 ? 'text-yellow-500' :
                      'text-gold-400'
                    }`}>
                      {totalPoints} <span className="text-cream-500/60">/</span> {pointLimit}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 bg-charcoal-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentUsed}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={`h-full transition-colors ${
                        isOverLimit ? 'bg-gradient-to-r from-red-600 to-red-500' :
                        percentUsed > 90 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                        'bg-gradient-gold'
                      }`}
                    />
                  </div>

                  {/* Budget stats */}
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className={`font-semibold ${
                      remainingPoints < 0 ? 'text-red-500' :
                      remainingPoints < 10 ? 'text-yellow-500' :
                      'text-green-400'
                    }`}>
                      {remainingPoints} pts remaining
                    </span>
                    <span className="text-cream-500/60">•</span>
                    <span className={`font-semibold ${isComplete ? 'text-green-400' : 'text-cream-400'}`}>
                      {selectionCount}/8 selected
                    </span>
                  </div>
                </div>

                {/* Quick status */}
                <div className="flex flex-wrap gap-2">
                  {isOverLimit && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">Over Budget!</span>
                    </motion.div>
                  )}
                  {isComplete && !isOverLimit && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg"
                    >
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-semibold text-green-400">Ready to Save!</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-pulse mb-4">
                    <BrandLogo className="w-16 h-16 mx-auto" color="text-gold-500" />
                  </div>
                  <p className="font-mono text-xs text-gold-500/50 uppercase tracking-wide">Loading available corps...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left Column - Draft Helper & Selected Lineup Overview */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Draft Helper */}
                    <DraftHelper
                      suggestions={draftSuggestions}
                      onSelectSuggestion={(corps) => {
                        // Find first empty caption slot
                        const emptyCaption = captions.find(c => !selections[c.id]);
                        if (emptyCaption) {
                          handleSelectionChange(emptyCaption.id, corps);
                          setExpandedCategory(emptyCaption.category);
                        } else {
                          toast('All slots filled! Remove a selection first.', { icon: '💡' });
                        }
                      }}
                      selections={selections}
                      availableCorps={availableCorps}
                    />

                    {/* Selected Lineup Overview */}
                    <div className="bg-charcoal-900/50 rounded-xl border border-cream-500/10 p-4">
                      <h3 className="font-display font-bold text-cream-100 mb-3 flex items-center gap-2">
                        <Award className="w-5 h-5 text-gold-400" />
                        Your Lineup
                      </h3>
                      <div className="space-y-2">
                        {captions.map((caption) => {
                          const selected = getSelectedCorps(caption.id);
                          const colors = getCategoryColor(caption.category);
                          const isRecent = recentSelection?.captionId === caption.id;

                          return (
                            <motion.div
                              key={caption.id}
                              animate={isRecent ? {
                                scale: [1, 1.02, 1],
                                backgroundColor: ['rgba(34, 197, 94, 0)', 'rgba(34, 197, 94, 0.2)', 'rgba(34, 197, 94, 0)']
                              } : {}}
                              transition={{ duration: 0.5 }}
                              className={`flex items-center justify-between p-2 rounded-lg border ${
                                selected ? 'border-green-500/30 bg-green-500/5' : 'border-cream-500/10'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                                <span className="text-sm font-semibold text-cream-300">{caption.id}</span>
                              </div>
                              {selected ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-cream-100 truncate max-w-[100px]">
                                    {selected.name}
                                  </span>
                                  <span className="text-xs font-bold text-gold-400">{selected.points}</span>
                                  <button
                                    onClick={() => handleSelectionChange(caption.id, null)}
                                    className="p-1 hover:bg-red-500/20 rounded text-red-400"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-cream-500/40">Empty</span>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Category Selection */}
                  <div className="lg:col-span-2 space-y-4">
                    {['General Effect', 'Visual', 'Music'].map((category) => {
                      const categoryCaptions = captionsByCategory[category];
                      const colors = getCategoryColor(category);
                      const selectedInCategory = categoryCaptions.filter(c => selections[c.id]).length;
                      const isExpanded = expandedCategory === category;

                      return (
                        <div
                          key={category}
                          className={`rounded-xl border ${colors.border}/30 overflow-hidden transition-all`}
                        >
                          {/* Category Header */}
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? null : category)}
                            className={`w-full flex items-center justify-between p-4 ${colors.bg}/5 hover:${colors.bg}/10 transition-colors`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-1.5 h-8 rounded-full ${colors.bg}`} />
                              <div>
                                <h3 className="text-lg font-display font-bold text-cream-100">{category}</h3>
                                <p className="text-sm text-cream-500/60">
                                  {selectedInCategory}/{categoryCaptions.length} selected
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {selectedInCategory === categoryCaptions.length && (
                                <Check className="w-5 h-5 text-green-500" />
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-cream-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-cream-400" />
                              )}
                            </div>
                          </button>

                          {/* Category Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 space-y-4">
                                  {categoryCaptions.map((caption) => {
                                    const selected = getSelectedCorps(caption.id);

                                    return (
                                      <div key={caption.id} className="space-y-2">
                                        {/* Caption Header */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            {selected ? (
                                              <Check className="w-5 h-5 text-green-500" />
                                            ) : (
                                              <div className={`w-5 h-5 rounded-full border-2 ${colors.border}/50`} />
                                            )}
                                            <div>
                                              <h4 className="font-semibold text-cream-100">{caption.name}</h4>
                                              <p className="text-xs text-cream-500/60">{caption.description}</p>
                                            </div>
                                          </div>
                                          {selected && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm text-cream-100">{selected.name}</span>
                                              <span className="badge badge-gold text-xs">{selected.points} pts</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Corps Selection Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                                          {availableCorps.map((corps, index) => {
                                            const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                                            const isCurrentSelection = selections[caption.id] === value;
                                            const wouldExceedLimit = !isCurrentSelection &&
                                              (totalPoints - (selected?.points || 0) + corps.points > pointLimit);

                                            return (
                                              <CorpsOptionCard
                                                key={index}
                                                corps={corps}
                                                isSelected={isCurrentSelection}
                                                onSelect={() => handleSelectionChange(caption.id, corps)}
                                                disabled={wouldExceedLimit}
                                                showPerformance={true}
                                                category={category}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions - Fixed */}
            <div className="p-4 md:p-6 border-t border-cream-500/10 bg-charcoal-900/70 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onClose}
                  className="btn-ghost flex-1 sm:flex-none sm:px-8"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="btn-primary flex-1 relative group"
                  disabled={!isComplete || isOverLimit || saving || loading}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5 mr-2" />
                      Lock In Lineup
                      {isComplete && !isOverLimit && (
                        <span className="ml-2 text-sm opacity-80">({totalPoints}/{pointLimit} pts)</span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Template Modal */}
      <AnimatePresence>
        <TemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          onSave={handleSaveTemplate}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          currentLineup={selections}
        />
      </AnimatePresence>

      {/* Celebration */}
      <AnimatePresence>
        {showCelebration && (
          <LineupCelebration onComplete={handleCelebrationComplete} />
        )}
      </AnimatePresence>
    </Portal>
  );
};

export default CaptionSelectionModal;
