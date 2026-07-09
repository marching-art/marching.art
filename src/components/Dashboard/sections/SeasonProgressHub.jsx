// SeasonProgressHub — Zone D's single progression surface: the Season Ladder
// and the Achievement Tracker as one tabbed card instead of two stacked
// widgets. The dashboard used to present four separate progress-bar panels
// (journey, challenges, ladder, achievements); this hub is half of that
// consolidation (the daily pair lives in Zone B / the Director's Report).

import React, { memo, useState } from 'react';
import { TrendingUp, Award } from 'lucide-react';
import SeasonLadderPanel from './SeasonLadderPanel';
import AchievementTrackerPanel from './AchievementTrackerPanel';

const TABS = [
  { id: 'ladder', label: 'Season Ladder', icon: TrendingUp },
  { id: 'achievements', label: 'Achievements', icon: Award },
];

const SeasonProgressHub = memo(({ profile, seasonUid, lineupCount, resultCount, leagueCount }) => {
  const [activeTab, setActiveTab] = useState('ladder');

  return (
    <div>
      <div className="flex bg-[#1a1a1a] border border-[#333] border-b-0" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                isActive
                  ? 'text-white bg-[#222] border-b-2 border-[#0057B8]'
                  : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === 'ladder' ? (
        <SeasonLadderPanel profile={profile} seasonUid={seasonUid} />
      ) : (
        <AchievementTrackerPanel
          profile={profile}
          lineupCount={lineupCount}
          resultCount={resultCount}
          leagueCount={leagueCount}
        />
      )}
    </div>
  );
});

export default SeasonProgressHub;
