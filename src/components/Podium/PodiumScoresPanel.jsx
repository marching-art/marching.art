// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumScoresPanel — the Podium Class Scores tab, split into two sub-views:
//
//   • Recaps — the DCI-style per-show box scores (PodiumRecapSheet)
//   • Report — The Podium Report weekly power-rankings column (PodiumReportSheet)
//
// The report used to stack above the recap sheets on a single page; once the
// field grows (a 100-corps season), that page got very long before you reached
// the box scores. Keeping both under the Podium tab as sibling sub-views — the
// user's ask — lets each surface own its scroll and grow independently.

import React, { useState } from 'react';
import PodiumRecapSheet from './PodiumRecapSheet';
import PodiumReportSheet from './PodiumReportSheet';

const SUB_TABS = [
  { id: 'recaps', label: 'Recaps' },
  { id: 'report', label: 'Report' },
];

export default function PodiumScoresPanel({ seasonUid, seasonName, userCorpsName }) {
  const [subTab, setSubTab] = useState('recaps');

  return (
    <div>
      {/* Sub-tab strip — mirrors the archive sub-tab styling so it reads as a
          nested control under the Podium tab, not a peer of the top tabs. */}
      <div className="bg-surface-sunken border-b border-line px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              aria-pressed={subTab === tab.id}
              className={`px-2.5 py-1.5 min-h-touch text-[10px] font-bold uppercase tracking-wider transition-all rounded-none whitespace-nowrap flex-shrink-0 ${
                subTab === tab.id ? 'bg-line text-white' : 'text-muted hover:text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'recaps' ? (
        <PodiumRecapSheet
          seasonUid={seasonUid}
          seasonName={seasonName}
          userCorpsName={userCorpsName}
        />
      ) : (
        <PodiumReportSheet
          seasonUid={seasonUid}
          seasonName={seasonName}
          userCorpsName={userCorpsName}
        />
      )}
    </div>
  );
}
