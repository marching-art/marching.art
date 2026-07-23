// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// SettingsTab - Commissioner settings for league management
// Includes matchup generation, league settings, and invite code management

import React, { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import {
  Settings,
  Copy,
  Check,
  Swords,
  Calendar,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trophy,
  Award,
  Star,
} from 'lucide-react';
import { getLeagueMatchupWeek } from '../../../api/leagues';
import { useLeagueInviteCode } from '../../../hooks/useLeagues';
import { generateMatchups } from '../../../api/functions';
import { GAME_CONFIG } from '../../../config';
import toast from 'react-hot-toast';
import { Heading } from '../../ui';

// Corps class icons for visual display
const CORPS_CLASS_CONFIG = {
  worldClass: {
    name: 'World Class',
    icon: Trophy,
    color: 'text-secondary',
    bg: 'bg-surface-raised',
  },
  openClass: { name: 'Open Class', icon: Award, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  aClass: { name: 'A Class', icon: Star, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  soundSport: { name: 'SoundSport', icon: Zap, color: 'text-green-500', bg: 'bg-green-500/10' },
};

const SettingsTab = ({ league, userProfile: _userProfile, currentWeek = 1, onBack }) => {
  const inviteCode = useLeagueInviteCode(league);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [generating, setGenerating] = useState(false);
  const [existingMatchups, setExistingMatchups] = useState({});
  const [_checkingMatchups, setCheckingMatchups] = useState(true);
  const [lastGeneratedResult, setLastGeneratedResult] = useState(null);

  // Check which weeks have matchups already
  useEffect(() => {
    const checkExistingMatchups = async () => {
      if (!league?.id) return;
      setCheckingMatchups(true);

      try {
        const matchupsFound = {};
        for (let w = 1; w <= GAME_CONFIG.season.totalWeeks; w++) {
          const data = await getLeagueMatchupWeek(league.id, w);
          if (data) {
            matchupsFound[w] = data;
          }
        }
        setExistingMatchups(matchupsFound);
      } catch (error) {
        console.error('Error checking matchups:', error);
      } finally {
        setCheckingMatchups(false);
      }
    };

    checkExistingMatchups();
  }, [league?.id]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.success(`Code: ${inviteCode}`);
    }
  };

  const handleGenerateMatchups = async () => {
    if (generating) return;

    // Check if matchups already exist
    if (existingMatchups[selectedWeek]) {
      const confirm = window.confirm(
        `Week ${selectedWeek} already has matchups. Generating new matchups will replace them. Continue?`
      );
      if (!confirm) return;
    }

    setGenerating(true);
    setLastGeneratedResult(null);

    try {
      const result = await generateMatchups({
        leagueId: league.id,
        week: selectedWeek,
      });

      if (result.data?.success) {
        setExistingMatchups((prev) => ({
          ...prev,
          [selectedWeek]: result.data.matchups,
        }));
        setLastGeneratedResult({
          success: true,
          week: selectedWeek,
          matchups: result.data.matchups,
        });
        toast.success(`Week ${selectedWeek} matchups generated!`);
      } else {
        throw new Error(result.data?.message || 'Failed to generate matchups');
      }
    } catch (error) {
      console.error('Error generating matchups:', error);
      setLastGeneratedResult({
        success: false,
        error: error.message || 'Failed to generate matchups',
      });
      toast.error(error.message || 'Failed to generate matchups');
    } finally {
      setGenerating(false);
    }
  };

  const weekHasMatchups = existingMatchups[selectedWeek];
  const memberCount = league?.members?.length || 0;
  const canGenerate = memberCount >= 2;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-4"
    >
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 bg-surface-raised hover:bg-line transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-secondary" />
          <Heading level="title">Commissioner Settings</Heading>
        </div>
      </div>

      {/* Matchup Generation Section */}
      <div className="bg-surface-card border border-line">
        <div className="px-4 py-3 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Generate Matchups
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Week Selection */}
          <div>
            <p className="text-xs text-muted mb-2">Select week to generate matchups for:</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                disabled={selectedWeek <= 1}
                className="p-2 bg-surface-raised hover:bg-line disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted" />
              </button>

              <div className="flex-1 flex gap-1 overflow-x-auto py-1">
                {Array.from(
                  { length: Math.min(GAME_CONFIG.season.totalWeeks, 12) },
                  (_, i) => i + 1
                ).map((week) => {
                  const hasMatchups = existingMatchups[week];
                  const isSelected = selectedWeek === week;
                  const isCurrent = week === currentWeek;

                  return (
                    <button
                      key={week}
                      onClick={() => setSelectedWeek(week)}
                      className={`relative flex-shrink-0 w-10 h-10 flex items-center justify-center text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-interactive text-white'
                          : hasMatchups
                            ? 'bg-green-500/20 border border-green-500/30 text-green-500'
                            : isCurrent
                              ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                              : 'bg-surface-raised border border-line text-muted hover:border-line-strong'
                      }`}
                    >
                      {week}
                      {hasMatchups && !isSelected && (
                        <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setSelectedWeek(Math.min(GAME_CONFIG.season.totalWeeks, selectedWeek + 1))
                }
                disabled={selectedWeek >= GAME_CONFIG.season.totalWeeks}
                className="p-2 bg-surface-raised hover:bg-line disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            </div>
          </div>

          {/* Week Status */}
          <div
            className={`p-3 border ${
              weekHasMatchups
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-surface-raised border-line'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted" />
                <span className="text-sm font-bold text-white">Week {selectedWeek}</span>
                {selectedWeek === currentWeek && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[9px] font-bold uppercase">
                    Current
                  </span>
                )}
              </div>
              {weekHasMatchups ? (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Matchups exist
                </span>
              ) : (
                <span className="text-xs text-muted">No matchups</span>
              )}
            </div>

            {/* Show existing matchup counts */}
            {weekHasMatchups && (
              <div className="mt-2 pt-2 border-t border-line flex flex-wrap gap-2">
                {Object.entries(CORPS_CLASS_CONFIG).map(([key, config]) => {
                  const count = existingMatchups[selectedWeek]?.[`${key}Matchups`]?.length || 0;
                  if (count === 0) return null;
                  const Icon = config.icon;
                  return (
                    <div key={key} className={`flex items-center gap-1 px-2 py-1 ${config.bg}`}>
                      <Icon className={`w-3 h-3 ${config.color}`} />
                      <span className={`text-xs font-bold ${config.color}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Member Count Warning */}
          {!canGenerate && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30">
              <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-xs text-warning">
                Need at least 2 members to generate matchups. Currently: {memberCount}
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerateMatchups}
            disabled={generating || !canGenerate}
            className={`w-full py-3 flex items-center justify-center gap-2 font-bold text-sm transition-colors ${
              generating || !canGenerate
                ? 'bg-line text-muted cursor-not-allowed'
                : weekHasMatchups
                  ? 'bg-orange-500 hover:bg-orange-400 text-black'
                  : 'bg-green-500 hover:bg-green-400 text-black'
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Swords className="w-4 h-4" />
                {weekHasMatchups ? 'Regenerate Matchups' : 'Generate Matchups'}
              </>
            )}
          </button>

          {/* Last Result */}
          {lastGeneratedResult && (
            <div
              className={`p-3 border ${
                lastGeneratedResult.success
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              {lastGeneratedResult.success ? (
                <div>
                  <p className="text-sm text-green-500 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Week {lastGeneratedResult.week} matchups generated!
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Members have been paired based on their active corps classes.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {lastGeneratedResult.error}
                </p>
              )}
            </div>
          )}

          {/* Help Text */}
          <p className="text-[11px] text-muted">
            Matchups are generated separately for each corps class (World, Open, A, SoundSport).
            Members are randomly paired within their class. Odd numbers result in bye weeks.
          </p>
        </div>
      </div>

      {/* Invite Code Section */}
      <div className="bg-surface-card border border-line">
        <div className="px-4 py-3 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Invite Code
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-surface-raised border border-line">
              <code className="text-xl font-mono font-bold text-interactive tracking-wider">
                {inviteCode || '——'}
              </code>
            </div>
            <button
              onClick={handleCopyInvite}
              className="px-4 py-3 bg-surface-raised border border-line hover:border-line-strong transition-colors flex items-center gap-2"
            >
              {inviteCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted" />
              )}
              <span className="text-sm text-muted">{inviteCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Share this code with others to invite them to your league.
          </p>
        </div>
      </div>

      {/* League Settings Display */}
      <div className="bg-surface-card border border-line">
        <div className="px-4 py-3 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              League Settings
            </span>
          </div>
        </div>

        <div className="divide-y divide-line-subtle">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Prize Pool</span>
            <span className="text-sm font-bold text-brand">
              {/* Escrowed entry fees only — no phantom seeded pool */}
              {(league.settings?.prizePool || 0).toLocaleString()} CC
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Finals Spots</span>
            <span className="text-sm font-bold text-white">
              {league.settings?.finalsSize || 12}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Members</span>
            <span className="text-sm font-bold text-white">
              {memberCount} / {league.maxMembers || 20}
            </span>
          </div>
        </div>
      </div>
    </m.div>
  );
};

export default SettingsTab;
