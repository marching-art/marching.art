// Which side took each caption, on a league running Caption Wars.
//
// Who won, never by how much: this renders on SoundSport matchups too, and
// SoundSport is a ratings-only format that must never show numbers. The
// per-category totals live in the matchup detail, where the breakdown already
// showed them.

import React, { memo } from 'react';

import { CAPTION_CATEGORIES, type CaptionsBlock } from '../../utils/captionWars';

interface CaptionStripProps {
  captions?: CaptionsBlock;
  p1Uid?: string | null;
  p2Uid?: string | null;
}

const CaptionStrip = memo(({ captions, p1Uid, p2Uid }: CaptionStripProps) => (
  <div className="mt-2 flex items-center gap-1">
    {CAPTION_CATEGORIES.map(({ key, short, label }) => {
      const winner = captions?.[key]?.winner;
      const dot = (won: boolean) => `w-1.5 h-1.5 ${won ? 'bg-green-500' : 'bg-line'}`;
      return (
        <div
          key={key}
          title={
            winner && winner !== 'tie'
              ? `${label} — taken`
              : `${label} — nobody could be awarded it`
          }
          className="flex-1 flex items-center gap-1.5 px-1.5 py-1 bg-surface-sunken border border-line-subtle"
        >
          <span className={dot(!!p1Uid && winner === p1Uid)} />
          <span className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted">
            {short}
          </span>
          <span className={dot(!!p2Uid && winner === p2Uid)} />
        </div>
      );
    })}
  </div>
));
CaptionStrip.displayName = 'CaptionStrip';

export default CaptionStrip;
