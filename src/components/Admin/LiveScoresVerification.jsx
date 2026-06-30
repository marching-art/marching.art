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
// It mirrors the layout of ScoresSpreadsheet (caption tabs + heatmap) but reads
// the live current-year data instead of the prior-year reference corps.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw, AlertCircle, Download, Radio, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { getCaptionLabel } from '../../utils/captionUtils';

const INDIVIDUAL_CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

// Aggregate tabs. NOTE: "Total" uses the real scraped DCI total (event.scores[].score)
// so it can be eyeballed directly against dci.org. The aggregates are derived from
// the individual captions using the game's scoring formula (visual/music halved).
const AGGREGATE_TABS = [
  { id: 'total', label: 'DCI Total', max: 100 },
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

const LiveScoresVerification = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [events, setEvents] = useState([]); // current-year scraped events
  const [scoredDays, setScoredDays] = useState(new Set()); // competition days with a fantasy recap
  const [activeTab, setActiveTab] = useState('total');
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

  // Build the ordered list of unique corps across all events, ranked by their most
  // recent (highest competition day) DCI total so the strongest corps surface first.
  const corpsList = useMemo(() => {
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
      .sort((a, b) => b[1].latestTotal - a[1].latestTotal)
      .map(([corps]) => corps);
  }, [events]);

  // Cell value for a corps/event under the active tab.
  const getCellValue = (corps, event) => {
    const scoreData = (event.scores || []).find((s) => s.corps === corps);
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

  const totalCorps = corpsList.length;
  const totalScores = useMemo(
    () => events.reduce((sum, e) => sum + (e.scores?.length || 0), 0),
    [events]
  );

  const handleExportCSV = () => {
    const headers = ['Corps', ...events.map((e) => `${formatEventDate(e.date)} (D${e.offSeasonDay ?? '-'})`)];
    const rows = corpsList.map((corps) => {
      const cells = events.map((event) => {
        const v = getCellValue(corps, event);
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
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-6 h-6 text-[#0057B8] animate-spin" />
        <span className="ml-3 text-gray-400 text-sm">Loading live DCI scores…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-red-400">
        <AlertCircle className="w-6 h-6 mr-3" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  const isLiveSeason = seasonData?.status === 'live-season';

  return (
    <div className="space-y-3">
      {/* Summary + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#0057B8]/20 rounded-sm">
            <Radio className="w-4 h-4 text-[#0057B8]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Active DCI Season Scores — {currentYear}
            </h2>
            <p className="text-[11px] text-gray-500">
              {seasonData?.name} · {events.length} events · {totalCorps} corps · {totalScores} score rows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase bg-white/5 text-gray-300 border border-[#333] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/30 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
            {scraping ? 'Scraping…' : 'Scrape DCI Scores Now'}
          </button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-2 bg-[#111] border border-[#333] text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="text-gray-500 uppercase tracking-wider">Status:</span>
          <span className={isLiveSeason ? 'text-green-400 font-bold' : 'text-yellow-400 font-bold'}>
            {seasonData?.status?.toUpperCase() || 'UNKNOWN'}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="text-gray-500 uppercase tracking-wider">Last scraped:</span>
          <span className="text-gray-300 font-data">{seasonData?.lastScrapedDate || 'never'}</span>
        </span>
        {!isLiveSeason && (
          <span className="text-yellow-500/80">
            Not a live season — scraping is a no-op until a live DCI season is active.
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-gray-500 border border-[#333] bg-[#111]">
          No scraped scores found for {currentYear}.{' '}
          {isLiveSeason ? 'Use "Scrape DCI Scores Now" to pull the latest recap.' : ''}
        </div>
      ) : (
        <>
          {/* Caption / aggregate tabs */}
          <div className="flex flex-wrap gap-0.5 p-0.5 bg-[#111] border border-[#333] rounded-sm">
            {AGGREGATE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
                  activeTab === tab.id ? 'bg-[#0057B8] text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="w-px bg-[#333] mx-0.5" />
            {INDIVIDUAL_CAPTIONS.map((caption) => (
              <button
                key={caption}
                onClick={() => setActiveTab(caption)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
                  activeTab === caption ? 'bg-amber-400 text-neutral-900 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={getCaptionLabel(caption)}
              >
                {caption}
              </button>
            ))}
          </div>

          {/* Spreadsheet */}
          <div className="overflow-x-auto border border-[#333] rounded">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-[#1a1a1a] border-b border-[#333]">
                  <th className="sticky left-0 z-10 bg-[#1a1a1a] px-2 py-1.5 text-left font-mono text-[#0057B8] border-r border-[#333] w-[110px]">
                    {INDIVIDUAL_CAPTIONS.includes(activeTab)
                      ? getCaptionLabel(activeTab)
                      : AGGREGATE_TABS.find((t) => t.id === activeTab)?.label}
                  </th>
                  {events.map((event, idx) => {
                    const day = event.offSeasonDay;
                    const isScored = typeof day === 'number' && scoredDays.has(day);
                    return (
                      <th
                        key={`${event.eventName}-${event.date}-${idx}`}
                        className="px-0.5 py-1.5 text-center font-mono text-gray-400 w-[44px] border-r border-[#222]"
                        title={`${event.eventName}\n${event.location || ''}\nDay ${day ?? 'pre-season'}\nFantasy recap: ${isScored ? 'scored' : 'not yet scored'}`}
                      >
                        <div className="text-[10px] text-gray-300 leading-none">{formatEventDate(event.date)}</div>
                        <div className="text-[8px] text-gray-500 leading-tight mt-0.5">
                          {day != null ? `D${day}` : 'pre'}
                        </div>
                        <div className="flex justify-center mt-0.5">
                          {day == null ? (
                            <span className="w-2 h-2" />
                          ) : isScored ? (
                            <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                          ) : (
                            <XCircle className="w-2.5 h-2.5 text-gray-600" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {corpsList.map((corps, rowIdx) => (
                  <tr
                    key={corps}
                    className={`border-b border-[#222] ${rowIdx % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[#111]'} hover:bg-[#1a1a1a]`}
                  >
                    <td className="sticky left-0 z-10 bg-[#111] px-2 py-1.5 border-r border-[#333] w-[110px] max-w-[110px]">
                      <div className="font-medium text-white text-[11px] truncate leading-tight" title={corps}>
                        {corps}
                      </div>
                    </td>
                    {events.map((event, idx) => {
                      const value = getCellValue(corps, event);
                      const maxScore = getMaxScore();
                      const bgColor = getCellBgColor(value, maxScore);
                      return (
                        <td
                          key={`${corps}-${idx}`}
                          className={`px-0 py-1.5 text-center font-mono text-[11px] w-[44px] border-r border-[#1a1a1a] ${bgColor}`}
                        >
                          {value !== null ? (
                            <span className={value >= maxScore * 0.85 ? 'text-green-400' : 'text-gray-300'}>
                              {value.toFixed(3)}
                            </span>
                          ) : (
                            <span className="text-gray-700">-</span>
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
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-gray-500">
            <span className="font-mono">Day badge:</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5 text-green-500" /> recap scored</span>
            <span className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5 text-gray-600" /> not yet scored</span>
            <span className="ml-2 font-mono">Heatmap:</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-900/30" /> 90%+</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-900/20" /> 80%+</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-900/20" /> 70%+</span>
            <span className="flex items-center gap-0.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-900/20" /> &lt;50%</span>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveScoresVerification;
