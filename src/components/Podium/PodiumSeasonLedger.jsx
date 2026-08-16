// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumSeasonLedger — a director's running stat ledger for their OWN Podium
// corps, show to show (community request). Where PodiumRecapSheet is the whole
// field's box score for one night, this is one corps' season told as a recap:
// every scored outing on one line, full caption breakdown, with the season's
// personal bests bolded in gold like box-toppers and the total movement between
// outings shown as a trend.
//
// Reads the same public `podium-recaps/{seasonUid}/days` collection the recap
// sheet does, then keeps only this corps' row from each show. Presentation is
// the shared SeasonLedgerView (also used by the fantasy ledger); this file only
// turns Podium recaps into the normalized ledger it renders. Surfaced two ways
// (both from the community ask): as a panel on the Podium Dashboard, and as the
// modal that opens when a director clicks SEASON SCORE on the Season Scorecard.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../api';
import { formatEventName } from '../../utils/season';
import { CLASS_LABELS } from '../../utils/scoresUtils';
import SeasonLedgerView from '../scores/SeasonLedgerView';
import { fmtScore, summarizeLedger } from '../scores/seasonLedgerUtils';
import { PODIUM_CAPTIONS } from './podiumConstants';

// New recaps carry `shows: [...]`; legacy per-day recaps carried a flat
// `results`. Normalize both to the shows shape (mirrors PodiumRecapSheet).
function showsOf(recap) {
  if (Array.isArray(recap?.shows)) return recap.shows;
  if (Array.isArray(recap?.results)) {
    return [{ eventName: null, location: null, results: recap.results }];
  }
  return [];
}

/**
 * Reduce every day's recap to THIS corps' outings, oldest first. Each entry is
 * one scored show: its caption line, subtotals, total, and the corps' placement
 * WITHIN ITS OWN DIVISION that night (the number that matters to it — a
 * division crowns its own winner, §5.7), not its rank in the mixed field.
 */
function buildLedger(days, uid, userCorpsName) {
  const isMine = (r) =>
    (uid && r.uid === uid) ||
    (userCorpsName && r.corpsName?.toLowerCase() === userCorpsName.toLowerCase());

  const entries = [];
  for (const { day, recap } of days) {
    for (const show of showsOf(recap)) {
      const results = show.results || [];
      const mine = results.find(isMine);
      if (!mine) continue;
      const division = mine.division || 'aClass';
      const divisionField = results
        .filter((r) => (r.division || 'aClass') === division)
        .sort((a, b) => b.totalScore - a.totalScore);
      const place = divisionField.findIndex(isMine) + 1;
      entries.push({
        key: `${day}-${show.eventName || entries.length}`,
        day,
        eventName: show.eventName,
        location: show.location || null,
        division,
        captions: mine.captions || {},
        geScore: mine.geScore,
        visualScore: mine.visualScore,
        musicScore: mine.musicScore,
        totalScore: mine.totalScore,
        place: place > 0 ? place : null,
        fieldSize: divisionField.length,
        medal: mine.medal || null,
      });
    }
  }
  return entries;
}

/** Monospace ledger for the Share button — pastes cleanly into Discord. */
function formatLedgerAsText(ledger, summary, corpsName, seasonName) {
  const lines = [
    `${corpsName || 'My Corps'} — Season Recap Ledger${seasonName ? ` · ${seasonName}` : ''}`,
    `${summary.outings} outing${summary.outings === 1 ? '' : 's'} · best ${fmtScore(
      summary.best.totalScore
    )} · avg ${fmtScore(summary.average)}`,
    '',
  ];
  for (const entry of ledger) {
    const name = formatEventName(entry.eventName) || `Day ${entry.day}`;
    const placeStr = entry.place ? `${entry.place}/${entry.fieldSize}` : '—';
    lines.push(
      `D${String(entry.day).padStart(2)} ${name.padEnd(26).slice(0, 26)} ${fmtScore(
        entry.totalScore
      ).padStart(6)}  (GE ${fmtScore(entry.geScore)} · VIS ${fmtScore(
        entry.visualScore
      )} · MUS ${fmtScore(entry.musicScore)}) ${CLASS_LABELS[entry.division] || entry.division} ${placeStr}`
    );
  }
  lines.push('');
  lines.push(`marching.art${seasonName ? ` · ${seasonName}` : ''} — Podium Class`);
  return '```\n' + lines.join('\n') + '\n```';
}

/**
 * @param {{
 *   seasonUid?: string|null,
 *   seasonName?: string|null,
 *   uid?: string|null,
 *   userCorpsName?: string|null,
 *   compact?: boolean,   // drop the card chrome when hosted inside a modal
 * }} props
 */
export default function PodiumSeasonLedger({
  seasonUid,
  seasonName,
  uid,
  userCorpsName,
  compact = false,
}) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonUid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'podium-recaps', seasonUid, 'days'));
        if (cancelled) return;
        const loaded = snapshot.docs
          .map((doc) => ({ day: Number(doc.id), recap: doc.data() }))
          .sort((a, b) => a.day - b.day);
        setDays(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  const ledger = useMemo(() => buildLedger(days, uid, userCorpsName), [days, uid, userCorpsName]);
  const summary = useMemo(() => summarizeLedger(ledger, PODIUM_CAPTIONS), [ledger]);

  return (
    <SeasonLedgerView
      loading={loading}
      ledger={ledger}
      summary={summary}
      captions={PODIUM_CAPTIONS}
      subtitle={`${userCorpsName || 'Your corps'} · show to show`}
      emptyText="No scored outings yet — your ledger fills in one line at a time as your corps competes. The first entry posts after your next scored show."
      legendText={
        <>
          Your caption bests in <span className="text-brand font-bold">gold</span> · place is within
          division
        </>
      }
      formatEventName={formatEventName}
      getShareText={
        summary ? () => formatLedgerAsText(ledger, summary, userCorpsName, seasonName) : undefined
      }
      showMedals
      compact={compact}
    />
  );
}
