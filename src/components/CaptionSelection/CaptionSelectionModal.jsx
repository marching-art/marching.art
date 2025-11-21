import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, TrendingUp, Lock, Star, Info } from 'lucide-react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const CaptionSelectionModal = ({ onClose, onSubmit, corpsClass, currentLineup, seasonId }) => {
  const [selections, setSelections] = useState(currentLineup || {});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Point limits by class (using backend naming convention)
  const pointLimits = {
    soundSport: 90,
    aClass: 60,
    openClass: 120,
    worldClass: 150
  };

  const pointLimit = pointLimits[corpsClass];
  if (!pointLimit) {
    console.error(`Invalid corpsClass: ${corpsClass}`);
  }

  useEffect(() => {
    fetchAvailableCorps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  const fetchAvailableCorps = async () => {
    try {
      setLoading(true);
      const corpsDataRef = doc(db, 'dci-data', seasonId);
      const corpsDataSnap = await getDoc(corpsDataRef);

      if (corpsDataSnap.exists()) {
        const data = corpsDataSnap.data();
        const corps = data.corpsValues || [];

        // Sort by points (highest to lowest) for better UX
        corps.sort((a, b) => b.points - a.points);
        setAvailableCorps(corps);
      } else {
        toast.error('No corps data available for this season');
        setAvailableCorps([]);
      }
    } catch (error) {
      console.error('Error fetching available corps:', error);
      toast.error('Failed to load corps data');
      setAvailableCorps([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total points from current selections
  const calculateTotalPoints = () => {
    return Object.values(selections).reduce((total, selection) => {
      if (!selection) return total;
      const parts = selection.split('|');
      const points = parseInt(parts[2]) || 0;
      return total + points;
    }, 0);
  };

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

  const handleSelectionChange = (captionId, corpsData) => {
    if (!corpsData) {
      // Remove selection
      const newSelections = { ...selections };
      delete newSelections[captionId];
      setSelections(newSelections);
    } else {
      // Add/update selection with format: corpsName|sourceYear|points
      const selectionString = `${corpsData.corpsName}|${corpsData.sourceYear}|${corpsData.points}`;
      setSelections({
        ...selections,
        [captionId]: selectionString
      });
    }
  };

  const handleSubmit = async () => {
    // Validation
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

      // Call the backend saveLineup function
      const saveLineup = httpsCallable(functions, 'saveLineup');
      const result = await saveLineup({
        lineup: selections,
        corpsClass: corpsClass
      });

      toast.success(result.data.message || 'Lineup saved successfully!');
      onSubmit(selections);
      onClose();
    } catch (error) {
      console.error('Error saving lineup:', error);

      // Parse error message from backend
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-display font-bold text-gradient">
                Select Your Caption Lineup
              </h2>
              <span className={`badge text-sm ${
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
            <p className="text-cream-300">
              Choose one corps for each of the 8 captions within your {pointLimit}-point budget.
              Higher-ranked corps cost more points but typically score better.
            </p>
          </div>

          {/* Point Budget Display */}
          <div className="mb-6 p-6 bg-charcoal-900/50 rounded-xl border border-cream-500/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-cream-100">Point Budget</h3>
                <p className="text-sm text-cream-500/60">
                  {corpsClass.charAt(0).toUpperCase() + corpsClass.slice(1)} Class Limit: {pointLimit} points
                </p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${
                  isOverLimit ? 'text-red-500' :
                  remainingPoints < 10 ? 'text-yellow-500' :
                  'text-gold-500'
                }`}>
                  {totalPoints} / {pointLimit}
                </div>
                <p className="text-sm text-cream-500/60">
                  {remainingPoints} points remaining
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-4 bg-charcoal-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentUsed}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full transition-colors ${
                  isOverLimit ? 'bg-gradient-to-r from-red-600 to-red-500' :
                  percentUsed > 90 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                  'bg-gradient-gold'
                }`}
              />
              {isOverLimit && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-white">OVER LIMIT</span>
                </motion.div>
              )}
            </div>

            {/* Warning Messages */}
            {isOverLimit && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 text-red-500 text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Your lineup exceeds the point limit. Remove some high-value corps.</span>
              </motion.div>
            )}
          </div>

          {/* Caption Selection Grid - Grouped by Category */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-cream-500/60">Loading available corps...</p>
            </div>
          ) : (
            <div className="space-y-6 mb-6">
              {/* Group captions by category */}
              {['General Effect', 'Visual', 'Music'].map((category) => {
                const categoryCaptions = captions.filter(c => c.category === category);
                const categoryColor =
                  category === 'General Effect' ? 'gold' :
                  category === 'Visual' ? 'blue' : 'purple';
                const selectedInCategory = categoryCaptions.filter(c => selections[c.id]).length;

                return (
                  <div key={category} className="space-y-3">
                    {/* Category Header */}
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-6 rounded ${
                        categoryColor === 'gold' ? 'bg-gold-500' :
                        categoryColor === 'blue' ? 'bg-blue-500' :
                        'bg-purple-500'
                      }`} />
                      <h3 className="text-xl font-semibold text-cream-100">{category}</h3>
                      <span className={`badge ${
                        selectedInCategory === categoryCaptions.length ? 'badge-success' : 'badge-ghost'
                      } text-xs`}>
                        {selectedInCategory}/{categoryCaptions.length} selected
                      </span>
                    </div>

                    {/* Category Captions */}
                    <div className="space-y-3 pl-4">
                      {categoryCaptions.map((caption) => {
                        const selected = getSelectedCorps(caption.id);

                        return (
                          <div
                            key={caption.id}
                            className={`glass rounded-xl p-4 border transition-all ${
                              selected
                                ? 'border-green-500/30 bg-green-500/5'
                                : 'border-cream-500/10 hover:border-cream-500/20'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  {selected ? (
                                    <Check className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <div className={`w-5 h-5 rounded-full border-2 ${
                                      categoryColor === 'gold' ? 'border-gold-500/30' :
                                      categoryColor === 'blue' ? 'border-blue-500/30' :
                                      'border-purple-500/30'
                                    }`} />
                                  )}
                                  <h4 className="font-semibold text-cream-100">{caption.name}</h4>
                                  <span className="text-xs text-cream-500/60">{caption.id}</span>
                                </div>
                                <p className="text-sm text-cream-500/60 ml-8">{caption.description}</p>
                              </div>

                              {selected && (
                                <div className="flex items-center gap-3 ml-4">
                                  <div className="text-right">
                                    <div className="text-xl font-bold text-gold-500">{selected.points}</div>
                                    <div className="text-xs text-cream-500/60">pts</div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <select
                              className={`select w-full ${selected ? 'bg-green-500/5' : ''}`}
                              value={selections[caption.id] || ''}
                              onChange={(e) => {
                                if (!e.target.value) {
                                  handleSelectionChange(caption.id, null);
                                } else {
                                  const corps = availableCorps.find(c =>
                                    `${c.corpsName}|${c.sourceYear}|${c.points}` === e.target.value
                                  );
                                  if (corps) {
                                    handleSelectionChange(caption.id, corps);
                                  }
                                }
                              }}
                            >
                              <option value="">
                                {selected ? `${selected.name} (${selected.year})` : `Select ${caption.name}...`}
                              </option>
                              {availableCorps.map((corps, index) => {
                                const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                                const isCurrentSelection = selections[caption.id] === value;
                                const wouldExceedLimit = !isCurrentSelection &&
                                  (totalPoints - (selected?.points || 0) + corps.points > pointLimit);

                                return (
                                  <option
                                    key={index}
                                    value={value}
                                    disabled={wouldExceedLimit}
                                  >
                                    {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                                    {wouldExceedLimit ? ' [Would exceed limit]' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Stats & Tips */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Selection Progress */}
            <div className="p-4 bg-charcoal-900/50 rounded-lg border border-cream-500/10">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-gold-500" />
                <h4 className="font-semibold text-cream-100">Selection Progress</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-cream-500/80">Captions selected:</span>
                  <span className={`font-semibold ${isComplete ? 'text-green-500' : 'text-yellow-500'}`}>
                    {Object.keys(selections).length}/8
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-500/80">Points used:</span>
                  <span className={`font-semibold ${
                    isOverLimit ? 'text-red-500' :
                    remainingPoints < 10 ? 'text-yellow-500' :
                    'text-gold-500'
                  }`}>
                    {totalPoints}/{pointLimit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-500/80">Remaining budget:</span>
                  <span className={`font-semibold ${
                    remainingPoints < 0 ? 'text-red-500' :
                    remainingPoints < 10 ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>
                    {remainingPoints} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-cream-300">
                  <p className="font-semibold mb-2">Tips for Building Your Lineup:</p>
                  <ul className="space-y-1 text-cream-500/80">
                    <li>• Higher-ranked corps cost more points but score better</li>
                    <li>• Balance your budget across all 8 captions</li>
                    {!isComplete && (
                      <li className="text-yellow-400">• You need to select all 8 captions</li>
                    )}
                    {isOverLimit && (
                      <li className="text-red-400 font-semibold">• Reduce your total to {pointLimit} points or less</li>
                    )}
                    {corpsClass === 'soundSport' && (
                      <li className="text-green-400">• SoundSport is non-competitive - just have fun!</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-ghost flex-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary flex-1 relative"
              disabled={!isComplete || isOverLimit || saving || loading}
            >
              {saving ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Star className="w-5 h-5 mr-2" />
                  Save Lineup {isComplete && `(${totalPoints}/${pointLimit} pts)`}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CaptionSelectionModal;
