// src/components/Execution/ShowDifficultySelector.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target, TrendingUp, AlertCircle, Check, Lock, Zap, Shield,
  Star, Flame
} from 'lucide-react';
import { setShowDifficulty } from '../../firebase/functions';
import toast from 'react-hot-toast';

const DIFFICULTY_OPTIONS = {
  conservative: {
    id: 'conservative',
    name: 'Conservative',
    icon: Shield,
    color: 'green',
    difficulty: 3,
    ceiling: '+4%',
    risk: '-5%',
    threshold: '70%',
    description: 'Safe show that\'s easy to execute well',
    gradient: 'from-green-500/20 to-green-600/20',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  moderate: {
    id: 'moderate',
    name: 'Moderate',
    icon: Target,
    color: 'blue',
    difficulty: 5,
    ceiling: '+8%',
    risk: '-10%',
    threshold: '80%',
    description: 'Balanced risk and reward',
    gradient: 'from-blue-500/20 to-blue-600/20',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  ambitious: {
    id: 'ambitious',
    name: 'Ambitious',
    icon: Star,
    color: 'purple',
    difficulty: 7,
    ceiling: '+12%',
    risk: '-15%',
    threshold: '85%',
    description: 'High difficulty with great potential',
    gradient: 'from-purple-500/20 to-purple-600/20',
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  legendary: {
    id: 'legendary',
    name: 'Legendary',
    icon: Flame,
    color: 'gold',
    difficulty: 10,
    ceiling: '+15%',
    risk: '-20%',
    threshold: '90%',
    description: 'Maximum difficulty for the elite',
    gradient: 'from-gold-500/20 to-orange-500/20',
    textColor: 'text-gold-400',
    bgColor: 'bg-gold-500/10',
    borderColor: 'border-gold-500/30',
  },
};

const ShowDifficultySelector = ({ corpsClass, currentDifficulty, currentDay = 1, onSuccess }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState(
    currentDifficulty || 'moderate'
  );
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isLocked = currentDay > 10;

  const handleSelectDifficulty = (difficultyId) => {
    if (isLocked) return;
    setSelectedDifficulty(difficultyId);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!corpsClass) {
      toast.error('No corps selected');
      return;
    }

    try {
      setProcessing(true);
      const result = await setShowDifficulty({
        corpsClass,
        difficulty: selectedDifficulty,
      });

      if (result.data.success) {
        toast.success(result.data.message, { icon: '🎯', duration: 3000 });
        setShowConfirm(false);
        if (onSuccess) onSuccess(selectedDifficulty);
      }
    } catch (error) {
      console.error('Error setting show difficulty:', error);
      toast.error(error.message || 'Failed to set show difficulty');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-display font-bold text-cream-100 mb-2 flex items-center gap-2">
            <Target className="w-6 h-6 text-gold-500" />
            Show Difficulty
          </h3>
          <p className="text-sm text-cream-500/60">
            {isLocked ? (
              <span className="flex items-center gap-2 text-red-400">
                <Lock className="w-4 h-4" />
                Locked after Day 10
              </span>
            ) : (
              `Choose your show's difficulty level (can change until Day 10)`
            )}
          </p>
        </div>
        {currentDifficulty && (
          <span className={`
            px-3 py-1 rounded-full text-sm font-semibold
            ${DIFFICULTY_OPTIONS[currentDifficulty]?.bgColor}
            ${DIFFICULTY_OPTIONS[currentDifficulty]?.textColor}
          `}>
            Current: {DIFFICULTY_OPTIONS[currentDifficulty]?.name}
          </span>
        )}
      </div>

      {/* Difficulty Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.values(DIFFICULTY_OPTIONS).map((option) => {
          const Icon = option.icon;
          const isSelected = selectedDifficulty === option.id;
          const isCurrent = currentDifficulty === option.id;

          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelectDifficulty(option.id)}
              disabled={isLocked || processing}
              whileHover={!isLocked ? { scale: 1.02 } : {}}
              whileTap={!isLocked ? { scale: 0.98 } : {}}
              className={`
                relative p-5 rounded-xl border-2 transition-all text-left
                ${isSelected
                  ? `${option.borderColor} bg-gradient-to-br ${option.gradient} shadow-lg`
                  : 'border-charcoal-700 bg-charcoal-900/30 hover:border-cream-500/30'
                }
                ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className={`w-6 h-6 rounded-full ${option.bgColor} ${option.textColor} flex items-center justify-center`}>
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Current Badge */}
              {isCurrent && !isSelected && (
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-semibold text-cream-500/60">CURRENT</span>
                </div>
              )}

              {/* Icon and Name */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`
                  w-12 h-12 rounded-lg flex items-center justify-center
                  ${option.bgColor} ${option.textColor}
                `}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-cream-100">{option.name}</h4>
                  <p className="text-xs text-cream-500/60">Difficulty: {option.difficulty}/10</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-cream-300 mb-4">{option.description}</p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-charcoal-900/50 rounded-lg">
                  <p className="text-xs text-cream-500/60 mb-1">Ceiling</p>
                  <p className={`font-bold ${option.textColor}`}>{option.ceiling}</p>
                </div>
                <div className="text-center p-2 bg-charcoal-900/50 rounded-lg">
                  <p className="text-xs text-cream-500/60 mb-1">Risk</p>
                  <p className="font-bold text-red-400">{option.risk}</p>
                </div>
                <div className="text-center p-2 bg-charcoal-900/50 rounded-lg">
                  <p className="text-xs text-cream-500/60 mb-1">Ready</p>
                  <p className="font-bold text-cream-100">{option.threshold}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-400 font-semibold mb-1">How Show Difficulty Works</p>
            <ul className="text-cream-300 space-y-1">
              <li>• <span className="text-blue-400">Ceiling Bonus:</span> Maximum potential score increase</li>
              <li>• <span className="text-red-400">Risk Penalty:</span> Score reduction if not prepared</li>
              <li>• <span className="text-cream-100">Readiness Threshold:</span> Preparation needed to avoid penalty</li>
              <li>• <span className="text-gold-400">Strategy:</span> Higher difficulty = higher reward, but requires more rehearsals</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-dark rounded-2xl p-6">
              <div className="text-center mb-6">
                <div className={`
                  w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center
                  ${DIFFICULTY_OPTIONS[selectedDifficulty].bgColor}
                `}>
                  {React.createElement(DIFFICULTY_OPTIONS[selectedDifficulty].icon, {
                    className: `w-8 h-8 ${DIFFICULTY_OPTIONS[selectedDifficulty].textColor}`,
                  })}
                </div>
                <h3 className="text-2xl font-display font-bold text-cream-100 mb-2">
                  Confirm Difficulty
                </h3>
                <p className="text-cream-300">
                  Set show difficulty to <span className={DIFFICULTY_OPTIONS[selectedDifficulty].textColor}>
                    {DIFFICULTY_OPTIONS[selectedDifficulty].name}
                  </span>?
                </p>
              </div>

              <div className="space-y-2 mb-6 p-4 bg-charcoal-900/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500/60">Ceiling Bonus:</span>
                  <span className="text-green-400 font-semibold">
                    {DIFFICULTY_OPTIONS[selectedDifficulty].ceiling}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500/60">Risk Penalty:</span>
                  <span className="text-red-400 font-semibold">
                    {DIFFICULTY_OPTIONS[selectedDifficulty].risk}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500/60">Readiness Required:</span>
                  <span className="text-cream-100 font-semibold">
                    {DIFFICULTY_OPTIONS[selectedDifficulty].threshold}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={processing}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={processing}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Setting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default ShowDifficultySelector;
