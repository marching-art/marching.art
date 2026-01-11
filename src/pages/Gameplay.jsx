// src/pages/Gameplay.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Users, Calendar, TrendingUp, Zap, Target, Medal, Sparkles } from 'lucide-react';
import { useBodyScroll } from '../hooks/useBodyScroll';

const Gameplay = () => {
  useBodyScroll();

  return (
    <div className="min-h-screen bg-gradient-main">
      <div className="container-responsive py-8 px-4 max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-cream-300 hover:text-gold-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="glass-dark rounded-2xl p-6 sm:p-8">
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">
            How to Play
          </h1>
          <p className="text-cream-400 text-lg mb-8">
            Fantasy Drum Corps meets real-time competition
          </p>

          <div className="space-y-8 text-cream-300">

            {/* The Concept */}
            <section className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#0057B8]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-[#0057B8]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">The Concept</h2>
                  <p className="text-sm text-cream-400 mt-1">Where fantasy sports meets the marching arts</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed">
                Think fantasy football, but for drum corps. You're the director of your own virtual ensemble,
                drafting real DCI corps as your "players." When they perform on the field, you score points.
                Every show matters. Every tenth of a point counts. Welcome to a summer where you're not just
                watching—you're competing.
              </p>
            </section>

            {/* Getting Started */}
            <section>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">Getting Started</h2>
                  <p className="text-sm text-cream-400 mt-1">From signup to your first score in minutes</p>
                </div>
              </div>
              <div className="space-y-3 ml-13">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0057B8] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <div>
                    <p className="text-sm font-medium text-cream-100">Create your account</p>
                    <p className="text-xs text-cream-400">Free to play. No credit card needed.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0057B8] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <div>
                    <p className="text-sm font-medium text-cream-100">Name your corps</p>
                    <p className="text-xs text-cream-400">Give it a name, a hometown, and a show theme. Make it yours.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0057B8] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <div>
                    <p className="text-sm font-medium text-cream-100">Draft your roster</p>
                    <p className="text-xs text-cream-400">Select real DCI corps across World, Open, and All-Age classes.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0057B8] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                  <div>
                    <p className="text-sm font-medium text-cream-100">Watch, wait, win</p>
                    <p className="text-xs text-cream-400">Your points update automatically after every real show.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Scoring System */}
            <section>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">How Scoring Works</h2>
                  <p className="text-sm text-cream-400 mt-1">Real scores, real stakes</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed">
                  Your fantasy score is calculated from the actual competition scores of the corps on your roster.
                  The better they perform on the field, the more points you earn.
                </p>
                <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
                  <p className="font-medium text-cream-100 mb-2">Key mechanics:</p>
                  <ul className="list-disc list-inside space-y-1 text-cream-400">
                    <li>Scores update after each DCI competition</li>
                    <li>Bonus multipliers reward smart drafting strategy</li>
                    <li>Caption awards and rankings factor into final scores</li>
                    <li>Season-long consistency matters as much as peak performance</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Leagues */}
            <section>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">Leagues & Competition</h2>
                  <p className="text-sm text-cream-400 mt-1">Solo or squad—your call</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed">
                  Compete globally in the public leaderboard, or create private leagues to battle friends,
                  alumni groups, or fellow section members. Set custom rules, talk trash, and crown your champion.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                    <p className="font-medium text-cream-100 text-xs uppercase tracking-wide mb-1">Public Leagues</p>
                    <p className="text-xs text-cream-400">Compete against the entire marching.art community</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                    <p className="font-medium text-cream-100 text-xs uppercase tracking-wide mb-1">Private Leagues</p>
                    <p className="text-xs text-cream-400">Invite-only competitions with custom settings</p>
                  </div>
                </div>
              </div>
            </section>

            {/* The Season */}
            <section>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">The Season</h2>
                  <p className="text-sm text-cream-400 mt-1">June through August—every week counts</p>
                </div>
              </div>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  The fantasy season mirrors the DCI tour. From the first June regional to Finals Week in
                  Indianapolis, your roster accumulates points. Trade strategically, watch the standings,
                  and make your move when it matters.
                </p>
                <p>
                  Major events like the DCI Southwestern Championship, Drums Along the Rockies, and Finals
                  carry extra weight. Position yourself for these high-stakes weekends.
                </p>
              </div>
            </section>

            {/* XP & Progression */}
            <section>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#0057B8]/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-[#0057B8]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">XP & Progression</h2>
                  <p className="text-sm text-cream-400 mt-1">Level up beyond the leaderboard</p>
                </div>
              </div>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  Every action earns XP—logging in daily, making roster moves, winning head-to-head matchups,
                  climbing the standings. Level up to unlock achievements, earn Corps Coin, and build your
                  legacy as a fantasy director.
                </p>
                <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
                  <p className="font-medium text-cream-100 mb-2">Earn XP through:</p>
                  <ul className="list-disc list-inside space-y-1 text-cream-400">
                    <li>Daily login streaks</li>
                    <li>Roster management and trades</li>
                    <li>League participation and wins</li>
                    <li>Season milestones and achievements</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Winning */}
            <section className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl p-5 border border-yellow-500/20">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/30 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-cream-100">Glory Awaits</h2>
                  <p className="text-sm text-cream-400 mt-1">Championships aren't won in August—they're built all summer</p>
                </div>
              </div>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  When Finals Week arrives, the best fantasy directors rise to the top. Your cumulative
                  score—built through months of strategic decisions, calculated risks, and a little bit
                  of luck—determines your final standing.
                </p>
                <p className="text-cream-100 font-medium">
                  Will you be the one lifting the trophy when the confetti falls in Lucas Oil?
                </p>
              </div>
            </section>

            {/* CTA */}
            <section className="text-center pt-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0057B8] text-white font-display font-bold uppercase tracking-wide rounded-lg hover:bg-[#0066d6] transition-colors"
              >
                <Medal className="w-5 h-5" />
                Start Your Journey
              </Link>
              <p className="text-xs text-cream-400 mt-3">
                Free to play. Join thousands of drum corps fans competing this season.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Gameplay;
