// src/components/Dashboard/DailyOperations.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Users, Wrench, Heart, Music, Eye, Flag,
  Drum, Zap, ChevronRight, Play, Square,
  Coffee, ChevronDown, ChevronUp, Check,
  TrendingUp, AlertTriangle, CheckCircle, Lightbulb, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import BrandLogo from '../BrandLogo';
import {
  claimDailyLogin,
  staffCheckin,
  memberWellnessCheck,
  equipmentInspection,
  sectionalRehearsal,
  showReview,
  getDailyOpsStatus
} from '../../firebase/functions';

/**
 * Unified Daily Operations Component
 * Consolidates: Execution multiplier, rehearsal, daily activities, and challenges
 */
const DailyOperations = ({
  corpsClass,
  profile,
  executionState,
  canRehearseToday,
  onRehearsal,
  rehearsalProcessing,
  calculateMultiplier,
  onActivityComplete
}) => {
  const { user } = useAuth();
  const { ownedStaff } = useStaffMarketplace(user?.uid);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [opsStatus, setOpsStatus] = useState(null);
  const [showInsights, setShowInsights] = useState(null);
  const [showMultiplierBreakdown, setShowMultiplierBreakdown] = useState(false);
  const [showRehearsalAnimation, setShowRehearsalAnimation] = useState(false);
  const [rehearsalResults, setRehearsalResults] = useState(null);

  // Get staff assigned to this corps from marketplace
  const assignedStaff = ownedStaff.filter(
    s => s.assignedTo?.corpsClass === corpsClass
  );

  // Calculate multiplier using correct staff count from marketplace
  const calculateMultiplierWithStaff = () => {
    if (!executionState) return 1.0;

    const { readiness = 0.75, morale = 0.80, equipment = {} } = executionState;

    // Calculate average equipment condition
    const equipmentValues = Object.entries(equipment)
      .filter(([k, v]) => typeof v === 'number' && !k.includes('Max'))
      .map(([, v]) => v);
    const avgEquipment = equipmentValues.length > 0
      ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
      : 0.90;

    // Staff bonus from marketplace assigned staff (max 5%)
    const staffBonus = Math.min(assignedStaff.length * 0.01, 0.05);

    // Base calculation: (readiness * 40%) + (morale * 30%) + (equipment * 30%)
    const baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (avgEquipment * 0.3);

    // Clamp to 0.70-1.10 range
    return Math.max(0.70, Math.min(1.10, baseMultiplier + staffBonus));
  };

  const multiplier = calculateMultiplierWithStaff();

  // Fetch daily ops status
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getDailyOpsStatus({ corpsClass });
      if (result.data.success) {
        setOpsStatus(result.data.status);
      }
    } catch (error) {
      console.error('Error fetching daily ops status:', error);
    } finally {
      setLoading(false);
    }
  }, [corpsClass]);

  useEffect(() => {
    if (corpsClass) {
      fetchStatus();
    }
  }, [corpsClass, fetchStatus]);

  // Get execution metrics
  const getMetrics = () => {
    if (!executionState) return { readiness: 0.75, morale: 0.80, equipment: 0.85, staffCount: 0 };

    const readiness = typeof executionState.readiness === 'number' ? executionState.readiness : 0.75;
    const morale = typeof executionState.morale === 'number' ? executionState.morale : 0.80;

    // Calculate average equipment
    const equipment = executionState.equipment || {};
    const equipmentValues = Object.entries(equipment)
      .filter(([k, v]) => typeof v === 'number' && !k.includes('Max'))
      .map(([, v]) => v);
    const avgEquipment = equipmentValues.length > 0
      ? equipmentValues.reduce((a, b) => a + b, 0) / equipmentValues.length
      : 0.85;

    // Get staff count from marketplace assigned staff
    const staffCount = assignedStaff.length;

    return { readiness, morale, equipment: avgEquipment, staffCount };
  };

  const metrics = getMetrics();

  // Calculate actual multiplier breakdown that matches useExecution.calculateMultiplier
  const getMultiplierBreakdownData = () => {
    // Actual formula: baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (equipment * 0.3) + staffBonus
    // Then clamped to 0.70 - 1.10
    const readinessContrib = metrics.readiness * 0.4;
    const moraleContrib = metrics.morale * 0.3;
    const equipmentContrib = metrics.equipment * 0.3;
    const staffBonus = Math.min(metrics.staffCount * 0.01, 0.05);

    // Show deviation from perfect (1.0 for each factor)
    const readinessDelta = (metrics.readiness - 1.0) * 0.4;
    const moraleDelta = (metrics.morale - 1.0) * 0.3;
    const equipmentDelta = (metrics.equipment - 1.0) * 0.3;

    return {
      readiness: { value: readinessContrib, delta: readinessDelta, weight: 40, current: metrics.readiness },
      morale: { value: moraleContrib, delta: moraleDelta, weight: 30, current: metrics.morale },
      equipment: { value: equipmentContrib, delta: equipmentDelta, weight: 30, current: metrics.equipment },
      staff: { value: staffBonus, count: metrics.staffCount, maxBonus: 0.05 }
    };
  };

  const breakdownData = getMultiplierBreakdownData();

  // Handle main rehearsal
  const handleRehearsal = async () => {
    setShowRehearsalAnimation(true);
    try {
      const result = await onRehearsal();
      if (result?.success) {
        setRehearsalResults(result.data);
        setTimeout(() => {
          setShowRehearsalAnimation(false);
          setRehearsalResults(null);
          fetchStatus();
        }, 3000);
      } else {
        setShowRehearsalAnimation(false);
      }
    } catch (error) {
      setShowRehearsalAnimation(false);
      toast.error('Rehearsal failed');
    }
  };

  // Activity handlers
  const handleClaimLogin = async () => {
    setProcessing('login');
    try {
      const result = await claimDailyLogin();
      if (result.data.success) {
        toast.success(result.data.message);
        fetchStatus();
        if (onActivityComplete) onActivityComplete('login', result.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to claim login bonus');
    } finally {
      setProcessing(null);
    }
  };

  const handleStaffCheckin = async () => {
    setProcessing('staff');
    try {
      const result = await staffCheckin({ corpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchStatus();
        if (onActivityComplete) onActivityComplete('staff', result.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to complete staff check-in');
    } finally {
      setProcessing(null);
    }
  };

  const handleWellnessCheck = async () => {
    setProcessing('wellness');
    try {
      const result = await memberWellnessCheck({ corpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchStatus();
        if (onActivityComplete) onActivityComplete('wellness', result.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to complete wellness check');
    } finally {
      setProcessing(null);
    }
  };

  const handleEquipmentInspection = async () => {
    setProcessing('equipment');
    try {
      const result = await equipmentInspection({ corpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        if (result.data.event) {
          toast(result.data.event.message, {
            icon: result.data.event.type === 'positive' ? '✨' : result.data.event.type === 'negative' ? '⚠️' : 'ℹ️',
            duration: 4000
          });
        }
        fetchStatus();
        if (onActivityComplete) onActivityComplete('equipment', result.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to complete equipment inspection');
    } finally {
      setProcessing(null);
    }
  };

  const handleSectionalRehearsal = async (section) => {
    setProcessing(`sectional_${section}`);
    try {
      const result = await sectionalRehearsal({ corpsClass, section });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchStatus();
        if (onActivityComplete) onActivityComplete('sectional', result.data);
      }
    } catch (error) {
      toast.error(error.message || `Failed to complete ${section} sectional`);
    } finally {
      setProcessing(null);
    }
  };

  const handleShowReview = async () => {
    setProcessing('review');
    try {
      const result = await showReview({ corpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        // Store full result data including insights and stats
        setShowInsights({
          insights: result.data.insights,
          stats: result.data.stats
        });
        fetchStatus();
        if (onActivityComplete) onActivityComplete('review', result.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to complete show review');
    } finally {
      setProcessing(null);
    }
  };

  // Get multiplier status
  const getMultiplierStatus = () => {
    if (multiplier >= 1.05) return { color: 'text-green-500', bg: 'bg-green-500', label: 'Excellent' };
    if (multiplier >= 0.95) return { color: 'text-blue-500', bg: 'bg-blue-500', label: 'Good' };
    if (multiplier >= 0.85) return { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Fair' };
    return { color: 'text-red-500', bg: 'bg-red-500', label: 'Needs Work' };
  };

  const multiplierStatus = getMultiplierStatus();

  // Calculate completion
  const getCompletionStats = () => {
    if (!opsStatus) return { completed: 0, total: 6 };

    let completed = 0;
    let total = 6; // login, staff, wellness, equipment, review, rehearsal

    if (!opsStatus.loginBonus?.available) completed++;
    if (!opsStatus.staffCheckin?.available) completed++;
    if (!opsStatus.memberWellness?.available) completed++;
    if (!opsStatus.equipmentInspection?.available) completed++;
    if (!opsStatus.showReview?.available) completed++;
    if (!canRehearseToday) completed++;

    return { completed, total };
  };

  const completionStats = getCompletionStats();

  if (loading) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="animate-pulse">
            <BrandLogo className="w-12 h-12" color="text-gold-500" />
          </div>
          <p className="font-mono text-xs text-gold-500/50 uppercase tracking-wide">Loading activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Rehearsal Card - 80px height */}
      <div className="h-20 glass-slot flex items-center gap-3 px-4">
        {/* Left: Icon + Info */}
        <div className="w-12 h-12 flex items-center justify-center bg-gold-500/20 border border-gold-500/40 rounded-lg flex-shrink-0">
          <Music className="w-6 h-6 text-gold-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-mono font-bold text-cream-100">Full Rehearsal</h4>
            <span className="text-xs font-mono text-gold-400">+5% readiness</span>
          </div>
          {/* Horizontal Progress Bar for Week */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-charcoal-900 rounded-sm overflow-hidden flex gap-px">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 transition-all ${
                    i < (executionState?.rehearsalsThisWeek || 0)
                      ? 'bg-gold-500'
                      : 'bg-charcoal-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono text-cream/50 w-10 text-right">
              {executionState?.rehearsalsThisWeek || 0}/7
            </span>
          </div>
        </div>
        {/* Right: Action Button */}
        <button
          onClick={handleRehearsal}
          disabled={!canRehearseToday || rehearsalProcessing || showRehearsalAnimation}
          className={`h-10 px-4 font-mono font-bold text-xs uppercase flex items-center gap-2 transition-all border rounded-lg flex-shrink-0 ${
            canRehearseToday
              ? 'bg-gold-500/20 border-gold-500/50 text-gold-400 hover:bg-gold-500/30'
              : 'bg-green-500/10 border-green-500/30 text-green-400 cursor-not-allowed'
          }`}
        >
          {rehearsalProcessing || showRehearsalAnimation ? (
            <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          ) : canRehearseToday ? (
            <>
              <Play className="w-4 h-4" />
              Run
            </>
          ) : (
            <Check className="w-4 h-4" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }} />
          )}
        </button>
      </div>

      {/* Daily Tasks - Checklist Style */}
      <div className="glass-slot">
        <div className="flex items-center justify-between mb-3">
          <span className="section-label mb-0">Daily Tasks</span>
          <span className="text-sm font-mono font-bold text-gold-400">
            {completionStats.completed}<span className="text-cream/40">/{completionStats.total}</span>
          </span>
        </div>

        <div className="space-y-1">
          {(() => {
            const activities = [
              { id: 'login', icon: Coffee, title: 'Login Bonus', reward: '+10 XP, +5 CC', available: opsStatus?.loginBonus?.available, loading: processing === 'login', onClick: handleClaimLogin },
              { id: 'staff', icon: Users, title: 'Staff Check-in', reward: '+15 XP', available: opsStatus?.staffCheckin?.available, loading: processing === 'staff', onClick: handleStaffCheckin },
              { id: 'wellness', icon: Heart, title: 'Member Wellness', reward: '+15 XP, +3% morale', available: opsStatus?.memberWellness?.available, loading: processing === 'wellness', onClick: handleWellnessCheck },
              { id: 'equipment', icon: Wrench, title: 'Equipment Check', reward: '+10 XP, +5 CC', available: opsStatus?.equipmentInspection?.available, loading: processing === 'equipment', onClick: handleEquipmentInspection },
              { id: 'review', icon: Eye, title: 'Show Review', reward: '+20 XP', available: opsStatus?.showReview?.available, loading: processing === 'review', onClick: handleShowReview },
            ];

            return activities.map((activity) => (
              <TaskChecklistRow
                key={activity.id}
                title={activity.title}
                reward={activity.reward}
                available={activity.available}
                loading={activity.loading}
                onClick={activity.onClick}
              />
            ));
          })()}
        </div>
      </div>

      {/* Sectional Rehearsals */}
      {opsStatus?.sectionalRehearsals && (
        <div className="bg-white/5 border border-blue-500/30 p-4" style={{ borderRadius: '4px' }}>
          <h4 className="text-sm font-display font-bold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-blue-500/30">
            <Target className="w-4 h-4 text-blue-400" />
            Sectional Rehearsals
            <span className="text-xs font-mono text-blue-400/60">(+2% each)</span>
          </h4>

          <div className="grid grid-cols-4 gap-2">
            <SectionalButton
              icon={Music}
              label="Music"
              available={opsStatus.sectionalRehearsals.music?.available}
              loading={processing === 'sectional_music'}
              onClick={() => handleSectionalRehearsal('music')}
            />
            <SectionalButton
              icon={Eye}
              label="Visual"
              available={opsStatus.sectionalRehearsals.visual?.available}
              loading={processing === 'sectional_visual'}
              onClick={() => handleSectionalRehearsal('visual')}
            />
            <SectionalButton
              icon={Flag}
              label="Guard"
              available={opsStatus.sectionalRehearsals.guard?.available}
              loading={processing === 'sectional_guard'}
              onClick={() => handleSectionalRehearsal('guard')}
            />
            <SectionalButton
              icon={Drum}
              label="Battery"
              available={opsStatus.sectionalRehearsals.percussion?.available}
              loading={processing === 'sectional_percussion'}
              onClick={() => handleSectionalRehearsal('percussion')}
            />
          </div>
        </div>
      )}

      {/* Insights Modal */}
      <AnimatePresence>
        {showInsights && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-charcoal-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowInsights(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="glass-premium rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-cream-100">Show Review</h3>
                    <p className="text-xs text-cream-400">Corps Performance Analysis</p>
                  </div>
                </div>

                {/* Stats Grid */}
                {showInsights.stats && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {/* Readiness */}
                    <div className="bg-charcoal-800/50 rounded-xl p-4 border border-charcoal-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-cream-400 font-medium">Readiness</span>
                      </div>
                      <div className="flex items-end gap-1">
                        <span className={`text-2xl font-bold ${
                          showInsights.stats.readiness >= 90 ? 'text-green-400' :
                          showInsights.stats.readiness >= 70 ? 'text-blue-400' :
                          showInsights.stats.readiness >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {showInsights.stats.readiness}
                        </span>
                        <span className="text-sm text-cream-500 mb-0.5">%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-charcoal-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${showInsights.stats.readiness}%` }}
                          transition={{ delay: 0.2, duration: 0.8 }}
                          className={`h-full rounded-full ${
                            showInsights.stats.readiness >= 90 ? 'bg-green-500' :
                            showInsights.stats.readiness >= 70 ? 'bg-blue-500' :
                            showInsights.stats.readiness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Morale */}
                    <div className="bg-charcoal-800/50 rounded-xl p-4 border border-charcoal-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-pink-400" />
                        <span className="text-xs text-cream-400 font-medium">Morale</span>
                      </div>
                      <div className="flex items-end gap-1">
                        <span className={`text-2xl font-bold ${
                          showInsights.stats.morale >= 90 ? 'text-green-400' :
                          showInsights.stats.morale >= 70 ? 'text-pink-400' :
                          showInsights.stats.morale >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {showInsights.stats.morale}
                        </span>
                        <span className="text-sm text-cream-500 mb-0.5">%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-charcoal-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${showInsights.stats.morale}%` }}
                          transition={{ delay: 0.3, duration: 0.8 }}
                          className={`h-full rounded-full ${
                            showInsights.stats.morale >= 90 ? 'bg-green-500' :
                            showInsights.stats.morale >= 70 ? 'bg-pink-500' :
                            showInsights.stats.morale >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sectional Focus */}
                {showInsights.stats?.sectionalFocus && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-cream-200 mb-3 flex items-center gap-2">
                      <Music className="w-4 h-4 text-purple-400" />
                      Sectional Practice
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { key: 'music', label: 'Music', icon: Music, color: 'blue' },
                        { key: 'visual', label: 'Visual', icon: Eye, color: 'purple' },
                        { key: 'guard', label: 'Guard', icon: Flag, color: 'pink' },
                        { key: 'percussion', label: 'Battery', icon: Drum, color: 'orange' }
                      ].map(({ key, label, icon: Icon, color }) => (
                        <div key={key} className="bg-charcoal-800/30 rounded-lg p-2 text-center border border-charcoal-700/30">
                          <Icon className={`w-4 h-4 mx-auto mb-1 text-${color}-400`} />
                          <div className="text-lg font-bold text-cream-100">
                            {showInsights.stats.sectionalFocus[key] || 0}
                          </div>
                          <div className="text-[10px] text-cream-500 leading-tight">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Equipment Health */}
                {showInsights.stats?.equipmentHealth && Object.keys(showInsights.stats.equipmentHealth).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-cream-200 mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      Equipment Health
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(showInsights.stats.equipmentHealth).map(([name, value]) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="text-xs text-cream-400 w-24 capitalize truncate">{name}</span>
                          <div className="flex-1 h-2 bg-charcoal-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${value}%` }}
                              transition={{ delay: 0.4, duration: 0.6 }}
                              className={`h-full rounded-full ${
                                value >= 80 ? 'bg-green-500' :
                                value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <span className={`text-xs font-medium w-10 text-right ${
                            value >= 80 ? 'text-green-400' :
                            value >= 60 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {value}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insights */}
                {showInsights.insights && showInsights.insights.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-cream-200 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                      Insights & Recommendations
                    </h4>
                    <div className="space-y-2">
                      {showInsights.insights.map((insight, idx) => {
                        const getInsightConfig = (type) => {
                          switch (type) {
                            case 'success':
                              return {
                                icon: CheckCircle,
                                bg: 'bg-green-500/10',
                                border: 'border-green-500/30',
                                iconColor: 'text-green-400',
                                textColor: 'text-green-200'
                              };
                            case 'warning':
                              return {
                                icon: AlertTriangle,
                                bg: 'bg-yellow-500/10',
                                border: 'border-yellow-500/30',
                                iconColor: 'text-yellow-400',
                                textColor: 'text-yellow-200'
                              };
                            case 'tip':
                              return {
                                icon: Lightbulb,
                                bg: 'bg-purple-500/10',
                                border: 'border-purple-500/30',
                                iconColor: 'text-purple-400',
                                textColor: 'text-purple-200'
                              };
                            default:
                              return {
                                icon: TrendingUp,
                                bg: 'bg-blue-500/10',
                                border: 'border-blue-500/30',
                                iconColor: 'text-blue-400',
                                textColor: 'text-blue-200'
                              };
                          }
                        };
                        const config = getInsightConfig(insight.type);
                        const InsightIcon = config.icon;

                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * idx }}
                            className={`flex items-start gap-3 p-3 rounded-lg ${config.bg} border ${config.border}`}
                          >
                            <InsightIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
                            <p className={`text-sm ${config.textColor}`}>
                              {insight.message}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <button
                  onClick={() => setShowInsights(null)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-charcoal-700 to-charcoal-600 text-cream-100 rounded-xl font-medium hover:from-charcoal-600 hover:to-charcoal-500 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Got it!
                </button>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Rehearsal Animation */}
      <AnimatePresence>
        {showRehearsalAnimation && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-dark rounded-2xl p-8 max-w-sm w-full text-center"
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
                    <h3 className="text-2xl font-bold text-gradient">Rehearsal Complete!</h3>
                    <div className="space-y-2">
                      <div className="glass p-3 rounded-lg flex justify-between">
                        <span className="text-cream-500/80">Readiness</span>
                        <span className="text-green-500 font-semibold">+5%</span>
                      </div>
                      {rehearsalResults.xpGained && (
                        <div className="glass p-3 rounded-lg flex justify-between">
                          <span className="text-cream-500/80">XP Gained</span>
                          <span className="text-gold-500 font-semibold">+{rehearsalResults.xpGained}</span>
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
                    <h3 className="text-xl font-bold text-cream-100">Rehearsal in Progress</h3>
                    <p className="text-cream-500/60">Your corps is working hard...</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

// Metric Pill Component
const MetricPill = ({ icon: Icon, label, value }) => {
  const getColor = (v) => {
    if (v >= 0.85) return 'text-green-400 bg-green-500/20';
    if (v >= 0.70) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const colorClass = getColor(value);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass.split(' ')[1]}`}>
      <Icon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${colorClass.split(' ')[0]}`}>
          {Math.round(value * 100)}%
        </div>
        <div className="text-[10px] text-cream-500/60 truncate">{label}</div>
      </div>
    </div>
  );
};

// Detailed Breakdown Row Component - shows actual contribution vs potential
const BreakdownRowDetailed = ({ label, weight, current, contribution, delta }) => {
  const maxContribution = weight / 100; // Convert weight % to decimal
  const percentage = Math.round(current * 100);
  const isAtMax = current >= 0.99;
  const deltaDisplay = delta >= 0 ? '' : (delta * 100).toFixed(1);

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-cream-500/60">{label}</span>
        <span className="text-cream-500/40">({percentage}% × {weight}%)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={isAtMax ? 'text-green-400' : current >= 0.85 ? 'text-yellow-400' : 'text-red-400'}>
          {(contribution * 100).toFixed(1)}%
        </span>
        {!isAtMax && (
          <span className="text-red-400/60 text-[10px]">
            ({deltaDisplay}%)
          </span>
        )}
      </div>
    </div>
  );
};

// Activity Row Component - Commander's tactical checklist with neon tick marks
// isNextTask: Highlighted with gold glow as the next action to take
// Available (not next): Standard clickable row with dark glass panel
// Completed: Green neon tick with glow effect
const ActivityRow = ({ icon: Icon, title, reward, available, loading, onClick, isNextTask = false }) => {
  // Determine styling based on state
  const getRowStyles = () => {
    if (!available) {
      // Completed: subtle with neon tick
      return 'bg-black/30 border-green-500/30 cursor-default';
    }
    if (isNextTask) {
      // Next task to complete: gold glow highlight
      return 'bg-gold-500/10 border-gold-500/50 hover:border-gold-400 cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.15)]';
    }
    // Available but not next: dark glass panel
    return 'bg-black/40 border-white/10 hover:border-white/20 cursor-pointer';
  };

  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`w-full flex items-center gap-3 p-3 transition-all border ${getRowStyles()}`}
      style={{ borderRadius: '4px' }}
    >
      <div className={`w-8 h-8 flex items-center justify-center border ${
        !available
          ? 'bg-green-500/20 border-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
          : isNextTask
            ? 'bg-gold-500/20 border-gold-500/40'
            : 'bg-charcoal-900 border-white/20'
      }`} style={{ borderRadius: '4px' }}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
        ) : available ? (
          <Icon className={`w-4 h-4 ${isNextTask ? 'text-gold-400' : 'text-cream-muted'}`} />
        ) : (
          <Check className="w-4 h-4 text-green-400" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }} />
        )}
      </div>
      <div className="flex-1 text-left">
        <div className={`text-sm font-display font-bold uppercase tracking-wide ${
          !available
            ? 'text-green-400/70'
            : isNextTask
              ? 'text-gold-300'
              : 'text-cream-100'
        }`}>
          {title}
        </div>
        <div className={`text-xs font-mono ${
          !available
            ? 'text-green-500/50'
            : isNextTask
              ? 'text-gold-400/80'
              : 'text-cream-muted'
        }`}>
          {reward}
        </div>
      </div>
      {available && (
        <ChevronRight className={`w-5 h-5 ${isNextTask ? 'text-gold-400' : 'text-cream-muted'}`} />
      )}
    </button>
  );
};

// Sectional Button Component - Tactical grid buttons with neon effects
const SectionalButton = ({ icon: Icon, label, available, loading, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`flex flex-col items-center gap-1.5 p-3 transition-all border ${
        available
          ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-400 hover:shadow-[0_0_10px_rgba(59,130,246,0.3)] cursor-pointer'
          : 'bg-black/30 border-green-500/30 cursor-default'
      }`}
      style={{ borderRadius: '4px' }}
    >
      <div className={`w-8 h-8 flex items-center justify-center border ${
        available
          ? 'bg-blue-500/20 border-blue-500/40'
          : 'bg-green-500/20 border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
      }`} style={{ borderRadius: '4px' }}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        ) : available ? (
          <Icon className="w-4 h-4 text-blue-400" />
        ) : (
          <Check className="w-4 h-4 text-green-400" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }} />
        )}
      </div>
      <span className={`text-[10px] font-display font-bold uppercase ${available ? 'text-blue-300' : 'text-green-400/70'}`}>{label}</span>
    </button>
  );
};

// Task Checklist Row Component - Clean checklist style with neon checkbox
// Available: White text, clickable
// Completed: Dimmed (opacity-50), neon green checkbox with glow
const TaskChecklistRow = ({ title, reward, available, loading, onClick }) => {
  const isCompleted = !available;

  return (
    <button
      onClick={onClick}
      disabled={isCompleted || loading}
      className={`w-full h-12 flex items-center gap-3 px-3 rounded-lg transition-all ${
        isCompleted
          ? 'opacity-50 cursor-default'
          : 'hover:bg-white/5 cursor-pointer'
      }`}
    >
      {/* Neon Checkbox */}
      <div className={`w-5 h-5 flex items-center justify-center rounded border transition-all ${
        isCompleted
          ? 'bg-green-500/20 border-green-500/60 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
          : 'bg-transparent border-white/20'
      }`}>
        {loading ? (
          <div className="w-3 h-3 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
        ) : isCompleted ? (
          <Check className="w-3 h-3 text-green-400" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }} />
        ) : (
          <Square className="w-3 h-3 text-transparent" />
        )}
      </div>

      {/* Task Name (White) */}
      <span className={`flex-1 text-left text-sm font-mono ${
        isCompleted ? 'text-cream/50 line-through' : 'text-cream-100'
      }`}>
        {title}
      </span>

      {/* Reward (Gold, Monospace) */}
      <span className={`text-xs font-mono font-bold ${
        isCompleted ? 'text-gold-400/50' : 'text-gold-400'
      }`}>
        {reward}
      </span>
    </button>
  );
};

export default DailyOperations;
