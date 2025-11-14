// src/pages/Admin.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Play, RefreshCw, Database, TrendingUp,
  AlertCircle, CheckCircle, Settings as SettingsIcon,
  Calendar, Trophy, Users, Zap
} from 'lucide-react';
import { useAuth } from '../App';
import { functions, adminHelpers } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const Admin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const adminStatus = await adminHelpers.isAdmin();
        setIsAdmin(adminStatus);
      }
      setLoading(false);
    };

    checkAdminStatus();
  }, [user]);

  const handleStartOffSeason = async () => {
    if (!confirm('Are you sure you want to start a new off-season? This will reset all current progress.')) {
      return;
    }

    setProcessing('off-season');
    try {
      const startNewOffSeason = httpsCallable(functions, 'startNewOffSeason');
      const result = await startNewOffSeason();
      toast.success(result.data.message);
    } catch (error) {
      console.error('Error starting off-season:', error);
      toast.error(error.message || 'Failed to start off-season');
    } finally {
      setProcessing(null);
    }
  };

  const handleStartLiveSeason = async () => {
    if (!confirm('Are you sure you want to start a new live season? This will transition from off-season.')) {
      return;
    }

    setProcessing('live-season');
    try {
      const startNewLiveSeason = httpsCallable(functions, 'startNewLiveSeason');
      const result = await startNewLiveSeason();
      toast.success(result.data.message);
    } catch (error) {
      console.error('Error starting live season:', error);
      toast.error(error.message || 'Failed to start live season');
    } finally {
      setProcessing(null);
    }
  };

  const handleManualTrigger = async (jobName, displayName) => {
    if (!confirm(`Are you sure you want to run "${displayName}"?`)) {
      return;
    }

    setProcessing(jobName);
    try {
      const manualTrigger = httpsCallable(functions, 'manualTrigger');
      const result = await manualTrigger({ jobName });
      toast.success(result.data.message);
    } catch (error) {
      console.error(`Error running ${jobName}:`, error);
      toast.error(error.message || `Failed to run ${displayName}`);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
          Access Denied
        </h2>
        <p className="text-cream-500/60">
          You must be an administrator to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-cream-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-gold rounded-xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-charcoal-900" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-gradient mb-2">
                Admin Panel
              </h1>
              <p className="text-cream-300">
                System administration and game management
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Season Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-gold-500" />
          <h2 className="text-2xl font-display font-bold text-cream-100">
            Season Management
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleStartOffSeason}
            disabled={processing !== null}
            className="card-hover p-6 text-left relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <Trophy className="w-8 h-8 text-blue-500" />
                {processing === 'off-season' && (
                  <RefreshCw className="w-5 h-5 text-gold-500 animate-spin" />
                )}
              </div>
              <h3 className="text-xl font-bold text-cream-100 mb-2">
                Start Off-Season
              </h3>
              <p className="text-sm text-cream-500/60">
                Initialize a new off-season period. Creates new season structure and resets player progress.
              </p>
            </div>
          </button>

          <button
            onClick={handleStartLiveSeason}
            disabled={processing !== null}
            className="card-hover p-6 text-left relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <Zap className="w-8 h-8 text-red-500" />
                {processing === 'live-season' && (
                  <RefreshCw className="w-5 h-5 text-gold-500 animate-spin" />
                )}
              </div>
              <h3 className="text-xl font-bold text-cream-100 mb-2">
                Start Live Season
              </h3>
              <p className="text-sm text-cream-500/60">
                Transition to live season mode. Activates real-time scoring and weekly competitions.
              </p>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Manual Triggers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-6">
          <Play className="w-6 h-6 text-gold-500" />
          <h2 className="text-2xl font-display font-bold text-cream-100">
            Manual Triggers
          </h2>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleManualTrigger('calculateCorpsStatistics', 'Calculate Corps Statistics')}
            disabled={processing !== null}
            className="w-full card-hover p-4 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div className="text-left">
                <p className="font-semibold text-cream-100">Calculate Corps Statistics</p>
                <p className="text-sm text-cream-500/60">Recalculate all corps stats and rankings</p>
              </div>
            </div>
            {processing === 'calculateCorpsStatistics' && (
              <RefreshCw className="w-5 h-5 text-gold-500 animate-spin" />
            )}
          </button>

          <button
            onClick={() => handleManualTrigger('archiveSeasonResults', 'Archive Season Results')}
            disabled={processing !== null}
            className="w-full card-hover p-4 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-purple-500" />
              <div className="text-left">
                <p className="font-semibold text-cream-100">Archive Season Results</p>
                <p className="text-sm text-cream-500/60">Archive current season data and league champions</p>
              </div>
            </div>
            {processing === 'archiveSeasonResults' && (
              <RefreshCw className="w-5 h-5 text-gold-500 animate-spin" />
            )}
          </button>

          <button
            onClick={() => handleManualTrigger('processAndArchiveOffSeasonScores', 'Process Off-Season Scores')}
            disabled={processing !== null}
            className="w-full card-hover p-4 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <p className="font-semibold text-cream-100">Process Off-Season Scores</p>
                <p className="text-sm text-cream-500/60">Calculate and archive off-season scores</p>
              </div>
            </div>
            {processing === 'processAndArchiveOffSeasonScores' && (
              <RefreshCw className="w-5 h-5 text-gold-500 animate-spin" />
            )}
          </button>
        </div>
      </motion.div>

      {/* Status Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card bg-charcoal-900/30"
      >
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <p className="font-semibold text-cream-100 mb-1">Admin Access Confirmed</p>
            <p className="text-sm text-cream-500/60">
              You have administrative privileges. Use these controls carefully as they affect all users.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Admin;
