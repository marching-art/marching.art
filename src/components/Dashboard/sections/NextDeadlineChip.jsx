// NextDeadlineChip - always-visible countdown to the next game deadline.
// Scores process nightly at 2 AM ET; caption-change windows (unlimited /
// weekly / championship / lockouts) come from the shared season clock.

import React from 'react';
import { Clock } from 'lucide-react';
import { useSeasonDeadlines } from '../../../hooks/useSeasonClock';
import { formatCountdown, formatEtShort, formatEtDayTime } from '../../../utils/seasonClock';

const NextDeadlineChip = ({ variant = 'chip' }) => {
  const { scoresAt, scoresInMs, trade } = useSeasonDeadlines();

  const tooltipLines = [
    `Scores process nightly at 2:00 AM ET — next: ${formatEtDayTime(scoresAt)}`,
  ];
  let tradeLabel = null;
  if (trade?.status === 'locked') {
    if (trade.phase === 'weekly') {
      // Locked at the Saturday 8 PM ET week boundary — the fresh weekly
      // allotment becomes usable once scores process, so now the reset matters.
      tradeLabel = `Changes reset ${formatEtShort(trade.reopensAt)}`;
      tooltipLines.push(
        'Caption changes are locked until scores process',
        `Weekly lineup-change limit (${trade.tradeLimit}) resets ${formatEtDayTime(trade.reopensAt)}`
      );
    } else {
      tradeLabel = 'Changes locked until scores process';
      tooltipLines.push(
        `Caption changes reopen once scores are processed (~${formatEtDayTime(trade.reopensAt)})`
      );
    }
  } else if (trade?.phase === 'blackout') {
    tradeLabel = `Changes closed until ${formatEtShort(trade.reopensAt)}`;
    tooltipLines.push(
      'No caption changes on Days 43-44',
      `Championship changes (${trade.nextLimit} total) open ${formatEtDayTime(trade.reopensAt)}`
    );
  } else if (trade?.phase === 'championship') {
    tradeLabel = `Championship changes lock ${formatEtShort(trade.locksAt)}`;
    tooltipLines.push(
      `${trade.tradeLimit} caption changes total for Championship Week (Days 45-49)`,
      `Changes lock nightly at ${formatEtDayTime(trade.locksAt)} until scores process`
    );
  } else if (trade?.isUnlimited && trade.unlimitedEndsAt) {
    tradeLabel = `Unlimited changes until ${formatEtShort(trade.unlimitedEndsAt)}`;
    tooltipLines.push(
      `Lineup changes are unlimited until ${formatEtDayTime(trade.unlimitedEndsAt)}`
    );
  } else if (trade?.phase === 'weekly' && trade.locksAt) {
    // While the window is open the upcoming lock is what matters; the reset
    // only becomes relevant once changes actually lock (handled above).
    tradeLabel = `Changes lock ${formatEtShort(trade.locksAt)}`;
    tooltipLines.push(
      `Changes lock ${formatEtDayTime(trade.locksAt)} until scores process`,
      `Weekly lineup-change limit (${trade.tradeLimit}) resets ${formatEtDayTime(trade.resetsAt)}`
    );
  }

  const countdown = (
    <>
      <Clock className="w-3 h-3 text-cyan-400 flex-shrink-0" aria-hidden="true" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
        Scores in{' '}
        <span className="text-cyan-400 font-data tabular-nums">{formatCountdown(scoresInMs)}</span>
      </span>
    </>
  );

  if (variant === 'strip') {
    // Full-width row for small screens, shown under the ControlBar tabs.
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-1 border-t border-[#333] bg-[#111]"
        title={tooltipLines.join('\n')}
      >
        {countdown}
        {tradeLabel && (
          <span className="text-[10px] text-gray-500 whitespace-nowrap truncate">
            • {tradeLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 border border-[#333] bg-[#111] rounded-sm"
      title={tooltipLines.join('\n')}
    >
      {countdown}
      {tradeLabel && (
        <span className="text-[10px] text-gray-500 whitespace-nowrap hidden xl:inline">
          • {tradeLabel}
        </span>
      )}
    </div>
  );
};

export default NextDeadlineChip;
