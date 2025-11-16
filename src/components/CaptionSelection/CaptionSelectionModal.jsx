import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, TrendingUp, Lock, Star, Info } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { functions } from '../../firebase';
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

  // Point limits by class
  const pointLimits = {
    soundSport: 90,
    aClass: 60,
    open: 120,
    world: 150
  };

  // Map frontend class names to backend expected names
  const classNameMap = {
    soundSport: 'soundSport',
    aClass: 'aClass',
    open: 'openClass',
    world: 'worldClass'
  };

  const pointLimit = pointLimits[corpsClass] || 150;
  const backendClassName = classNameMap[corpsClass] || corpsClass;

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
        corpsClass: backendClassName
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
            <h2 className="text-3xl font-display font-bold text-gradient mb-2">
              Select Your Caption Lineup
            </h2>
            <p className="text-cream-300">
              Choose one corps for each of the 8 captions. Higher-ranked corps cost more points.
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

          {/* Caption Selection Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-cream-500/60">Loading available corps...</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {captions.map((caption) => {
                const selected = getSelectedCorps(caption.id);

                return (
                  <div key={caption.id} className="glass rounded-xl p-5 border border-cream-500/10 hover:border-cream-500/20 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <div className={`w-3 h-3 rounded-full ${
                            caption.color === 'gold' ? 'bg-gold-500' :
                            caption.color === 'blue' ? 'bg-blue-500' :
                            'bg-purple-500'
                          }`} />
                          <h4 className="font-semibold text-cream-100 text-lg">{caption.name}</h4>
                          <span className={`badge ${
                            caption.color === 'gold' ? 'badge-gold' :
                            caption.color === 'blue' ? 'badge-primary' :
                            'badge-purple'
                          } text-xs`}>
                            {caption.category}
                          </span>
                        </div>
                        <p className="text-sm text-cream-500/60 ml-6">{caption.description}</p>
                      </div>

                      {selected && (
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-3">
                            <div className="text-2xl font-bold text-gold-500">{selected.points}</div>
                            <div className="text-xs text-cream-500/60">points</div>
                          </div>
                          <Check className="w-6 h-6 text-green-500" />
                        </div>
                      )}
                    </div>

                    <select
                      className="select w-full"
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
                      <option value="">Select a corps...</option>
                      {availableCorps.map((corps, index) => {
                        const value = `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
                        const wouldExceedLimit = !selections[caption.id] &&
                          (totalPoints + corps.points > pointLimit);

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
          )}

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-cream-300">
                <p className="font-semibold mb-1">How Caption Selection Works:</p>
                <ul className="list-disc list-inside space-y-1 text-cream-500/80">
                  <li>Each corps has a point value (1-25) based on historical performance</li>
                  <li>Higher-ranked corps cost more points but typically score better</li>
                  <li>Your total must not exceed {pointLimit} points for {corpsClass} class</li>
                  {corpsClass === 'soundSport' && (
                    <li className="text-green-400 font-semibold">SoundSport is non-competitive - scores won't be displayed, just enjoy the experience!</li>
                  )}
                  <li>Each unique lineup can only be claimed by one player (first come, first served)</li>
                  <li>You have limited caption changes per week during the season</li>
                </ul>
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
