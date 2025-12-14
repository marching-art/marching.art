// src/pages/Scores.jsx
// Redesigned Scores page with clear hierarchy:
// 1. Your Season status at top
// 2. Latest Show with your results
// 3. Leaderboard below

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Archive } from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';

// Hooks
import { useScoresData } from '../hooks/useScoresData';

// Components
import YourSeasonCard from '../components/Scores/YourSeasonCard';
import LatestShowCard from '../components/Scores/LatestShowCard';
import Leaderboard from '../components/Scores/Leaderboard';
import ScoreBreakdown from '../components/Scores/ScoreBreakdown';
import { SystemLoader, ConsoleEmptyState } from '../components/ui/CommandConsole';

const Scores = () => {
  const { user } = useAuth();
  const { loggedInProfile, completeDailyChallenge } = useUserStore();
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);

  // Score breakdown modal state
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [selectedShowInfo, setSelectedShowInfo] = useState({});
  const [previousScore, setPreviousScore] = useState(null);
  const [previousShowInfo, setPreviousShowInfo] = useState(null);

  // Use the scores data hook - default to 'all' classes
  const {
    loading,
    error,
    allShows,
    stats,
    aggregatedScores,
    isArchived
  } = useScoresData({
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true }
  });

  // Get current season name
  const currentSeasonName = useMemo(() => {
    return formatSeasonName?.() || 'Current Season';
  }, [formatSeasonName]);

  // Extract user's corps data
  const userCorpsData = useMemo(() => {
    if (!loggedInProfile?.corps) return null;

    // Get first corps with a lineup (active corps)
    const activeCorps = Object.values(loggedInProfile.corps).find(c => c?.lineup);
    if (!activeCorps) return null;

    return {
      corpsName: activeCorps.corpsName,
      corpsClass: activeCorps.corpsClass,
      totalSeasonScore: activeCorps.totalSeasonScore || 0
    };
  }, [loggedInProfile?.corps]);

  // Find user's position in leaderboard
  const userLeaderboardEntry = useMemo(() => {
    if (!userCorpsData?.corpsName || !aggregatedScores?.length) return null;

    return aggregatedScores.find(score =>
      (score.corps || score.corpsName) === userCorpsData.corpsName
    );
  }, [aggregatedScores, userCorpsData?.corpsName]);

  // Calculate rank change (simplified - compare to previous best position)
  const userRankChange = useMemo(() => {
    if (!userLeaderboardEntry?.scores || userLeaderboardEntry.scores.length < 2) return 0;

    // Get ranks from last two shows
    const scores = userLeaderboardEntry.scores;
    const lastScore = scores[scores.length - 1];
    const previousScoreData = scores[scores.length - 2];

    if (!lastScore?.rank || !previousScoreData?.rank) return 0;
    return previousScoreData.rank - lastScore.rank; // Positive means improved
  }, [userLeaderboardEntry]);

  // Get user's latest show result
  const userLatestShow = useMemo(() => {
    if (!userCorpsData?.corpsName || !allShows?.length) return null;

    // Find most recent show where user competed
    for (const show of allShows) {
      const userScore = show.scores?.find(s =>
        (s.corps || s.corpsName) === userCorpsData.corpsName
      );
      if (userScore) {
        return {
          show,
          score: userScore,
          rank: show.scores.findIndex(s =>
            (s.corps || s.corpsName) === userCorpsData.corpsName
          ) + 1,
          totalParticipants: show.scores.length
        };
      }
    }
    return null;
  }, [allShows, userCorpsData?.corpsName]);

  // Get user's previous show for comparison
  const userPreviousShow = useMemo(() => {
    if (!userCorpsData?.corpsName || !allShows?.length) return null;

    let foundFirst = false;
    for (const show of allShows) {
      const userScore = show.scores?.find(s =>
        (s.corps || s.corpsName) === userCorpsData.corpsName
      );
      if (userScore) {
        if (foundFirst) {
          return {
            show,
            score: userScore
          };
        }
        foundFirst = true;
      }
    }
    return null;
  }, [allShows, userCorpsData?.corpsName]);

  // Complete daily challenge on visit
  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  // Handle viewing score breakdown
  const handleViewBreakdown = (score, showInfo, prevScore = null, prevShowInfo = null) => {
    setSelectedScore(score);
    setSelectedShowInfo(showInfo);
    setPreviousScore(prevScore);
    setPreviousShowInfo(prevShowInfo);
    setBreakdownOpen(true);
  };

  // Handle leaderboard entry click
  const handleEntryClick = (entry) => {
    // Get this corps's most recent score with show info
    if (entry.scores && entry.scores.length > 0) {
      const latestScore = entry.scores[entry.scores.length - 1];
      const prevScore = entry.scores.length > 1 ? entry.scores[entry.scores.length - 2] : null;

      handleViewBreakdown(
        { ...entry, ...latestScore },
        {
          eventName: latestScore.eventName,
          date: latestScore.date,
          location: latestScore.location
        },
        prevScore,
        prevScore ? { eventName: prevScore.eventName } : null
      );
    }
  };

  // Handle viewing user's latest show breakdown
  const handleViewUserBreakdown = () => {
    if (userLatestShow) {
      handleViewBreakdown(
        { ...userLatestShow.score, rank: userLatestShow.rank },
        {
          eventName: userLatestShow.show.eventName,
          date: userLatestShow.show.date,
          location: userLatestShow.show.location
        },
        userPreviousShow?.score,
        userPreviousShow ? { eventName: userPreviousShow.show.eventName } : null
      );
    }
  };

  return (
    <div className="min-h-full bg-charcoal-950">
      {/* Page Header */}
      <div className="border-b border-cream-500/10 bg-charcoal-950/80 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h1 className="text-xl font-display font-black uppercase tracking-tight text-cream-100">
                  Scores
                </h1>
                <p className="text-xs text-cream-500/60 font-mono uppercase tracking-wide">
                  {currentSeasonName}
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Corps</p>
                <p className="font-mono text-lg font-bold text-cream-100">{stats.corpsActive || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Top Score</p>
                <p className="font-mono text-lg font-bold text-gold-400">{stats.topScore || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <SystemLoader
              messages={[
                'Loading scores...',
                'Calculating rankings...',
                'Almost there...'
              ]}
              showProgress={true}
            />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <ConsoleEmptyState
              variant="network"
              title="CONNECTION ERROR"
              subtitle={error}
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Archive Notice */}
            {isArchived && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3"
              >
                <Archive className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-display font-bold text-amber-400 uppercase tracking-wide">
                    Historical Archive
                  </p>
                  <p className="text-xs text-amber-400/70">
                    Viewing archived data. Some features may be limited.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Your Season Card */}
            {user && (
              <YourSeasonCard
                rank={userLeaderboardEntry?.rank}
                totalCorps={aggregatedScores.length}
                score={userLeaderboardEntry?.score || userLeaderboardEntry?.totalScore || userCorpsData?.totalSeasonScore || 0}
                rankChange={userRankChange}
                corpsClass={userCorpsData?.corpsClass}
                corpsName={userCorpsData?.corpsName}
                isLoading={loading}
              />
            )}

            {/* Latest Show Card */}
            {user && (
              <LatestShowCard
                showName={userLatestShow?.show?.eventName}
                showDate={userLatestShow?.show?.date}
                location={userLatestShow?.show?.location}
                userScore={userLatestShow?.score?.score || userLatestShow?.score?.totalScore}
                userRank={userLatestShow?.rank}
                totalParticipants={userLatestShow?.totalParticipants}
                onViewBreakdown={userLatestShow ? handleViewUserBreakdown : null}
                isLoading={loading}
              />
            )}

            {/* Leaderboard */}
            <Leaderboard
              entries={aggregatedScores}
              currentUserCorps={userCorpsData?.corpsName}
              onEntryClick={handleEntryClick}
              isLoading={loading}
              totalEntries={aggregatedScores.length}
            />
          </motion.div>
        )}
      </div>

      {/* Score Breakdown Modal */}
      <ScoreBreakdown
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        score={selectedScore}
        previousScore={previousScore}
        showInfo={selectedShowInfo}
        previousShowInfo={previousShowInfo}
      />
    </div>
  );
};

export default Scores;
