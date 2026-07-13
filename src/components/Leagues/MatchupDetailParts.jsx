// Tab panels for MatchupDetailView: season-stats overview and per-show
// caption comparison, plus the CaptionCompare bar. Extracted verbatim.

import React from 'react';
import { m } from 'framer-motion';
import { Award, Flame, Target, Trophy } from 'lucide-react';

// Caption comparison bar component
const CaptionCompare = ({ label, score1, score2, color }) => {
  const total = score1 + score2;
  const percent1 = total > 0 ? (score1 / total) * 100 : 50;
  const percent2 = total > 0 ? (score2 / total) * 100 : 50;

  const colorClasses = {
    purple: { bg1: 'bg-purple-500', bg2: 'bg-purple-400/50' },
    blue: { bg1: 'bg-blue-500', bg2: 'bg-blue-400/50' },
    green: { bg1: 'bg-green-500', bg2: 'bg-green-400/50' },
  };

  const colors = colorClasses[color];

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`text-muted/60 font-semibold ${score1 > score2 ? 'text-green-400' : ''}`}>
          {score1.toFixed(1)}
        </span>
        <span className="font-semibold text-secondary">{label}</span>
        <span className={`text-muted/60 font-semibold ${score2 > score1 ? 'text-green-400' : ''}`}>
          {score2.toFixed(1)}
        </span>
      </div>
      <div className="flex h-2 rounded-none overflow-hidden bg-charcoal-800">
        <m.div
          initial={{ width: '50%' }}
          animate={{ width: `${percent1}%` }}
          transition={{ type: 'spring', damping: 20 }}
          className={`${colors.bg1} rounded-l-full`}
        />
        <m.div
          initial={{ width: '50%' }}
          animate={{ width: `${percent2}%` }}
          transition={{ type: 'spring', damping: 20 }}
          className={`${colors.bg2} rounded-r-full`}
        />
      </div>
    </div>
  );
};

// OPTIMIZATION #6: Wrap with React.memo to prevent unnecessary re-renders

export const MatchupOverviewPanel = ({ scoreBreakdown, user1Stats, user2Stats, loading }) => (
  <m.div
    key="overview"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="space-y-4"
  >
    {/* Season Stats Comparison */}
    {user1Stats && user2Stats && (
      <div className="glass rounded-none p-4">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-secondary" />
          Season Stats
        </h3>

        <div className="grid grid-cols-3 gap-4">
          {/* Wins */}
          <div className="text-center">
            <p className="text-xs text-muted/60 mb-1">Wins</p>
            <div className="flex items-center justify-center gap-4">
              <span
                className={`font-bold text-lg ${
                  user1Stats.wins > user2Stats.wins ? 'text-green-400' : 'text-white'
                }`}
              >
                {user1Stats.wins}
              </span>
              <span className="text-muted/20">|</span>
              <span
                className={`font-bold text-lg ${
                  user2Stats.wins > user1Stats.wins ? 'text-green-400' : 'text-white'
                }`}
              >
                {user2Stats.wins}
              </span>
            </div>
          </div>

          {/* Total Points */}
          <div className="text-center">
            <p className="text-xs text-muted/60 mb-1">Total Pts</p>
            <div className="flex items-center justify-center gap-4">
              <span
                className={`font-bold text-lg ${
                  user1Stats.totalPoints > user2Stats.totalPoints ? 'text-secondary' : 'text-white'
                }`}
              >
                {user1Stats.totalPoints.toFixed(0)}
              </span>
              <span className="text-muted/20">|</span>
              <span
                className={`font-bold text-lg ${
                  user2Stats.totalPoints > user1Stats.totalPoints ? 'text-secondary' : 'text-white'
                }`}
              >
                {user2Stats.totalPoints.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Streak */}
          <div className="text-center">
            <p className="text-xs text-muted/60 mb-1">Streak</p>
            <div className="flex items-center justify-center gap-4">
              <span
                className={`font-bold text-lg flex items-center gap-0.5 ${
                  user1Stats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {user1Stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                {user1Stats.streakType || '—'}
                {user1Stats.streak || ''}
              </span>
              <span className="text-muted/20">|</span>
              <span
                className={`font-bold text-lg flex items-center gap-0.5 ${
                  user2Stats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {user2Stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                {user2Stats.streakType || '—'}
                {user2Stats.streak || ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Quick Caption Comparison */}
    {!loading &&
      (scoreBreakdown.user1?.shows.length > 0 || scoreBreakdown.user2?.shows.length > 0) && (
        <div className="glass rounded-none p-4">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-secondary" />
            Caption Summary
          </h3>

          <CaptionCompare
            label="General Effect"
            score1={scoreBreakdown.user1?.geTotal || 0}
            score2={scoreBreakdown.user2?.geTotal || 0}
            color="purple"
          />
          <CaptionCompare
            label="Visual"
            score1={scoreBreakdown.user1?.visualTotal || 0}
            score2={scoreBreakdown.user2?.visualTotal || 0}
            color="blue"
          />
          <CaptionCompare
            label="Music"
            score1={scoreBreakdown.user1?.musicTotal || 0}
            score2={scoreBreakdown.user2?.musicTotal || 0}
            color="green"
          />
        </div>
      )}
  </m.div>
);

export const MatchupShowsPanel = ({ matchup, scoreBreakdown, getDisplayName, loading }) => (
  <m.div
    key="captions"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="space-y-4"
  >
    {/* Detailed Caption Breakdown */}
    {!loading &&
      (scoreBreakdown.user1?.shows.length > 0 || scoreBreakdown.user2?.shows.length > 0) && (
        <div className="glass rounded-none p-4">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-secondary" />
            Caption Breakdown
          </h3>

          <CaptionCompare
            label="General Effect"
            score1={scoreBreakdown.user1?.geTotal || 0}
            score2={scoreBreakdown.user2?.geTotal || 0}
            color="purple"
          />
          <CaptionCompare
            label="Visual"
            score1={scoreBreakdown.user1?.visualTotal || 0}
            score2={scoreBreakdown.user2?.visualTotal || 0}
            color="blue"
          />
          <CaptionCompare
            label="Music"
            score1={scoreBreakdown.user1?.musicTotal || 0}
            score2={scoreBreakdown.user2?.musicTotal || 0}
            color="green"
          />
        </div>
      )}

    {/* Shows This Week */}
    <div className="glass rounded-none overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-secondary" />
          Shows This Week
        </h3>
      </div>

      <div className="divide-y divide-white/5">
        {/* User 1 Shows */}
        {scoreBreakdown.user1?.shows.map((show, idx) => (
          <div key={`u1-${idx}`} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none bg-charcoal-800 flex items-center justify-center">
                <span className="text-xs font-bold text-muted/60">
                  {getDisplayName(matchup.user1).charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm text-white">{show.eventName}</p>
                <p className="text-xs text-muted/40">{getDisplayName(matchup.user1)}</p>
              </div>
            </div>
            <span className="font-bold text-secondary">{show.score.toFixed(1)}</span>
          </div>
        ))}

        {/* User 2 Shows */}
        {scoreBreakdown.user2?.shows.map((show, idx) => (
          <div key={`u2-${idx}`} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none bg-charcoal-800 flex items-center justify-center">
                <span className="text-xs font-bold text-muted/60">
                  {getDisplayName(matchup.user2).charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm text-white">{show.eventName}</p>
                <p className="text-xs text-muted/40">{getDisplayName(matchup.user2)}</p>
              </div>
            </div>
            <span className="font-bold text-secondary">{show.score.toFixed(1)}</span>
          </div>
        ))}

        {scoreBreakdown.user1?.shows.length === 0 && scoreBreakdown.user2?.shows.length === 0 && (
          <div className="p-8 text-center text-muted/40">No shows scored yet this week</div>
        )}
      </div>
    </div>
  </m.div>
);
