// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// JourneyPanel - First Season Journey quest line
// Walks a new director through every core mechanic, one step at a time, with
// server-validated XP + CorpsCoin rewards per step. Completion lives in
// profile.journey (server-only field), awarded by the completeJourneyStep
// callable.
//
// The step table and its readiness rules live in utils/journeyProgress (shared
// with the mobile Next Action hero, which counts claimable steps); this file
// owns only how each step is presented — its icon and which surface its
// shortcut opens.

import React, { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Map,
  Check,
  Music,
  Calendar,
  Palette,
  Trophy,
  Target,
  Repeat,
  Users,
  Flag,
  Gift,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { completeJourneyStep, joinRookieLeague } from '../../../api/functions';
import { showXPGain, showCoinGain } from '../../xpFeedbackTrigger';
import { getJourneySteps, JOURNEY_STEPS } from '../../../utils/journeyProgress';

// How each shared step is presented here: its icon, and the shortcut offered
// while it is still out of reach. Keyed by the step ids in journeyProgress.
const STEP_PRESENTATION = {
  full_lineup: { icon: Music, action: { type: 'lineup', label: 'Edit Lineup' } },
  register_shows: {
    icon: Calendar,
    action: { type: 'link', label: 'View Schedule', to: '/schedule' },
  },
  show_concept: { icon: Palette, action: { type: 'concept', label: 'Set Concept' } },
  check_scores: { icon: Trophy, action: { type: 'link', label: 'View Scores', to: '/scores' } },
  make_prediction: { icon: Target, action: null },
  caption_trade: { icon: Repeat, action: { type: 'lineup', label: 'Edit Lineup' } },
  join_league: { icon: Users, action: { type: 'rookieLeague', label: 'Quick Join' } },
  finish_season: { icon: Flag, action: null },
};

const JourneyPanel = memo(({ profile, resultCount, onEditLineup, onSetConcept }) => {
  const [claiming, setClaiming] = useState(null); // stepId being claimed

  const steps = useMemo(
    () =>
      getJourneySteps(profile, resultCount).map((step) => ({
        ...step,
        ...STEP_PRESENTATION[step.id],
      })),
    [profile, resultCount]
  );

  const doneCount = steps.filter((s) => s.done).length;

  // The journey is finished — retire the panel
  if (!profile || doneCount === JOURNEY_STEPS.length) return null;

  const handleClaim = async (step) => {
    setClaiming(step.id);
    try {
      const result = await completeJourneyStep({ stepId: step.id });
      if (result.data.success && !result.data.alreadyCompleted) {
        const parts = [`+${result.data.xpAwarded} XP`];
        if (result.data.coinAwarded > 0) parts.push(`+${result.data.coinAwarded} CC`);
        toast.success(`${step.title} — ${parts.join(' ')}`);
        if (result.data.xpAwarded > 0) showXPGain(result.data.xpAwarded, step.title);
        if (result.data.coinAwarded > 0) showCoinGain(result.data.coinAwarded);
      }
    } catch (error) {
      toast.error(error.message || 'Could not complete step');
    } finally {
      setClaiming(null);
    }
  };

  const handleQuickJoin = async () => {
    setClaiming('join_league');
    try {
      const result = await joinRookieLeague();
      toast.success(result.data.message || 'Joined the Rookie Circuit!');
      // League membership is now on the profile — claim the step right away
      const claim = await completeJourneyStep({ stepId: 'join_league' });
      if (claim.data.success && !claim.data.alreadyCompleted) {
        toast.success(
          `Find Your Circuit — +${claim.data.xpAwarded} XP +${claim.data.coinAwarded} CC`
        );
        if (claim.data.xpAwarded > 0) showXPGain(claim.data.xpAwarded, 'Find Your Circuit');
        if (claim.data.coinAwarded > 0) showCoinGain(claim.data.coinAwarded);
      }
    } catch (error) {
      toast.error(error.message || 'Could not join the rookie league');
    } finally {
      setClaiming(null);
    }
  };

  return (
    // scroll-mt clears the fixed shell chrome plus the sticky ControlBar when
    // the Next Action hero scrolls the page to a claimable step.
    <div
      id="journey-panel"
      className="bg-surface-card border border-line overflow-hidden scroll-mt-24"
    >
      {/* Header */}
      <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <Map className="w-3.5 h-3.5 text-interactive" />
          First Season Journey
        </h3>
        <span className="text-[10px] font-bold text-muted font-data tabular-nums">
          {doneCount}/{JOURNEY_STEPS.length}
        </span>
      </div>
      <div className="h-1 bg-surface-raised">
        <div
          className="h-full bg-interactive transition-all duration-500"
          style={{ width: `${(doneCount / JOURNEY_STEPS.length) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-line-subtle">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className={`px-4 py-3 ${step.done ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? 'bg-green-500/20'
                      : step.claimable
                        ? 'bg-interactive/20'
                        : 'bg-surface-raised border border-line'
                  }`}
                >
                  {step.done ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Icon
                      className={`w-3 h-3 ${step.claimable ? 'text-interactive' : 'text-muted'}`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${step.done ? 'text-muted line-through' : 'text-white'}`}
                  >
                    {step.title}
                  </span>
                  {!step.done && (
                    <span className="text-[10px] text-brand ml-2 font-data whitespace-nowrap">
                      +{step.xp} XP{step.coin > 0 ? ` +${step.coin} CC` : ''}
                    </span>
                  )}
                </div>
                {step.claimable && (
                  <button
                    onClick={() => handleClaim(step)}
                    disabled={claiming === step.id}
                    className="flex items-center gap-1 px-2.5 h-7 bg-interactive hover:bg-interactive-hover text-white text-[10px] font-bold uppercase tracking-wider transition-colors press-feedback flex-shrink-0"
                  >
                    <Gift className="w-3 h-3" />
                    {claiming === step.id ? '...' : 'Claim'}
                  </button>
                )}
              </div>
              {!step.done && !step.claimable && (
                <div className="ml-8 mt-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted">{step.description}</p>
                  {step.action?.type === 'link' && (
                    <Link
                      to={step.action.to}
                      className="text-[10px] font-bold text-interactive hover:text-interactive-hover whitespace-nowrap"
                    >
                      {step.action.label} →
                    </Link>
                  )}
                  {step.action?.type === 'lineup' && (
                    <button
                      onClick={() => onEditLineup?.()}
                      className="text-[10px] font-bold text-interactive hover:text-interactive-hover whitespace-nowrap"
                    >
                      {step.action.label} →
                    </button>
                  )}
                  {step.action?.type === 'concept' && (
                    <button
                      onClick={() => onSetConcept?.()}
                      className="text-[10px] font-bold text-interactive hover:text-interactive-hover whitespace-nowrap"
                    >
                      {step.action.label} →
                    </button>
                  )}
                  {step.action?.type === 'rookieLeague' && (
                    <button
                      onClick={handleQuickJoin}
                      disabled={claiming === 'join_league'}
                      className="text-[10px] font-bold text-interactive hover:text-interactive-hover whitespace-nowrap"
                    >
                      {claiming === 'join_league' ? 'Joining...' : `${step.action.label} →`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

JourneyPanel.displayName = 'JourneyPanel';

export default JourneyPanel;
