// =============================================================================
// PUBLIC HOW-TO-PLAY PAGE - /how-to-play
// =============================================================================
// Fully public, crawlable long-form guide targeting "fantasy drum corps"
// searches. Unlike the authenticated /guide (tabs + accordions), every section
// renders in the document so search engines index the complete content.
// Game facts (captions, classes, glossary, FAQ) are imported from HowToPlay
// so the two pages never drift apart.

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Users,
  Calendar,
  Target,
  TrendingUp,
  Clock,
  Book,
  ChevronRight,
  Play,
} from 'lucide-react';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useSEO } from '../hooks/useSEO';
import { CAPTIONS, CLASSES, GLOSSARY, FAQ } from './howToPlayData';

const PAGE_FAQ = [
  {
    q: 'What is fantasy drum corps?',
    a: 'Fantasy drum corps is a fantasy sports game for the marching arts. On marching.art you draft caption performances (General Effect, Visual, Color Guard, Brass, Percussion, and more) from 50 years of DCI history, build a corps lineup within a point budget, and earn points from real competition scores as the season unfolds.',
  },
  {
    q: 'Is marching.art free to play?',
    a: 'Yes. marching.art is free to play. Create an account, name your corps, draft your lineup, and compete on public leaderboards or in private leagues with friends.',
  },
  ...FAQ,
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PAGE_FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const SectionHeading = ({ icon: Icon, children }) => (
  <h2 className="flex items-center gap-3 text-xl font-bold text-white mb-4">
    <span className="w-8 h-8 bg-[#0057B8]/20 rounded-none flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-[#0057B8]" />
    </span>
    {children}
  </h2>
);

const HowToPlayPublic = () => {
  useBodyScroll();
  useSEO({
    title: 'How to Play Fantasy Drum Corps — Free DCI Fantasy Game | marching.art',
    description:
      'Learn how fantasy drum corps works: draft 8 DCI captions from 50 years of history, manage a point budget, and score points from real competition results. Free to play.',
    path: '/how-to-play',
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      {/* Top bar */}
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="text-sm font-bold text-white hover:text-yellow-500 transition-colors"
          >
            marching<span className="text-yellow-500">.art</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-gray-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 bg-[#0057B8] text-white font-bold text-xs uppercase tracking-wider rounded-none hover:bg-[#0066d6] transition-colors"
            >
              Create Your Corps
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Intro */}
        <p className="text-xs font-bold uppercase tracking-wider text-[#0057B8] mb-2">
          The Fantasy Drum Corps Game
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
          How to Play Fantasy Drum Corps
        </h1>
        <p className="text-lg text-gray-300 mb-4">
          Fantasy drum corps works like fantasy football for the marching arts. Instead of drafting
          quarterbacks and running backs, you draft{' '}
          <strong className="text-white">caption performances</strong> — General Effect, Visual,
          Color Guard, Brass, Percussion, and more — from 50 years of Drum Corps International (DCI)
          history. Your fantasy corps earns points from real competition scores, and you climb
          leaderboards against directors worldwide.
        </p>
        <p className="text-gray-400 mb-8">
          marching.art is free to play, runs year-round, and takes about two minutes to get started.
        </p>

        {/* Quick start */}
        <section className="mb-10">
          <SectionHeading icon={Trophy}>Quick Start</SectionHeading>
          <ol className="space-y-4">
            {[
              [
                'Create your corps',
                'Register free and give your corps a unique name. Every director starts in SoundSport class.',
              ],
              [
                'Draft your lineup',
                'Select 8 captions from historical DCI corps performances. Each caption has a point cost — stay within your class budget.',
              ],
              [
                'Compete and level up',
                'Earn scores from real DCI results, gain XP, unlock higher classes, and climb the leaderboards.',
              ],
            ].map(([title, desc], i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-[#0057B8] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Captions */}
        <section className="mb-10">
          <SectionHeading icon={Target}>The 8 Captions You Draft</SectionHeading>
          <p className="text-sm text-gray-300 mb-4">
            Your lineup mirrors how real DCI judging works: one selection in each of the eight
            scoring captions. Each caption comes from a real historical corps performance and costs
            1–25 points based on how that corps actually scored.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {CAPTIONS.map((cap) => (
              <div key={cap.abbr} className="bg-[#111] border border-white/10 rounded-none p-3">
                <p className="text-sm text-white">
                  <span className="font-bold text-[#0057B8] mr-2">{cap.abbr}</span>
                  {cap.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">{cap.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Classes */}
        <section className="mb-10">
          <SectionHeading icon={TrendingUp}>Four Competitive Classes</SectionHeading>
          <p className="text-sm text-gray-300 mb-4">
            Classes set your drafting budget. Everyone starts in SoundSport; reach the required
            level (or spend CorpsCoin earned in-game) to unlock the rest — permanently.
          </p>
          <div className="space-y-2">
            {CLASSES.map((cls) => (
              <div
                key={cls.id}
                className="bg-[#111] border border-white/10 rounded-none p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-white">{cls.name}</p>
                  <p className="text-xs text-gray-500">{cls.desc}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#0057B8]">{cls.points} pts</p>
                  <p className="text-xs text-gray-500">{cls.unlock}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Seasons */}
        <section className="mb-10">
          <SectionHeading icon={Calendar}>Seasons Run Year-Round</SectionHeading>
          <div className="space-y-3">
            <div className="bg-[#111] border border-[#0057B8]/30 rounded-none p-4">
              <p className="text-sm font-bold text-white mb-1">
                Live Season{' '}
                <span className="text-xs font-normal text-gray-500 ml-2">June – August</span>
              </p>
              <p className="text-sm text-gray-400">
                Runs alongside the real DCI summer tour. Your fantasy scores track actual
                competition results night by night, through Finals in August.
              </p>
            </div>
            <div className="bg-[#111] border border-purple-500/30 rounded-none p-4">
              <p className="text-sm font-bold text-white mb-1">
                Off-Season{' '}
                <span className="text-xs font-normal text-gray-500 ml-2">August – May</span>
              </p>
              <p className="text-sm text-gray-400">
                Six 7-week seasons scored with historical DCI data, so there is always a leaderboard
                to climb. XP, levels, unlocked classes, and CorpsCoin carry over between seasons.
              </p>
            </div>
          </div>
        </section>

        {/* Scoring */}
        <section className="mb-10">
          <SectionHeading icon={Clock}>How Scoring Works</SectionHeading>
          <p className="text-sm text-gray-300 mb-3">
            Your corps score is the sum of your 8 caption scores, taken from the real (or
            historical) performances you drafted. Lineup changes are unlimited for the first two
            weeks, then tighten as finals approach — 3 per week mid-season, none on Days 43-44, and
            just 2 total during Championship Week — so timing your moves is part of the strategy.
          </p>
          <p className="text-sm text-gray-300">
            Along the way you earn XP and CorpsCoin from daily check-ins, competition results,
            achievements, and streaks.
          </p>
        </section>

        {/* Leagues */}
        <section className="mb-10">
          <SectionHeading icon={Users}>Leagues and Leaderboards</SectionHeading>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-[#0057B8] flex-shrink-0 mt-0.5" />
              Create public or private leagues with join codes and compete head-to-head with
              friends.
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-[#0057B8] flex-shrink-0 mt-0.5" />
              Global leaderboards for every class, updated as scores come in.
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-[#0057B8] flex-shrink-0 mt-0.5" />
              Field a separate corps in each class you have unlocked, each with its own lineup and
              ranking.
            </li>
          </ul>
        </section>

        {/* Glossary */}
        <section className="mb-10">
          <SectionHeading icon={Book}>New to Drum Corps? Key Terms</SectionHeading>
          <dl className="space-y-3">
            {GLOSSARY.map((item) => (
              <div key={item.term} className="bg-[#111] border border-white/10 rounded-none p-3">
                <dt className="text-sm font-bold text-[#0057B8]">{item.term}</dt>
                <dd className="text-sm text-gray-400 mt-1">{item.def}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* FAQ - content mirrors the FAQPage JSON-LD above */}
        <section className="mb-10">
          <SectionHeading icon={Trophy}>Fantasy Drum Corps FAQ</SectionHeading>
          <div className="space-y-4">
            {PAGE_FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-bold text-white mb-1">{item.q}</h3>
                <p className="text-sm text-gray-400">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0057B8]/10 border border-[#0057B8]/30 rounded-none p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Ready to Direct Your Own Corps?</h2>
          <p className="text-sm text-gray-400 mb-4">
            Join directors worldwide playing fantasy drum corps — free, year-round, no downloads.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 min-h-[44px] px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider rounded-none hover:bg-[#0066d6] transition-colors"
            >
              Create Your Corps
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              to="/preview"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 border border-yellow-500/50 text-yellow-500 font-bold text-sm uppercase tracking-wider rounded-none hover:bg-yellow-500/10 transition-colors"
            >
              <Play className="w-4 h-4" />
              Try the Demo
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-4">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link to="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/preview" className="hover:text-white transition-colors">
            Demo
          </Link>
          <Link to="/register" className="hover:text-white transition-colors">
            Register
          </Link>
          <Link to="/login" className="hover:text-white transition-colors">
            Sign In
          </Link>
          <Link to="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HowToPlayPublic;
