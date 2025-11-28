// src/components/Dashboard/DailyOperations.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Users, Wrench, Heart, Music, Eye, Flag,
  Drum, CheckCircle, Circle, Zap, ChevronRight,
  Coffee, Clock, Sparkles, TrendingUp, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
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
 * Daily Operations Component
 * Shows all daily activities a director can perform
 */
const DailyOperations = ({
  corpsClass,
  profile,
  onActivityComplete
}) => {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [opsStatus, setOpsStatus] = useState(null);
  const [showInsights, setShowInsights] = useState(null);

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

  // Handle claiming daily login
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

  // Handle staff check-in
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

  // Handle member wellness
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

  // Handle equipment inspection
  const handleEquipmentInspection = async () => {
    setProcessing('equipment');
    try {
      const result = await equipmentInspection({ corpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        if (result.data.event) {
          // Show event notification
          const eventType = result.data.event.type;
          const color = eventType === 'positive' ? 'text-green-400' : eventType === 'negative' ? 'text-red-400' : 'text-yellow-400';
          toast(result.data.event.message, {
            icon: eventType === 'positive' ? '✨' : eventType === 'negative' ? '⚠️' : 'ℹ️',
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

  // Handle sectional rehearsal
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

  // Handle show review
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

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    if (!opsStatus) return 0;
    let completed = 0;
    let total = 5; // Base activities

    if (!opsStatus.loginBonus?.available) completed++;
    if (!opsStatus.staffCheckin?.available) completed++;
    if (!opsStatus.memberWellness?.available) completed++;
    if (!opsStatus.equipmentInspection?.available) completed++;
    if (!opsStatus.showReview?.available) completed++;

    // Add sectionals
    if (opsStatus.sectionalRehearsals) {
      total += 4;
      if (!opsStatus.sectionalRehearsals.music?.available) completed++;
      if (!opsStatus.sectionalRehearsals.visual?.available) completed++;
      if (!opsStatus.sectionalRehearsals.guard?.available) completed++;
      if (!opsStatus.sectionalRehearsals.percussion?.available) completed++;
    }

    return Math.round((completed / total) * 100);
  };

  const completionPct = getCompletionPercentage();

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
      {/* Header with Progress */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-gold-500" />
            <h3 className="font-semibold text-cream-100">Daily Operations</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-cream-400">
              {completionPct}% Complete
            </div>
            {completionPct === 100 && (
              <Sparkles className="w-4 h-4 text-gold-500" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-gold-500 to-yellow-500"
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {completionPct === 100 && (
          <p className="text-xs text-gold-400 mt-2 text-center">
            All daily activities complete! Come back tomorrow.
          </p>
        )}
      </div>

      {/* Core Activities */}
      <div className="glass rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-2">
          Core Activities
        </h4>

        {/* Daily Login Bonus */}
        <ActivityButton
          icon={Coffee}
          title="Daily Login Bonus"
          description="+10 XP, +5 CC (streak bonus!)"
          available={opsStatus?.loginBonus?.available}
          loading={processing === 'login'}
          onClick={handleClaimLogin}
          color="gold"
        />

        {/* Staff Check-in */}
        <ActivityButton
          icon={Users}
          title="Staff Check-in"
          description="+15 XP, +2% staff morale"
          available={opsStatus?.staffCheckin?.available}
          loading={processing === 'staff'}
          onClick={handleStaffCheckin}
          color="purple"
        />

        {/* Member Wellness */}
        <ActivityButton
          icon={Heart}
          title="Member Wellness Check"
          description="+15 XP, +3% corps morale"
          available={opsStatus?.memberWellness?.available}
          loading={processing === 'wellness'}
          onClick={handleWellnessCheck}
          color="pink"
        />

        {/* Equipment Inspection */}
        <ActivityButton
          icon={Wrench}
          title="Equipment Inspection"
          description="+10 XP, +5 CC (random events!)"
          available={opsStatus?.equipmentInspection?.available}
          loading={processing === 'equipment'}
          onClick={handleEquipmentInspection}
          color="orange"
        />

        {/* Show Review */}
        <ActivityButton
          icon={Eye}
          title="Show Review"
          description="+20 XP, get performance insights"
          available={opsStatus?.showReview?.available}
          loading={processing === 'review'}
          onClick={handleShowReview}
          color="blue"
        />
      </div>

      {/* Show Insights Modal */}
      <AnimatePresence>
        {showInsights && (
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
                    <div className="flex items-start gap-2">
                      {insight.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />}
                      {insight.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />}
                      {insight.type === 'tip' && <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />}
                      <p className={`text-sm ${
                        insight.type === 'success' ? 'text-green-300' :
                        insight.type === 'warning' ? 'text-yellow-300' :
                        'text-blue-300'
                      }`}>
                        {insight.message}
                      </p>
                    </div>
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
        )}
      </AnimatePresence>

      {/* Sectional Rehearsals */}
      {opsStatus?.sectionalRehearsals && (
        <div className="glass rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-cream-400 uppercase tracking-wider mb-2">
            Sectional Rehearsals
          </h4>
          <p className="text-xs text-cream-500/60 mb-3">
            Focus on specific sections for targeted improvement (+2% readiness each)
          </p>

          <div className="grid grid-cols-2 gap-2">
            <SectionalButton
              icon={Music}
              title="Music"
              available={opsStatus.sectionalRehearsals.music?.available}
              loading={processing === 'sectional_music'}
              onClick={() => handleSectionalRehearsal('music')}
            />
            <SectionalButton
              icon={Eye}
              title="Visual/Drill"
              available={opsStatus.sectionalRehearsals.visual?.available}
              loading={processing === 'sectional_visual'}
              onClick={() => handleSectionalRehearsal('visual')}
            />
            <SectionalButton
              icon={Flag}
              title="Color Guard"
              available={opsStatus.sectionalRehearsals.guard?.available}
              loading={processing === 'sectional_guard'}
              onClick={() => handleSectionalRehearsal('guard')}
            />
            <SectionalButton
              icon={Drum}
              title="Percussion"
              available={opsStatus.sectionalRehearsals.percussion?.available}
              loading={processing === 'sectional_percussion'}
              onClick={() => handleSectionalRehearsal('percussion')}
            />
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-300">
            Daily activities reset each day. Complete them all for maximum XP and corps improvement!
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Activity Button Component
 */
const ActivityButton = ({ icon: Icon, title, description, available, loading, onClick, color }) => {
  const colorClasses = {
    gold: 'bg-gold-500/20 text-gold-400',
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400',
    orange: 'bg-orange-500/20 text-orange-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400'
  };

  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 text-left ${
        available
          ? 'bg-charcoal-800/50 border-cream-500/10 hover:border-cream-500/30 cursor-pointer'
          : 'bg-charcoal-900/30 border-cream-500/5 cursor-default opacity-60'
      }`}
    >
      <div className={`p-2 rounded-lg ${colorClasses[color] || 'bg-cream-500/20 text-cream-400'}`}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-cream-100 text-sm">{title}</span>
          {!available && <CheckCircle className="w-3 h-3 text-green-400" />}
        </div>
        <p className="text-xs text-cream-500/60 truncate">{description}</p>
      </div>
      {available && <ChevronRight className="w-4 h-4 text-cream-500/40" />}
    </button>
  );
};

/**
 * Sectional Button Component
 */
const SectionalButton = ({ icon: Icon, title, available, loading, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
        available
          ? 'bg-charcoal-800/50 border-cream-500/10 hover:border-blue-500/30 cursor-pointer'
          : 'bg-charcoal-900/30 border-cream-500/5 cursor-default opacity-60'
      }`}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      ) : available ? (
        <Icon className="w-5 h-5 text-blue-400" />
      ) : (
        <CheckCircle className="w-5 h-5 text-green-400" />
      )}
      <span className={`text-xs font-medium ${available ? 'text-cream-300' : 'text-cream-500/60'}`}>
        {title}
      </span>
    </button>
  );
};

export default DailyOperations;
