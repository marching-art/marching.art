// src/pages/HowToPlay.jsx
// Comprehensive game guide for marching.art
import React, { useState } from 'react';
import { m } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Trophy, Users, Calendar, Target, TrendingUp, Award,
  Clock, Star, DollarSign, Book, ChevronRight, Info,
  HelpCircle, Music, Zap, ArrowLeft, Search
} from 'lucide-react';

const HowToPlay = () => {
  const [openSection, setOpenSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  const Section = ({ id, title, icon: Icon, children }) => {
    const isOpen = openSection === id;

    // Filter sections based on search
    if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) {
      const childText = typeof children === 'string' ? children : '';
      if (!childText.toLowerCase().includes(searchQuery.toLowerCase())) {
        return null;
      }
    }

    return (
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg mb-4 overflow-hidden"
      >
        <button
          onClick={() => toggleSection(id)}
          className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-charcoal-700/30 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-gold-400" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-cream-100">{title}</h2>
          </div>
          <ChevronRight className={`w-5 h-5 text-cream-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        {isOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 md:px-6 pb-4 md:pb-6 space-y-4 text-cream-300"
          >
            {children}
          </m.div>
        )}
      </m.div>
    );
  };

  const InfoBox = ({ title, children, color = 'gold' }) => {
    const colors = {
      gold: 'border-gold-500/30 bg-gold-500/10',
      blue: 'border-blue-500/30 bg-blue-500/10',
      green: 'border-green-500/30 bg-green-500/10',
      purple: 'border-purple-500/30 bg-purple-500/10'
    };

    return (
      <div className={`border rounded-lg p-4 ${colors[color]}`}>
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-cream-300" />
          <div>
            {title && <p className="font-semibold text-cream-100 mb-1">{title}</p>}
            <div className="text-sm">{children}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-charcoal-900 py-6 md:py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <m.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-cream-400 hover:text-cream-200 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gold-500/20 rounded-lg flex items-center justify-center">
              <Book className="w-6 h-6 text-gold-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-cream-100">Game Guide</h1>
              <p className="text-cream-400 text-sm">Everything you need to master marching.art</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500" />
            <input
              type="text"
              placeholder="Search the guide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 placeholder-cream-500 focus:outline-none focus:border-gold-500/50"
            />
          </div>
        </m.div>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started" icon={Book}>
          <p className="text-base">
            Welcome to <span className="text-gold-400 font-semibold">marching.art</span> -
            the fantasy game for drum corps fans! Build your dream corps by selecting
            caption performances from historical DCI shows, compete against other directors,
            and climb the leaderboards.
          </p>

          <div className="space-y-4 mt-4">
            <div className="bg-charcoal-900/50 rounded-lg p-4">
              <h4 className="font-semibold text-cream-100 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-gold-500 text-charcoal-900 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Create Your Corps
              </h4>
              <p className="text-sm">
                Register your fantasy drum corps with a unique name and show concept.
                You start in SoundSport class and can unlock higher classes as you level up.
              </p>
            </div>

            <div className="bg-charcoal-900/50 rounded-lg p-4">
              <h4 className="font-semibold text-cream-100 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-gold-500 text-charcoal-900 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Draft Your Lineup
              </h4>
              <p className="text-sm">
                Select 8 caption performances from 25 available historical DCI corps.
                Each caption has a point cost based on how well that corps performed historically.
                Stay within your class's point budget!
              </p>
            </div>

            <div className="bg-charcoal-900/50 rounded-lg p-4">
              <h4 className="font-semibold text-cream-100 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-gold-500 text-charcoal-900 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Compete & Earn
              </h4>
              <p className="text-sm">
                Your corps earns scores based on the historical performance of your selected captions.
                Check in daily to earn XP, climb the leaderboards, and unlock new classes!
              </p>
            </div>
          </div>
        </Section>

        {/* Classes & Point Limits */}
        <Section id="classes" title="Classes & Point Budgets" icon={Trophy}>
          <p>
            There are four competitive classes, each with different point budgets for building your lineup.
            Higher classes have larger budgets, allowing you to select more premium captions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-charcoal-900/50 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-cream-100">SoundSport</h4>
                <span className="text-green-400 text-xs px-2 py-0.5 bg-green-500/20 rounded">Default</span>
              </div>
              <p className="text-cream-400 text-sm mb-3">Entry level - perfect for learning</p>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gold-400" />
                <span className="font-bold text-gold-400">90 Point Budget</span>
              </div>
            </div>

            <div className="bg-charcoal-900/50 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-cream-100">A Class</h4>
                <span className="text-blue-400 text-xs px-2 py-0.5 bg-blue-500/20 rounded">Level 3</span>
              </div>
              <p className="text-cream-400 text-sm mb-3">Tighter budget, strategic drafting</p>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gold-400" />
                <span className="font-bold text-gold-400">60 Point Budget</span>
              </div>
            </div>

            <div className="bg-charcoal-900/50 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-cream-100">Open Class</h4>
                <span className="text-purple-400 text-xs px-2 py-0.5 bg-purple-500/20 rounded">Level 5</span>
              </div>
              <p className="text-cream-400 text-sm mb-3">Expanded options, more competition</p>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gold-400" />
                <span className="font-bold text-gold-400">120 Point Budget</span>
              </div>
            </div>

            <div className="bg-charcoal-900/50 border border-gold-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-cream-100">World Class</h4>
                <span className="text-gold-400 text-xs px-2 py-0.5 bg-gold-500/20 rounded">Level 10</span>
              </div>
              <p className="text-cream-400 text-sm mb-3">Elite competition, maximum flexibility</p>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gold-400" />
                <span className="font-bold text-gold-400">150 Point Budget</span>
              </div>
            </div>
          </div>

          <InfoBox title="Unlocking Classes" color="blue">
            You can unlock classes by reaching the required level OR by spending CorpsCoin:
            A Class (Level 3 or 1,000 CC), Open Class (Level 5 or 2,500 CC), World Class (Level 10 or 5,000 CC).
          </InfoBox>
        </Section>

        {/* Caption Selection */}
        <Section id="captions" title="Captions & Drafting" icon={Music}>
          <p>
            Your lineup consists of 8 captions - one for each DCI scoring category.
            Each caption comes from a historical corps performance (e.g., "Blue Devils 2014 - Brass").
          </p>

          <h4 className="font-semibold text-cream-100 mt-4 mb-3">The 8 Caption Categories:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { abbr: 'GE1', name: 'General Effect 1' },
              { abbr: 'GE2', name: 'General Effect 2' },
              { abbr: 'VP', name: 'Visual Proficiency' },
              { abbr: 'VA', name: 'Visual Analysis' },
              { abbr: 'CG', name: 'Color Guard' },
              { abbr: 'B', name: 'Brass' },
              { abbr: 'MA', name: 'Music Analysis' },
              { abbr: 'P', name: 'Percussion' },
            ].map(cap => (
              <div key={cap.abbr} className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-bold text-cream-100">{cap.abbr}</p>
                <p className="text-xs text-cream-400">{cap.name}</p>
              </div>
            ))}
          </div>

          <h4 className="font-semibold text-cream-100 mt-6 mb-2">Caption Point Costs</h4>
          <p className="text-sm mb-3">
            Each caption costs 1-25 points based on how well that corps historically performed in that category.
            Higher-cost captions generally score better, but smart combinations of mid-tier captions can compete!
          </p>

          <h4 className="font-semibold text-cream-100 mt-6 mb-2">Lineup Change Rules</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Early Season (5+ weeks left):</strong> Unlimited changes</li>
            <li><strong>Mid Season (2-4 weeks left):</strong> 3 changes per week</li>
            <li><strong>Finals Week:</strong> 2 changes between each round</li>
          </ul>

          <InfoBox title="Pro Tip" color="green">
            Research which corps excelled in specific captions across different years.
            A corps might have legendary brass but average percussion - mix and match!
          </InfoBox>
        </Section>

        {/* Seasons */}
        <Section id="seasons" title="Seasons & Competition" icon={Calendar}>
          <p>
            marching.art runs two alternating season types throughout the year:
          </p>

          <div className="space-y-4 mt-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h4 className="font-semibold text-cream-100">Live Season (June - August)</h4>
              </div>
              <p className="text-sm mb-2">
                Runs alongside the real DCI season. Your corps' scores are calculated using
                actual DCI competition results. Pick captions from corps you think will perform
                well this year!
              </p>
              <p className="text-xs text-cream-400">
                Duration: ~10 weeks, ending the second Saturday of August (DCI Finals)
              </p>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-cream-100">Off-Season (August - May)</h4>
              </div>
              <p className="text-sm mb-2">
                Uses historical DCI data to simulate competitions. Broken into six 7-week periods
                with a 49-show schedule. Perfect for analyzing historical performance patterns.
              </p>
              <p className="text-xs text-cream-400">
                Duration: ~42 weeks total (6 periods of 7 weeks each)
              </p>
            </div>
          </div>

          <InfoBox title="Season Transitions" color="purple">
            When a season ends, leaderboards reset and a new season begins. Your XP, level,
            and unlocked classes carry over - only competitive rankings reset.
          </InfoBox>
        </Section>

        {/* XP & Progression */}
        <Section id="progression" title="XP & Leveling Up" icon={TrendingUp}>
          <p>
            Earn XP (experience points) to level up your director profile.
            Higher levels unlock new classes and features!
          </p>

          <h4 className="font-semibold text-cream-100 mt-4 mb-3">Ways to Earn XP:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-charcoal-900/50 border border-charcoal-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-gold-400" />
                <span className="font-semibold text-cream-100">Daily Check-in</span>
              </div>
              <p className="text-sm text-cream-400">Log in daily to earn XP and maintain your streak</p>
            </div>

            <div className="bg-charcoal-900/50 border border-charcoal-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-gold-400" />
                <span className="font-semibold text-cream-100">Competition Scores</span>
              </div>
              <p className="text-sm text-cream-400">Earn XP based on your corps' performance</p>
            </div>

            <div className="bg-charcoal-900/50 border border-charcoal-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-gold-400" />
                <span className="font-semibold text-cream-100">Achievements</span>
              </div>
              <p className="text-sm text-cream-400">Complete achievements for bonus XP</p>
            </div>

            <div className="bg-charcoal-900/50 border border-charcoal-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-gold-400" />
                <span className="font-semibold text-cream-100">Streak Bonuses</span>
              </div>
              <p className="text-sm text-cream-400">Maintain daily streaks for multiplied XP</p>
            </div>
          </div>

          <InfoBox title="Level Milestones" color="gold">
            <ul className="space-y-1">
              <li><strong>Level 3:</strong> Unlock A Class</li>
              <li><strong>Level 5:</strong> Unlock Open Class</li>
              <li><strong>Level 10:</strong> Unlock World Class</li>
            </ul>
          </InfoBox>
        </Section>

        {/* CorpsCoin */}
        <Section id="economy" title="CorpsCoin Economy" icon={DollarSign}>
          <p>
            CorpsCoin (CC) is the in-game currency. Earn it through gameplay and spend it on
            class unlocks and streak protection.
          </p>

          <h4 className="font-semibold text-cream-100 mt-4 mb-2">Earning CorpsCoin:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm mb-4">
            <li>Daily check-ins and streak bonuses</li>
            <li>Strong competition performance</li>
            <li>Completing achievements</li>
            <li>Leveling up your profile</li>
          </ul>

          <h4 className="font-semibold text-cream-100 mb-2">Spending CorpsCoin:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Class Unlocks:</strong> Skip level requirements (1,000 - 5,000 CC)</li>
            <li><strong>Streak Freeze:</strong> Protect your streak if you miss a day (300 CC)</li>
          </ul>

          <InfoBox title="Tip" color="green">
            CorpsCoin can't buy better scores or competitive advantages -
            it's purely for convenience and class access.
          </InfoBox>
        </Section>

        {/* Leagues */}
        <Section id="leagues" title="Leagues & Social" icon={Users}>
          <p>
            Compete with friends and other directors in leagues!
            Create private leagues for your group or join public ones.
          </p>

          <h4 className="font-semibold text-cream-100 mt-4 mb-3">League Features:</h4>
          <div className="bg-charcoal-900/50 border border-charcoal-700 rounded-lg p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gold-400 rounded-full" />
                <span><strong>Public or Private:</strong> Open leagues or invite-only with join codes</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gold-400 rounded-full" />
                <span><strong>League Standings:</strong> Track rankings within your league</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gold-400 rounded-full" />
                <span><strong>Custom Settings:</strong> Configure scoring format and finals size</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gold-400 rounded-full" />
                <span><strong>Head-to-Head:</strong> Weekly matchups against league members</span>
              </li>
            </ul>
          </div>

          <h4 className="font-semibold text-cream-100 mt-4 mb-2">Global Leaderboards:</h4>
          <p className="text-sm">
            Beyond leagues, compete on global leaderboards for each class.
            Top performers are featured in the Hall of Champions!
          </p>
        </Section>

        {/* Strategy Tips */}
        <Section id="strategy" title="Strategy Tips" icon={Star}>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-cream-100 mb-2">Caption Selection</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Don't always pick the most expensive captions - balance matters</li>
                <li>Research which corps peaked in different years</li>
                <li>Some corps excel at specific captions (e.g., SCV percussion, Crown brass)</li>
                <li>Save some budget flexibility for mid-season adjustments</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-cream-100 mb-2">Class Strategy</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Start in SoundSport to learn the game mechanics</li>
                <li>A Class's tight 60-point budget rewards strategic thinking</li>
                <li>Open and World Class let you build more premium lineups</li>
                <li>You can run corps in multiple classes simultaneously</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-cream-100 mb-2">Progression</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Check in daily - consistent play beats sporadic grinding</li>
                <li>Maintain your streak for bonus XP multipliers</li>
                <li>Join active leagues for community and competition</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Glossary */}
        <Section id="glossary" title="DCI Glossary" icon={Book}>
          <p className="mb-4">New to drum corps? Here are the key terms:</p>

          <div className="space-y-3">
            {[
              { term: 'DCI', def: 'Drum Corps International - the governing body for competitive drum corps in North America' },
              { term: 'Caption', def: 'A scoring category (GE, Visual, Music, etc.) - judges score each caption separately' },
              { term: 'General Effect (GE)', def: 'How the overall show impacts the audience emotionally and artistically' },
              { term: 'Visual', def: 'Marching, staging, and choreography quality (VP = proficiency, VA = analysis)' },
              { term: 'Music', def: 'Musical performance quality (Brass, Percussion, MA = music analysis)' },
              { term: 'Color Guard', def: 'The flag, rifle, and saber performers who add visual artistry' },
              { term: 'Finals', def: 'Championship competition held in August - the culmination of the DCI season' },
              { term: 'World Class', def: 'The top competitive tier in real DCI (and our game!)' },
              { term: 'Open Class', def: 'Developing corps working toward World Class' },
            ].map(item => (
              <div key={item.term} className="bg-charcoal-900/50 rounded-lg p-3">
                <span className="font-semibold text-gold-400">{item.term}:</span>
                <span className="text-cream-300 ml-2">{item.def}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" title="Frequently Asked Questions" icon={HelpCircle}>
          <div className="space-y-4">
            {[
              {
                q: 'How are scores calculated?',
                a: 'Your corps score is the sum of your 8 caption scores. Each caption score comes from the historical (or live) performance of the corps you selected for that caption.'
              },
              {
                q: 'Can I change my lineup?',
                a: 'Yes! Early in the season you have unlimited changes. As finals approach, changes become limited to encourage strategic commitment.'
              },
              {
                q: 'What happens when a season ends?',
                a: 'Leaderboards reset and a new season begins. Your XP, level, unlocked classes, and CorpsCoin carry over.'
              },
              {
                q: 'How do I unlock higher classes?',
                a: 'Reach the required level (3/5/10) OR spend CorpsCoin to unlock early. Classes remain unlocked permanently.'
              },
              {
                q: 'What\'s the difference between Live and Off-Season?',
                a: 'Live Season uses real-time DCI scores from actual competitions. Off-Season uses historical data to simulate competitions year-round.'
              },
              {
                q: 'Can I compete in multiple classes?',
                a: 'Yes! You can have a separate corps in each unlocked class, each with its own lineup and rankings.'
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-charcoal-900/50 border border-charcoal-700 rounded-lg p-4">
                <h4 className="font-semibold text-cream-100 mb-2">{item.q}</h4>
                <p className="text-sm text-cream-300">{item.a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Quick Reference */}
        <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-4 md:p-6 mt-6">
          <h2 className="text-xl font-bold text-cream-100 mb-4">Quick Reference</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-cream-100 mb-2">Point Budgets</h4>
              <ul className="space-y-1 text-cream-300">
                <li>SoundSport: 90</li>
                <li>A Class: 60</li>
                <li>Open Class: 120</li>
                <li>World Class: 150</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-cream-100 mb-2">Level Unlocks</h4>
              <ul className="space-y-1 text-cream-300">
                <li>Level 3: A Class</li>
                <li>Level 5: Open Class</li>
                <li>Level 10: World Class</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-cream-100 mb-2">Season Length</h4>
              <ul className="space-y-1 text-cream-300">
                <li>Live: ~10 weeks</li>
                <li>Off-Season: ~42 weeks</li>
                <li>Off-Season periods: 6 x 7 weeks</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8 pb-8"
        >
          <p className="text-cream-400 mb-4">Ready to build your championship corps?</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg font-bold hover:bg-gold-400 transition-colors"
          >
            <Trophy className="w-5 h-5" />
            Go to Dashboard
          </Link>
        </m.div>
      </div>
    </div>
  );
};

export default HowToPlay;
