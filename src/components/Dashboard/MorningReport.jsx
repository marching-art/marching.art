// src/components/Dashboard/MorningReport.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Sun, Moon, Coffee, Target, Wrench, Users, Heart,
  TrendingUp, TrendingDown, AlertTriangle, Check,
  Flame, Star, ChevronRight, X, Sparkles, Trophy,
  Calendar, Zap, Gift
} from 'lucide-react';

/**
 * Morning Report Modal - Shows a quick status overview when returning users log in
 * Displays corps health, urgent actions needed, and daily tasks
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
  const [hasSeenReport, setHasSeenReport] = useState(false);

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Coffee, emoji: 'sunrise' };
    if (hour < 17) return { text: 'Good Afternoon', icon: Sun, emoji: 'sun' };
    return { text: 'Good Evening', icon: Moon, emoji: 'moon' };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Calculate corps health metrics
  const getCorpsHealth = () => {
    if (!executionState) return { status: 'loading', metrics: [] };

    const readiness = executionState.readiness || 0.75;
    const morale = executionState.morale || 0.80;
    const equipment = executionState.equipment || {};

    // Calculate average equipment condition
    const equipmentValues = Object.values(equipment).filter(v => typeof v === 'number');
    const avgEquipment = equipmentValues.length > 0
      ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
      : 0.85;

    const metrics = [
      {
        name: 'Readiness',
        value: readiness,
        icon: Target,
        color: readiness >= 0.8 ? 'text-green-400' : readiness >= 0.6 ? 'text-yellow-400' : 'text-red-400',
        bgColor: readiness >= 0.8 ? 'bg-green-500/20' : readiness >= 0.6 ? 'bg-yellow-500/20' : 'bg-red-500/20'
      },
      {
        name: 'Morale',
        value: morale,
        icon: Heart,
        color: morale >= 0.8 ? 'text-green-400' : morale >= 0.6 ? 'text-yellow-400' : 'text-red-400',
        bgColor: morale >= 0.8 ? 'bg-green-500/20' : morale >= 0.6 ? 'bg-yellow-500/20' : 'bg-red-500/20'
      },
      {
        name: 'Equipment',
        value: avgEquipment,
        icon: Wrench,
        color: avgEquipment >= 0.8 ? 'text-green-400' : avgEquipment >= 0.6 ? 'text-yellow-400' : 'text-red-400',
        bgColor: avgEquipment >= 0.8 ? 'bg-green-500/20' : avgEquipment >= 0.6 ? 'bg-yellow-500/20' : 'bg-red-500/20'
      }
    ];

    // Determine overall status
    const avgHealth = (readiness + morale + avgEquipment) / 3;
    const status = avgHealth >= 0.8 ? 'excellent' : avgHealth >= 0.6 ? 'good' : avgHealth >= 0.4 ? 'needs_attention' : 'critical';

    return { status, metrics, avgHealth };
  };

  const corpsHealth = getCorpsHealth();

  // Get urgent actions needed
  const getUrgentActions = () => {
    const actions = [];

    // Check if rehearsal available
    if (canRehearseToday && canRehearseToday()) {
      actions.push({
        id: 'rehearse',
        title: 'Run Daily Rehearsal',
        description: '+5% readiness, +25 XP',
        icon: Target,
        color: 'text-blue-400',
        priority: 'high',
        action: onStartRehearsal
      });
    }

    // Check equipment condition
    if (executionState?.equipment) {
      const lowEquipment = Object.entries(executionState.equipment)
        .filter(([key, val]) => typeof val === 'number' && val < 0.6 && !key.includes('Max'));

      if (lowEquipment.length > 0) {
        actions.push({
          id: 'equipment',
          title: 'Repair Equipment',
          description: `${lowEquipment.length} item${lowEquipment.length > 1 ? 's' : ''} need attention`,
          icon: Wrench,
          color: 'text-orange-400',
          priority: 'medium',
          action: onNavigateToEquipment
        });
      }
    }

    // Check morale
    if (executionState?.morale && executionState.morale < 0.6) {
      actions.push({
        id: 'morale',
        title: 'Boost Corps Morale',
        description: 'Low morale affects performance',
        icon: Heart,
        color: 'text-pink-400',
        priority: 'medium'
      });
    }

    // Check if staff assigned
    const staffCount = profile?.staff?.filter(s => s.assignedTo?.corpsClass === activeCorpsClass)?.length || 0;
    if (staffCount === 0 && activeCorpsClass !== 'soundSport') {
      actions.push({
        id: 'staff',
        title: 'Hire Staff',
        description: 'No instructors assigned yet',
        icon: Users,
        color: 'text-purple-400',
        priority: 'low',
        action: onNavigateToStaff
      });
    }

    return actions;
  };

  const urgentActions = getUrgentActions();

  // Get status message based on corps health
  const getStatusMessage = () => {
    switch (corpsHealth.status) {
      case 'excellent':
        return "Your corps is performing at peak level! Keep up the great work.";
      case 'good':
        return "Your corps is doing well. A few improvements could make a big difference.";
      case 'needs_attention':
        return "Your corps needs some attention. Focus on the priority actions below.";
      case 'critical':
        return "Your corps requires immediate attention! Address the urgent items.";
      default:
        return "Welcome back, Director!";
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setHasSeenReport(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-charcoal-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-premium rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 pb-4 border-b border-cream-500/10">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5 text-cream-500/60" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-gold-500/20">
                <GreetingIcon className="w-6 h-6 text-gold-500" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-cream-100">
                  {greeting.text}, {profile?.displayName?.split(' ')[0] || 'Director'}!
                </h2>
                <p className="text-sm text-cream-500/60">
                  Here's your morning report
                </p>
              </div>
            </div>

            {/* Login Streak */}
            {engagementData?.loginStreak > 1 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-400">
                  {engagementData.loginStreak} day streak!
                </span>
              </div>
            )}
          </div>

          {/* Corps Overview */}
          {activeCorps && (
            <div className="p-6 border-b border-cream-500/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-cream-100">
                    {activeCorps.corpsName || activeCorps.name}
                  </h3>
                  <p className="text-sm text-cream-500/60">
                    {activeCorps.showConcept || 'Show concept not set'}
                  </p>
                </div>
                {activeCorps.rank && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-gold-500">
                      <Trophy className="w-4 h-4" />
                      <span className="font-bold">#{activeCorps.rank}</span>
                    </div>
                    <p className="text-xs text-cream-500/60">Current Rank</p>
                  </div>
                )}
              </div>

              {/* Health Metrics */}
              <div className="grid grid-cols-3 gap-3">
                {corpsHealth.metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.name}
                      className={`p-3 rounded-xl ${metric.bgColor} text-center`}
                    >
                      <Icon className={`w-5 h-5 ${metric.color} mx-auto mb-1`} />
                      <div className={`text-lg font-bold ${metric.color}`}>
                        {Math.round(metric.value * 100)}%
                      </div>
                      <div className="text-xs text-cream-500/60">{metric.name}</div>
                    </div>
                  );
                })}
              </div>

              {/* Status Message */}
              <div className={`mt-4 p-3 rounded-lg ${
                corpsHealth.status === 'excellent' ? 'bg-green-500/10 border border-green-500/20' :
                corpsHealth.status === 'good' ? 'bg-blue-500/10 border border-blue-500/20' :
                corpsHealth.status === 'needs_attention' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                'bg-red-500/10 border border-red-500/20'
              }`}>
                <p className={`text-sm ${
                  corpsHealth.status === 'excellent' ? 'text-green-400' :
                  corpsHealth.status === 'good' ? 'text-blue-400' :
                  corpsHealth.status === 'needs_attention' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {getStatusMessage()}
                </p>
              </div>
            </div>
          )}

          {/* Priority Actions */}
          {urgentActions.length > 0 && (
            <div className="p-6 border-b border-cream-500/10">
              <h3 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-gold-500" />
                Priority Actions
              </h3>
              <div className="space-y-2">
                {urgentActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        if (action.action) {
                          action.action();
                          handleDismiss();
                        }
                      }}
                      className={`w-full p-3 rounded-xl bg-charcoal-800/50 border border-cream-500/10
                        hover:border-cream-500/20 transition-all flex items-center gap-3 text-left
                        ${action.action ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className={`p-2 rounded-lg ${
                        action.priority === 'high' ? 'bg-blue-500/20' :
                        action.priority === 'medium' ? 'bg-orange-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        <Icon className={`w-4 h-4 ${action.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-cream-100">{action.title}</div>
                        <div className="text-xs text-cream-500/60">{action.description}</div>
                      </div>
                      {action.action && (
                        <ChevronRight className="w-4 h-4 text-cream-500/40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Challenges Preview */}
          {dailyChallenges && dailyChallenges.length > 0 && (
            <div className="p-6 border-b border-cream-500/10">
              <h3 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                Today's Challenges
              </h3>
              <div className="space-y-2">
                {dailyChallenges.slice(0, 3).map((challenge) => (
                  <div
                    key={challenge.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-charcoal-800/30"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      challenge.completed ? 'bg-green-500/20' : 'bg-charcoal-700'
                    }`}>
                      {challenge.completed ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-cream-500/30" />
                      )}
                    </div>
                    <span className={`flex-1 text-sm ${
                      challenge.completed ? 'text-cream-500/60 line-through' : 'text-cream-300'
                    }`}>
                      {challenge.title}
                    </span>
                    <span className="text-xs text-gold-500">{challenge.reward}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Performance */}
          {recentScores && recentScores.length > 0 && activeCorpsClass !== 'soundSport' && (
            <div className="p-6 border-b border-cream-500/10">
              <h3 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-gold-500" />
                Recent Performance
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-2xl font-bold text-cream-100">
                    {recentScores[0]?.totalScore || '--'}
                  </div>
                  <div className="text-xs text-cream-500/60">
                    {recentScores[0]?.showName || 'Last Score'}
                  </div>
                </div>
                {recentScores[0]?.rank && (
                  <div className="text-right">
                    <div className="text-lg font-semibold text-cream-300">
                      #{recentScores[0].rank}
                    </div>
                    <div className="text-xs text-cream-500/60">Placement</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-6">
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-3 bg-gold-500 text-charcoal-900 rounded-xl font-semibold
                  hover:bg-gold-400 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Let's Get Started
              </button>
            </div>
            <p className="text-center text-xs text-cream-500/40 mt-3">
              Press anywhere outside to dismiss
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MorningReport;
