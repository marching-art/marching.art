// PodiumZone — everything that renders in Dashboard Zone C when the Podium
// tab is selected (Phase 2, design §6). Handles its own three states:
// loading, unregistered (four-step setup), and the daily loop
// (RehearsalPlanner + PodiumCaptionPanel).
//
// The Podium state is loaded by the Dashboard (which also reads its
// challenge facts for the shared Director's Report) and passed in, so it is
// fetched exactly once. Falls back to loading its own when no prop is given,
// keeping the component usable in isolation (e.g. tests).

import React, { useState } from 'react';
import { Loader2, Medal, X } from 'lucide-react';
import { usePodium } from '../../hooks/usePodium';
import { useProfileStore } from '../../store/profileStore';
import PodiumRegistration from './PodiumRegistration';
import RehearsalPlanner from './RehearsalPlanner';
import PodiumCaptionPanel from './PodiumCaptionPanel';
import PodiumTrajectoryCard from './PodiumTrajectoryCard';
import PodiumSeasonLedger from './PodiumSeasonLedger';
import CorpsConditionPanel from './CorpsConditionPanel';
import PodiumStaffPanel from './PodiumStaffPanel';
import JointRehearsalPanel from './JointRehearsalPanel';
import FanFavoriteCard from './FanFavoriteCard';
import StaffOutlookBanner from './StaffOutlookBanner';

// Once a director has read the mode banner they don't need it every visit, so
// dismissing it writes a flag we honour on future loads. localStorage (not
// per-account state) keeps it a lightweight, device-local preference.
const BANNER_DISMISSED_KEY = 'marching_art_podium_mode_banner_dismissed';

function readBannerDismissed() {
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

// A slim mode banner. Selecting the Podium tab swaps Zone C from the fantasy
// lineup surfaces to the director sim — this line names the boundary so a
// director who expected a draftable lineup understands they've crossed into a
// different game (a separate simulation, not a fifth class). Directors who
// have internalised the distinction can dismiss it permanently via the X.
function PodiumModeBanner() {
  const [dismissed, setDismissed] = useState(readBannerDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    } catch {
      // localStorage unavailable — still hide it for this session.
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-2 bg-brand/10 border border-brand/30 rounded-none px-3 py-2">
      <Medal className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-[11px] text-secondary leading-snug flex-1">
        <span className="font-bold text-brand uppercase tracking-wider">Podium</span> — a director
        simulation, not a fantasy draft. You run your own corps and earn every point through how you
        rehearse, travel, and rest.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss Podium intro"
        title="Dismiss permanently"
        className="flex-shrink-0 -mr-1 -mt-0.5 p-0.5 text-muted hover:text-brand transition-colors"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
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
  const uid = useProfileStore((state) => state.profile?.uid || state._currentUid);

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
      {/* data-tour anchors: the first-run Podium tour (components/Dashboard/
          tourSteps PODIUM_TOUR_STEPS) highlights these four panels in turn. */}
      <div data-tour="podium-rehearsal">
        <RehearsalPlanner podium={podium} />
      </div>
      <div data-tour="podium-captions">
        <PodiumCaptionPanel podium={podium} />
      </div>
      <FanFavoriteCard />
      <div data-tour="podium-trajectory">
        <PodiumTrajectoryCard podium={podium} />
      </div>
      <PodiumSeasonLedger
        seasonUid={podium.data?.state?.seasonUid}
        seasonName={podium.data?.state?.seasonName}
        uid={uid}
        userCorpsName={podium.data?.state?.corpsName}
      />
      <div data-tour="podium-condition">
        <CorpsConditionPanel podium={podium} />
      </div>
      <PodiumStaffPanel podium={podium} />
      <JointRehearsalPanel />
    </div>
  );
}
