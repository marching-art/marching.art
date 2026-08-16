// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// FantasySeasonLedger — the fantasy-class counterpart to PodiumSeasonLedger: a
// director's own corps told as a running recap, show to show, with the FULL
// 8-caption breakdown. This is the community insight that motivated it — the
// public Scores tab keeps fantasy classes at GE/VIS/MUS so lineups can't be
// harvested, but this module is private to the director and lives on the
// dashboard, so the individual captions can be shown here for self-analysis.
//
// Per-caption fantasy values aren't in the public recap (by design), so the
// nightly scorer writes each director's own breakdown to a private, owner-only
// store (captionLedger/{seasonUid}/days). This reads that store, then derives
// each outing's placement WITHIN ITS CLASS from the public class recaps the
// dashboard already loaded (passed in as `publicShows`). Presentation is the
// shared SeasonLedgerView, so it reads as one system with the Podium ledger.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, paths } from '../../api';
import { formatEventName } from '../../utils/season';
import { CLASS_LABELS } from '../../utils/scoresUtils';
import { CAPTION_IDS } from '../../data/captions';
import SeasonLedgerView from './SeasonLedgerView';
import { fmtScore, summarizeLedger } from './seasonLedgerUtils';

/**
 * Placement lookup by `${day}|${eventName}`. The public class recaps carry
 * every corps' total for a show, so the director's place and field size are
 * derived from those — never stored privately (a stored rank would drift when
 * the field re-ranks). Scores arrive newest-first and pre-sorted by score.
 */
function buildPlaceIndex(publicShows) {
  const index = new Map();
  for (const show of publicShows || []) {
    const ranked = [...(show.scores || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    index.set(`${show.offSeasonDay}|${show.eventName}`, ranked);
  }
  return index;
}

/**
 * Turn the private caption-ledger day docs into the normalized ledger for one
 * corps class, oldest first. Placement is joined in from the public recaps.
 */
function buildLedger(days, corpsClass, uid, userCorpsName, placeIndex) {
  const matchesMe = (row) =>
    (uid && row.uid === uid) ||
    (userCorpsName && (row.corpsName || row.corps)?.toLowerCase() === userCorpsName.toLowerCase());

  const entries = [];
  for (const { day, outings } of days) {
    for (const outing of outings || []) {
      if (outing.corpsClass !== corpsClass) continue;
      const ranked = placeIndex.get(`${day}|${outing.eventName}`);
      let place = null;
      let fieldSize = null;
      if (ranked && ranked.length > 0) {
        const idx = ranked.findIndex(matchesMe);
        if (idx >= 0) place = idx + 1;
        fieldSize = ranked.length;
      }
      entries.push({
        key: `${day}-${outing.eventName || entries.length}`,
        day,
        eventName: outing.eventName,
        location: outing.location || null,
        captions: outing.captions || {},
        geScore: outing.geScore,
        visualScore: outing.visualScore,
        musicScore: outing.musicScore,
        totalScore: outing.totalScore,
        place,
        fieldSize,
      });
    }
  }
  entries.sort((a, b) => a.day - b.day);
  return entries;
}

/** Monospace ledger for the Share button — pastes cleanly into Discord. */
function formatLedgerAsText(ledger, summary, corpsName, corpsClass, seasonName) {
  const lines = [
    `${corpsName || 'My Corps'} — ${CLASS_LABELS[corpsClass] || corpsClass} Recap Ledger${
      seasonName ? ` · ${seasonName}` : ''
    }`,
    `${summary.outings} outing${summary.outings === 1 ? '' : 's'} · best ${fmtScore(
      summary.best.totalScore
    )} · avg ${fmtScore(summary.average)}`,
    '',
  ];
  for (const entry of ledger) {
    const name = formatEventName(entry.eventName) || `Day ${entry.day}`;
    const placeStr = entry.place ? `${entry.place}/${entry.fieldSize}` : '—';
    const caps = CAPTION_IDS.map((c) => `${c} ${fmtScore(entry.captions?.[c])}`).join(' · ');
    lines.push(
      `D${String(entry.day).padStart(2)} ${name.padEnd(24).slice(0, 24)} ${fmtScore(
        entry.totalScore
      ).padStart(7)}  ${placeStr}`
    );
    lines.push(`     ${caps}`);
  }
  lines.push('');
  lines.push(`marching.art${seasonName ? ` · ${seasonName}` : ''} — private ledger`);
  return '```\n' + lines.join('\n') + '\n```';
}

/**
 * @param {{
 *   seasonUid?: string|null,
 *   seasonName?: string|null,
 *   uid?: string|null,
 *   corpsClass?: string,
 *   userCorpsName?: string|null,
 *   publicShows?: Array<any>,  // class-filtered NormalizedShow[] for placements
 *   compact?: boolean,
 * }} props
 */
export default function FantasySeasonLedger({
  seasonUid,
  seasonName,
  uid,
  corpsClass,
  userCorpsName,
  publicShows,
  compact = false,
}) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonUid || !uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, paths.userCaptionLedgerDays(uid, seasonUid)));
        if (cancelled) return;
        const loaded = snapshot.docs
          .map((doc) => ({ day: Number(doc.id), ...doc.data() }))
          .sort((a, b) => a.day - b.day);
        setDays(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid, uid]);

  const placeIndex = useMemo(() => buildPlaceIndex(publicShows), [publicShows]);
  const ledger = useMemo(
    () => buildLedger(days, corpsClass, uid, userCorpsName, placeIndex),
    [days, corpsClass, uid, userCorpsName, placeIndex]
  );
  const summary = useMemo(() => summarizeLedger(ledger, CAPTION_IDS), [ledger]);

  return (
    <SeasonLedgerView
      loading={loading}
      ledger={ledger}
      summary={summary}
      captions={CAPTION_IDS}
      subtitle={`${userCorpsName || 'Your corps'} · show to show`}
      emptyText="No scored outings yet — your caption ledger fills in one line per show as your corps competes. The first entry posts after your next scored show."
      legendText={
        <>
          Your caption bests in <span className="text-brand font-bold">gold</span> · place is within
          class · private to you
        </>
      }
      formatEventName={formatEventName}
      getShareText={
        summary
          ? () => formatLedgerAsText(ledger, summary, userCorpsName, corpsClass, seasonName)
          : undefined
      }
      compact={compact}
    />
  );
}
