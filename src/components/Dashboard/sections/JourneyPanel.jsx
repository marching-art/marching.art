// JourneyPanel - First Season Journey quest line
// Walks a new director through every core mechanic, one step at a time, with
// server-validated XP + CorpsCoin rewards per step. Completion lives in
// profile.journey (server-only field), awarded by the completeJourneyStep
// callable. Step ids/rewards mirror functions/src/helpers/journey.js —
// keep the two lists in sync.

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

const STEPS = [
  {
    id: 'full_lineup',
    title: 'Field a Full Corps',
    description: 'Fill all 8 caption slots in your lineup',
    xp: 50,
    coin: 50,
    icon: Music,
    ready: (s) => s.hasFullLineup,
    action: { type: 'lineup', label: 'Edit Lineup' },
  },
  {
    id: 'register_shows',
    title: 'Hit the Road',
    description: 'Register your corps for shows this week',
    xp: 50,
    coin: 50,
    icon: Calendar,
    ready: (s) => s.hasShows,
    action: { type: 'link', label: 'View Schedule', to: '/schedule' },
  },
  {
    id: 'show_concept',
    title: 'Design Your Show',
    description: 'Set a show concept — it earns synergy bonuses at scoring',
    xp: 50,
    coin: 50,
    icon: Palette,
    ready: (s) => s.hasConcept,
    action: { type: 'concept', label: 'Set Concept' },
  },
  {
    id: 'check_scores',
    title: 'Read the Recaps',
    description: 'Scores drop overnight around 2 AM ET — check your first recap',
    xp: 25,
    coin: 0,
    icon: Trophy,
    // Trust step: claimable once the corps actually has results to read
    ready: (s) => s.hasResults,
    action: { type: 'link', label: 'View Scores', to: '/scores' },
  },
  {
    id: 'make_prediction',
    title: 'Call Your Shot',
    description: 'Submit a daily prediction from the dashboard panel',
    xp: 25,
    coin: 25,
    icon: Target,
    ready: (s) => s.hasPrediction,
    action: null,
  },
  {
    id: 'caption_trade',
    title: 'Work the Trade Window',
    description: 'Make a caption change in a weekly window (3/week after Day 14)',
    xp: 50,
    coin: 50,
    icon: Repeat,
    ready: (s) => s.hasTraded,
    action: { type: 'lineup', label: 'Edit Lineup' },
  },
  {
    id: 'join_league',
    title: 'Find Your Circuit',
    description: 'Join a league for weekly head-to-head matchups',
    xp: 75,
    coin: 100,
    icon: Users,
    ready: (s) => s.hasLeague,
    action: { type: 'rookieLeague', label: 'Quick Join' },
  },
  {
    id: 'finish_season',
    title: 'Complete a Season',
    description: 'Stay with your corps through Finals',
    xp: 100,
    coin: 100,
    icon: Flag,
    ready: (s) => s.hasFinishedSeason,
    action: null,
  },
];

const JourneyPanel = memo(({ profile, resultCount, onEditLineup, onSetConcept }) => {
  const [claiming, setClaiming] = useState(null); // stepId being claimed
  const journey = profile?.journey;

  const state = useMemo(() => {
    const corpsList = Object.values(profile?.corps || {}).filter(Boolean);
    return {
      hasFullLineup: corpsList.some((c) => c.lineup && Object.keys(c.lineup).length === 8),
      hasShows: corpsList.some((c) =>
        Object.values(c.selectedShows || {}).some((w) => Array.isArray(w) && w.length > 0)
      ),
      hasConcept: corpsList.some((c) => !!c.showConcept),
      hasResults: (resultCount || 0) > 0,
      hasPrediction: Object.keys(profile?.predictions || {}).length > 0,
      hasTraded: corpsList.some((c) => (c.weeklyTrades?.used || 0) > 0),
      hasLeague: (profile?.leagueIds || []).length > 0,
      hasFinishedSeason: (profile?.lifetimeStats?.totalSeasons || 0) >= 1,
    };
  }, [profile, resultCount]);

  const steps = useMemo(
    () =>
      STEPS.map((step) => ({
        ...step,
        done: !!journey?.[step.id],
        ready: !journey?.[step.id] && step.ready(state),
      })),
    [journey, state]
  );

  const doneCount = steps.filter((s) => s.done).length;

  // The journey is finished — retire the panel
  if (!profile || doneCount === STEPS.length) return null;

  const handleClaim = async (step) => {
    setClaiming(step.id);
    try {
      const result = await completeJourneyStep({ stepId: step.id });
      if (result.data.success && !result.data.alreadyCompleted) {
        const parts = [`+${result.data.xpAwarded} XP`];
        if (result.data.coinAwarded > 0) parts.push(`+${result.data.coinAwarded} CC`);
        toast.success(`${step.title} — ${parts.join(' ')}`);
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
      }
    } catch (error) {
      toast.error(error.message || 'Could not join the rookie league');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Map className="w-3.5 h-3.5 text-[#0057B8]" />
          First Season Journey
        </h3>
        <span className="text-[10px] font-bold text-gray-500 font-data tabular-nums">
          {doneCount}/{STEPS.length}
        </span>
      </div>
      <div className="h-1 bg-[#222]">
        <div
          className="h-full bg-[#0057B8] transition-all duration-500"
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-[#222]">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className={`px-4 py-3 ${step.done ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? 'bg-green-500/20'
                      : step.ready
                        ? 'bg-[#0057B8]/20'
                        : 'bg-[#222] border border-[#333]'
                  }`}
                >
                  {step.done ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Icon
                      className={`w-3 h-3 ${step.ready ? 'text-[#0057B8]' : 'text-gray-600'}`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${step.done ? 'text-gray-500 line-through' : 'text-white'}`}
                  >
                    {step.title}
                  </span>
                  {!step.done && (
                    <span className="text-[10px] text-yellow-600 ml-2 font-data whitespace-nowrap">
                      +{step.xp} XP{step.coin > 0 ? ` +${step.coin} CC` : ''}
                    </span>
                  )}
                </div>
                {step.ready && (
                  <button
                    onClick={() => handleClaim(step)}
                    disabled={claiming === step.id}
                    className="flex items-center gap-1 px-2.5 h-7 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold uppercase tracking-wider transition-colors press-feedback flex-shrink-0"
                  >
                    <Gift className="w-3 h-3" />
                    {claiming === step.id ? '...' : 'Claim'}
                  </button>
                )}
              </div>
              {!step.done && !step.ready && (
                <div className="ml-8 mt-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-gray-600">{step.description}</p>
                  {step.action?.type === 'link' && (
                    <Link
                      to={step.action.to}
                      className="text-[10px] font-bold text-[#0057B8] hover:text-[#0066d6] whitespace-nowrap"
                    >
                      {step.action.label} →
                    </Link>
                  )}
                  {step.action?.type === 'lineup' && (
                    <button
                      onClick={() => onEditLineup?.()}
                      className="text-[10px] font-bold text-[#0057B8] hover:text-[#0066d6] whitespace-nowrap"
                    >
                      {step.action.label} →
                    </button>
                  )}
                  {step.action?.type === 'concept' && (
                    <button
                      onClick={() => onSetConcept?.()}
                      className="text-[10px] font-bold text-[#0057B8] hover:text-[#0066d6] whitespace-nowrap"
                    >
                      {step.action.label} →
                    </button>
                  )}
                  {step.action?.type === 'rookieLeague' && (
                    <button
                      onClick={handleQuickJoin}
                      disabled={claiming === 'join_league'}
                      className="text-[10px] font-bold text-[#0057B8] hover:text-[#0066d6] whitespace-nowrap"
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
