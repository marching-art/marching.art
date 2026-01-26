// LeagueStatus - Sidebar widget showing user's league standings
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

const LeagueStatus = memo(({ leagues }) => {
  if (!leagues || leagues.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-blue-500" />
          Leagues
        </h3>
        <Link to="/leagues" className="text-[10px] text-gray-500 hover:text-white">
          View All →
        </Link>
      </div>

      <div className="divide-y divide-[#222]">
        {leagues.slice(0, 2).map((league, idx) => (
          <Link
            key={league.id || idx}
            to="/leagues"
            className="flex items-center justify-between px-4 py-2.5 hover:bg-[#222] transition-colors"
          >
            <span className="text-sm text-white truncate">{league.name}</span>
            <span className="text-sm font-bold text-white font-data">#{league.userRank || '-'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
});

export default LeagueStatus;
