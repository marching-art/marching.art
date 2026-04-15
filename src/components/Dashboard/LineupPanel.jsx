// LineupPanel - Lineup list with caption slots
import React from 'react';
import { ChevronRight } from 'lucide-react';

const CAPTIONS = [
  { id: 'GE1', name: 'GE1', category: 'ge', fullName: 'General Effect 1' },
  { id: 'GE2', name: 'GE2', category: 'ge', fullName: 'General Effect 2' },
  { id: 'VP', name: 'VP', category: 'vis', fullName: 'Visual Proficiency' },
  { id: 'VA', name: 'VA', category: 'vis', fullName: 'Visual Analysis' },
  { id: 'CG', name: 'CG', category: 'vis', fullName: 'Color Guard' },
  { id: 'B', name: 'B', category: 'mus', fullName: 'Brass' },
  { id: 'MA', name: 'MA', category: 'mus', fullName: 'Music Analysis' },
  { id: 'P', name: 'P', category: 'mus', fullName: 'Percussion' },
];

// Memoized row component to prevent re-renders when other rows change
const LineupRow = React.memo(({ caption, value, captionScore, isLast, onSelect }) => {
  const hasValue = !!value;
  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
  const captionLabel = `${caption.name} — ${caption.fullName}`;

  return (
    <button
      onClick={() => onSelect(caption.id)}
      aria-label={hasValue
        ? `${captionLabel}: ${corpsName}${sourceYear ? ` ${sourceYear}` : ''}`
        : `${captionLabel}: empty slot`}
      className={`w-full flex items-center gap-3 px-3 py-3.5 transition-all cursor-pointer group ${
        !isLast ? 'border-b border-[#333]/50' : ''
      } bg-[#1a1a1a] hover:bg-[#222] active:bg-[#252525]`}
    >
      {/* Position Badge */}
      <div
        title={captionLabel}
        aria-hidden="true"
        className={`w-10 h-8 flex items-center justify-center rounded text-xs font-bold flex-shrink-0 ${
          hasValue ? 'bg-[#0057B8]/20 text-[#0057B8]' : 'bg-[#333] text-gray-500'
        }`}
      >
        {caption.name}
      </div>
      {/* Corps Name + Year */}
      <div className="flex-1 text-left min-w-0">
        {hasValue ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white truncate">{corpsName}</span>
            {sourceYear && (
              <span className="text-[10px] text-gray-500">'{sourceYear?.slice(-2)}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">Empty slot</span>
        )}
      </div>
      {/* Caption Score / Action */}
      <div className="flex items-center gap-2">
        {hasValue ? (
          <span className="text-xs font-data text-gray-400 tabular-nums">
            {captionScore !== null ? captionScore.toFixed(1) : '—'}
          </span>
        ) : (
          <span className="text-xs font-bold text-[#F5A623] group-hover:text-[#FFB84D]">+ Draft</span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
      </div>
    </button>
  );
});
LineupRow.displayName = 'LineupRow';

const LineupPanel = React.memo(({ lineup, corpsStats, onCaptionSelect }) => {
  // Helper to get caption score based on category
  const getCaptionScore = (captionId) => {
    if (['GE1', 'GE2'].includes(captionId)) {
      return corpsStats?.geScore ?? null;
    } else if (['VP', 'VA', 'CG'].includes(captionId)) {
      return corpsStats?.visualScore ?? null;
    } else if (['B', 'MA', 'P'].includes(captionId)) {
      return corpsStats?.musicScore ?? null;
    }
    return null;
  };

  return (
    <div className="mb-4 border border-[#333] rounded-sm overflow-hidden">
      {CAPTIONS.map((caption, index) => (
        <LineupRow
          key={caption.id}
          caption={caption}
          value={lineup[caption.id]}
          captionScore={getCaptionScore(caption.id)}
          isLast={index === CAPTIONS.length - 1}
          onSelect={onCaptionSelect}
        />
      ))}
    </div>
  );
});

LineupPanel.displayName = 'LineupPanel';

export default LineupPanel;
