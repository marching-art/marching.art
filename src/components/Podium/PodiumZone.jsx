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
import { Loader2 } from 'lucide-react';
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
    return <PodiumRegistration podium={podium} />;
  }

  return (
    <div className="space-y-4">
      <StaffOutlookBanner podium={podium} />
      <FanFavoriteCard />
      <RehearsalPlanner podium={podium} />
      <PodiumCaptionPanel podium={podium} />
      <PodiumTrajectoryCard podium={podium} />
      <CorpsConditionPanel podium={podium} />
      <PodiumStaffPanel podium={podium} />
      <JointRehearsalPanel />
    </div>
  );
}
