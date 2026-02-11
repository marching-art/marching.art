/**
 * GamePreview Component - Visual Game Preview for First-Time Visitors
 *
 * Shows a realistic, non-interactive preview of the actual game UI so
 * first-time visitors can see what they're signing up for before registering.
 * Uses the same design tokens as the real dashboard for authenticity.
 *
 * Three tabbed views: Lineup, Scores, Leagues
 * Auto-cycles between tabs every 5 seconds to showcase features.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  Trophy, TrendingUp, TrendingDown, Users, ChevronRight,
  Activity, Award, Flame, Play, Zap, Crown
} from 'lucide-react';

// =============================================================================
// SAMPLE DATA - Realistic demo data matching the actual game format
// =============================================================================

const SAMPLE_LINEUP = [
  { slot: 'GE1', corps: 'Blue Devils', year: '2014', score: 18.50, trend: 'up', change: '+0.25' },
  { slot: 'GE2', corps: 'Carolina Crown', year: '2013', score: 18.30, trend: 'up', change: '+0.15' },
  { slot: 'VP', corps: 'Santa Clara Vanguard', year: '2018', score: 17.90, trend: 'down', change: '-0.10' },
  { slot: 'VA', corps: 'Bluecoats', year: '2019', score: 18.10, trend: 'up', change: '+0.30' },
  { slot: 'CG', corps: 'Carolina Crown', year: '2015', score: 17.80, trend: 'neutral', change: '0.00' },
  { slot: 'Brass', corps: 'The Cavaliers', year: '2002', score: 18.20, trend: 'up', change: '+0.40' },
  { slot: 'MA', corps: 'Blue Devils', year: '2017', score: 18.40, trend: 'up', change: '+0.20' },
  { slot: 'Perc', corps: 'Santa Clara Vanguard', year: '2022', score: 18.25, trend: 'up', change: '+0.35' },
];

const SAMPLE_SCORES = [
  { rank: 1, name: 'The Ambassadors', director: 'DrumCorpsFan', score: 92.45, change: '+2.35', trend: 'up' },
  { rank: 2, name: 'Midnight Horizon', director: 'BrassBoss22', score: 91.80, change: '+1.90', trend: 'up' },
  { rank: 3, name: 'Stardust Legion', director: 'GuardQueen', score: 91.20, change: '-0.40', trend: 'down' },
  { rank: 4, name: 'Nova Alliance', director: 'PercMaster', score: 90.75, change: '+1.15', trend: 'up' },
  { rank: 5, name: 'Phantom Light', director: 'MarchOn99', score: 90.10, change: '+0.85', trend: 'up' },
];

const SAMPLE_LEAGUE = [
  { rank: 1, name: 'DrumCorpsFan', corps: 'The Ambassadors', points: 847.65, wins: 9, losses: 3 },
  { rank: 2, name: 'BrassBoss22', corps: 'Midnight Horizon', points: 832.40, wins: 8, losses: 4 },
  { rank: 3, name: 'GuardQueen', corps: 'Stardust Legion', points: 819.15, wins: 7, losses: 5 },
  { rank: 4, name: 'PercMaster', corps: 'Nova Alliance', points: 805.90, wins: 6, losses: 6 },
  { rank: 5, name: 'MarchOn99', corps: 'Phantom Light', points: 791.20, wins: 5, losses: 7 },
];

const TABS = [
  { id: 'lineup', label: 'Your Lineup', icon: Activity },
  { id: 'scores', label: 'Live Scores', icon: Trophy },
  { id: 'leagues', label: 'Leagues', icon: Users },
];

// =============================================================================
// TREND ICON COMPONENT
// =============================================================================

function TrendIcon({ direction, className = 'w-3 h-3' }) {
  if (direction === 'up') return <TrendingUp className={`${className} text-green-500`} />;
  if (direction === 'down') return <TrendingDown className={`${className} text-red-500`} />;
  return <span className={`${className} text-gray-500`}>—</span>;
}

// =============================================================================
// LINEUP PREVIEW TAB
// =============================================================================

function LineupPreview() {
  return (
    <div>
      {/* Corps Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#333]">
        <div className="w-10 h-10 bg-[#0057B8]/20 border border-[#0057B8]/30 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">The Ambassadors</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">World Class</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white font-data tabular-nums">92.45</p>
          <p className="text-[10px] text-green-500 font-data tabular-nums flex items-center justify-end gap-0.5">
            <TrendingUp className="w-2.5 h-2.5" />
            +2.35
          </p>
        </div>
      </div>

      {/* Lineup Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#333] bg-[#111]">
            <th className="py-2 px-3 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Slot</th>
            <th className="py-2 px-3 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Selection</th>
            <th className="py-2 px-2 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider hidden xs:table-cell">Score</th>
            <th className="py-2 px-2 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider">Trend</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_LINEUP.map((row) => (
            <tr key={row.slot} className="border-b border-[#222]">
              <td className="py-2 px-3">
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-[#0057B8]/20 text-[#0057B8]">
                  {row.slot}
                </span>
              </td>
              <td className="py-2 px-3">
                <span className="text-xs text-white">{row.corps}</span>
                <span className="text-[10px] text-gray-500 ml-1">'{row.year.slice(-2)}</span>
              </td>
              <td className="py-2 px-2 text-right hidden xs:table-cell">
                <span className="text-xs font-bold text-white font-data tabular-nums">{row.score.toFixed(2)}</span>
              </td>
              <td className="py-2 px-2 text-right">
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-data tabular-nums ${
                  row.trend === 'up' ? 'text-green-500' :
                  row.trend === 'down' ? 'text-red-500' :
                  'text-gray-500'
                }`}>
                  <TrendIcon direction={row.trend} className="w-2.5 h-2.5" />
                  <span className="hidden xs:inline">{row.change}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// SCORES PREVIEW TAB
// =============================================================================

function ScoresPreview() {
  return (
    <div>
      {/* Show Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
        <div>
          <p className="text-sm font-bold text-white">San Antonio Regional</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">World Class Standings</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-bold text-red-400 uppercase">Live</span>
        </div>
      </div>

      {/* Scores Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#333] bg-[#111]">
            <th className="py-2 px-3 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider w-8">#</th>
            <th className="py-2 px-2 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Corps</th>
            <th className="py-2 px-2 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider">Score</th>
            <th className="py-2 px-3 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider">Chg</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_SCORES.map((row, idx) => (
            <tr key={row.rank} className={`border-b border-[#222] ${idx === 0 ? 'bg-[#0057B8]/5' : ''}`}>
              <td className="py-2.5 px-3">
                <span className={`text-xs font-bold tabular-nums ${idx === 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {row.rank}
                </span>
              </td>
              <td className="py-2.5 px-2">
                <div>
                  <span className="text-xs font-bold text-white">{row.name}</span>
                  <span className="text-[10px] text-gray-500 block">{row.director}</span>
                </div>
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className="text-sm font-black text-white font-data tabular-nums">{row.score.toFixed(2)}</span>
              </td>
              <td className="py-2.5 px-3 text-right">
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-data tabular-nums ${
                  row.trend === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  <TrendIcon direction={row.trend} className="w-2.5 h-2.5" />
                  {row.change}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// LEAGUES PREVIEW TAB
// =============================================================================

function LeaguesPreview() {
  return (
    <div>
      {/* League Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
        <div>
          <p className="text-sm font-bold text-white">DCI Fanatics League</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">12 Directors &middot; Week 8</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-[#0057B8]/20 border border-[#0057B8]/30">
          <Crown className="w-3 h-3 text-[#0057B8]" />
          <span className="text-[10px] font-bold text-[#0057B8] uppercase">World</span>
        </div>
      </div>

      {/* Standings Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#333] bg-[#111]">
            <th className="py-2 px-3 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider w-8">#</th>
            <th className="py-2 px-2 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Director</th>
            <th className="py-2 px-2 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider hidden xs:table-cell">W-L</th>
            <th className="py-2 px-3 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider">Points</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_LEAGUE.map((row, idx) => (
            <tr key={row.rank} className={`border-b border-[#222] ${idx === 0 ? 'bg-yellow-500/5' : ''}`}>
              <td className="py-2.5 px-3">
                {idx === 0 ? (
                  <Crown className="w-3.5 h-3.5 text-yellow-500" />
                ) : (
                  <span className="text-xs font-bold text-gray-500 tabular-nums">{row.rank}</span>
                )}
              </td>
              <td className="py-2.5 px-2">
                <div>
                  <span className="text-xs font-bold text-white">{row.name}</span>
                  <span className="text-[10px] text-gray-500 block truncate">{row.corps}</span>
                </div>
              </td>
              <td className="py-2.5 px-2 text-right hidden xs:table-cell">
                <span className="text-xs text-gray-400 font-data tabular-nums">{row.wins}-{row.losses}</span>
              </td>
              <td className="py-2.5 px-3 text-right">
                <span className="text-sm font-bold text-white font-data tabular-nums">{row.points.toFixed(2)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// MAIN GAME PREVIEW COMPONENT
// =============================================================================

const GamePreview = () => {
  const [activeTab, setActiveTab] = useState('lineup');
  const [autoCycle, setAutoCycle] = useState(true);

  // Auto-cycle tabs every 5 seconds unless user has interacted
  useEffect(() => {
    if (!autoCycle) return;

    const interval = setInterval(() => {
      setActiveTab(prev => {
        const currentIdx = TABS.findIndex(t => t.id === prev);
        return TABS[(currentIdx + 1) % TABS.length].id;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [autoCycle]);

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId);
    setAutoCycle(false);
  }, []);

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#222] border-b border-[#333]">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-[#0057B8]" />
          Game Preview
        </h2>
        <Link
          to="/preview"
          className="text-[10px] font-medium text-[#0057B8] hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1"
        >
          Try Demo
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-[#333]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                isActive
                  ? 'text-white border-[#0057B8] bg-[#0057B8]/5'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/[0.02]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="relative min-h-[280px] xs:min-h-[320px]">
        <AnimatePresence mode="wait">
          <m.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'lineup' && <LineupPreview />}
            {activeTab === 'scores' && <ScoresPreview />}
            {activeTab === 'leagues' && <LeaguesPreview />}
          </m.div>
        </AnimatePresence>
      </div>

      {/* CTA Footer */}
      <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          <span className="text-green-400 font-semibold">Free to play</span> &middot; Draft from 50+ years of DCI history
        </p>
        <Link
          to="/register"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 min-h-[36px] bg-[#0057B8] text-white font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-[#0066d6] active:bg-[#004a9e] active:scale-[0.98] transition-all duration-150 press-feedback-strong"
        >
          Start Playing
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </m.div>
  );
};

export default GamePreview;
