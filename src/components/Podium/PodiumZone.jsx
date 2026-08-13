// PodiumZone — everything that renders in Dashboard Zone C when the Podium
// tab is selected (Phase 2, design §6). Handles its own three states:
// loading, unregistered (four-step setup), and the daily loop
// (RehearsalPlanner + PodiumCaptionPanel).
//
// The Podium state is loaded by the Dashboard (which also reads its
// challenge facts for the shared Director's Report) and passed in, so it is
// fetched exactly once. Falls back to loading its own when no prop is given,
// keeping the component usable in isolation (e.g. tests).

import React from 'react';
import { Loader2, Medal } from 'lucide-react';
import { usePodium } from '../../hooks/usePodium';
import PodiumRegistration from './PodiumRegistration';
import RehearsalPlanner from './RehearsalPlanner';
import PodiumCaptionPanel from './PodiumCaptionPanel';
import PodiumTrajectoryCard from './PodiumTrajectoryCard';
import CorpsConditionPanel from './CorpsConditionPanel';
import PodiumStaffPanel from './PodiumStaffPanel';
import JointRehearsalPanel from './JointRehearsalPanel';
import FanFavoriteCard from './FanFavoriteCard';
import StaffOutlookBanner from './StaffOutlookBanner';

// A slim, persistent mode banner. Selecting the Podium tab swaps Zone C from
// the fantasy lineup surfaces to the director sim — this line names the
// boundary so a director who expected a draftable lineup understands they've
// crossed into a different game (a separate simulation, not a fifth class).
function PodiumModeBanner() {
  return (
    <div className="flex items-start gap-2 bg-brand/10 border border-brand/30 rounded-none px-3 py-2">
      <Medal className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-[11px] text-secondary leading-snug">
        <span className="font-bold text-brand uppercase tracking-wider">Podium</span> — a director
        simulation, not a fantasy draft. You run your own corps and earn every point through how you
        rehearse, travel, and rest.
      </p>
    </div>
  );
}

/**
 * @param {{ podium?: ReturnType<typeof usePodium> }} props
 */
export default function PodiumZone({ podium: podiumProp }) {
  // Self-load only when the Dashboard didn't hand us its instance. The hook
  // runs unconditionally (rules of hooks) but no-ops its fetch when disabled,
  // so passing an instance avoids the duplicate getPodiumState call.
  const ownPodium = usePodium(!podiumProp);
  const podium = podiumProp || ownPodium;

  if (podium.loading && !podium.data) {
    return (
      <div className="bg-surface-card border border-line rounded-none p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  // Only a FATAL error (nothing loaded) replaces the whole zone. A transient
  // error while state is present — e.g. a bounced rehearsal block — is shown
  // inline by the planner, so it must not nuke the surface.
  if (podium.error && !podium.data) {
    return (
      <div className="bg-surface-card border border-line rounded-none p-4 text-xs text-red-400">
        {podium.error}
      </div>
    );
  }

  if (!podium.data?.exists) {
    return (
      <div className="space-y-4">
        <PodiumModeBanner />
        <PodiumRegistration podium={podium} />
      </div>
    );
  }

  // Order matters most on mobile, where these eight panels are a long single
  // column. Lead with the daily decision loop — a between-seasons alert, then
  // the rehearsal verb and the caption progress that tells you what to spend
  // blocks on — so a returning director lands on today's work, not the season
  // furniture. The strategic panels (trajectory, condition, staff, joint) and
  // the community vote follow.
  return (
    <div className="space-y-4">
      <PodiumModeBanner />
      <StaffOutlookBanner podium={podium} />
      <RehearsalPlanner podium={podium} />
      <PodiumCaptionPanel podium={podium} />
      <FanFavoriteCard />
      <PodiumTrajectoryCard podium={podium} />
      <CorpsConditionPanel podium={podium} />
      <PodiumStaffPanel podium={podium} />
      <JointRehearsalPanel />
    </div>
  );
}
