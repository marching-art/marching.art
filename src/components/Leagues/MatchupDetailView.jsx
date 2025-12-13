// MatchupDetailView - Head-to-head matchup comparison view
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Swords, Trophy, TrendingUp, TrendingDown,
  Flame, Medal, Target, Calendar, Zap
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { RivalryBadge } from './LeagueActivityFeed';

const MatchupDetailView = ({
  matchup,
  league,
  userProfile,
  memberProfiles,
  standings,
  currentWeek,
  onBack,
  rivalry = null, // Optional rivalry data for this matchup
}) => {
  const [weeklyScores, setWeeklyScores] = useState({ user1: 0, user2: 0 });
  const [loading, setLoading] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState({ user1: null, user2: null });

  // Get user stats from standings
  const user1Stats = standings.find(s => s.uid === matchup.user1);
  const user2Stats = standings.find(s => s.uid === matchup.user2);

  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles?.[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Get corps name for a user
  const getCorpsName = (uid) => {
    const profile = memberProfiles?.[uid];
    if (profile?.corps) {
      const activeCorps = Object.values(profile.corps).find(c => c.corpsName || c.name);
      return activeCorps?.corpsName || activeCorps?.name || null;
    }
    return null;
  };

  // Fetch weekly scores
  useEffect(() => {
    const fetchWeeklyScores = async () => {
      setLoading(true);
      try {
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();
          const recapsRef = doc(db, `fantasy_recaps/${sData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            let score1 = 0, score2 = 0;
            const breakdown1 = { shows: [], geTotal: 0, visualTotal: 0, musicTotal: 0 };
            const breakdown2 = { shows: [], geTotal: 0, visualTotal: 0, musicTotal: 0 };

            recaps.forEach(dayRecap => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
              if (weekNum === matchup.week) {
                dayRecap.shows?.forEach(show => {
                  show.results?.forEach(result => {
                    if (result.uid === matchup.user1) {
                      score1 += result.totalScore || 0;
                      breakdown1.shows.push({
                        eventName: show.eventName,
                        score: result.totalScore || 0,
                        geScore: result.geScore || 0,
                        visualScore: result.visualScore || 0,
                        musicScore: result.musicScore || 0
                      });
                      breakdown1.geTotal += result.geScore || 0;
                      breakdown1.visualTotal += result.visualScore || 0;
                      breakdown1.musicTotal += result.musicScore || 0;
                    }
                    if (result.uid === matchup.user2) {
                      score2 += result.totalScore || 0;
                      breakdown2.shows.push({
                        eventName: show.eventName,
                        score: result.totalScore || 0,
                        geScore: result.geScore || 0,
                        visualScore: result.visualScore || 0,
                        musicScore: result.musicScore || 0
                      });
                      breakdown2.geTotal += result.geScore || 0;
                      breakdown2.visualTotal += result.visualScore || 0;
                      breakdown2.musicTotal += result.musicScore || 0;
                    }
                  });
                });
              }
            });

            setWeeklyScores({ user1: score1, user2: score2 });
            setScoreBreakdown({ user1: breakdown1, user2: breakdown2 });
          }
        }
      } catch (error) {
        console.error('Error fetching weekly scores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyScores();
  }, [matchup]);

  const user1Leading = weeklyScores.user1 > weeklyScores.user2;
  const user2Leading = weeklyScores.user2 > weeklyScores.user1;
  const tied = weeklyScores.user1 === weeklyScores.user2 && weeklyScores.user1 > 0;

  const scoreDiff = Math.abs(weeklyScores.user1 - weeklyScores.user2);

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cream-300 hover:text-cream-100 transition-colors mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back to League</span>
        </button>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-cream-500/60" />
          <span className="text-sm text-cream-500/60">Week {matchup.week} Matchup</span>
          {rivalry && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
              <Flame className="w-3 h-3" /> Rivalry
            </span>
          )}
        </div>

        <h1 className="text-xl font-display font-bold text-cream-100 text-center">
          Head-to-Head
        </h1>
      </motion.div>

      {/* Rivalry Card */}
      {rivalry && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
        >
          <RivalryBadge rivalry={rivalry} compact={false} />
        </motion.div>
      )}

      {/* Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6"
      >
        <div className="flex items-center justify-between">
          {/* User 1 */}
          <div className="flex-1 text-center">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${
              user1Leading
                ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50'
                : 'bg-charcoal-800 border-2 border-cream-500/20'
            }`}>
              <span className="text-2xl font-display font-bold text-cream-100">
                {getDisplayName(matchup.user1).charAt(0)}
              </span>
            </div>
            <p className={`font-display font-bold ${
              matchup.user1 === userProfile?.uid ? 'text-purple-400' : 'text-cream-100'
            }`}>
              {getDisplayName(matchup.user1)}
            </p>
            <p className="text-xs text-cream-500/40 mb-3">
              {getCorpsName(matchup.user1) || 'Unknown Corps'}
            </p>

            {/* Score */}
            <div className={`text-4xl font-display font-bold ${
              user1Leading ? 'text-green-400' : tied ? 'text-yellow-400' : 'text-cream-100'
            }`}>
              {loading ? '—' : weeklyScores.user1.toFixed(1)}
            </div>

            {/* Record */}
            {user1Stats && (
              <p className="text-sm text-cream-500/60 mt-2">
                {user1Stats.wins}-{user1Stats.losses} Record
              </p>
            )}
          </div>

          {/* VS Divider */}
          <div className="px-4 py-2">
            <div className="w-14 h-14 rounded-full bg-charcoal-900/50 border border-cream-500/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-purple-400" />
            </div>
            {!loading && scoreDiff > 0 && (
              <div className="mt-2 text-center">
                <span className={`text-xs font-display font-bold ${
                  user1Leading ? 'text-green-400' : 'text-green-400'
                }`}>
                  +{scoreDiff.toFixed(1)}
                </span>
              </div>
            )}
            {tied && !loading && (
              <div className="mt-2 text-center">
                <span className="text-xs font-display font-bold text-yellow-400">
                  TIE
                </span>
              </div>
            )}
          </div>

          {/* User 2 */}
          <div className="flex-1 text-center">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${
              user2Leading
                ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50'
                : 'bg-charcoal-800 border-2 border-cream-500/20'
            }`}>
              <span className="text-2xl font-display font-bold text-cream-100">
                {getDisplayName(matchup.user2).charAt(0)}
              </span>
            </div>
            <p className={`font-display font-bold ${
              matchup.user2 === userProfile?.uid ? 'text-purple-400' : 'text-cream-100'
            }`}>
              {getDisplayName(matchup.user2)}
            </p>
            <p className="text-xs text-cream-500/40 mb-3">
              {getCorpsName(matchup.user2) || 'Unknown Corps'}
            </p>

            {/* Score */}
            <div className={`text-4xl font-display font-bold ${
              user2Leading ? 'text-green-400' : tied ? 'text-yellow-400' : 'text-cream-100'
            }`}>
              {loading ? '—' : weeklyScores.user2.toFixed(1)}
            </div>

            {/* Record */}
            {user2Stats && (
              <p className="text-sm text-cream-500/60 mt-2">
                {user2Stats.wins}-{user2Stats.losses} Record
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Score Comparison */}
      {!loading && (scoreBreakdown.user1?.shows.length > 0 || scoreBreakdown.user2?.shows.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4"
        >
          <h3 className="text-sm font-display font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-500" />
            Caption Breakdown
          </h3>

          {/* GE Comparison */}
          <CaptionCompare
            label="General Effect"
            score1={scoreBreakdown.user1?.geTotal || 0}
            score2={scoreBreakdown.user2?.geTotal || 0}
            color="purple"
          />

          {/* Visual Comparison */}
          <CaptionCompare
            label="Visual"
            score1={scoreBreakdown.user1?.visualTotal || 0}
            score2={scoreBreakdown.user2?.visualTotal || 0}
            color="blue"
          />

          {/* Music Comparison */}
          <CaptionCompare
            label="Music"
            score1={scoreBreakdown.user1?.musicTotal || 0}
            score2={scoreBreakdown.user2?.musicTotal || 0}
            color="green"
          />
        </motion.div>
      )}

      {/* Shows Breakdown */}
      {!loading && (scoreBreakdown.user1?.shows.length > 0 || scoreBreakdown.user2?.shows.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-cream-500/10">
            <h3 className="text-sm font-display font-bold text-cream-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gold-500" />
              Shows This Week
            </h3>
          </div>

          <div className="divide-y divide-cream-500/5">
            {/* User 1 Shows */}
            {scoreBreakdown.user1?.shows.map((show, idx) => (
              <div key={`u1-${idx}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-charcoal-800 flex items-center justify-center">
                    <span className="text-xs font-bold text-cream-500/60">
                      {getDisplayName(matchup.user1).charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-display text-cream-100">{show.eventName}</p>
                    <p className="text-xs text-cream-500/40">
                      {getDisplayName(matchup.user1)}
                    </p>
                  </div>
                </div>
                <span className="font-display font-bold text-gold-500">
                  {show.score.toFixed(1)}
                </span>
              </div>
            ))}

            {/* User 2 Shows */}
            {scoreBreakdown.user2?.shows.map((show, idx) => (
              <div key={`u2-${idx}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-charcoal-800 flex items-center justify-center">
                    <span className="text-xs font-bold text-cream-500/60">
                      {getDisplayName(matchup.user2).charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-display text-cream-100">{show.eventName}</p>
                    <p className="text-xs text-cream-500/40">
                      {getDisplayName(matchup.user2)}
                    </p>
                  </div>
                </div>
                <span className="font-display font-bold text-gold-500">
                  {show.score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {scoreBreakdown.user1?.shows.length === 0 && scoreBreakdown.user2?.shows.length === 0 && (
            <div className="p-8 text-center text-cream-500/40">
              No shows scored yet this week
            </div>
          )}
        </motion.div>
      )}

      {/* Season Stats Comparison */}
      {user1Stats && user2Stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-xl p-4"
        >
          <h3 className="text-sm font-display font-bold text-cream-100 mb-4">
            Season Stats
          </h3>

          <div className="grid grid-cols-3 gap-4">
            {/* Wins */}
            <div className="text-center">
              <p className="text-xs text-cream-500/60 mb-1">Wins</p>
              <div className="flex items-center justify-center gap-4">
                <span className={`font-display font-bold text-lg ${
                  user1Stats.wins > user2Stats.wins ? 'text-green-400' : 'text-cream-100'
                }`}>
                  {user1Stats.wins}
                </span>
                <span className="text-cream-500/20">|</span>
                <span className={`font-display font-bold text-lg ${
                  user2Stats.wins > user1Stats.wins ? 'text-green-400' : 'text-cream-100'
                }`}>
                  {user2Stats.wins}
                </span>
              </div>
            </div>

            {/* Total Points */}
            <div className="text-center">
              <p className="text-xs text-cream-500/60 mb-1">Total Pts</p>
              <div className="flex items-center justify-center gap-4">
                <span className={`font-display font-bold text-lg ${
                  user1Stats.totalPoints > user2Stats.totalPoints ? 'text-gold-400' : 'text-cream-100'
                }`}>
                  {user1Stats.totalPoints.toFixed(0)}
                </span>
                <span className="text-cream-500/20">|</span>
                <span className={`font-display font-bold text-lg ${
                  user2Stats.totalPoints > user1Stats.totalPoints ? 'text-gold-400' : 'text-cream-100'
                }`}>
                  {user2Stats.totalPoints.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Streak */}
            <div className="text-center">
              <p className="text-xs text-cream-500/60 mb-1">Streak</p>
              <div className="flex items-center justify-center gap-4">
                <span className={`font-display font-bold text-lg flex items-center gap-0.5 ${
                  user1Stats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {user1Stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                  {user1Stats.streakType || '—'}{user1Stats.streak || ''}
                </span>
                <span className="text-cream-500/20">|</span>
                <span className={`font-display font-bold text-lg flex items-center gap-0.5 ${
                  user2Stats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {user2Stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                  {user2Stats.streakType || '—'}{user2Stats.streak || ''}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Caption comparison bar component
const CaptionCompare = ({ label, score1, score2, color }) => {
  const total = score1 + score2;
  const percent1 = total > 0 ? (score1 / total) * 100 : 50;
  const percent2 = total > 0 ? (score2 / total) * 100 : 50;

  const colorClasses = {
    purple: { bg1: 'bg-purple-500', bg2: 'bg-purple-400/50' },
    blue: { bg1: 'bg-blue-500', bg2: 'bg-blue-400/50' },
    green: { bg1: 'bg-green-500', bg2: 'bg-green-400/50' }
  };

  const colors = colorClasses[color];

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-cream-500/60">{score1.toFixed(1)}</span>
        <span className="font-display font-semibold text-cream-300">{label}</span>
        <span className="text-cream-500/60">{score2.toFixed(1)}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-charcoal-800">
        <div
          className={`${colors.bg1} transition-all duration-500`}
          style={{ width: `${percent1}%` }}
        />
        <div
          className={`${colors.bg2} transition-all duration-500`}
          style={{ width: `${percent2}%` }}
        />
      </div>
    </div>
  );
};

export default MatchupDetailView;
