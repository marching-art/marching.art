// StandingsPanel - Standings table with top corps
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { TeamAvatar } from '../ui/TeamAvatar';

// Table column definitions - static, defined outside component
const standingsColumns = [
  {
    key: 'rank',
    header: 'RK',
    width: '44px',
    isRank: true,
    render: (row) => (
      <div className="flex items-center justify-center">
        <span className="w-6 h-6 rounded bg-[#333] border border-[#444] flex items-center justify-center text-gray-400 font-medium tabular-nums text-xs">
          {row.rank}
        </span>
      </div>
    ),
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => (
      <div className="flex items-center gap-2">
        <TeamAvatar name={row.corpsName || row.corps} size="xs" />
        <span className="font-bold text-white truncate block max-w-[160px] sm:max-w-[120px] text-sm sm:text-xs">
          {row.corpsName || row.corps}
        </span>
      </div>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    width: '75px',
    render: (row) => (
      <span className="text-white font-data tabular-nums text-sm sm:text-xs">
        {typeof row.score === 'number' ? row.score.toFixed(3) : row.score}
      </span>
    ),
  },
];

const StandingsPanel = React.memo(({
  data,
  isLoading,
  activeCorpsName,
  isMobile = false
}) => {
  return (
    <div className="bg-[#0a0a0a]">
      {/* Header - hidden on mobile since we have tabs */}
      <div className="hidden lg:flex bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] items-center justify-between">
        <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Standings
        </span>
        <Link to="/scores" className="text-[11px] sm:text-[10px] text-[#F5A623] hover:text-[#FFB84D] transition-colors flex items-center gap-0.5 py-1">
          Results <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
      ) : (
        <DataTable
          columns={standingsColumns}
          data={data}
          getRowKey={(row) => row.corpsName || row.corps}
          zebraStripes={true}
          highlightRow={(row) => row.corpsName === activeCorpsName}
          emptyState={
            <div className="p-4 text-center text-gray-500 text-sm">
              No standings yet
            </div>
          }
        />
      )}

      {/* Mobile View All link */}
      {isMobile && (
        <Link
          to="/scores"
          className="flex items-center justify-center gap-1 py-4 text-sm font-medium text-[#F5A623] hover:text-[#FFB84D] transition-colors border-t border-[#333] bg-[#1a1a1a]"
        >
          View Full Results <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
});

StandingsPanel.displayName = 'StandingsPanel';

export default StandingsPanel;
