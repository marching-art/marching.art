// src/pages/HowToPlay.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Users, Calendar, Target, TrendingUp, Award,
  Clock, Star, DollarSign, Shield, Zap, Book,
  ChevronRight, Info
} from 'lucide-react';

const HowToPlay = () => {
  const [openSection, setOpenSection] = useState('getting-started');

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  const Section = ({ id, title, icon: Icon, children }) => {
    const isOpen = openSection === id;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-4 overflow-hidden"
      >
        <button
          onClick={() => toggleSection(id)}
          className="w-full p-6 flex items-center justify-between hover:bg-charcoal-700/30 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-gold rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-charcoal-900" />
            </div>
            <h2 className="text-2xl font-semibold text-cream-100">{title}</h2>
          </div>
          <ChevronRight className={`w-6 h-6 text-cream-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 pb-6 space-y-4 text-cream-300"
          >
            {children}
          </motion.div>
        )}
      </motion.div>
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
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            {title && <p className="font-semibold text-cream-100 mb-1">{title}</p>}
            <div className="text-sm">{children}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-main py-12">
      <div className="container-responsive">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-display font-bold text-gradient mb-4">How to Play</h1>
          <p className="text-cream-300 text-lg mb-8">
            Master the art of fantasy drum corps management with this comprehensive guide.
          </p>

          {/* Getting Started */}
          <Section id="getting-started" title="Getting Started" icon={Book}>
            <p>
              Welcome to <span className="text-gold-400 font-semibold">marching.art</span>,
              the ultimate fantasy drum corps game! Build your dream corps by selecting legendary
              captions from historical DCI performances, compete in seasonal competitions, and
              rise through the ranks to become a championship director.
            </p>

            <div className="space-y-3 mt-4">
              <div>
                <h4 className="font-semibold text-cream-100 mb-2">Step 1: Create Your Corps</h4>
                <p>Register your fantasy drum corps with a unique name, location, and show concept.
                You can manage corps in multiple classes simultaneously!</p>
              </div>

              <div>
                <h4 className="font-semibold text-cream-100 mb-2">Step 2: Select Your Captions</h4>
                <p>Choose 8 captions from 25 available historical DCI corps performances. Each caption
                represents a scoring category and has a point cost based on historical success.</p>
              </div>

              <div>
                <h4 className="font-semibold text-cream-100 mb-2">Step 3: Compete & Progress</h4>
                <p>Your corps will earn scores based on the selected captions. Complete daily rehearsals,
                earn XP, unlock higher classes, and compete for championships!</p>
              </div>
            </div>
          </Section>

          {/* Classes & Point Limits */}
          <Section id="classes" title="Classes & Point Limits" icon={Trophy}>
            <p>
              marching.art features four competitive classes, each with different point limits for
              caption selection. You must unlock higher classes by gaining XP through gameplay.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-cream-100">SoundSport</h4>
                  <span className="text-green-400 text-sm">Always Available</span>
                </div>
                <p className="text-cream-400 text-sm mb-2">Perfect for beginners</p>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-400" />
                  <span className="font-bold text-gold-400">90 Point Limit</span>
                </div>
              </div>

              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-cream-100">A Class</h4>
                  <span className="text-blue-400 text-sm">Unlocks at Level 3</span>
                </div>
                <p className="text-cream-400 text-sm mb-2">Intermediate competition</p>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-400" />
                  <span className="font-bold text-gold-400">60 Point Limit</span>
                </div>
              </div>

              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-cream-100">Open Class</h4>
                  <span className="text-purple-400 text-sm">Unlocks at Level 5</span>
                </div>
                <p className="text-cream-400 text-sm mb-2">Advanced competition</p>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-400" />
                  <span className="font-bold text-gold-400">120 Point Limit</span>
                </div>
              </div>

              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-cream-100">World Class</h4>
                  <span className="text-gold-400 text-sm">Unlocks at Level 10</span>
                </div>
                <p className="text-cream-400 text-sm mb-2">Elite championship level</p>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-400" />
                  <span className="font-bold text-gold-400">150 Point Limit</span>
                </div>
              </div>
            </div>

            <InfoBox title="Point Limit Strategy" color="blue">
              Each caption has a point cost (1-25 points) based on historical performance. You must select
              8 captions within your class's point limit. Higher-cost captions typically score better, but
              strategic combinations can outperform expensive lineups!
            </InfoBox>
          </Section>

          {/* Caption Selection */}
          <Section id="captions" title="Caption Selection" icon={Target}>
            <p>
              Captions are the core of your corps' scoring system. You must select exactly 8 captions,
              one for each DCI scoring category:
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">GE1</p>
                <p className="text-xs text-cream-400">General Effect 1</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">GE2</p>
                <p className="text-xs text-cream-400">General Effect 2</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">VP</p>
                <p className="text-xs text-cream-400">Visual Proficiency</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">VA</p>
                <p className="text-xs text-cream-400">Visual Analysis</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">CG</p>
                <p className="text-xs text-cream-400">Color Guard</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">B</p>
                <p className="text-xs text-cream-400">Brass</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">MA</p>
                <p className="text-xs text-cream-400">Music Analysis</p>
              </div>
              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-3 text-center">
                <p className="font-semibold text-cream-100">P</p>
                <p className="text-xs text-cream-400">Percussion</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <h4 className="font-semibold text-cream-100">Caption Change Rules:</h4>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Early Season:</strong> Unlimited changes until 5 weeks remain</li>
                <li><strong>Mid Season:</strong> 3 changes per week until 1 week remains</li>
                <li><strong>Finals Week:</strong> 2 changes between quarters/semis, 2 changes between semis/finals</li>
              </ul>
            </div>

            <InfoBox title="Pro Tip" color="green">
              Each caption comes from a different historical DCI corps (e.g., Blue Devils 2014, Carolina Crown 2013).
              Research which corps excelled in specific captions to build a winning lineup!
            </InfoBox>
          </Section>

          {/* Seasons & Competition */}
          <Section id="seasons" title="Seasons & Competition" icon={Calendar}>
            <p>
              marching.art features two distinct season types that alternate throughout the year:
            </p>

            <div className="space-y-4 mt-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h4 className="font-semibold text-cream-100">Live Season (10 weeks)</h4>
                </div>
                <p className="text-sm mb-2">
                  Follows the real DCI competition schedule. Your corps' scores are based on actual
                  DCI performances using your selected captions. Ends on the second Saturday of August.
                </p>
                <p className="text-xs text-cream-400">
                  <strong>Strategy:</strong> Pick captions from corps you think will perform well in the current year!
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <h4 className="font-semibold text-cream-100">Off-Season (42 weeks)</h4>
                </div>
                <p className="text-sm mb-2">
                  Six periods of 7 weeks each using historical and simulated scores. Focuses on
                  strategic caption selection and corps management without real-time pressure.
                </p>
                <p className="text-xs text-cream-400">
                  <strong>Strategy:</strong> Analyze historical data to find the best-performing caption combinations!
                </p>
              </div>
            </div>

            <InfoBox title="Show Selection" color="purple">
              You can optionally select which shows your corps will compete in during the season.
              Strategic show selection can maximize your scoring potential and competitive advantage!
            </InfoBox>
          </Section>

          {/* XP & Progression */}
          <Section id="progression" title="XP & Progression" icon={TrendingUp}>
            <p>
              Advance your director career by earning XP (experience points) through daily activities
              and gameplay. Leveling up unlocks new classes and features!
            </p>

            <div className="space-y-3 mt-4">
              <h4 className="font-semibold text-cream-100">Ways to Earn XP:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-gold-400" />
                    <span className="font-semibold text-cream-100">Daily Rehearsal</span>
                  </div>
                  <p className="text-sm text-cream-400">Complete daily rehearsals for consistent XP gains</p>
                </div>

                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-gold-400" />
                    <span className="font-semibold text-cream-100">Competition Results</span>
                  </div>
                  <p className="text-sm text-cream-400">Earn XP based on your corps' performance</p>
                </div>

                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-gold-400" />
                    <span className="font-semibold text-cream-100">Achievements</span>
                  </div>
                  <p className="text-sm text-cream-400">Complete achievements for bonus XP</p>
                </div>

                <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-gold-400" />
                    <span className="font-semibold text-cream-100">Battle Pass</span>
                  </div>
                  <p className="text-sm text-cream-400">Premium rewards and XP boosts</p>
                </div>
              </div>
            </div>

            <InfoBox title="Level Milestones" color="gold">
              <ul className="space-y-1 text-sm">
                <li><strong>Level 3:</strong> Unlock A Class competition</li>
                <li><strong>Level 5:</strong> Unlock Open Class competition</li>
                <li><strong>Level 10:</strong> Unlock World Class - the ultimate challenge!</li>
              </ul>
            </InfoBox>
          </Section>

          {/* Execution & Performance */}
          <Section id="execution" title="Execution & Performance" icon={Zap}>
            <p>
              Your corps' final score is affected by an execution multiplier that reflects various
              factors of your corps management. The multiplier can range from approximately 0.50x to 1.50x.
            </p>

            <div className="space-y-3 mt-4">
              <h4 className="font-semibold text-cream-100">Execution Factors:</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <span className="text-cream-300">Section Readiness</span>
                  <span className="text-gold-400 font-semibold">±12%</span>
                </div>
                <div className="flex items-center justify-between bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <span className="text-cream-300">Staff Effectiveness</span>
                  <span className="text-gold-400 font-semibold">±8%</span>
                </div>
                <div className="flex items-center justify-between bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <span className="text-cream-300">Section Morale</span>
                  <span className="text-gold-400 font-semibold">±8%</span>
                </div>
                <div className="flex items-center justify-between bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <span className="text-cream-300">Equipment Condition</span>
                  <span className="text-gold-400 font-semibold">±5%</span>
                </div>
                <div className="flex items-center justify-between bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <span className="text-cream-300">Show Difficulty</span>
                  <span className="text-gold-400 font-semibold">±15%</span>
                </div>
                <div className="flex items-center justify-between bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                  <span className="text-cream-300">Performance Variance</span>
                  <span className="text-gold-400 font-semibold">±2%</span>
                </div>
              </div>
            </div>

            <InfoBox title="Improving Execution" color="blue">
              Complete daily rehearsals to improve section readiness and morale. Hire quality staff from
              the marketplace and maintain your equipment to maximize your execution multiplier!
            </InfoBox>
          </Section>

          {/* CorpsCoin & Economy */}
          <Section id="economy" title="CorpsCoin & Economy" icon={DollarSign}>
            <p>
              CorpsCoin is the in-game currency used to purchase staff, equipment, and other upgrades
              for your corps.
            </p>

            <div className="space-y-3 mt-4">
              <h4 className="font-semibold text-cream-100">Earning CorpsCoin:</h4>
              <ul className="list-disc list-inside space-y-2">
                <li>Complete daily rehearsals</li>
                <li>Achieve high competition scores</li>
                <li>Complete achievements and challenges</li>
                <li>Battle Pass rewards (free and premium)</li>
              </ul>

              <h4 className="font-semibold text-cream-100 mt-4">Spending CorpsCoin:</h4>
              <ul className="list-disc list-inside space-y-2">
                <li>Hire staff from the DCI Hall of Fame</li>
                <li>Purchase and upgrade equipment</li>
                <li>Unlock cosmetic upgrades</li>
                <li>Trade with league members</li>
              </ul>
            </div>

            <InfoBox title="Economic Strategy" color="green">
              Balance your spending between staff (long-term performance boost) and equipment
              (maintenance and reliability). Smart investments pay dividends throughout the season!
            </InfoBox>
          </Section>

          {/* Leagues & Social */}
          <Section id="leagues" title="Leagues & Social Competition" icon={Users}>
            <p>
              Join or create leagues to compete with friends and other directors. Leagues add a social
              dimension to your fantasy drum corps experience!
            </p>

            <div className="space-y-3 mt-4">
              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <h4 className="font-semibold text-cream-100 mb-2">League Features:</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>Public or private leagues</li>
                  <li>Custom league rules and settings</li>
                  <li>League-specific leaderboards</li>
                  <li>Staff trading between members (coming soon)</li>
                  <li>League chat and social features (coming soon)</li>
                </ul>
              </div>

              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <h4 className="font-semibold text-cream-100 mb-2">Global Leaderboards:</h4>
                <p className="text-sm">
                  Compete on global leaderboards across all four classes. Track your ranking, see
                  top performers, and aim for the Hall of Champions!
                </p>
              </div>
            </div>
          </Section>

          {/* Battle Pass */}
          <Section id="battlepass" title="Battle Pass & Rewards" icon={Award}>
            <p>
              The Battle Pass offers seasonal rewards and progression bonuses. Both free and premium
              tiers are available!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h4 className="font-semibold text-cream-100">Free Tier</h4>
                </div>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    <span>CorpsCoin rewards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    <span>XP boosts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    <span>Basic cosmetic items</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    <span>Achievement progress</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-gold/10 border border-gold-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-gold-400" />
                  <h4 className="font-semibold text-cream-100">Premium Tier</h4>
                </div>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-gold-400">•</span>
                    <span>All free tier rewards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold-400">•</span>
                    <span>Exclusive cosmetics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold-400">•</span>
                    <span>Bonus CorpsCoin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold-400">•</span>
                    <span>Early access to features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold-400">•</span>
                    <span>Premium support</span>
                  </li>
                </ul>
              </div>
            </div>

            <InfoBox title="Free Rewards" color="green">
              You can claim all free tier rewards without a subscription! Premium is optional and
              supports continued development of marching.art.
            </InfoBox>
          </Section>

          {/* Strategy Tips */}
          <Section id="strategy" title="Strategy Tips" icon={Star}>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-cream-100 mb-2">🎯 Caption Selection Strategy</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Don't always pick the most expensive captions - balance is key</li>
                  <li>Research historical performance data for each corps</li>
                  <li>Consider which corps peaked in different years</li>
                  <li>Save some points for flexible adjustments mid-season</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-cream-100 mb-2">⚡ Execution Optimization</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Complete daily rehearsals consistently - don't miss days!</li>
                  <li>Invest in quality staff early for long-term benefits</li>
                  <li>Monitor equipment condition and repair before it degrades</li>
                  <li>Balance show difficulty with your corps' readiness level</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-cream-100 mb-2">💰 Economic Management</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Save CorpsCoin early season for strategic staff acquisitions</li>
                  <li>Don't overspend on equipment - maintain, don't replace constantly</li>
                  <li>Complete achievements for bonus currency</li>
                  <li>Consider premium Battle Pass for accelerated progression</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-cream-100 mb-2">🏆 Competitive Edge</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Start in SoundSport to learn mechanics without pressure</li>
                  <li>Join active leagues for collaborative strategy discussions</li>
                  <li>Watch leaderboards to see what top directors are doing</li>
                  <li>Experiment with different caption combinations in lower classes</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Quick Reference */}
          <div className="card p-6 mt-6 bg-gradient-gold/5 border-gold-500/30">
            <h2 className="text-2xl font-bold text-gradient mb-4">Quick Reference</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-cream-100 mb-2">Point Limits</h4>
                <ul className="space-y-1 text-cream-300">
                  <li>SoundSport: 90</li>
                  <li>A Class: 60</li>
                  <li>Open: 120</li>
                  <li>World: 150</li>
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
                  <li>Live: 10 weeks</li>
                  <li>Off: 42 weeks (6 periods)</li>
                  <li>Reset: 3 AM after finals</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mt-8"
          >
            <p className="text-cream-300 mb-4">Ready to build your championship corps?</p>
            <a href="/dashboard" className="btn-primary inline-flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Go to Dashboard
            </a>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default HowToPlay;
