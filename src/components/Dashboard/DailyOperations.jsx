// src/components/Dashboard/DailyOperations.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Users, Wrench, Heart, Music, Eye, Flag,
  Drum, Zap, ChevronRight, Play,
  Coffee, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
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
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [opsStatus, setOpsStatus] = useState(null);
  const [showInsights, setShowInsights] = useState(null);
  const [showMultiplierBreakdown, setShowMultiplierBreakdown] = useState(false);
  const [showRehearsalAnimation, setShowRehearsalAnimation] = useState(false);
  const [rehearsalResults, setRehearsalResults] = useState(null);

  // Calculate multiplier
  const multiplier = calculateMultiplier ? calculateMultiplier() : 1.0;

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

    // Get staff count for bonus calculation
    const staffCount = Array.isArray(executionState.staff) ? executionState.staff.length : 0;

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
        setShowInsights(result.data.insights);
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
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Execution Multiplier & Corps Health */}
      <div className="glass-premium rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-cream-100">Corps Performance</h3>
            <p className="text-xs text-cream-500/60">
              {completionStats.completed}/{completionStats.total} daily tasks complete
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${multiplierStatus.color}`}>
              {multiplier.toFixed(2)}x
            </div>
            <div className={`text-xs font-medium ${multiplierStatus.color}`}>
              {multiplierStatus.label}
            </div>
          </div>
        </div>

        {/* Multiplier Bar */}
        <div className="mb-4">
          <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((multiplier - 0.70) / 0.40) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full ${multiplierStatus.bg}`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-cream-500/40 mt-1">
            <span>0.70x</span>
            <span>1.00x</span>
            <span>1.10x</span>
          </div>
        </div>

        {/* Health Metrics Row */}
        <div className="grid grid-cols-3 gap-2">
          <MetricPill
            icon={Target}
            label="Ready"
            value={metrics.readiness}
          />
          <MetricPill
            icon={Heart}
            label="Morale"
            value={metrics.morale}
          />
          <MetricPill
            icon={Wrench}
            label="Equip"
            value={metrics.equipment}
          />
        </div>

        {/* Expand Breakdown */}
        <button
          onClick={() => setShowMultiplierBreakdown(!showMultiplierBreakdown)}
          className="w-full mt-3 pt-3 border-t border-cream-500/10 flex items-center justify-center gap-2 text-xs text-cream-500/60 hover:text-cream-400 transition-colors"
        >
          {showMultiplierBreakdown ? 'Hide Details' : 'Show Multiplier Breakdown'}
          {showMultiplierBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {showMultiplierBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2 text-xs">
                <div className="text-cream-500/60 mb-2">
                  Formula: (Readiness × 40%) + (Morale × 30%) + (Equipment × 30%) + Staff Bonus
                </div>
                <BreakdownRowDetailed
                  label="Readiness"
                  weight={40}
                  current={metrics.readiness}
                  contribution={breakdownData.readiness.value}
                  delta={breakdownData.readiness.delta}
                />
                <BreakdownRowDetailed
                  label="Morale"
                  weight={30}
                  current={metrics.morale}
                  contribution={breakdownData.morale.value}
                  delta={breakdownData.morale.delta}
                />
                <BreakdownRowDetailed
                  label="Equipment"
                  weight={30}
                  current={metrics.equipment}
                  contribution={breakdownData.equipment.value}
                  delta={breakdownData.equipment.delta}
                />
                <div className="flex justify-between items-center pt-2 border-t border-cream-500/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span className="text-cream-500/60">Staff Bonus ({breakdownData.staff.count} staff)</span>
                  </div>
                  <span className={breakdownData.staff.value > 0 ? 'text-blue-400' : 'text-cream-500/40'}>
                    +{(breakdownData.staff.value * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-cream-500/20 font-semibold">
                  <span className="text-cream-300">Total Multiplier</span>
                  <span className={multiplierStatus.color}>{multiplier.toFixed(2)}x</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Rehearsal */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gold-500/20">
              <Music className="w-5 h-5 text-gold-500" />
            </div>
            <div>
              <h4 className="font-semibold text-cream-100">Full Rehearsal</h4>
              <p className="text-xs text-cream-500/60">+5% readiness, +50 XP</p>
            </div>
          </div>
          {executionState?.rehearsalsThisWeek !== undefined && (
            <div className="text-right">
              <div className="text-sm font-medium text-cream-300">
                {executionState.rehearsalsThisWeek}/7
              </div>
              <div className="text-xs text-cream-500/60">this week</div>
            </div>
          )}
        </div>

        <button
          onClick={handleRehearsal}
          disabled={!canRehearseToday || rehearsalProcessing || showRehearsalAnimation}
          className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
            canRehearseToday
              ? 'bg-gold-500 text-charcoal-900 hover:bg-gold-400'
              : 'bg-charcoal-800 text-cream-500/60 cursor-not-allowed'
          }`}
        >
          {rehearsalProcessing || showRehearsalAnimation ? (
            <>
              <div className="w-5 h-5 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
              Rehearsing...
            </>
          ) : canRehearseToday ? (
            <>
              <Play className="w-5 h-5" />
              Run Full Rehearsal
            </>
          ) : (
            <>
              <Check className="w-5 h-5 text-green-500" />
              Rehearsal Complete
            </>
          )}
        </button>
      </div>

      {/* Daily Activities */}
      <div className="glass rounded-xl p-4">
        <h4 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-gold-500" />
          Daily Activities
        </h4>

        <div className="space-y-2">
          <ActivityRow
            icon={Coffee}
            title="Login Bonus"
            reward="+10 XP, +5 CC"
            available={opsStatus?.loginBonus?.available}
            loading={processing === 'login'}
            onClick={handleClaimLogin}
          />
          <ActivityRow
            icon={Users}
            title="Staff Check-in"
            reward="+15 XP"
            available={opsStatus?.staffCheckin?.available}
            loading={processing === 'staff'}
            onClick={handleStaffCheckin}
          />
          <ActivityRow
            icon={Heart}
            title="Member Wellness"
            reward="+15 XP, +3% morale"
            available={opsStatus?.memberWellness?.available}
            loading={processing === 'wellness'}
            onClick={handleWellnessCheck}
          />
          <ActivityRow
            icon={Wrench}
            title="Equipment Check"
            reward="+10 XP, +5 CC"
            available={opsStatus?.equipmentInspection?.available}
            loading={processing === 'equipment'}
            onClick={handleEquipmentInspection}
          />
          <ActivityRow
            icon={Eye}
            title="Show Review"
            reward="+20 XP"
            available={opsStatus?.showReview?.available}
            loading={processing === 'review'}
            onClick={handleShowReview}
          />
        </div>
      </div>

      {/* Sectional Rehearsals */}
      {opsStatus?.sectionalRehearsals && (
        <div className="glass rounded-xl p-4">
          <h4 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            Sectional Rehearsals
            <span className="text-xs font-normal text-cream-500/60">(+2% readiness each)</span>
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
              className="fixed inset-0 bg-charcoal-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowInsights(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="glass-premium rounded-xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-cream-100 mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  Show Review Insights
                </h3>
                <div className="space-y-3">
                  {showInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        insight.type === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                        insight.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                        'bg-blue-500/10 border border-blue-500/20'
                      }`}
                    >
                      <p className={`text-sm ${
                        insight.type === 'success' ? 'text-green-300' :
                        insight.type === 'warning' ? 'text-yellow-300' :
                        'text-blue-300'
                      }`}>
                        {insight.message}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowInsights(null)}
                  className="w-full mt-4 px-4 py-2 bg-charcoal-700 text-cream-100 rounded-lg hover:bg-charcoal-600 transition-colors"
                >
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

// Activity Row Component
const ActivityRow = ({ icon: Icon, title, reward, available, loading, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
        available
          ? 'bg-charcoal-800/50 hover:bg-charcoal-800 cursor-pointer'
          : 'bg-charcoal-900/30 cursor-default opacity-60'
      }`}
    >
      <div className={`p-2 rounded-lg ${available ? 'bg-gold-500/20' : 'bg-green-500/20'}`}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        ) : available ? (
          <Icon className="w-4 h-4 text-gold-500" />
        ) : (
          <Check className="w-4 h-4 text-green-500" />
        )}
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-medium text-cream-100">{title}</div>
        <div className="text-xs text-cream-500/60">{reward}</div>
      </div>
      {available && <ChevronRight className="w-4 h-4 text-cream-500/40" />}
    </button>
  );
};

// Sectional Button Component
const SectionalButton = ({ icon: Icon, label, available, loading, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${
        available
          ? 'bg-charcoal-800/50 hover:bg-charcoal-800 cursor-pointer'
          : 'bg-charcoal-900/30 cursor-default opacity-60'
      }`}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      ) : available ? (
        <Icon className="w-5 h-5 text-blue-400" />
      ) : (
        <Check className="w-5 h-5 text-green-500" />
      )}
      <span className="text-xs text-cream-400">{label}</span>
    </button>
  );
};

export default DailyOperations;
