// src/components/Admin/LiveScoresVerification.jsx
// =============================================================================
// LIVE SEASON SCORE VERIFICATION
// =============================================================================
// During a live season the selectable corps are the PRIOR year's corps, but the
// game scores against the CURRENT DCI season's scraped scores. This panel surfaces
// that current-year scraped data (historical_scores/{currentYear}) so an admin can:
//   - verify the daily scrape is pulling the correct scores from dci.org
//   - confirm each event maps to the correct competition day (offSeasonDay)
//   - see which competition days have been scored into fantasy_recaps
//   - manually trigger a scrape on demand
//
// It uses the SAME spreadsheet format as ScoresSpreadsheet (caption/aggregate
// tabs, horizontal scroll, sticky corps column, heatmap, cream/gold theme), but
// reads the live current-year scraped data instead of the prior-year reference
// corps. Columns are scraped events (left = earliest competition day); the
// event -> competition-day mapping and recap-scored status live in the column
// header tooltips.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, RefreshCw, AlertCircle, Download, ChevronLeft, ChevronRight, Radio
} from 'lucide-react';
import { db } from '../../api';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { getCaptionLabel } from '../../utils/captionUtils';

const INDIVIDUAL_CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

// Aggregate tabs. NOTE: "Total Score" uses the real scraped DCI total
// (event.scores[].score) so it can be eyeballed directly against dci.org. The
// other aggregates are derived from the individual captions using the game's
// scoring formula (visual/music halved), matching ScoresSpreadsheet.
const AGGREGATE_TABS = [
  { id: 'total', label: 'Total Score', max: 100 },
  { id: 'ge_total', label: 'Total GE', max: 40, calculate: (c) => (c.GE1 || 0) + (c.GE2 || 0) },
  { id: 'music_total', label: 'Total Music', max: 30, calculate: (c) => ((c.B || 0) + (c.MA || 0) + (c.P || 0)) / 2 },
  { id: 'visual_total', label: 'Total Visual', max: 30, calculate: (c) => ((c.VP || 0) + (c.VA || 0) + (c.CG || 0)) / 2 },
];

// Heatmap cell background based on score as a fraction of the max possible.
const getCellBgColor = (value, maxPossible) => {
  if (!value || value === 0) return '';
  const percentage = value / maxPossible;
  if (percentage >= 0.9) return 'bg-green-900/30';
  if (percentage >= 0.8) return 'bg-green-900/20';
  if (percentage >= 0.7) return 'bg-yellow-900/20';
  if (percentage < 0.5) return 'bg-red-900/20';
  return '';
};

const formatEventDate = (isoDate) => {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  const monthStr = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${d.getUTCDate()}-${monthStr}`;
};

const VISIBLE_COLUMNS = 36;

const LiveScoresVerification = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [events, setEvents] = useState([]); // current-year scraped events
  const [scoredDays, setScoredDays] = useState(new Set()); // competition days with a fantasy recap
  const [activeTab, setActiveTab] = useState('total');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scraping, setScraping] = useState(false);

  const currentYear = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Current season settings
      const seasonDoc = await getDoc(doc(db, 'game-settings/season'));
      if (!seasonDoc.exists()) throw new Error('No active season found');
      const season = seasonDoc.data();
      setSeasonData(season);

      // 2. Current DCI year scraped scores
      const scoresDoc = await getDoc(doc(db, `historical_scores/${currentYear}`));
      const yearEvents = scoresDoc.exists() ? (scoresDoc.data().data || []) : [];
      // Sort by competition day, then by date. Pre-season events (null day) go last.
      const sorted = [...yearEvents].sort((a, b) => {
        const dayA = a.offSeasonDay ?? Infinity;
        const dayB = b.offSeasonDay ?? Infinity;
        if (dayA !== dayB) return dayA - dayB;
        return new Date(a.date || 0) - new Date(b.date || 0);
      });
      setEvents(sorted);

      // 3. Which competition days have been scored into fantasy_recaps
      if (season.seasonUid) {
        try {
          const daysSnap = await getDocs(collection(db, `fantasy_recaps/${season.seasonUid}/days`));
          const days = new Set();
          daysSnap.forEach((d) => {
            const data = d.data();
            if (typeof data.offSeasonDay === 'number') days.add(data.offSeasonDay);
          });
          setScoredDays(days);
        } catch (recapErr) {
          // Non-fatal: recap subcollection may not exist yet early in a season
          console.warn('Could not load fantasy recaps:', recapErr);
          setScoredDays(new Set());
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching live scores data:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const functions = getFunctions();
      const scrapeLiveScoresNow = httpsCallable(functions, 'scrapeLiveScoresNow');
      const result = await scrapeLiveScoresNow();
      const data = result.data || {};
      if (data.success) {
        toast.success(data.message || 'Scrape triggered.');
        // Scores are archived asynchronously via pubsub; give it a moment then refresh.
        setTimeout(fetchData, 2500);
      } else {
        toast.error(data.message || 'Scrape did not run.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to scrape DCI scores');
    } finally {
      setScraping(false);
    }
  };

  // Columns = one per competition day (offSeasonDay), merging all events that
  // share a day into a single column. A corps performs in at most one event per
  // day, so scores never collide. Pre-season events (null day, outside the
  // 49-day window) have no competition day, so they group by calendar date.
  const columns = useMemo(() => {
    const groups = new Map(); // key -> column accumulator
    for (const event of events) {
      const day = event.offSeasonDay;
      const dateKey = (event.date || '').slice(0, 10);
      const key = (day != null) ? `day:${day}` : `pre:${dateKey}`;

      let col = groups.get(key);
      if (!col) {
        col = {
          key,
          day: (day != null) ? day : null,
          date: event.date,
          dateLabel: formatEventDate(event.date),
          eventNames: [],
          locations: new Set(),
          scoresByCorps: new Map(), // corps -> scoreData
          scored: (day != null) && scoredDays.has(day),
        };
        groups.set(key, col);
      }
      if (event.eventName && !col.eventNames.includes(event.eventName)) col.eventNames.push(event.eventName);
      if (event.location) col.locations.add(event.location);
      for (const s of (event.scores || [])) {
        if (!s.corps) continue;
        const existing = col.scoresByCorps.get(s.corps);
        // Defensive: if a corps somehow appears twice in one day, keep the higher total.
        if (!existing || (s.score || 0) > (existing.score || 0)) {
          col.scoresByCorps.set(s.corps, s);
        }
      }
    }

    // Sort by competition day ascending; pre-season columns (null day) last, by date.
    return Array.from(groups.values()).sort((a, b) => {
      const dayA = a.day ?? Infinity;
      const dayB = b.day ?? Infinity;
      if (dayA !== dayB) return dayA - dayB;
      return new Date(a.date || 0) - new Date(b.date || 0);
    });
  }, [events, scoredDays]);

  // Rows = unique corps across all events, ranked by their most recent
  // (highest competition day) DCI total so the strongest corps surface first.
  const corpsRows = useMemo(() => {
    const best = new Map(); // corps -> { latestDay, latestTotal }
    for (const event of events) {
      const day = event.offSeasonDay ?? -1;
      for (const s of (event.scores || [])) {
        if (!s.corps) continue;
        const existing = best.get(s.corps);
        if (!existing || day >= existing.latestDay) {
          best.set(s.corps, { latestDay: day, latestTotal: s.score || 0 });
        }
      }
    }
    return Array.from(best.entries())
      .map(([corps, info]) => ({ corps, latestTotal: info.latestTotal }))
      .sort((a, b) => b.latestTotal - a.latestTotal);
  }, [events]);

  // Cell value for a corps in a (day-merged) column under the active tab.
  const getCellValue = (corps, column) => {
    const scoreData = column.scoresByCorps.get(corps);
    if (!scoreData) return null;
    if (activeTab === 'total') {
      return typeof scoreData.score === 'number' && !isNaN(scoreData.score) ? scoreData.score : null;
    }
    if (INDIVIDUAL_CAPTIONS.includes(activeTab)) {
      const v = scoreData.captions?.[activeTab];
      return typeof v === 'number' && v > 0 ? v : null;
    }
    const aggTab = AGGREGATE_TABS.find((t) => t.id === activeTab);
    if (aggTab?.calculate && scoreData.captions) return aggTab.calculate(scoreData.captions);
    return null;
  };

  const getMaxScore = () => {
    if (INDIVIDUAL_CAPTIONS.includes(activeTab)) return 20;
    return AGGREGATE_TABS.find((t) => t.id === activeTab)?.max || 100;
  };

  const visibleColumns = useMemo(
    () => columns.slice(scrollPosition, scrollPosition + VISIBLE_COLUMNS),
    [columns, scrollPosition]
  );
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition + VISIBLE_COLUMNS < columns.length;
  const handleScrollLeft = () => setScrollPosition(Math.max(0, scrollPosition - 18));
  const handleScrollRight = () =>
    setScrollPosition(Math.min(Math.max(0, columns.length - VISIBLE_COLUMNS), scrollPosition + 18));

  const activeLabel = INDIVIDUAL_CAPTIONS.includes(activeTab)
    ? getCaptionLabel(activeTab)
    : AGGREGATE_TABS.find((t) => t.id === activeTab)?.label || activeTab;

  const handleExportCSV = () => {
    const headers = ['Corps', ...columns.map((c) => `${c.dateLabel} (D${c.day ?? '-'})`)];
    const rows = corpsRows.map(({ corps }) => {
      const cells = columns.map((c) => {
        const v = getCellValue(corps, c);
        return v !== null ? v.toFixed(3) : '';
      });
      return [corps, ...cells];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-dci-scores-${currentYear}-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-yellow-500 animate-spin" />
        <span className="ml-3 text-gray-300">Loading live DCI scores…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertCircle className="w-8 h-8 mr-3" />
        <span>{error}</span>
      </div>
    );
  }

  const isLiveSeason = seasonData?.status === 'live-season';
  const totalScores = events.reduce((sum, e) => sum + (e.scores?.length || 0), 0);

  return (
    <div className="space-y-2">
      {/* Header (mirrors ScoresSpreadsheet) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-yellow-500/20 rounded-sm">
            <Table className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Live DCI Scores — {currentYear}</h2>
            <p className="text-xs text-gray-500">
              {seasonData?.name} • {corpsRows.length} corps • {events.length} events across {columns.length} days • {totalScores} score rows
              {seasonData?.lastScrapedDate ? ` • last scraped ${seasonData.lastScrapedDate}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={events.length === 0}
            className="btn-outline flex items-center gap-1.5 text-xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm bg-amber-400 text-neutral-900 font-bold hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
            {scraping ? 'Scraping…' : 'Scrape DCI Scores Now'}
          </button>
        </div>
      </div>

      {!isLiveSeason && (
        <div className="text-[11px] text-yellow-500/80 px-1">
          Status: {seasonData?.status?.toUpperCase() || 'UNKNOWN'} — scraping is a no-op until a live DCI season is active.
        </div>
      )}

      {events.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-gray-500 border border-white/20 rounded">
          No scraped scores found for {currentYear}.{' '}
          {isLiveSeason ? 'Use "Scrape DCI Scores Now" to pull the latest recap.' : ''}
        </div>
      ) : (
        <>
          {/* Tab Navigation (individual captions, then aggregates) */}
          <div className="flex flex-wrap gap-0.5 p-0.5 bg-charcoal-900/50 rounded-sm">
            {INDIVIDUAL_CAPTIONS.map((caption) => (
              <button
                key={caption}
                onClick={() => setActiveTab(caption)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
                  activeTab === caption
                    ? 'bg-amber-400 text-neutral-900 font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-charcoal-800'
                }`}
              >
                {caption}
              </button>
            ))}
            <div className="w-px bg-white/20 mx-0.5" />
            {AGGREGATE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-400 text-neutral-900 font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-charcoal-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scroll Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleScrollLeft}
              disabled={!canScrollLeft}
              className={`p-1 rounded transition-all ${
                canScrollLeft
                  ? 'bg-charcoal-800 text-gray-300 hover:bg-charcoal-700'
                  : 'bg-charcoal-900/50 text-gray-500/30 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-gray-500 font-mono">
              Showing days {columns.length === 0 ? 0 : scrollPosition + 1}-
              {Math.min(scrollPosition + VISIBLE_COLUMNS, columns.length)} of {columns.length}
            </span>
            <button
              onClick={handleScrollRight}
              disabled={!canScrollRight}
              className={`p-1 rounded transition-all ${
                canScrollRight
                  ? 'bg-charcoal-800 text-gray-300 hover:bg-charcoal-700'
                  : 'bg-charcoal-900/50 text-gray-500/30 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Spreadsheet Table */}
          <div className="overflow-x-auto border border-white/20 rounded">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-charcoal-900/80 border-b border-white/20">
                  <th className="sticky left-0 z-10 bg-charcoal-900 px-1 py-1 text-left font-mono text-yellow-400 border-r border-white/20 w-[90px]">
                    {activeLabel}
                  </th>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className="px-0 py-1.5 text-center font-mono text-gray-400 w-[38px] border-r border-white/10"
                      title={`${col.eventNames.join(' + ')}\n${[...col.locations].join(' • ')}\nDay ${col.day ?? 'pre-season'}\nFantasy recap: ${col.scored ? 'scored' : 'not yet scored'}`}
                    >
                      <div className="text-[10px] text-gray-500/70 leading-none">{col.dateLabel}</div>
                      <div className={`text-[8px] leading-tight mt-0.5 ${col.scored ? 'text-green-400/70' : 'text-gray-500/40'}`}>
                        {col.day != null ? `D${col.day}` : 'pre'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corpsRows.map(({ corps, latestTotal }, rowIdx) => (
                  <tr
                    key={corps}
                    className={`border-b border-white/10 ${
                      rowIdx % 2 === 0 ? 'bg-charcoal-950/30' : 'bg-charcoal-900/20'
                    } hover:bg-charcoal-800/40`}
                  >
                    {/* Corps Name - Sticky */}
                    <td className="sticky left-0 z-10 bg-charcoal-900/95 px-1 py-1.5 border-r border-white/20 w-[90px] max-w-[90px]">
                      <div className="font-medium text-white text-[11px] truncate leading-tight" title={corps}>
                        {corps}
                      </div>
                      <div className="text-[9px] text-gray-500/50 leading-none font-mono">
                        {latestTotal ? latestTotal.toFixed(3) : '—'}
                      </div>
                    </td>

                    {/* Score Cells */}
                    {visibleColumns.map((col) => {
                      const value = getCellValue(corps, col);
                      const maxScore = getMaxScore();
                      const bgColor = getCellBgColor(value, maxScore);
                      return (
                        <td
                          key={`${corps}-${col.key}`}
                          className={`px-0 py-1.5 text-center font-mono text-[11px] w-[38px] border-r border-white/5 ${bgColor}`}
                        >
                          {value !== null ? (
                            <span className={value >= maxScore * 0.85 ? 'text-green-400' : 'text-gray-300'}>
                              {value.toFixed(3)}
                            </span>
                          ) : (
                            <span className="text-gray-500/20">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-gray-500/60">
            <span className="font-mono">Heatmap:</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-900/30" /> 90%+</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-900/20" /> 80-90%</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-900/20" /> 70-80%</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-900/20" /> &lt;50%</span>
            <span className="font-mono ml-2">Column = competition day (same-day events merged);</span>
            <span>D# is the competition day (green = recap scored). Hover a column for event details.</span>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveScoresVerification;
