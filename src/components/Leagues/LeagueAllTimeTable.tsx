// LeagueAllTimeTable — the league across every season it has played.
//
// This is the dynasty view. A league's live standings reset every rollover, by
// design: a table blending four seasons of records is not a table of anything.
// But a league that has run for four seasons IS a thing, and nothing anywhere
// said who had been good at it — only who was winning right now.
//
// Titles rank it, because that is what a league argues about. Everything else
// separates the untitled.
//
// Derived from the same matchup weeks as the Record Book and the career cards
// (utils/leagueCareer.ts). No new documents, no backfill.

import React, { useMemo, useState } from 'react';
import { ChevronDown, Crown, Landmark } from 'lucide-react';

import { computeAllTimeTable, formatRecord, type CareerChampion } from '../../utils/leagueCareer';
import type { RecordWeekDoc } from '../../utils/leagueRecords';

interface LeagueAllTimeTableProps {
  matchupDocs?: RecordWeekDoc[];
  corpsClasses: string[];
  champions?: CareerChampion[];
  /**
   * Current roster. Given, the table shows only directors still here; omitted,
   * it shows everyone who ever played. Members is the right default beside a
   * live league — a table naming people who left reads as a bug.
   */
  members?: string[] | null;
  getDisplayName: (uid: string) => string;
  viewerUid?: string;
}

/** Rows shown before the fold. */
const ROWS_SHOWN = 8;

const LeagueAllTimeTable = ({
  matchupDocs = [],
  corpsClasses,
  champions = [],
  members = null,
  getDisplayName,
  viewerUid,
}: LeagueAllTimeTableProps) => {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () => computeAllTimeTable(matchupDocs, corpsClasses, champions, members),
    [matchupDocs, corpsClasses, champions, members]
  );

  // A league in its first season has an all-time table identical to its
  // standings, which is noise rather than history.
  const seasonsCovered = useMemo(
    () => new Set(rows.flatMap((row) => row.seasons.map((s) => s.seasonUid ?? 'live'))).size,
    [rows]
  );
  if (rows.length === 0 || seasonsCovered < 2) return null;

  const visible = expanded ? rows : rows.slice(0, ROWS_SHOWN);

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-brand" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            All Time
          </span>
        </div>
        <span className="text-[10px] font-data tabular-nums text-muted">
          {seasonsCovered} seasons
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-surface-sunken">
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted w-10">
                RK
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                Director
              </th>
              <th
                className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted w-12"
                title="League titles"
              >
                <Crown className="w-3 h-3 mx-auto" />
              </th>
              <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted w-20">
                Record
              </th>
              <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted w-14">
                Win %
              </th>
              <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted w-12">
                SNS
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isViewer = row.uid === viewerUid;
              return (
                <tr
                  key={row.uid}
                  className={`border-b border-line-subtle ${
                    isViewer ? 'bg-purple-500/10' : row.titles > 0 ? 'bg-brand/5' : ''
                  }`}
                >
                  <td className="py-2 px-3">
                    <span className="text-xs font-bold font-data tabular-nums text-muted">
                      {row.displayRank}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-sm font-bold truncate ${
                        isViewer ? 'text-purple-400' : 'text-white'
                      }`}
                    >
                      {isViewer ? 'You' : getDisplayName(row.uid)}
                    </span>
                  </td>
                  <td className="text-center py-2 px-2">
                    {row.titles > 0 ? (
                      <span className="text-xs font-bold font-data tabular-nums text-brand">
                        {row.titles}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="text-center py-2 px-2">
                    <span className="text-xs font-bold font-data tabular-nums text-white">
                      {formatRecord(row)}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2">
                    <span className="text-xs font-data tabular-nums text-muted">
                      {Math.round(row.winPercentage * 100)}%
                    </span>
                  </td>
                  <td className="text-right py-2 px-3">
                    <span className="text-xs font-data tabular-nums text-muted">
                      {row.seasonsPlayed}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > ROWS_SHOWN && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full py-2.5 min-h-touch border-t border-line text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white transition-colors flex items-center justify-center gap-1.5"
        >
          {expanded ? 'Show fewer' : `All ${rows.length} directors`}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      <div className="px-4 py-2 border-t border-line bg-surface-sunken">
        <p className="text-[10px] text-muted">
          Titles first, then win percentage. Records carry across every season this league has
          played; the standings above reset each rollover.
        </p>
      </div>
    </div>
  );
};

export default LeagueAllTimeTable;
