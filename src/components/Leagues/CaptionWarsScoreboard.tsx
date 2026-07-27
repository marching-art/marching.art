// The three category verdicts that decided a Caption Wars week.
//
// Read off the stored block (functions/src/helpers/captionWars.js), never
// recomputed here: a commissioner's correction, or a week resolved before the
// format existed, must not make this card disagree with the result printed
// beside it.
//
// Three categories, permanently. The eight lineup captions are never persisted
// per show, because publishing them would let an opponent read a director's
// lineup straight off the recap — see docs/CAPTION_WARS_SPEC.md §7.

import React from 'react';
import { Swords } from 'lucide-react';

import { CAPTION_CATEGORIES, captionsWonBy, type CaptionsBlock } from '../../utils/captionWars';

interface CaptionWarsScoreboardProps {
  captions?: CaptionsBlock;
  homeUid: string;
  awayUid: string;
  homeDisplayName: string;
  awayDisplayName: string;
  /** SoundSport is a ratings-only format — never show it a number. */
  hideScores?: boolean;
}

const CaptionWarsScoreboard = ({
  captions,
  homeUid,
  awayUid,
  homeDisplayName,
  awayDisplayName,
  hideScores = false,
}: CaptionWarsScoreboardProps) => {
  if (!captions) return null;

  const home = captionsWonBy(captions, homeUid);
  const away = captionsWonBy(captions, awayUid);

  const side = (won: boolean, isTie: boolean) =>
    won ? 'text-green-400 font-bold' : isTie ? 'text-secondary' : 'text-muted';

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
        <Swords className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Caption Wars
        </span>
        <span className="ml-auto text-sm font-bold font-data tabular-nums text-white">
          {home.won}–{away.won}
        </span>
      </div>

      <div className="divide-y divide-line-subtle">
        {CAPTION_CATEGORIES.map(({ key, label }) => {
          const result = captions[key];
          const winner = result?.winner;
          const homeWon = winner === homeUid;
          const awayWon = winner === awayUid;
          const undecided = !winner || winner === 'tie';

          return (
            <div key={key} className="px-4 py-2.5 flex items-center gap-3">
              <span
                className={`flex-1 text-right text-sm font-data tabular-nums ${side(homeWon, undecided)}`}
              >
                {hideScores ? (homeWon ? '✓' : '—') : (result?.scores?.[homeUid] ?? 0).toFixed(1)}
              </span>
              <span className="w-24 text-center text-[9px] font-bold uppercase tracking-wider text-muted">
                {label}
              </span>
              <span
                className={`flex-1 text-left text-sm font-data tabular-nums ${side(awayWon, undecided)}`}
              >
                {hideScores ? (awayWon ? '✓' : '—') : (result?.scores?.[awayUid] ?? 0).toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-line bg-surface-sunken flex items-center justify-between text-[10px] text-muted">
        <span className="truncate max-w-[40%]">{homeDisplayName}</span>
        <span>Take two captions, take the week</span>
        <span className="truncate max-w-[40%] text-right">{awayDisplayName}</span>
      </div>
    </div>
  );
};

export default CaptionWarsScoreboard;
