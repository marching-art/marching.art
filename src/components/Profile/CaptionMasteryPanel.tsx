// Caption Mastery — lifetime per-caption craft, banked by the nightly scoring
// run into the server-only captionStats counters (WS5.5). Part of the
// progression hierarchy's LEGACY axis. Renders nothing until points exist,
// so brand-new profiles aren't shown an empty grid.

import React, { memo } from 'react';
import { Target } from 'lucide-react';
import type { UserProfile } from '../../types';
import { CAPTION_CATEGORIES } from '../../utils/captionPricing';
import {
  MASTERY_CAPTIONS,
  MASTERY_TIER_STYLES,
  getCaptionMastery,
  hasCaptionStats,
} from '../../utils/captionMastery';

const CaptionMasteryPanel = memo(({ profile }: { profile: UserProfile }) => {
  if (!hasCaptionStats(profile.captionStats)) return null;

  return (
    <div className="px-3 pb-3">
      <div className="bg-[#1a1a1a] border border-[#333]">
        <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-[#0057B8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Caption Mastery
          </span>
        </div>
        <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {MASTERY_CAPTIONS.map((caption) => {
            const mastery = getCaptionMastery(profile.captionStats?.[caption]);
            const style = mastery.tier
              ? MASTERY_TIER_STYLES[mastery.tier.id as keyof typeof MASTERY_TIER_STYLES]
              : null;
            return (
              <div key={caption} className="bg-[#111] border border-[#333] px-2.5 py-2">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className="text-[10px] font-bold text-white"
                    title={
                      CAPTION_CATEGORIES[caption as keyof typeof CAPTION_CATEGORIES]?.name ||
                      caption
                    }
                  >
                    {caption}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      style ? style.text : 'text-gray-600'
                    }`}
                  >
                    {mastery.tier ? mastery.tier.name : '—'}
                  </span>
                </div>
                <div className="h-1 bg-[#222] rounded-none overflow-hidden mb-1">
                  <div
                    className={`h-full ${style ? style.bar : 'bg-[#0057B8]'}`}
                    style={{ width: `${Math.round(mastery.progress * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-500 font-data tabular-nums">
                    {Math.round(mastery.points).toLocaleString()}
                  </span>
                  {mastery.next && (
                    <span className="text-[9px] text-gray-600 font-data tabular-nums">
                      {mastery.next.min.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

CaptionMasteryPanel.displayName = 'CaptionMasteryPanel';

export default CaptionMasteryPanel;
