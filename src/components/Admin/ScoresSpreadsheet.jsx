// src/components/Admin/ScoresSpreadsheet.jsx
// Admin spreadsheet view of reference scores for the current season
// Shows selected corps by point value (25-1) with scores across dates

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Table, RefreshCw, AlertCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCaptionLabel, getCaptionColor } from '../../utils/captionUtils';

// Caption definitions for tabs
const INDIVIDUAL_CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

const AGGREGATE_TABS = [
  { id: 'total', label: 'Total Score', calculate: (c) =>
    (c.GE1 || 0) + (c.GE2 || 0) + (c.VP || 0) + (c.VA || 0) + (c.CG || 0) + (c.B || 0) + (c.MA || 0) + (c.P || 0)
  },
  { id: 'ge_total', label: 'Total GE', calculate: (c) => (c.GE1 || 0) + (c.GE2 || 0) },
  { id: 'music_total', label: 'Total Music', calculate: (c) => (c.B || 0) + (c.MA || 0) + (c.P || 0) },
  { id: 'visual_total', label: 'Total Visual', calculate: (c) => (c.VP || 0) + (c.VA || 0) + (c.CG || 0) },
];

// Format date for column header
const formatDateHeader = (date, day) => {
  if (!date) return `Day ${day}`;
  const d = new Date(date);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const dayNum = d.getDate();
  return `${dayNum}-${month}`;
};

// Get cell background color based on score value (heatmap)
const getCellBgColor = (value, maxPossible) => {
  if (!value || value === 0) return '';
  const percentage = value / maxPossible;
  if (percentage >= 0.9) return 'bg-green-900/30';
  if (percentage >= 0.8) return 'bg-green-900/20';
  if (percentage >= 0.7) return 'bg-yellow-900/20';
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
        const seasonDoc = await getDoc(doc(db, 'game-settings/season'));
        if (!seasonDoc.exists()) {
          throw new Error('No active season found');
        }
        const season = seasonDoc.data();
        setSeasonData(season);

        // 2. Get corps values (selected corps for each point value)
        const corpsDataDoc = await getDoc(doc(db, `dci-data/${season.dataDocId}`));
        if (!corpsDataDoc.exists()) {
          throw new Error(`Corps data not found: ${season.dataDocId}`);
        }
        const corpsData = corpsDataDoc.data();
        const corps = corpsData.corpsValues || [];

        // Sort by points descending (25 -> 1)
        const sortedCorps = [...corps].sort((a, b) => b.points - a.points);
        setCorpsValues(sortedCorps);

        // 3. Get unique years to fetch
        const yearsToFetch = [...new Set(corps.map(c => c.sourceYear))];

        // 4. Fetch historical scores for each year
        const historicalPromises = yearsToFetch.map(year =>
          getDoc(doc(db, `historical_scores/${year}`))
        );
        const historicalDocs = await Promise.all(historicalPromises);

        const historical = {};
        historicalDocs.forEach((docSnap) => {
          if (docSnap.exists()) {
            historical[docSnap.id] = docSnap.data().data || [];
          }
        });
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

  // Get all unique dates/days from historical data
  const allDates = useMemo(() => {
    const datesMap = new Map();

    Object.values(historicalData).forEach(yearData => {
      yearData.forEach(event => {
        if (event.offSeasonDay && !datesMap.has(event.offSeasonDay)) {
          datesMap.set(event.offSeasonDay, {
            day: event.offSeasonDay,
            date: event.date,
            eventName: event.eventName
          });
        }
      });
    });

    // Sort by day number
    return Array.from(datesMap.values()).sort((a, b) => a.day - b.day);
  }, [historicalData]);

  // Get score for a specific corps on a specific day
  const getScore = (corpsName, sourceYear, day, caption) => {
    const yearData = historicalData[sourceYear] || [];
    for (const event of yearData) {
      if (event.offSeasonDay === day) {
        const scoreData = event.scores?.find(s => s.corps === corpsName);
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
        const scoreData = event.scores?.find(s => s.corps === corpsName);
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
    const aggTab = AGGREGATE_TABS.find(t => t.id === activeTab);
    if (aggTab) {
      switch (aggTab.id) {
        case 'total': return 160; // 8 captions * 20
        case 'ge_total': return 40; // 2 captions * 20
        case 'music_total': return 60; // 3 captions * 20
        case 'visual_total': return 60; // 3 captions * 20
        default: return 20;
      }
    }
    return 20;
  };

  // Visible columns based on scroll position
  const VISIBLE_COLUMNS = 32;
  const visibleDates = useMemo(() => {
    return allDates.slice(scrollPosition, scrollPosition + VISIBLE_COLUMNS);
  }, [allDates, scrollPosition]);

  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition + VISIBLE_COLUMNS < allDates.length;

  const handleScrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 16));
  };

  const handleScrollRight = () => {
    setScrollPosition(Math.min(allDates.length - VISIBLE_COLUMNS, scrollPosition + 16));
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Corps Name', 'Points', 'Source Year', ...allDates.map(d => formatDateHeader(d.date, d.day))];

    const rows = corpsValues.map(corps => {
      const scores = allDates.map(dateInfo => {
        if (INDIVIDUAL_CAPTIONS.includes(activeTab)) {
          const score = getScore(corps.corpsName, corps.sourceYear, dateInfo.day, activeTab);
          return score !== null ? score.toFixed(3) : '';
        } else {
          const aggTab = AGGREGATE_TABS.find(t => t.id === activeTab);
          if (aggTab) {
            const score = getAggregateScore(corps.corpsName, corps.sourceYear, dateInfo.day, aggTab.calculate);
            return score !== null ? score.toFixed(3) : '';
          }
        }
        return '';
      });
      return [corps.corpsName, corps.points, corps.sourceYear, ...scores];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
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
        <RefreshCw className="w-8 h-8 text-gold-500 animate-spin" />
        <span className="ml-3 text-cream-300">Loading scores data...</span>
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
          <div className="p-1.5 bg-gold-500/20 rounded-lg">
            <Table className="w-4 h-4 text-gold-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-cream-100">Scores Reference Spreadsheet</h2>
            <p className="text-xs text-cream-500">
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
      <div className="flex flex-wrap gap-0.5 p-0.5 bg-charcoal-900/50 rounded-lg">
        {/* Individual Caption Tabs */}
        {INDIVIDUAL_CAPTIONS.map(caption => (
          <button
            key={caption}
            onClick={() => setActiveTab(caption)}
            className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
              activeTab === caption
                ? 'bg-gold-500 text-charcoal-900 font-bold'
                : 'text-cream-400 hover:text-cream-100 hover:bg-charcoal-800'
            }`}
          >
            {caption}
          </button>
        ))}

        {/* Separator */}
        <div className="w-px bg-cream-500/20 mx-0.5" />

        {/* Aggregate Tabs */}
        {AGGREGATE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
              activeTab === tab.id
                ? 'bg-gold-500 text-charcoal-900 font-bold'
                : 'text-cream-400 hover:text-cream-100 hover:bg-charcoal-800'
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
              ? 'bg-charcoal-800 text-cream-300 hover:bg-charcoal-700'
              : 'bg-charcoal-900/50 text-cream-500/30 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-cream-500 font-mono">
          Showing days {scrollPosition + 1}-{Math.min(scrollPosition + VISIBLE_COLUMNS, allDates.length)} of {allDates.length}
        </span>
        <button
          onClick={handleScrollRight}
          disabled={!canScrollRight}
          className={`p-1 rounded transition-all ${
            canScrollRight
              ? 'bg-charcoal-800 text-cream-300 hover:bg-charcoal-700'
              : 'bg-charcoal-900/50 text-cream-500/30 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto border border-cream-500/20 rounded">
        <table className="w-full border-collapse text-[10px]">
          {/* Header Row */}
          <thead>
            <tr className="bg-charcoal-900/80 border-b border-cream-500/20">
              <th className="sticky left-0 z-10 bg-charcoal-900 px-1 py-1 text-left font-mono text-gold-400 border-r border-cream-500/20 w-[90px]">
                {INDIVIDUAL_CAPTIONS.includes(activeTab)
                  ? getCaptionLabel(activeTab)
                  : AGGREGATE_TABS.find(t => t.id === activeTab)?.label || activeTab
                }
              </th>
              <th className="sticky left-[90px] z-10 bg-charcoal-900 px-0.5 py-1 text-center font-mono text-gold-400 border-r border-cream-500/20 w-6">
                Pts
              </th>
              {visibleDates.map((dateInfo, idx) => (
                <th
                  key={dateInfo.day}
                  className="px-0 py-0.5 text-center font-mono text-cream-400 w-[38px] border-r border-cream-500/10"
                  title={`${dateInfo.eventName} (Day ${dateInfo.day})`}
                >
                  <div className="text-[8px] text-cream-500/70 leading-none">{formatDateHeader(dateInfo.date, dateInfo.day)}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {corpsValues.map((corps, rowIdx) => (
              <tr
                key={`${corps.corpsName}-${corps.sourceYear}`}
                className={`border-b border-cream-500/10 ${
                  rowIdx % 2 === 0 ? 'bg-charcoal-950/30' : 'bg-charcoal-900/20'
                } hover:bg-charcoal-800/40`}
              >
                {/* Corps Name - Sticky */}
                <td className="sticky left-0 z-10 bg-charcoal-900/95 px-1 py-0.5 border-r border-cream-500/20 w-[90px] max-w-[90px]">
                  <div className="font-medium text-cream-100 text-[9px] truncate leading-tight" title={`${corps.corpsName} (${corps.sourceYear})`}>
                    {corps.corpsName}
                  </div>
                  <div className="text-[7px] text-cream-500/50 leading-none">
                    {corps.sourceYear}
                  </div>
                </td>

                {/* Points - Sticky */}
                <td className="sticky left-[90px] z-10 bg-charcoal-900/95 px-0.5 py-0.5 text-center border-r border-cream-500/20 w-6">
                  <span className={`font-mono text-[9px] font-bold ${
                    corps.points >= 20 ? 'text-gold-400' :
                    corps.points >= 15 ? 'text-cream-200' :
                    corps.points >= 10 ? 'text-cream-400' :
                    'text-cream-500'
                  }`}>
                    {corps.points}
                  </span>
                </td>

                {/* Score Cells */}
                {visibleDates.map((dateInfo) => {
                  let score = null;
                  if (INDIVIDUAL_CAPTIONS.includes(activeTab)) {
                    score = getScore(corps.corpsName, corps.sourceYear, dateInfo.day, activeTab);
                  } else {
                    const aggTab = AGGREGATE_TABS.find(t => t.id === activeTab);
                    if (aggTab) {
                      score = getAggregateScore(corps.corpsName, corps.sourceYear, dateInfo.day, aggTab.calculate);
                    }
                  }

                  const maxScore = getMaxScore();
                  const bgColor = getCellBgColor(score, maxScore);

                  return (
                    <td
                      key={dateInfo.day}
                      className={`px-0 py-0.5 text-center font-mono text-[9px] w-[38px] border-r border-cream-500/5 ${bgColor}`}
                    >
                      {score !== null ? (
                        <span className={`${score >= maxScore * 0.85 ? 'text-green-400' : 'text-cream-300'}`}>
                          {score.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-cream-500/20">-</span>
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
      <div className="flex items-center gap-3 text-[9px] text-cream-500/60">
        <span className="font-mono">Legend:</span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-900/30" /> 90%+
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-900/20" /> 80-90%
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-yellow-900/20" /> 70-80%
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-900/20" /> &lt;50%
        </span>
      </div>
    </div>
  );
};

export default ScoresSpreadsheet;
