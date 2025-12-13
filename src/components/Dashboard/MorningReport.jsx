// src/components/Dashboard/MorningReport.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Moon, Coffee, Target, Users,
  Check, Flame, ChevronRight, X, ChevronDown
} from 'lucide-react';

/**
 * Morning Report Modal - Streamlined daily status overview
 * Focused design: Quick scan, clear action, easy dismiss
 */
const MorningReport = ({
  isOpen,
  onClose,
  profile,
  activeCorps,
  activeCorpsClass,
  engagementData,
  dailyChallenges,
  recentScores,
  onNavigateToStaff
}) => {
  const [showChallenges, setShowChallenges] = useState(false);

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Coffee };
    if (hour < 17) return { text: 'Good Afternoon', icon: Sun };
    return { text: 'Good Evening', icon: Moon };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Get the primary action
  const getPrimaryAction = () => {
    // Check staffing
    const staffCount = profile?.staff?.filter(s => s.assignedTo?.corpsClass === activeCorpsClass)?.length || 0;
    if (staffCount === 0 && activeCorpsClass !== 'soundSport') {
      return {
        id: 'staff',
        title: 'Hire Staff',
        subtitle: 'Boost your corps performance',
        icon: Users,
        action: onNavigateToStaff
      };
    }

    return null;
  };

  const primaryAction = getPrimaryAction();

  // Handle action click
  const handleAction = (action) => {
    if (action?.action) {
      action.action();
      onClose();
    }
  };

  // Count incomplete challenges
  const incompleteChallenges = dailyChallenges?.filter(c => !c.completed) || [];
  const completedCount = dailyChallenges?.filter(c => c.completed)?.length || 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-charcoal-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-premium rounded-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Compact greeting */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gold-500/20">
                <GreetingIcon className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-cream-100">
                  {greeting.text}, {profile?.displayName?.split(' ')[0] || 'Director'}
                </h2>
                {engagementData?.loginStreak > 1 && (
                  <div className="flex items-center gap-1.5 text-orange-400">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{engagementData.loginStreak} day streak</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5 text-cream-500/60" />
            </button>
          </div>

          {/* Corps Status */}
          {activeCorps && (
            <div className="px-6 pb-5">
              <div className="rounded-xl p-4 bg-gold-500/10 ring-1 ring-gold-500/30">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-cream-100 truncate">
                      {activeCorps.corpsName || activeCorps.name}
                    </h3>
                    <p className="text-xs text-cream-500/60 truncate">
                      {typeof activeCorps.showConcept === 'object'
                        ? activeCorps.showConcept.theme || 'Ready for competition'
                        : activeCorps.showConcept || 'Ready for competition'}
                    </p>
                  </div>
                  {activeCorpsClass !== 'soundSport' && activeCorps.totalSeasonScore > 0 && (
                    <div className="flex flex-col items-end ml-4">
                      <span className="text-3xl font-bold text-gold-400">
                        {activeCorps.totalSeasonScore?.toFixed(1)}
                      </span>
                      <span className="text-xs text-cream-500/60">Season Score</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Primary Action */}
          {primaryAction && (
            <div className="px-6 pb-4">
              <button
                onClick={() => handleAction(primaryAction)}
                className="w-full p-4 rounded-xl bg-gold-500 hover:bg-gold-400
                  transition-colors flex items-center gap-3 text-left group"
              >
                <div className="p-2 rounded-lg bg-charcoal-900/20">
                  <primaryAction.icon className="w-5 h-5 text-charcoal-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-charcoal-900">{primaryAction.title}</div>
                  <div className="text-xs text-charcoal-900/70">{primaryAction.subtitle}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-charcoal-900/50 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

          {/* Challenges - Collapsible */}
          {dailyChallenges && dailyChallenges.length > 0 && (
            <div className="px-6 pb-4">
              <button
                onClick={() => setShowChallenges(!showChallenges)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-cream-300">Daily Challenges</span>
                  <span className="text-xs text-cream-500/50">
                    {completedCount}/{dailyChallenges.length}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-cream-500/40 transition-transform ${showChallenges ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showChallenges && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-2">
                      {dailyChallenges.map((challenge) => (
                        <div
                          key={challenge.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-charcoal-800/30"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            challenge.completed ? 'bg-green-500/20' : 'bg-charcoal-700'
                          }`}>
                            {challenge.completed ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-cream-500/30" />
                            )}
                          </div>
                          <span className={`flex-1 text-sm ${
                            challenge.completed ? 'text-cream-500/50 line-through' : 'text-cream-300'
                          }`}>
                            {challenge.title}
                          </span>
                          <span className="text-xs text-gold-500 flex-shrink-0">{challenge.reward}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Dismiss button */}
          <div className="px-6 pb-5">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg bg-charcoal-800/50 border border-cream-500/10
                hover:border-cream-500/20 text-sm text-cream-400 transition-colors"
            >
              Let&apos;s Go!
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MorningReport;
