/**
 * GuestDashboard - Read-Only Dashboard for Guest Preview Mode
 *
 * Lets unauthenticated visitors experience the ACTUAL dashboard before
 * registering. It reuses the real dashboard section components (ControlBar,
 * SeasonScorecard, RecentResultsFeed, RivalsPanel,
 * AchievementTrackerPanel) fed with demo data, so the preview mirrors what a
 * signed-in director sees. Every edit/management action is gated with a
 * registration prompt, and the one interactive affordance — drafting a
 * SoundSport lineup — carries over to the user's account on signup.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
  Users,
  Zap,
  LogIn,
  UserPlus,
  ArrowLeft,
  Info,
  Target,
  Lock,
  Check,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useGuestPreview } from '../hooks/useGuestPreview';
import { RegistrationGate, GuestLineupPicker } from '../components/GuestPreview';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useSEO } from '../hooks/useSEO';
import { getSeasonData, getCorpsValues } from '../api/season';
import { getChallengesForGameDay } from '../utils/dailyChallenges';
import { CORPS_CLASS_ORDER, CORPS_CLASS_LABELS, isCorpsClassUnlocked } from '../utils/corps';
import {
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
  CLASS_POINT_CAPS,
} from '../components/Dashboard/sections/constants';

// Real dashboard section components — reused directly so the preview is the
// genuine article, not a facsimile. Imported by file path (not the barrel) to
// keep the guest bundle lean.
import ControlBar from '../components/Dashboard/sections/ControlBar';
import SeasonScorecard from '../components/Dashboard/sections/SeasonScorecard';
import RecentResultsFeed from '../components/Dashboard/sections/RecentResultsFeed';
import RivalsPanel from '../components/Dashboard/sections/RivalsPanel';
import AchievementTrackerPanel from '../components/Dashboard/sections/AchievementTrackerPanel';
import { CAPTIONS as CAPTION_DEFS } from '../data/captions';

const STARTER_BUDGET = 90; // Same 90-pt SoundSport budget onboarding drafts under

// =============================================================================
// CAPTION DISPLAY DATA
// =============================================================================

// Guest view of the canonical captions (data/captions.ts). The compact draft
// badges show the caption id, so `name` maps to id here (not the friendly
// label the full dashboard uses).
const CAPTIONS = CAPTION_DEFS.map((c) => ({
  id: c.id,
  name: c.id,
  category: c.group,
  fullName: c.fullName,
}));

// =============================================================================
// GUEST HEADER COMPONENT
// =============================================================================

const GuestHeader = () => {
  return (
    <header className="flex-shrink-0 h-14 bg-surface-card border-b border-line">
      <div className="max-w-[1920px] mx-auto h-full flex items-center px-4 lg:px-6">
        {/* Back to Landing */}
        <Link
          to="/"
          className="flex items-center gap-2 text-muted hover:text-white transition-colors mr-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none overflow-hidden">
            <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
          </div>
          <span className="text-base font-bold text-white tracking-wider">marching.art</span>
        </div>

        {/* Preview Badge */}
        <div className="ml-3 px-2.5 py-1 bg-surface-raised border border-line rounded-none">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider">
            Preview Mode
          </span>
        </div>

        {/* Auth Links */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 h-9 text-sm text-muted hover:text-white transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign In</span>
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-1.5 px-4 h-9 bg-interactive text-white text-sm font-bold rounded-none hover:bg-interactive-hover transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Sign Up Free</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

// =============================================================================
// LINEUP ROW COMPONENT (draftable)
// =============================================================================

const LineupRow = ({ caption, value, pointsCost, isLast, isPlayable, onClick }) => {
  const hasValue = !!value;
  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
  const captionLabel = `${caption.name} — ${caption.fullName}`;

  return (
    <button
      onClick={onClick}
      aria-label={
        hasValue
          ? `${captionLabel}: ${corpsName}${sourceYear ? ` ${sourceYear}` : ''}. Tap to change.`
          : `${captionLabel}: empty slot. Tap to draft.`
      }
      className={`w-full flex items-center gap-3 px-3 py-3.5 transition-all cursor-pointer group ${
        !isLast ? 'border-b border-line/50' : ''
      } bg-surface-card hover:bg-surface-raised active:bg-surface-raised`}
    >
      {/* Position Badge */}
      <div
        title={captionLabel}
        aria-hidden="true"
        className={`w-10 h-8 flex items-center justify-center rounded-none text-xs font-bold flex-shrink-0 ${
          hasValue ? 'bg-interactive/20 text-interactive' : 'bg-line text-muted'
        }`}
      >
        {caption.name}
      </div>

      {/* Corps Name + Year, with caption full name as subtitle */}
      <div className="flex-1 text-left min-w-0">
        {hasValue ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white truncate">{corpsName}</span>
            {sourceYear && (
              <span className="text-[10px] text-muted">'{String(sourceYear).slice(-2)}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted italic">Empty slot</span>
        )}
        <div className="text-[10px] text-muted truncate mt-0.5">{caption.fullName}</div>
      </div>

      {/* Right side: pick cost (draft mode) or draft CTA. SoundSport is a
          ratings-only format, so a locked-in active lineup shows no per-caption
          numeric score — matching the real dashboard's SoundSport lineup. */}
      <div className="flex items-center gap-2">
        {hasValue ? (
          pointsCost != null ? (
            <span className="text-xs font-bold font-data text-secondary tabular-nums">
              Cost {pointsCost}
            </span>
          ) : null
        ) : (
          <span className="text-xs font-bold text-interactive group-hover:text-interactive-hover">
            + Draft
          </span>
        )}
        {!isPlayable && <Lock className="w-3.5 h-3.5 text-muted group-hover:text-muted" />}
      </div>
    </button>
  );
};

// =============================================================================
// DEMO DAILY CHALLENGES (read-only mirror of the real engagement panel)
// =============================================================================
// The real DailyChallenges panel writes completion to the profile via a
// callable; a guest has no profile, so this read-only version shows the same
// catalog with one pre-completed and routes taps to the registration gate.

const DEMO_CHALLENGE_DAY = 5;

const DemoDailyChallenges = ({ onGate }) => {
  const challenges = getChallengesForGameDay(DEMO_CHALLENGE_DAY) || [];
  const completedIds = new Set(challenges.slice(0, 1).map((c) => c.id));
  const totalCount = challenges.length || 1;
  const completedCount = completedIds.size;

  return (
    <div className="bg-surface-card border border-line overflow-hidden">
      <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-orange-500" />
          Daily Challenges
        </h3>
        <span className="text-[10px] font-bold text-muted font-data tabular-nums">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface-raised">
        <div
          className="h-full bg-orange-500 transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-line-subtle">
        {challenges.map((challenge) => {
          const isDone = completedIds.has(challenge.id);
          return (
            <button
              key={challenge.id}
              onClick={() => onGate('challenge')}
              className="w-full px-4 py-3 hover:bg-surface-raised transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isDone ? 'bg-green-500' : 'border border-line-strong'
                  }`}
                >
                  {isDone && <Check className="w-3 h-3 text-white" />}
                </div>
                <span
                  className={`text-sm flex-1 ${isDone ? 'text-muted line-through' : 'text-white'}`}
                >
                  {challenge.label}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-purple-400 font-data">
                    +{challenge.xp} XP
                  </span>
                  {!isDone && <ChevronRight className="w-3.5 h-3.5 text-muted" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// CLASS PROGRESSION PANEL
// =============================================================================
// Reflects the real class-unlock ladder (ARCHITECTURE.md): SoundSport is the
// ratings-only starter tier; A/Open/World Class add full competitive scoring
// (numeric scores + rank, Lineup Analyzer, Daily Predictions). Surfaces what a
// director unlocks as they level up — the "fuller dashboard" beyond SoundSport.

const CLASS_PERKS = {
  soundSport: 'Medal ratings & Best in Show',
  aClass: 'Numeric scoring, class rank & Lineup Analyzer',
  openClass: 'Deeper field, Daily Predictions & head-to-head leagues',
  worldClass: 'The complete competitive experience',
};

const ClassProgressionPanel = ({ unlockedClasses, activeCorpsClass, onGate }) => (
  <div className="bg-surface-card border border-line rounded-none overflow-hidden">
    <div className="bg-surface-raised px-4 py-3 border-b border-line">
      <h2 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
        Class Progression
      </h2>
    </div>

    <div className="divide-y divide-line/50">
      {CORPS_CLASS_ORDER.map((classId) => {
        const isUnlocked = isCorpsClassUnlocked(unlockedClasses, classId);
        const isActive = classId === activeCorpsClass;
        const requirement =
          classId === 'soundSport'
            ? 'Unlocked by default'
            : `Level ${CLASS_UNLOCK_LEVELS[classId]} or ${CLASS_UNLOCK_COSTS[classId].toLocaleString()} CorpsCoin`;

        return (
          <button
            key={classId}
            onClick={() => onGate('default')}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
          >
            <div
              className={`w-9 h-9 rounded-none flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                isActive
                  ? 'bg-interactive/20 text-interactive'
                  : isUnlocked
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-surface-sunken text-muted'
              }`}
            >
              {CLASS_POINT_CAPS[classId]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">
                  {CORPS_CLASS_LABELS[classId]}
                </span>
                {isActive ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-interactive/20 text-interactive rounded-none">
                    Your Corps
                  </span>
                ) : isUnlocked ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-green-500/20 text-green-500 rounded-none">
                    Unlocked
                  </span>
                ) : null}
              </div>
              <div className="text-[11px] text-muted truncate">{CLASS_PERKS[classId]}</div>
              <div className="text-[10px] text-muted truncate mt-0.5">{requirement}</div>
            </div>
            {!isUnlocked && <Lock className="w-3.5 h-3.5 text-muted flex-shrink-0" />}
          </button>
        );
      })}
    </div>

    <div className="px-4 py-2.5 border-t border-line bg-surface-sunken">
      <p className="text-[10px] text-muted">
        Level up as a director to unlock higher classes and the full competitive dashboard.
      </p>
    </div>
  </div>
);

// =============================================================================
// GUEST DASHBOARD COMPONENT
// =============================================================================

const GuestDashboard = () => {
  useBodyScroll();
  useSEO({
    title: 'Live Demo | marching.art — Fantasy Drum Corps',
    description:
      'Preview the marching.art fantasy drum corps dashboard — live scores, lineups, and leaderboards — before creating your free corps.',
    path: '/preview',
  });

  const {
    isLoading,
    demoCorps,
    demoProfile,
    demoRecentScores,
    demoUpcomingShows,
    demoRivals,
    trackInteraction,
    hasEngaged,
    startPreview,
    guestLineup,
    updateGuestLineup,
    shouldPromptRegistration,
    resetPreview,
  } = useGuestPreview();

  // Gate modal state
  const [gateModal, setGateModal] = useState({ isOpen: false, type: 'default' });

  // Real season corps list (publicly readable) — the same pool onboarding
  // drafts from, so the guest's picks import cleanly after signup. When the
  // load fails, availableCorps stays empty and lineup taps fall back to the
  // registration gate.
  const [availableCorps, setAvailableCorps] = useState([]);
  const [pickerCaption, setPickerCaption] = useState(null);
  const [engagementGateShown, setEngagementGateShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const season = await getSeasonData();
        if (!season?.seasonUid) return;
        const corpsValues = await getCorpsValues(season.seasonUid);
        if (!cancelled && corpsValues.length) {
          // Mirror onboarding's availability filter (points <= 50)
          setAvailableCorps(corpsValues.filter((c) => (c.points || 0) <= 50));
        }
      } catch {
        // Demo stays gated-only without the corps list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mark preview as started on mount
  useEffect(() => {
    startPreview();
  }, [startPreview]);

  // Handle gated action clicks
  const handleGatedClick = (gateType) => {
    trackInteraction(gateType);
    setGateModal({ isOpen: true, type: gateType });
  };

  const closeGate = () => {
    setGateModal({ isOpen: false, type: 'default' });
  };

  // Whether the demo lineup is actually draftable (corps list loaded)
  const isPlayable = availableCorps.length > 0;
  // Once the guest makes a pick, the panel shows their own draft
  const isDrafting = guestLineup !== null;

  const draftPickCount = isDrafting ? Object.values(guestLineup).filter(Boolean).length : 0;
  const draftPoints = isDrafting
    ? Object.values(guestLineup).reduce(
        (sum, val) => sum + (val ? parseInt(val.split('|')[2]) || 0 : 0),
        0
      )
    : 0;

  // Open the draft picker for a caption (or gate when corps didn't load)
  const handleLineupClick = (caption) => {
    trackInteraction('lineup');
    if (isPlayable) {
      setPickerCaption(caption);
    } else {
      setGateModal({ isOpen: true, type: 'edit' });
    }
  };

  const handleEditLineupClick = () => {
    trackInteraction('lineup');
    if (!isPlayable) {
      setGateModal({ isOpen: true, type: 'edit' });
      return;
    }
    const firstEmpty = CAPTIONS.find((c) => !(guestLineup || {})[c.id]);
    setPickerCaption(firstEmpty || CAPTIONS[0]);
  };

  // A pick was made: advance to the next empty caption, or celebrate a
  // complete draft with the save-progress prompt.
  const handlePickerSelect = (captionId, value) => {
    updateGuestLineup(captionId, value);
    const nextLineup = { ...(guestLineup || {}), [captionId]: value };
    const nextEmpty = CAPTIONS.find((c) => !nextLineup[c.id]);
    if (nextEmpty) {
      setPickerCaption(nextEmpty);
    } else {
      setPickerCaption(null);
      setEngagementGateShown(true);
      setGateModal({ isOpen: true, type: 'save' });
    }
  };

  // Closing the picker after enough engagement shows the save prompt once
  const handlePickerClose = () => {
    setPickerCaption(null);
    if (shouldPromptRegistration && !engagementGateShown) {
      setEngagementGateShown(true);
      setGateModal({ isOpen: true, type: 'save' });
    }
  };

  // Caption count powering AchievementTracker (guest's draft
  // progress while drafting, the full demo lineup otherwise).
  const lineupCount = isDrafting ? draftPickCount : Object.keys(demoCorps.lineup || {}).length;

  // Shapes the reused dashboard components expect.
  const recentResultsForFeed = demoRecentScores.map((show) => ({
    eventName: show.showName,
    score: show.score,
    date: new Date(show.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-interactive border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <GuestHeader />

      {/* Control Bar — real class tabs + Director HUD (streak, level, wallet,
          next-class unlock) + live deadline countdown. All actions gated. */}
      <ControlBar
        corps={demoProfile.corps}
        activeCorpsClass="soundSport"
        unlockedClasses={demoProfile.unlockedClasses}
        profile={demoProfile}
        onSwitch={(classId) => {
          if (classId !== 'soundSport') handleGatedClick('default');
        }}
        onCreateCorps={() => handleGatedClick('default')}
        onUnlockClass={() => handleGatedClick('default')}
        onStreakClick={() => handleGatedClick('default')}
        onWalletClick={() => handleGatedClick('default')}
      />

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-4">
        <div className="max-w-[1920px] mx-auto p-3 md:p-4 lg:p-6">
          {/* Preview Notice Banner */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-interactive/10 border border-interactive/30 rounded-none"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Info className="w-5 h-5 text-interactive flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">
                    You're exploring a live demo dashboard
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Draft a SoundSport lineup below — it carries over when you create your free
                    account
                  </p>
                </div>
              </div>
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 px-4 h-10 bg-interactive text-white text-sm font-bold rounded-none hover:bg-interactive-hover transition-colors whitespace-nowrap"
              >
                Create Your Corps
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </m.div>

          {/* 2/3 + 1/3 Grid — mirrors the real Dashboard layout. Scorecard leads
              the mobile stack, then sits atop the right column on lg. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* SCORECARD — top of mobile stack, top of right column on lg */}
            <div className="lg:col-start-3 lg:row-start-1">
              <SeasonScorecard
                score={demoCorps.seasonHighScore}
                rank={null}
                rankChange={null}
                corpsName={demoCorps.corpsName}
                corpsClass="soundSport"
                loading={false}
                avatarUrl={demoCorps.avatarUrl || null}
                bestInShowCount={demoCorps.bestInShowCount}
                showConcept={demoCorps.showConcept}
                onShowConcept={() => handleGatedClick('default')}
                onDesignUniform={() => handleGatedClick('default')}
                canManage
                canMove
                onMoveCorps={() => handleGatedClick('default')}
                onRetireCorps={() => handleGatedClick('default')}
              />
            </div>

            {/* MAIN CONTENT (2/3) - Lineup + results */}
            <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 space-y-4">
              {/* Lineup Panel (draftable) */}
              <div className="bg-surface-card border border-line rounded-none overflow-hidden">
                <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-interactive" />
                    {isDrafting ? 'Your Draft' : 'Active Lineup'}
                  </h2>
                  <div className="flex items-center gap-3">
                    {isDrafting && (
                      <>
                        <span className="text-[10px] font-bold text-muted font-data tabular-nums">
                          {draftPickCount}/8 •{' '}
                          <span
                            className={
                              draftPoints > STARTER_BUDGET ? 'text-red-400' : 'text-secondary'
                            }
                          >
                            {draftPoints}/{STARTER_BUDGET} budget
                          </span>
                        </span>
                        <button
                          onClick={resetPreview}
                          className="text-[10px] text-muted hover:text-white uppercase"
                        >
                          Reset
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleEditLineupClick}
                      className="text-xs font-medium text-interactive hover:text-white transition-colors flex items-center gap-1"
                    >
                      {!isPlayable && <Lock className="w-3 h-3" />}
                      {isDrafting ? 'Continue Draft' : isPlayable ? 'Try Drafting' : 'Edit Lineup'}
                    </button>
                  </div>
                </div>

                {isDrafting && (
                  <div className="px-4 py-2 bg-interactive/10 border-b border-interactive/20">
                    <p className="text-[11px] text-interactive">
                      You're drafting your own lineup — it carries over when you sign up.
                    </p>
                  </div>
                )}

                <div>
                  {CAPTIONS.map((caption, index) => {
                    const draftValue = isDrafting ? guestLineup[caption.id] : null;
                    return (
                      <LineupRow
                        key={caption.id}
                        caption={caption}
                        value={isDrafting ? draftValue : demoCorps.lineup?.[caption.id]}
                        pointsCost={draftValue ? parseInt(draftValue.split('|')[2]) || null : null}
                        isPlayable={isPlayable}
                        isLast={index === CAPTIONS.length - 1}
                        onClick={() => handleLineupClick(caption)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Recent Results — real component, medal ratings for SoundSport */}
              <RecentResultsFeed
                results={recentResultsForFeed}
                loading={false}
                corpsClass="soundSport"
              />

              {/* Class Progression — the fuller competitive dashboard that
                  unlocks beyond the SoundSport starter tier. */}
              <ClassProgressionPanel
                unlockedClasses={demoProfile.unlockedClasses}
                activeCorpsClass="soundSport"
                onGate={handleGatedClick}
              />
            </div>

            {/* SIDEBAR (1/3) - Engagement panels below the scorecard */}
            <div className="lg:col-start-3 space-y-4">
              {/* Daily Challenges - drives daily return visits */}
              <DemoDailyChallenges onGate={handleGatedClick} />

              {/* Upcoming Shows */}
              <div className="bg-surface-card border border-line rounded-none overflow-hidden">
                <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-green-500" />
                    Upcoming Shows
                  </h2>
                  <button
                    onClick={() => handleGatedClick('shows')}
                    className="text-xs font-medium text-interactive hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    Select
                  </button>
                </div>

                <div className="divide-y divide-line/50">
                  {demoUpcomingShows.slice(0, 3).map((show) => (
                    <button
                      key={show.showId}
                      onClick={() => handleGatedClick('shows')}
                      className="w-full p-3 flex items-center gap-3 hover:bg-surface-raised transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-none bg-surface-sunken flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs text-muted">
                          {new Date(show.date)
                            .toLocaleDateString('en-US', { month: 'short' })
                            .toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {new Date(show.date).getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{show.eventName}</div>
                        <div className="text-xs text-muted truncate">{show.location}</div>
                      </div>
                      {show.isSelected && (
                        <div className="px-2 py-0.5 bg-green-500/20 rounded-none">
                          <span className="text-xs font-medium text-green-500">Selected</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rivals — real component, closest SoundSport competitors */}
              <RivalsPanel rivals={demoRivals} corpsClass="soundSport" />

              {/* Achievement Tracker — real progress-to-next-achievement widget */}
              <AchievementTrackerPanel
                profile={demoProfile}
                lineupCount={lineupCount}
                resultCount={demoRecentScores.length}
                leagueCount={0}
              />

              {/* Join League CTA */}
              <button
                onClick={() => handleGatedClick('league')}
                className="w-full bg-interactive/10 border border-interactive/30 rounded-none p-4 text-left hover:border-interactive/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-none bg-interactive/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-interactive" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white group-hover:text-interactive transition-colors">
                      Join a League
                    </div>
                    <div className="text-xs text-muted">Compete against friends</div>
                  </div>
                  <Lock className="w-4 h-4 text-muted group-hover:text-interactive transition-colors" />
                </div>
              </button>

              {/* Submit Article — community content (gated) */}
              <div className="bg-surface-card border border-line rounded-none overflow-hidden">
                <div className="bg-surface-raised px-4 py-3 border-b border-line">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-green-500" />
                    Community Content
                  </h3>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted mb-3">
                    Share your insights, analysis, or news with the community.
                  </p>
                  <button
                    onClick={() => handleGatedClick('default')}
                    className="w-full py-2.5 bg-surface-raised hover:bg-line border border-line text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Submit Article
                  </button>
                </div>
              </div>

              {/* Register CTA */}
              <div className="bg-interactive/10 border border-interactive/30 rounded-none p-4">
                <h3 className="text-sm font-bold text-white mb-2">Ready to compete?</h3>
                <p className="text-xs text-muted mb-4">
                  Create your free account to build your own corps, join leagues, and climb the
                  leaderboard.
                </p>
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 w-full h-11 bg-interactive text-white font-bold text-sm rounded-none hover:bg-interactive-hover transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Free Account
                </Link>
                <div className="flex items-center justify-center gap-2 mt-3 text-muted">
                  <Zap className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs">Takes less than 30 seconds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Draft Picker Modal */}
      <GuestLineupPicker
        isOpen={pickerCaption !== null}
        caption={pickerCaption}
        availableCorps={availableCorps}
        lineup={guestLineup || {}}
        onSelect={handlePickerSelect}
        onClose={handlePickerClose}
        onComplete={handlePickerClose}
      />

      {/* Registration Gate Modal */}
      <RegistrationGate
        isOpen={gateModal.isOpen}
        onClose={closeGate}
        gateType={gateModal.type}
        hasEngaged={hasEngaged}
      />
    </div>
  );
};

export default GuestDashboard;
