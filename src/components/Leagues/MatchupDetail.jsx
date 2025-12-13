// MatchupDetail - Full head-to-head matchup view with caption breakdown
// Screenshot-friendly design with winner celebration and H2H history
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Trophy, ChevronLeft, Share2, Radio, Check,
  TrendingUp, TrendingDown, Minus, Crown, Flame,
  Award, Clock, Copy, CheckCircle
} from 'lucide-react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

// Caption display names
const CAPTION_NAMES = {
  GE1: 'General Effect 1',
  GE2: 'General Effect 2',
  VP: 'Visual Performance',
  VA: 'Visual Auxiliary',
  CG: 'Color Guard',
  B: 'Brass',
  MA: 'Music Auxiliary',
  P: 'Percussion'
};

const CAPTION_SHORT = {
  GE1: 'GE1',
  GE2: 'GE2',
  VP: 'VP',
  VA: 'VA',
  CG: 'CG',
  B: 'Brass',
  MA: 'MA',
  P: 'Perc'
};

const MatchupDetail = ({
  matchup,
  league,
  currentUserId,
  homeUser,
  awayUser,
  onBack,
  onShare
}) => {
  const [h2hRecord, setH2hRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const isCurrentUserHome = matchup.homeUserId === currentUserId;
  const isLive = matchup.status === 'live';
  const isCompleted = matchup.status === 'completed';

  const userScore = isCurrentUserHome ? matchup.homeScore : matchup.awayScore;
  const opponentScore = isCurrentUserHome ? matchup.awayScore : matchup.homeScore;
  const userCaptions = isCurrentUserHome ? matchup.homeCaptions : matchup.awayCaptions;
  const opponentCaptions = isCurrentUserHome ? matchup.awayCaptions : matchup.homeCaptions;

  const userIsWinning = userScore > opponentScore;
  const isTied = userScore === opponentScore;
  const scoreDiff = Math.abs(userScore - opponentScore);

  const opponent = isCurrentUserHome ? awayUser : homeUser;
  const user = isCurrentUserHome ? homeUser : awayUser;

  const userWon = isCompleted && matchup.winnerId === currentUserId;
  const userLost = isCompleted && matchup.winnerId && matchup.winnerId !== currentUserId;

  // Fetch H2H history
  useEffect(() => {
    const fetchH2H = async () => {
      if (!league?.id || !currentUserId || !opponent?.uid) {
        setLoading(false);
        return;
      }

      try {
        // In production, this would fetch from a collection of historical matchups
        // For now, generate mock H2H data
        const mockH2H = {
          user1Id: currentUserId,
          user2Id: opponent.uid,
          user1Wins: Math.floor(Math.random() * 5),
          user2Wins: Math.floor(Math.random() * 4),
          ties: Math.floor(Math.random() * 2),
          totalMatchups: 0
        };
        mockH2H.totalMatchups = mockH2H.user1Wins + mockH2H.user2Wins + mockH2H.ties;

        setH2hRecord(mockH2H);
      } catch (error) {
        console.error('Error fetching H2H:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchH2H();
  }, [league?.id, currentUserId, opponent?.uid]);

  // Show celebration animation for wins
  useEffect(() => {
    if (userWon && isCompleted) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [userWon, isCompleted]);

  // Calculate caption wins
  const captionWins = useMemo(() => {
    if (!userCaptions || !opponentCaptions) return { user: 0, opponent: 0, ties: 0 };

    const captions = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
    let userWins = 0;
    let opponentWins = 0;
    let ties = 0;

    captions.forEach(cap => {
      const userVal = userCaptions[cap] || 0;
      const oppVal = opponentCaptions[cap] || 0;
      if (userVal > oppVal) userWins++;
      else if (oppVal > userVal) opponentWins++;
      else ties++;
    });

    return { user: userWins, opponent: opponentWins, ties };
  }, [userCaptions, opponentCaptions]);

  // Share functionality
  const handleShare = () => {
    const shareText = `Week ${matchup.week} Matchup
${user?.displayName || 'You'} vs @${opponent?.displayName || 'Opponent'}
${userScore.toFixed(1)} - ${opponentScore.toFixed(1)}
${userIsWinning ? '(Leading)' : isTied ? '(Tied)' : '(Trailing)'}
#MarchingArt #FantasyDCI`;

    if (navigator.share) {
      navigator.share({
        title: `Week ${matchup.week} Matchup`,
        text: shareText
      }).catch(() => {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareText);
        toast.success('Copied to clipboard!');
      });
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }

    onShare?.();
  };

  // Caption row component
  const CaptionRow = ({ caption }) => {
    const userVal = userCaptions?.[caption] || 0;
    const oppVal = opponentCaptions?.[caption] || 0;
    const userWins = userVal > oppVal;
    const oppWins = oppVal > userVal;
    const tied = userVal === oppVal && userVal > 0;

    return (
      <div className="flex items-center py-2.5 border-b border-cream-500/10 last:border-b-0">
        <div className={`flex-1 text-right pr-4 ${userWins ? 'text-green-400 font-bold' : 'text-cream-300'}`}>
          {userVal > 0 ? userVal.toFixed(1) : '-'}
          {userWins && <Check className="inline w-4 h-4 ml-1" />}
        </div>
        <div className="w-16 text-center">
          <span className="text-xs font-semibold text-cream-500 uppercase tracking-wide">
            {CAPTION_SHORT[caption]}
          </span>
        </div>
        <div className={`flex-1 text-left pl-4 ${oppWins ? 'text-green-400 font-bold' : 'text-cream-300'}`}>
          {oppWins && <Check className="inline w-4 h-4 mr-1" />}
          {oppVal > 0 ? oppVal.toFixed(1) : '-'}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* Winner Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Trophy className="w-24 h-24 text-gold-500 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-4xl font-display font-bold text-gradient mb-2">VICTORY!</h2>
              <p className="text-xl text-cream-300">
                You defeated @{opponent?.displayName}
              </p>
              <p className="text-2xl font-bold text-green-400 mt-2">
                {userScore.toFixed(1)} - {opponentScore.toFixed(1)}
              </p>
              <p className="text-sm text-cream-500/60 mt-4">Tap to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Card - Screenshot friendly */}
      <div className="card p-0 overflow-hidden" id="matchup-share-card">
        {/* Status Banner */}
        {isLive && (
          <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2 flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Live Matchup</span>
          </div>
        )}

        {isCompleted && (
          <div className={`${userWon ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/10 border-red-500/20'} border-b px-4 py-2 flex items-center justify-center gap-2`}>
            {userWon ? (
              <>
                <Trophy className="w-4 h-4 text-gold-500" />
                <span className="text-sm font-bold text-green-400 uppercase tracking-wider">Victory</span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Defeat</span>
              </>
            )}
          </div>
        )}

        {/* Week Title */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 px-6 py-4 text-center border-b border-cream-500/10">
          <span className="text-xs font-semibold text-cream-500/60 uppercase tracking-wider">
            {league?.name}
          </span>
          <h2 className="text-xl font-display font-bold text-cream-100 mt-1">
            Week {matchup.week} Matchup
          </h2>
        </div>

        {/* Main Matchup Display */}
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            {/* User Side */}
            <div className="flex-1 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 border-3 ${
                userWon ? 'bg-green-500/20 border-green-500' :
                userLost ? 'bg-charcoal-800 border-cream-500/30' :
                userIsWinning ? 'bg-green-500/10 border-green-500/50' :
                'bg-charcoal-800 border-cream-500/30'
              }`}>
                {userWon && <Crown className="w-6 h-6 text-gold-500 absolute -top-2 -right-1" />}
                <span className="text-2xl font-bold text-cream-100">
                  {user?.displayName?.charAt(0) || 'Y'}
                </span>
              </div>
              <p className="text-base font-bold text-cream-100">YOU</p>
              <p className="text-xs text-cream-500/60 truncate max-w-[120px] mx-auto">
                {user?.corpsName || 'Your Corps'}
              </p>
              <p className={`text-3xl font-display font-bold mt-3 ${
                userIsWinning ? 'text-green-400' : isTied ? 'text-cream-300' : 'text-cream-400'
              }`}>
                {userScore.toFixed(1)}
              </p>
            </div>

            {/* VS and Score Diff */}
            <div className="flex flex-col items-center">
              <span className="text-2xl font-display font-bold text-cream-500/40">VS</span>
              {(isLive || isCompleted) && (
                <div className={`mt-3 px-3 py-1.5 rounded-lg text-sm font-bold ${
                  userIsWinning ? 'bg-green-500/20 text-green-400' :
                  isTied ? 'bg-cream-500/20 text-cream-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {userIsWinning ? '+' : isTied ? '' : '-'}{scoreDiff.toFixed(1)}
                  {userIsWinning && ' ✓'}
                </div>
              )}
            </div>

            {/* Opponent Side */}
            <div className="flex-1 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 border-3 ${
                userLost ? 'bg-green-500/20 border-green-500' :
                userWon ? 'bg-charcoal-800 border-cream-500/30' :
                !userIsWinning && !isTied ? 'bg-green-500/10 border-green-500/50' :
                'bg-charcoal-800 border-cream-500/30'
              }`}>
                <span className="text-2xl font-bold text-cream-500/80">
                  {opponent?.displayName?.charAt(0) || '?'}
                </span>
              </div>
              <p className="text-base font-bold text-cream-100">@{opponent?.displayName || 'Opponent'}</p>
              <p className="text-xs text-cream-500/60 truncate max-w-[120px] mx-auto">
                {opponent?.corpsName || 'Their Corps'}
              </p>
              <p className={`text-3xl font-display font-bold mt-3 ${
                !userIsWinning && !isTied ? 'text-green-400' : isTied ? 'text-cream-300' : 'text-cream-400'
              }`}>
                {opponentScore.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* Caption Wins Summary */}
        {(isLive || isCompleted) && userCaptions && opponentCaptions && (
          <div className="px-6 pb-4">
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{captionWins.user}</p>
                <p className="text-xs text-cream-500/60">Captions Won</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cream-400">{captionWins.ties}</p>
                <p className="text-xs text-cream-500/60">Tied</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{captionWins.opponent}</p>
                <p className="text-xs text-cream-500/60">Lost</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Caption Breakdown */}
      {(isLive || isCompleted) && (userCaptions || opponentCaptions) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4"
        >
          <h3 className="text-lg font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-gold-500" />
            Caption Breakdown
          </h3>

          {/* Column Headers */}
          <div className="flex items-center pb-2 mb-2 border-b border-cream-500/20">
            <div className="flex-1 text-right pr-4">
              <span className="text-xs font-semibold text-cream-500/60 uppercase">You</span>
            </div>
            <div className="w-16 text-center">
              <span className="text-xs font-semibold text-cream-500/60 uppercase">Caption</span>
            </div>
            <div className="flex-1 text-left pl-4">
              <span className="text-xs font-semibold text-cream-500/60 uppercase">Opponent</span>
            </div>
          </div>

          {/* Caption Rows */}
          <div className="space-y-0">
            {['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'].map(caption => (
              <CaptionRow key={caption} caption={caption} />
            ))}
          </div>

          {/* Totals */}
          <div className="flex items-center pt-3 mt-3 border-t border-cream-500/30">
            <div className={`flex-1 text-right pr-4 text-lg font-bold ${userIsWinning ? 'text-green-400' : 'text-cream-300'}`}>
              {userScore.toFixed(1)}
            </div>
            <div className="w-16 text-center">
              <span className="text-xs font-bold text-cream-400 uppercase">Total</span>
            </div>
            <div className={`flex-1 text-left pl-4 text-lg font-bold ${!userIsWinning && !isTied ? 'text-green-400' : 'text-cream-300'}`}>
              {opponentScore.toFixed(1)}
            </div>
          </div>
        </motion.div>
      )}

      {/* H2H History */}
      {h2hRecord && h2hRecord.totalMatchups > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-4"
        >
          <h3 className="text-lg font-bold text-cream-100 mb-3 flex items-center gap-2">
            <Swords className="w-5 h-5 text-purple-400" />
            Head-to-Head History
          </h3>

          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className={`text-3xl font-display font-bold ${h2hRecord.user1Wins > h2hRecord.user2Wins ? 'text-green-400' : 'text-cream-400'}`}>
                {h2hRecord.user1Wins}
              </p>
              <p className="text-xs text-cream-500/60">Your Wins</p>
            </div>
            <div className="text-center px-4">
              <p className="text-lg text-cream-500/40">—</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-display font-bold ${h2hRecord.user2Wins > h2hRecord.user1Wins ? 'text-green-400' : 'text-cream-400'}`}>
                {h2hRecord.user2Wins}
              </p>
              <p className="text-xs text-cream-500/60">Their Wins</p>
            </div>
          </div>

          {h2hRecord.user1Wins > h2hRecord.user2Wins && (
            <p className="text-center text-sm text-green-400 mt-3">
              You lead the series {h2hRecord.user1Wins}-{h2hRecord.user2Wins}
            </p>
          )}
          {h2hRecord.user2Wins > h2hRecord.user1Wins && (
            <p className="text-center text-sm text-red-400 mt-3">
              They lead the series {h2hRecord.user2Wins}-{h2hRecord.user1Wins}
            </p>
          )}
          {h2hRecord.user1Wins === h2hRecord.user2Wins && h2hRecord.totalMatchups > 0 && (
            <p className="text-center text-sm text-cream-400 mt-3">
              Series tied {h2hRecord.user1Wins}-{h2hRecord.user2Wins}
            </p>
          )}
        </motion.div>
      )}

      {/* Projection (for live matchups) */}
      {isLive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-4 border-2 border-purple-500/30"
        >
          <h3 className="text-lg font-bold text-cream-100 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Projection
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {userIsWinning ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : isTied ? (
                <Minus className="w-5 h-5 text-cream-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-semibold ${userIsWinning ? 'text-green-400' : isTied ? 'text-cream-300' : 'text-red-400'}`}>
                {userIsWinning ? 'On track to WIN' : isTied ? 'Too close to call' : 'Opponent leading'}
              </span>
            </div>
            <span className="text-sm text-cream-500/60">
              Updates after each show
            </span>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 btn-ghost flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to League
        </button>
        <button
          onClick={handleShare}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          {copied ? <CheckCircle className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
          {copied ? 'Copied!' : 'Share Matchup'}
        </button>
      </div>

      {/* Matchup Notifications Note */}
      {isLive && (
        <div className="card p-3 bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <Radio className="w-4 h-4" />
            <span>You'll be notified when your opponent's score updates</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MatchupDetail;
