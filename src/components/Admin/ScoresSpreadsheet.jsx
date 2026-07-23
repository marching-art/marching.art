// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/components/Admin/ScoresSpreadsheet.jsx
// Admin spreadsheet view of reference scores for the current season
// Shows selected corps by point value (25-1) with scores across dates

import React, { useState, useEffect, useMemo } from 'react';
import { Table, RefreshCw, AlertCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSeasonSettings, getDciDataDoc, getHistoricalScoresMap } from '../../api/admin';
import { getCaptionLabel } from '../../utils/captionUtils';
import { CAPTION_IDS } from '../../data/captions';
import { competitionDayToDate } from '../../utils/competitionCalendar';
import { Heading } from '../ui';

// Caption tabs (canonical caption set)
const INDIVIDUAL_CAPTIONS = CAPTION_IDS;

const AGGREGATE_TABS = [
  {
    id: 'total',
    label: 'Total Score',
    calculate: (c) =>
      // GE contributes directly, Visual and Music are divided by 2
      (c.GE1 || 0) +
      (c.GE2 || 0) +
      ((c.VP || 0) + (c.VA || 0) + (c.CG || 0)) / 2 +
      ((c.B || 0) + (c.MA || 0) + (c.P || 0)) / 2,
  },
  { id: 'ge_total', label: 'Total GE', calculate: (c) => (c.GE1 || 0) + (c.GE2 || 0) },
  {
    id: 'music_total',
    label: 'Total Music',
    calculate: (c) => ((c.B || 0) + (c.MA || 0) + (c.P || 0)) / 2,
  },
  {
    id: 'visual_total',
    label: 'Total Visual',
    calculate: (c) => ((c.VP || 0) + (c.VA || 0) + (c.CG || 0)) / 2,
  },
];

/**
 * Format a competition day number as the "D-Mon" label used in the header row.
 * Date math (including the spring-training offset) is delegated to the shared
 * utils/competitionCalendar helper so this view can't drift from the Schedule
 * page and scores views.
 *
 * @param {Date} seasonStartDate - The start date of the fantasy season
 * @param {number} dayNumber - The competition day number (1-49)
 * @param {number} [springTrainingDays=0] - Days of spring training before Day 1
 * @returns {string} The formatted date string (e.g., "4-Jan")
 */
const getFantasyDateFormatted = (seasonStartDate, dayNumber, springTrainingDays = 0) => {
  const date = competitionDayToDate({ startDate: seasonStartDate, springTrainingDays }, dayNumber);
  if (!date) return `Day ${dayNumber}`;
  const monthStr = date.toLocaleString('en-US', { month: 'short' });
  return `${date.getDate()}-${monthStr}`;
};

// Get cell background color based on score value (heatmap)
const getCellBgColor = (value, maxPossible) => {
  if (!value || value === 0) return '';
  const percentage = value / maxPossible;
  if (percentage >= 0.9) return 'bg-green-900/30';
  if (percentage >= 0.8) return 'bg-green-900/20';
  if (percentage >= 0.7) return 'bg-warning/20';
  if (percentage < 0.5) return 'bg-red-900/20';
  return '';
};

const ScoresSpreadsheet = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [corpsValues, setCorpsValues] = useState([]);
  const [historicalData, setHistoricalData] = useState({});
  const [activeTab, setActiveTab] = useState('GE1');
  const [scrollPosition, setScrollPosition] = useState(0);

  // Fetch season data and historical scores
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get current season settings
        const season = await getSeasonSettings();
        if (!season) {
          throw new Error('No active season found');
        }
        setSeasonData(season);

        // 2. Get corps values (selected corps for each point value)
        const corpsData = await getDciDataDoc(season.dataDocId);
        if (!corpsData) {
          throw new Error(`Corps data not found: ${season.dataDocId}`);
        }
        const corps = corpsData.corpsValues || [];

        // Sort by points descending (25 -> 1)
        const sortedCorps = [...corps].sort((a, b) => b.points - a.points);
        setCorpsValues(sortedCorps);

        // 3. Get unique years to fetch
        const yearsToFetch = [...new Set(corps.map((c) => c.sourceYear))];

        // 4. Fetch historical scores for each year
        const historical = await getHistoricalScoresMap(yearsToFetch);
        setHistoricalData(historical);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching scores data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get the fantasy season start date
  const seasonStartDate = useMemo(() => {
    if (!seasonData?.schedule?.startDate) return null;
    return seasonData.schedule.startDate.toDate();
  }, [seasonData]);

  // Days of spring training before competition Day 1 (live seasons: 21;
  // off-seasons: absent -> 0). Competition day dates are offset past this.
  const springTrainingDays = seasonData?.schedule?.springTrainingDays || 0;

  // Get all unique dates/days from historical data, with fantasy dates calculated
  const allDates = useMemo(() => {
    const datesMap = new Map();

    Object.values(historicalData).forEach((yearData) => {
      yearData.forEach((event) => {
        if (event.offSeasonDay && !datesMap.has(event.offSeasonDay)) {
          datesMap.set(event.offSeasonDay, {
            day: event.offSeasonDay,
            // Calculate the formatted fantasy date based on season start date,
            // offset past spring training so live-season dates line up with
            // the actual competition calendar (Schedule page / seasonClock).
            dateLabel: getFantasyDateFormatted(
              seasonStartDate,
              event.offSeasonDay,
              springTrainingDays
            ),
            eventName: event.eventName,
          });
        }
      });
    });

    // Sort by day number
    return Array.from(datesMap.values()).sort((a, b) => a.day - b.day);
  }, [historicalData, seasonStartDate, springTrainingDays]);

  // Get score for a specific corps on a specific day
  const getScore = (corpsName, sourceYear, day, caption) => {
    const yearData = historicalData[sourceYear] || [];
    for (const event of yearData) {
      if (event.offSeasonDay === day) {
        const scoreData = event.scores?.find((s) => s.corps === corpsName);
        if (scoreData && scoreData.captions) {
          return scoreData.captions[caption] || null;
        }
      }
    }
    return null;
  };

  // Get aggregate score for a specific corps on a specific day
  const getAggregateScore = (corpsName, sourceYear, day, calculateFn) => {
    const yearData = historicalData[sourceYear] || [];
    for (const event of yearData) {
      if (event.offSeasonDay === day) {
        const scoreData = event.scores?.find((s) => s.corps === corpsName);
        if (scoreData && scoreData.captions) {
          return calculateFn(scoreData.captions);
        }
      }
    }
    return null;
  };

  // Get maximum possible score based on active tab
  const getMaxScore = () => {
    if (INDIVIDUAL_CAPTIONS.includes(activeTab)) {
      return 20; // Individual captions max at 20
    }
    const aggTab = AGGREGATE_TABS.find((t) => t.id === activeTab);
    if (aggTab) {
      switch (aggTab.id) {
        case 'total':
          return 100; // GE(40) + Visual(30)/2 + Music(30)/2 = 100
        case 'ge_total':
          return 40; // 2 captions * 20
        case 'music_total':
          return 30; // (3 captions * 20) / 2
        case 'visual_total':
          return 30; // (3 captions * 20) / 2
        default:
          return 20;
      }
    }
    return 20;
  };

  // Visible columns based on scroll position
  const VISIBLE_COLUMNS = 36;
  const visibleDates = useMemo(() => {
    return allDates.slice(scrollPosition, scrollPosition + VISIBLE_COLUMNS);
  }, [allDates, scrollPosition]);

  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition + VISIBLE_COLUMNS < allDates.length;

  const handleScrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 18));
  };

  const handleScrollRight = () => {
    setScrollPosition(Math.min(allDates.length - VISIBLE_COLUMNS, scrollPosition + 18));
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Corps Name', 'Points', 'Source Year', ...allDates.map((d) => d.dateLabel)];

    const rows = corpsValues.map((corps) => {
      const scores = allDates.map((dateInfo) => {
        if (INDIVIDUAL_CAPTIONS.includes(activeTab)) {
          const score = getScore(corps.corpsName, corps.sourceYear, dateInfo.day, activeTab);
          return score !== null ? score.toFixed(3) : '';
        } else {
          const aggTab = AGGREGATE_TABS.find((t) => t.id === activeTab);
          if (aggTab) {
            const score = getAggregateScore(
              corps.corpsName,
              corps.sourceYear,
              dateInfo.day,
              aggTab.calculate
            );
            return score !== null ? score.toFixed(3) : '';
          }
        }
        return '';
      });
      return [corps.corpsName, corps.points, corps.sourceYear, ...scores];
    });

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scores-${activeTab}-${seasonData?.name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-secondary animate-spin" />
        <span className="ml-3 text-secondary">Loading scores data...</span>
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

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-surface-raised rounded-none">
            <Table className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <Heading level="title">Scores Reference Spreadsheet</Heading>
            <p className="text-xs text-muted">
              {seasonData?.name} • {corpsValues.length} corps • {allDates.length} days
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn-outline flex items-center gap-1.5 text-xs px-2 py-1"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-0.5 p-0.5 bg-charcoal-900/50 rounded-none">
        {/* Individual Caption Tabs */}
        {INDIVIDUAL_CAPTIONS.map((caption) => (
          <button
            key={caption}
            onClick={() => setActiveTab(caption)}
            className={`px-2 py-1 text-[10px] font-mono rounded-none transition-all ${
              activeTab === caption
                ? 'bg-interactive text-white font-bold'
                : 'text-muted hover:text-white hover:bg-charcoal-800'
            }`}
          >
            {caption}
          </button>
        ))}

        {/* Separator */}
        <div className="w-px bg-white/20 mx-0.5" />

        {/* Aggregate Tabs */}
        {AGGREGATE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1 text-[10px] font-mono rounded-none transition-all ${
              activeTab === tab.id
                ? 'bg-interactive text-white font-bold'
                : 'text-muted hover:text-white hover:bg-charcoal-800'
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
          className={`p-1 rounded-none transition-all ${
            canScrollLeft
              ? 'bg-charcoal-800 text-secondary hover:bg-charcoal-700'
              : 'bg-charcoal-900/50 text-muted/30 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-muted font-mono">
          Showing days {scrollPosition + 1}-
          {Math.min(scrollPosition + VISIBLE_COLUMNS, allDates.length)} of {allDates.length}
        </span>
        <button
          onClick={handleScrollRight}
          disabled={!canScrollRight}
          className={`p-1 rounded-none transition-all ${
            canScrollRight
              ? 'bg-charcoal-800 text-secondary hover:bg-charcoal-700'
              : 'bg-charcoal-900/50 text-muted/30 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto border border-white/20 rounded-none">
        <table className="w-full border-collapse text-[10px]">
          {/* Header Row */}
          <thead>
            <tr className="bg-charcoal-900/80 border-b border-white/20">
              <th className="sticky left-0 z-10 bg-charcoal-900 px-1 py-1 text-left font-mono text-secondary border-r border-white/20 w-[90px]">
                {INDIVIDUAL_CAPTIONS.includes(activeTab)
                  ? getCaptionLabel(activeTab)
                  : AGGREGATE_TABS.find((t) => t.id === activeTab)?.label || activeTab}
              </th>
              <th className="sticky left-[90px] z-10 bg-charcoal-900 px-0.5 py-1 text-center font-mono text-secondary border-r border-white/20 w-6">
                Pts
              </th>
              {visibleDates.map((dateInfo) => (
                <th
                  key={dateInfo.day}
                  className="px-0 py-1.5 text-center font-mono text-muted w-[38px] border-r border-white/10"
                  title={`${dateInfo.eventName} (Day ${dateInfo.day})`}
                >
                  <div className="text-[10px] text-muted/70 leading-none">{dateInfo.dateLabel}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {corpsValues.map((corps, rowIdx) => (
              <tr
                key={`${corps.corpsName}-${corps.sourceYear}`}
                className={`border-b border-white/10 ${
                  rowIdx % 2 === 0 ? 'bg-charcoal-950/30' : 'bg-charcoal-900/20'
                } hover:bg-charcoal-800/40`}
              >
                {/* Corps Name - Sticky */}
                <td className="sticky left-0 z-10 bg-charcoal-900/95 px-1 py-1.5 border-r border-white/20 w-[90px] max-w-[90px]">
                  <div
                    className="font-medium text-white text-[11px] truncate leading-tight"
                    title={`${corps.corpsName} (${corps.sourceYear})`}
                  >
                    {corps.corpsName}
                  </div>
                  <div className="text-[9px] text-muted/50 leading-none">{corps.sourceYear}</div>
                </td>

                {/* Points - Sticky */}
                <td className="sticky left-[90px] z-10 bg-charcoal-900/95 px-0.5 py-1.5 text-center border-r border-white/20 w-6">
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      corps.points >= 20
                        ? 'text-main'
                        : corps.points >= 15
                          ? 'text-secondary'
                          : corps.points >= 10
                            ? 'text-muted'
                            : 'text-muted'
                    }`}
                  >
                    {corps.points}
                  </span>
                </td>

                {/* Score Cells */}
                {visibleDates.map((dateInfo) => {
                  let score = null;
                  if (INDIVIDUAL_CAPTIONS.includes(activeTab)) {
                    score = getScore(corps.corpsName, corps.sourceYear, dateInfo.day, activeTab);
                  } else {
                    const aggTab = AGGREGATE_TABS.find((t) => t.id === activeTab);
                    if (aggTab) {
                      score = getAggregateScore(
                        corps.corpsName,
                        corps.sourceYear,
                        dateInfo.day,
                        aggTab.calculate
                      );
                    }
                  }

                  const maxScore = getMaxScore();
                  const bgColor = getCellBgColor(score, maxScore);

                  return (
                    <td
                      key={dateInfo.day}
                      className={`px-0 py-1.5 text-center font-mono text-[11px] w-[38px] border-r border-white/5 ${bgColor}`}
                    >
                      {score !== null ? (
                        <span
                          className={`${score >= maxScore * 0.85 ? 'text-green-400' : 'text-secondary'}`}
                        >
                          {score.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-muted/20">-</span>
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
      <div className="flex items-center gap-3 text-[9px] text-muted/60">
        <span className="font-mono">Legend:</span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-none bg-green-900/30" /> 90%+
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-none bg-green-900/20" /> 80-90%
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-none bg-warning/20" /> 70-80%
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-none bg-red-900/20" /> &lt;50%
        </span>
      </div>
    </div>
  );
};

export default ScoresSpreadsheet;
