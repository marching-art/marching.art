// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// SettingsTab - Commissioner settings for league management
// Includes matchup generation, league settings, and invite code management

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  UserMinus,
} from 'lucide-react';
import { getLeagueMatchups } from '../../../api/leagues';
import { useLeagueInviteCode, useRemoveLeagueMember } from '../../../hooks/useLeagues';
import { triggerMatchupGeneration } from '../../../api/functions';
import { GAME_CONFIG } from '../../../config';
import toast from 'react-hot-toast';
import { Heading } from '../../ui';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { getRosterSize, getActiveMemberCount, isMemberActive } from '../../../utils/leagueActivity';
import { isLeagueCommissioner } from '../../../utils/leaguePermissions';
import LeagueSettingsForm from './LeagueSettingsForm';
import CommissionerTransfer from './CommissionerTransfer';
import CoCommissionerManager from './CoCommissionerManager';
import ResultCorrection from './ResultCorrection';
import ScoringFormatCard from './ScoringFormatCard';

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

/**
 * Confirmation for a commissioner removing a member. Removal is not something
 * the removed director can undo, and it moves CorpsCoin, so it never fires
 * straight off a tap.
 */
const ConfirmRemoveMemberModal = ({ member, entryFee, onCancel, onConfirm, isRemoving }) => {
  useEscapeKey(onCancel);
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm member removal"
    >
      <div
        className="w-full sm:max-w-sm bg-surface-card border-t sm:border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
          <UserMinus className="w-4 h-4 text-red-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Remove Member
          </span>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-white">
            Remove <span className="font-bold">{member.name}</span> from this league?
          </p>
          <ul className="text-xs text-muted space-y-1 list-disc pl-4">
            <li>Their standings record is cleared and they leave future matchups.</li>
            {entryFee > 0 && (
              <li>
                Their {entryFee.toLocaleString()} CC entry fee is refunded from the prize pool.
              </li>
            )}
            <li>The removal is posted to the league activity feed.</li>
          </ul>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 min-h-touch text-sm font-bold text-muted border border-line-strong hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isRemoving}
              className="flex-1 py-3 min-h-touch text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsTab = ({
  league,
  userProfile: _userProfile,
  memberProfiles = {},
  currentWeek = 1,
  onBack,
  onSettingsSaved,
  isOwner = false,
}) => {
  const inviteCode = useLeagueInviteCode(league);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [generating, setGenerating] = useState(false);
  const [existingMatchups, setExistingMatchups] = useState({});
  const [_checkingMatchups, setCheckingMatchups] = useState(true);
  const [lastGeneratedResult, setLastGeneratedResult] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const removeMemberMutation = useRemoveLeagueMember(league?.id);

  // Stable identity: this feeds the roster useMemo below and is handed to
  // ResultCorrection, so a fresh closure each render would defeat both.
  const getMemberName = useCallback(
    (uid) => {
      const profile = memberProfiles[uid] || {};
      const displayName =
        profile.displayName && profile.displayName !== 'Director'
          ? profile.displayName
          : profile.username;
      return displayName || `Director ${String(uid).slice(0, 6)}`;
    },
    [memberProfiles]
  );

  // Which weeks already have matchups. ONE collection read — this was a
  // serial getDoc per week (up to totalWeeks round trips) on every open of the
  // settings tab. MatchupsTab already made this switch; this was missed.
  useEffect(() => {
    const checkExistingMatchups = async () => {
      if (!league?.id) return;
      setCheckingMatchups(true);

      try {
        const matchupsFound = {};
        const docs = await getLeagueMatchups(league.id);
        docs.forEach((doc) => {
          const weekMatch = doc.id.match(/^week-(\d+)$/);
          if (weekMatch) matchupsFound[parseInt(weekMatch[1], 10)] = doc;
        });
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

    // This prompt used to be a lie: it promised replacement and then called
    // `generateMatchups`, which throws `already-exists` unconditionally, so
    // confirming produced a red error toast every single time.
    // `triggerMatchupGeneration` is the callable that can actually overwrite.
    const isRegenerate = Boolean(existingMatchups[selectedWeek]);
    if (isRegenerate) {
      const confirm = window.confirm(
        `Week ${selectedWeek} already has matchups. Generating new matchups will replace them, ` +
          `and any results already folded into the standings will NOT be undone. Continue?`
      );
      if (!confirm) return;
    }

    setGenerating(true);
    setLastGeneratedResult(null);

    try {
      const result = await triggerMatchupGeneration({
        leagueId: league.id,
        week: selectedWeek,
        forceRegenerate: isRegenerate,
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

  const handleRemoveMember = async (member) => {
    setRemovingId(member.uid);
    try {
      const result = await removeMemberMutation.mutateAsync(member.uid);
      toast.success(result?.message || `${member.name} was removed.`);
      setPendingRemoval(null);
    } catch (error) {
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const weekHasMatchups = existingMatchups[selectedWeek];

  // Whether the league's scoring format is still changeable, read exactly the
  // way the server reads it (callable/leagueFormat.js seasonUnderway): a week
  // left behind by a previous season is not this season's business, and an
  // unstamped week predates stamping, which rollover would have cleared.
  const seasonUnderway = useMemo(
    () =>
      Object.values(existingMatchups).some(
        (doc) => !doc?.seasonUid || doc.seasonUid === league?.seasonId
      ),
    [existingMatchups, league?.seasonId]
  );
  const memberCount = getRosterSize(league);
  const activeCount = getActiveMemberCount(league);
  const canGenerate = memberCount >= 2;

  // Roster rows for the management list — active directors first, so the
  // members a commissioner is most likely to prune surface at the bottom
  // together rather than scattered through the list.
  const roster = useMemo(() => {
    const rows = (league?.members || []).map((uid) => {
      const profile = memberProfiles[uid] || {};
      const activeCorps = Object.values(profile.corps || {}).find((c) => c?.corpsName);
      return {
        uid,
        name: getMemberName(uid),
        corpsName: activeCorps?.corpsName || null,
        isActive: isMemberActive(league, uid),
        isOwner: uid === league?.creatorId,
        isCommissioner: isLeagueCommissioner(league, uid),
      };
    });
    return rows.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (a.isCommissioner !== b.isCommissioner) return a.isCommissioner ? -1 : 1;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [league, memberProfiles, getMemberName]);

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

      {/* A resolved matchup used to be final and unappealable, with no way to
          fix a week that resolved against missing data. */}
      <ResultCorrection
        league={league}
        weekData={existingMatchups[selectedWeek]}
        week={selectedWeek}
        corpsClasses={Object.keys(CORPS_CLASS_CONFIG)}
        getDisplayName={getMemberName}
        onCorrected={onSettingsSaved}
      />

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

      {/* Editable league settings — a league used to be immutable from the
          moment it was created (no updateLeague* callable existed at all). */}
      <LeagueSettingsForm league={league} memberCount={memberCount} onSaved={onSettingsSaved} />

      {/* Alternate scoring format — a purchase, and locked once the season
          starts, so it is its own card rather than a field on the form. */}
      <ScoringFormatCard
        league={league}
        seasonUnderway={seasonUnderway}
        onChanged={onSettingsSaved}
      />

      {/* Read-only league facts */}
      <div className="bg-surface-card border border-line">
        <div className="divide-y divide-line-subtle">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Prize Pool</span>
            <span className="text-sm font-bold text-brand">
              {/* Escrowed entry fees only — no phantom seeded pool */}
              {(league.settings?.prizePool || 0).toLocaleString()} CC
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Members</span>
            <span className="text-sm font-bold text-white">
              {memberCount} / {league.maxMembers || 20}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Competing this season</span>
            <span
              className={`text-sm font-bold ${activeCount > 0 ? 'text-green-500' : 'text-muted'}`}
            >
              {activeCount === null ? 'Unknown' : `${activeCount} / ${memberCount}`}
            </span>
          </div>
        </div>
      </div>

      {/* Roster Management — the commissioner's control over who stays.
          A roster is otherwise append-only, so a league slowly fills with
          directors who stopped playing; they pad the member count and, before
          the season-activity gate, were still drawn into weekly matchups. */}
      <div className="bg-surface-card border border-line">
        <div className="px-4 py-3 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Manage Roster
            </span>
          </div>
        </div>

        <div className="px-4 py-2 bg-surface-sunken border-b border-line-subtle">
          <p className="text-[10px] text-muted">
            Removing a director refunds their entry fee from the prize pool and posts a note to the
            league activity feed. They can rejoin if the league is public.
          </p>
        </div>

        <div className="divide-y divide-line-subtle">
          {roster.map((member) => (
            <div key={member.uid} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white truncate">{member.name}</span>
                  {member.isOwner ? (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand bg-surface-raised flex-shrink-0">
                      Commissioner
                    </span>
                  ) : member.isCommissioner ? (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase text-secondary bg-surface-raised flex-shrink-0">
                      Co-Commish
                    </span>
                  ) : null}
                </div>
                <span
                  className={`text-[10px] ${member.isActive ? 'text-green-500' : 'text-muted'}`}
                >
                  {member.isActive
                    ? `Competing${member.corpsName ? ` — ${member.corpsName}` : ''}`
                    : 'No corps registered this season'}
                </span>
              </div>

              {member.isOwner ? (
                // The owner cannot remove themselves — the league would be left
                // with nobody able to run it. Leaving is the exit.
                <span className="text-[10px] text-muted flex-shrink-0">—</span>
              ) : (
                <button
                  onClick={() => setPendingRemoval(member)}
                  disabled={removingId === member.uid}
                  className="px-3 py-2 min-h-touch text-[10px] font-bold uppercase text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  {removingId === member.uid ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserMinus className="w-3 h-3" />
                  )}
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Handing the league over. Without this the only exits were "run it
          forever" or "leave", and leaving used to orphan the league entirely:
          every commissioner gate is creatorId === uid, so the league lost the
          ability to run itself with no way to recover. */}
      {isOwner && (
        <>
          <CoCommissionerManager league={league} roster={roster} onChanged={onSettingsSaved} />
          <CommissionerTransfer league={league} roster={roster} onTransferred={onSettingsSaved} />
        </>
      )}

      {/* Removal is irreversible from the commissioner's side and moves
          CorpsCoin, so it always goes through an explicit confirmation. */}
      {pendingRemoval && (
        <ConfirmRemoveMemberModal
          member={pendingRemoval}
          entryFee={league.settings?.entryFee || 0}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => handleRemoveMember(pendingRemoval)}
          isRemoving={removingId === pendingRemoval.uid}
        />
      )}
    </m.div>
  );
};

export default SettingsTab;
