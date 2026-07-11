// PodiumZone — everything that renders in Dashboard Zone C when the Podium
// tab is selected (Phase 2, design §6). Handles its own three states:
// loading, unregistered (four-step setup), and the daily loop
// (RehearsalPlanner + PodiumCaptionPanel).

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

export default function PodiumZone() {
  const podium = usePodium(true);

  if (podium.loading && !podium.data) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-none p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  if (podium.error) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-none p-4 text-xs text-red-400">
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
      <JointRehearsalPanel podium={podium} />
    </div>
  );
}
