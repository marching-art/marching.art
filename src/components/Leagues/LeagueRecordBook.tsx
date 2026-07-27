// LeagueRecordBook - what happened along the way.
//
// The Hall of Champions covers who won each season. This covers everything
// else: the biggest week anyone has posted, the worst hiding anyone has taken,
// the game that came down to a tenth, the longest run of form. All of it was
// already sitting in `matchups/week-N` and nobody could see any of it.
//
// Derived, not stored (utils/leagueRecords.ts) — no new documents, no backfill,
// nothing to keep in sync.

import React, { useMemo } from 'react';
import { Flame, Gauge, Music, Swords, Timer, TrendingUp, Zap } from 'lucide-react';

import { computeLeagueRecords, type RecordWeekDoc } from '../../utils/leagueRecords';
import { CORPS_CLASS_SHORT_LABELS } from '../../utils/corps';

interface LeagueRecordBookProps {
  matchupDocs?: RecordWeekDoc[];
  corpsClasses: string[];
  getDisplayName: (uid: string) => string;
  viewerUid?: string;
}

const RecordLine = ({
  icon: Icon,
  label,
  headline,
  detail,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  headline: string;
  detail: string;
  highlight: boolean;
}) => (
  <div className="px-4 py-3 flex items-center gap-3">
    <div
      className={`w-7 h-7 flex-shrink-0 flex items-center justify-center border ${
        highlight ? 'bg-purple-500/10 border-purple-500/40' : 'bg-surface-raised border-line'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-purple-400' : 'text-muted'}`} />
    </div>
    <div className="min-w-0 flex-1">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
        {label}
      </span>
      <span
        className={`block text-sm font-bold truncate ${highlight ? 'text-purple-400' : 'text-white'}`}
      >
        {headline}
      </span>
      <span className="block text-[10px] text-muted truncate">{detail}</span>
    </div>
  </div>
);

const LeagueRecordBook = ({
  matchupDocs = [],
  corpsClasses,
  getDisplayName,
  viewerUid,
}: LeagueRecordBookProps) => {
  const records = useMemo(
    () => computeLeagueRecords(matchupDocs, corpsClasses),
    [matchupDocs, corpsClasses]
  );

  // A league with nothing resolved has no records, and an empty record book is
  // worse than no record book.
  if (records.weeksCounted === 0) return null;

  const cls = (corpsClass: string) => CORPS_CLASS_SHORT_LABELS[corpsClass] || corpsClass;
  const name = (uid: string) => (uid === viewerUid ? 'You' : getDisplayName(uid));

  const lines: Array<React.ComponentProps<typeof RecordLine> & { key: string }> = [];

  if (records.highestWeek) {
    const r = records.highestWeek;
    lines.push({
      key: 'highest',
      icon: TrendingUp,
      label: 'Highest week',
      headline: `${name(r.uid)} — ${r.score.toFixed(1)}`,
      detail: `Week ${r.week} · ${cls(r.corpsClass)}`,
      highlight: r.uid === viewerUid,
    });
  }

  if (records.bestClassFinish) {
    const r = records.bestClassFinish;
    lines.push({
      key: 'class',
      icon: Gauge,
      label: 'Best against their own class',
      headline: `${name(r.uid)} — top ${Math.max(1, Math.round(100 - r.percentile))}%`,
      detail: `Week ${r.week} · ${cls(r.corpsClass)} · ${r.score.toFixed(1)}`,
      highlight: r.uid === viewerUid,
    });
  }

  if (records.biggestBlowout) {
    const r = records.biggestBlowout;
    lines.push({
      key: 'blowout',
      icon: Swords,
      label: 'Biggest blowout',
      headline: `${name(r.winnerUid)} by ${r.margin.toFixed(1)}`,
      detail: `over ${name(r.loserUid)} · Week ${r.week} · ${cls(r.corpsClass)}`,
      highlight: r.winnerUid === viewerUid || r.loserUid === viewerUid,
    });
  }

  if (records.closestCall) {
    const r = records.closestCall;
    lines.push({
      key: 'closest',
      icon: Timer,
      label: 'Closest call',
      headline: `${name(r.winnerUid)} by ${r.margin.toFixed(1)}`,
      detail: `over ${name(r.loserUid)} · Week ${r.week} · ${cls(r.corpsClass)}`,
      highlight: r.winnerUid === viewerUid || r.loserUid === viewerUid,
    });
  }

  // Caption Wars only — a league on the default format has neither, and both
  // read as nothing rather than as a zero.
  if (records.mostSweeps) {
    const r = records.mostSweeps;
    lines.push({
      key: 'sweeps',
      icon: Zap,
      label: 'Most caption sweeps',
      headline: `${name(r.uid)} — ${r.count}`,
      detail: `${r.count === 1 ? 'week' : 'weeks'} taking all three captions`,
      highlight: r.uid === viewerUid,
    });
  }

  if (records.longestCaptionStreak) {
    const r = records.longestCaptionStreak;
    lines.push({
      key: 'caption-streak',
      icon: Music,
      label: `Longest run in ${r.label}`,
      headline: `${name(r.uid)} — ${r.length} straight`,
      detail: `through week ${r.endedWeek}`,
      highlight: r.uid === viewerUid,
    });
  }

  if (records.longestWinStreak) {
    const r = records.longestWinStreak;
    lines.push({
      key: 'streak',
      icon: Flame,
      label: 'Longest win streak',
      headline: `${name(r.uid)} — ${r.length} straight`,
      detail: `through week ${r.endedWeek}`,
      highlight: r.uid === viewerUid,
    });
  }

  if (lines.length === 0) return null;

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-purple-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Record Book
          </span>
        </div>
        <span className="text-[10px] font-data tabular-nums text-muted">
          {records.seasonsCounted > 1
            ? `${records.seasonsCounted} seasons`
            : `${records.weeksCounted} ${records.weeksCounted === 1 ? 'week' : 'weeks'}`}
        </span>
      </div>

      <div className="divide-y divide-line-subtle">
        {lines.map(({ key, ...line }) => (
          <RecordLine key={key} {...line} />
        ))}
      </div>
    </div>
  );
};

export default LeagueRecordBook;
