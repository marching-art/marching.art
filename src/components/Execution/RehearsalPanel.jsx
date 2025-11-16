// src/components/Execution/RehearsalPanel.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Check, Clock, Zap, Star, TrendingUp,
  Users, Music, Target, Sparkles
} from 'lucide-react';

const RehearsalPanel = ({
  executionState,
  canRehearseToday,
  onRehearsal,
  processing
}) => {
  const [showAnimation, setShowAnimation] = useState(false);
  const [rehearsalResults, setRehearsalResults] = useState(null);

  const handleRehearsal = async () => {
    setShowAnimation(true);
    const result = await onRehearsal();

    if (result.success) {
      setRehearsalResults(result.data);
      setTimeout(() => {
        setShowAnimation(false);
        setRehearsalResults(null);
      }, 4000);
    } else {
      setShowAnimation(false);
    }
  };

  // Get next rehearsal time
  const getNextRehearsalTime = () => {
    if (!executionState?.lastRehearsalDate) return 'Available now';

    const lastRehearsal = new Date(executionState.lastRehearsalDate);
    const nextRehearsal = new Date(lastRehearsal);
    nextRehearsal.setDate(nextRehearsal.getDate() + 1);
    nextRehearsal.setHours(0, 0, 0, 0);

    const now = new Date();
    if (now >= nextRehearsal) return 'Available now';

    const hoursRemaining = Math.ceil((nextRehearsal - now) / (1000 * 60 * 60));
    return `Available in ${hoursRemaining}h`;
  };

  // Rehearsal benefits
  const rehearsalBenefits = [
    { icon: TrendingUp, label: 'Increases Readiness', value: '+5-10%' },
    { icon: Zap, label: 'Grants XP', value: '+50 XP' },
    { icon: Star, label: 'Improves Skills', value: 'Variable' }
  ];

  return (
    <div className="space-y-4">
      {/* Main Rehearsal Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-premium p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-display font-bold text-cream-100 mb-1">
              Daily Rehearsal
            </h3>
            <p className="text-sm text-cream-500/60">
              Train your corps to improve execution
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-cream-300">
              <Clock className="w-4 h-4" />
              {getNextRehearsalTime()}
            </div>
            {executionState?.rehearsalsThisWeek !== undefined && (
              <p className="text-xs text-cream-500/60 mt-1">
                {executionState.rehearsalsThisWeek}/7 this week
              </p>
            )}
          </div>
        </div>

        {/* Rehearsal Button */}
        <div className="mb-6">
          {canRehearseToday ? (
            <button
              onClick={handleRehearsal}
              disabled={processing || showAnimation}
              className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing || showAnimation ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-charcoal-500 border-t-gold-500 mr-2" />
                  Rehearsing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Rehearsal
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              className="btn-ghost w-full text-lg py-4 cursor-not-allowed opacity-50"
            >
              <Check className="w-5 h-5 mr-2 text-green-500" />
              Rehearsal Complete
            </button>
          )}
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {rehearsalBenefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-charcoal-900/30 rounded-lg"
              >
                <Icon className="w-5 h-5 text-gold-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-cream-500/60">{benefit.label}</p>
                  <p className="text-sm font-semibold text-cream-100">
                    {benefit.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Progress */}
        {executionState?.rehearsalsThisWeek !== undefined && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-cream-500/60">Weekly Progress</span>
              <span className="text-xs font-semibold text-cream-300">
                {executionState.rehearsalsThisWeek}/7 Days
              </span>
            </div>
            <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(executionState.rehearsalsThisWeek / 7) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-gold"
              />
            </div>
            {executionState.rehearsalsThisWeek === 7 && (
              <p className="text-xs text-green-500 mt-2 font-semibold">
                Perfect Week! Bonus XP awarded 🎉
              </p>
            )}
          </div>
        )}
      </motion.div>

      {/* Rehearsal Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4"
      >
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-gold-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-cream-100 mb-1">Pro Tips</p>
            <ul className="text-xs text-cream-500/80 space-y-1">
              <li>• Daily rehearsals prevent readiness decay</li>
              <li>• Consecutive rehearsals build stronger momentum</li>
              <li>• Perfect weekly attendance earns bonus rewards</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Rehearsal Animation & Results */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="glass-dark rounded-2xl p-8 max-w-md w-full text-center"
            >
              {rehearsalResults ? (
                <div className="space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <Check className="w-16 h-16 text-green-500 mx-auto" />
                  </motion.div>

                  <h3 className="text-2xl font-bold text-gradient">
                    Rehearsal Complete!
                  </h3>

                  <div className="space-y-3">
                    <div className="card p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-cream-500/80">Readiness</span>
                        <span className="text-green-500 font-semibold">
                          +{((rehearsalResults.newReadiness - (executionState?.readiness || 0)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {rehearsalResults.xpGained && (
                      <div className="card p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-cream-500/80">XP Gained</span>
                          <span className="text-gold-500 font-semibold">
                            +{rehearsalResults.xpGained} XP
                          </span>
                        </div>
                      </div>
                    )}

                    {rehearsalResults.bonusMessage && (
                      <div className="card-premium p-4">
                        <p className="text-sm text-cream-100">
                          {rehearsalResults.bonusMessage}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Music className="w-16 h-16 text-gold-500 mx-auto" />
                  </motion.div>

                  <h3 className="text-xl font-bold text-cream-100">
                    Rehearsal in Progress
                  </h3>
                  <p className="text-cream-500/60">
                    Your corps is working hard...
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RehearsalPanel;
