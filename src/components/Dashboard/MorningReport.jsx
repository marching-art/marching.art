// src/components/Dashboard/MorningReport.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Moon, Coffee, Target, Wrench, Users, Heart,
  Check, Flame, ChevronRight, X, Sparkles, ChevronDown
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
  executionState,
  engagementData,
  dailyChallenges,
  recentScores,
  canRehearseToday,
  onStartRehearsal,
  onNavigateToEquipment,
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

  // Calculate corps health metrics
  const getCorpsHealth = () => {
    if (!executionState) return { status: 'loading', metrics: [], avgHealth: 0.75 };

    const readiness = executionState.readiness || 0.75;
    const morale = executionState.morale || 0.80;
    const equipment = executionState.equipment || {};

    // Filter out Max keys (uniformsMax, instrumentsMax, propsMax) from equipment average
    const equipmentValues = Object.entries(equipment)
      .filter(([key, val]) => typeof val === 'number' && !key.includes('Max'))
      .map(([, val]) => val);
    const avgEquipment = equipmentValues.length > 0
      ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
      : 0.85;

    const metrics = [
      { name: 'Readiness', value: readiness, icon: Target },
      { name: 'Morale', value: morale, icon: Heart },
      { name: 'Equipment', value: avgEquipment, icon: Wrench }
    ];

    const avgHealth = (readiness + morale + avgEquipment) / 3;

    return { metrics, avgHealth };
  };

  const corpsHealth = getCorpsHealth();

  // Get the primary action (most important thing to do)
  const getPrimaryAction = () => {
    // Rehearsal is always the primary action if available
    if (canRehearseToday && canRehearseToday()) {
      return {
        id: 'rehearse',
        title: 'Run Daily Rehearsal',
        subtitle: '+5% readiness • +25 XP',
        icon: Target,
        action: onStartRehearsal
      };
    }

    // Otherwise check for urgent equipment needs
    if (executionState?.equipment) {
      const lowEquipment = Object.entries(executionState.equipment)
        .filter(([key, val]) => typeof val === 'number' && val < 0.6 && !key.includes('Max'));
      if (lowEquipment.length > 0) {
        return {
          id: 'equipment',
          title: 'Repair Equipment',
          subtitle: `${lowEquipment.length} item${lowEquipment.length > 1 ? 's' : ''} need attention`,
          icon: Wrench,
          action: onNavigateToEquipment
        };
      }
    }

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

  // Get secondary quick actions
  const getSecondaryActions = () => {
    const actions = [];

    // Only show secondary actions that aren't the primary
    if (primaryAction?.id !== 'equipment' && executionState?.equipment) {
      const lowEquipment = Object.entries(executionState.equipment)
        .filter(([key, val]) => typeof val === 'number' && val < 0.6 && !key.includes('Max'));
      if (lowEquipment.length > 0) {
        actions.push({
          id: 'equipment',
          title: 'Check Equipment',
          icon: Wrench,
          action: onNavigateToEquipment
        });
      }
    }

    const staffCount = profile?.staff?.filter(s => s.assignedTo?.corpsClass === activeCorpsClass)?.length || 0;
    if (primaryAction?.id !== 'staff' && staffCount === 0 && activeCorpsClass !== 'soundSport') {
      actions.push({
        id: 'staff',
        title: 'Staff Market',
        icon: Users,
        action: onNavigateToStaff
      });
    }

    return actions;
  };

  const secondaryActions = getSecondaryActions();

  // Handle action click
  const handleAction = (action) => {
    if (action?.action) {
      action.action();
      onClose();
    }
  };

  // Get health color and status (aligned with EquipmentManager thresholds)
  const getHealthDisplay = (value) => {
    if (value >= 0.85) return { color: 'text-green-400', bg: 'bg-green-500/20', ring: 'ring-green-500/30' };
    if (value >= 0.70) return { color: 'text-amber-400', bg: 'bg-amber-500/20', ring: 'ring-amber-500/30' };
    return { color: 'text-red-400', bg: 'bg-red-500/20', ring: 'ring-red-500/30' };
  };

  const overallHealth = getHealthDisplay(corpsHealth.avgHealth);

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

          {/* Corps Health - Visual focus */}
          {activeCorps && (
            <div className="px-6 pb-5">
              <div className={`rounded-xl p-4 ${overallHealth.bg} ring-1 ${overallHealth.ring}`}>
                {/* Corps name and overall score */}
                <div className="flex items-center justify-between mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-cream-100 truncate">
                      {activeCorps.corpsName || activeCorps.name}
                    </h3>
                    <p className="text-xs text-cream-500/60 truncate">
                      {activeCorps.showConcept || 'Ready for competition'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end ml-4">
                    <span className={`text-3xl font-bold ${overallHealth.color}`}>
                      {Math.round(corpsHealth.avgHealth * 100)}%
                    </span>
                    <span className="text-xs text-cream-500/60">Overall</span>
                  </div>
                </div>

                {/* Three metrics in a row */}
                <div className="grid grid-cols-3 gap-2">
                  {corpsHealth.metrics.map((metric) => {
                    const Icon = metric.icon;
                    const display = getHealthDisplay(metric.value);
                    return (
                      <div
                        key={metric.name}
                        className="bg-charcoal-900/40 rounded-lg p-2 text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          <Icon className={`w-3.5 h-3.5 ${display.color}`} />
                          <span className={`text-sm font-bold ${display.color}`}>
                            {Math.round(metric.value * 100)}%
                          </span>
                        </div>
                        <span className="text-[10px] text-cream-500/50 uppercase tracking-wide">
                          {metric.name}
                        </span>
                      </div>
                    );
                  })}
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

          {/* Secondary Actions - Compact row */}
          {secondaryActions.length > 0 && (
            <div className="px-6 pb-4 flex gap-2">
              {secondaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    className="flex-1 px-3 py-2 rounded-lg bg-charcoal-800/50 border border-cream-500/10
                      hover:border-cream-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Icon className="w-4 h-4 text-cream-400" />
                    <span className="text-sm text-cream-300">{action.title}</span>
                  </button>
                );
              })}
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

          {/* Footer - Skip option */}
          <div className="px-6 py-4 border-t border-cream-500/10">
            {!primaryAction ? (
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gold-500 text-charcoal-900 rounded-xl font-semibold
                  hover:bg-gold-400 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Let's Go
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full text-center text-sm text-cream-500/50 hover:text-cream-400 transition-colors py-1"
              >
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MorningReport;
