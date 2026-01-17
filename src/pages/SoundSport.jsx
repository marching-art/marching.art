// =============================================================================
// SOUNDSPORT PAGE - Entry Point for New Directors
// =============================================================================
// Comprehensive, welcoming page for SoundSport ensembles
// Features: Interactive rules, ratings system overview, guidelines
// Note: Results are displayed in the Scores section (/scores?tab=soundsport)

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  Music, Medal, Trophy, Users, Clock, Zap, Volume2, Shield,
  ChevronDown, Star, Award, Target, Sparkles,
  Play, Info, BookOpen, CheckCircle, AlertCircle, Mic2
} from 'lucide-react';
import { Card } from '../components/ui/Card';

// =============================================================================
// CONSTANTS
// =============================================================================

const RATING_THRESHOLDS = [
  { rating: 'Gold', min: 90, color: 'bg-primary', textColor: 'text-black', borderColor: 'border-black', description: 'Outstanding performance demonstrating excellence in all criteria' },
  { rating: 'Silver', min: 75, color: 'bg-stone-300', textColor: 'text-black', borderColor: 'border-black', description: 'Strong performance with high proficiency' },
  { rating: 'Bronze', min: 60, color: 'bg-orange-300', textColor: 'text-black', borderColor: 'border-black', description: 'Solid performance meeting core standards' },
  { rating: 'Participation', min: 0, color: 'bg-white', textColor: 'text-black', borderColor: 'border-black', description: 'Completed performance' },
];

const AGE_CLASSES = [
  { id: 'cadet', name: 'Cadet', description: 'All performers under 13 years old', icon: Star },
  { id: 'youth', name: 'Youth', description: 'All performers under 22 years old', icon: Users },
  { id: 'allAge', name: 'All-Age', description: 'Mixed ages with one or more over 21', icon: Award },
];

const ADJUDICATION_CRITERIA = [
  { id: 'engagement', title: 'Audience Engagement', description: 'The ensemble engages the audience throughout the performance', icon: Users },
  { id: 'entertainment', title: 'Entertainment Value', description: 'The ensemble is effective and entertaining', icon: Sparkles },
  { id: 'concept', title: 'Developed Concept', description: 'The ensemble has a clearly developed and coordinated concept', icon: Target },
  { id: 'proficiency', title: 'Technical & Artistic Proficiency', description: 'The ensemble demonstrates technical and artistic proficiency', icon: CheckCircle },
  { id: 'creativity', title: 'Creativity & Innovation', description: 'The program demonstrates creativity and innovation', icon: Zap },
];

const PERFORMANCE_RULES = [
  { title: 'Performance Time', content: '5-7 minutes of performance time. All playing and movement must cease at 7 minutes.', icon: Clock },
  { title: 'Minimum Members', content: '5 or more members must be in the performance area at any time during the performance.', icon: Users },
  { title: 'Entry & Setup', content: '3 minutes allowed for entry and setup before performance timing begins.', icon: Play },
  { title: 'Amplification', content: 'Self-contained amplification systems are permitted. Venues provide 110V outlet.', icon: Volume2 },
  { title: 'Live Music Only', content: 'All music must be performed live in real-time. Sequenced music and loops are prohibited.', icon: Mic2 },
  { title: 'Safety', content: 'No pyrotechnics, hazardous materials, or powders. Keep the performance area safe.', icon: Shield },
];

// =============================================================================
// COLLAPSIBLE SECTION COMPONENT
// =============================================================================

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#333] rounded-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[#222] hover:bg-[#2a2a2a] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-green-500" />
          <span className="font-bold text-white">{title}</span>
        </div>
        <m.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </m.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 bg-[#1a1a1a] border-t border-[#333]">
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// RATING CARD COMPONENT
// =============================================================================

const RatingCard = ({ rating, isHighlighted = false }) => {
  return (
    <m.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 rounded-sm border-2 ${rating.color} ${rating.borderColor} ${isHighlighted ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-[#0a0a0a]' : ''}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <Medal className={`w-6 h-6 ${rating.textColor}`} />
        <span className={`font-bold text-lg ${rating.textColor}`}>{rating.rating}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-sm font-mono ${rating.textColor}`}>{rating.min}+ points</span>
      </div>
      <p className={`text-xs ${rating.textColor} opacity-80`}>{rating.description}</p>
    </m.div>
  );
};

// =============================================================================
// MAIN SOUNDSPORT PAGE COMPONENT
// =============================================================================

const SoundSport = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'rules', label: 'Rules & Guidelines', icon: BookOpen },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      {/* Hero Header - Full width background */}
      <div className="w-full bg-gradient-to-b from-green-900/30 to-[#0a0a0a] border-b border-green-500/20">
        <div className="w-full px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg border border-green-500/30">
              <Music className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">SoundSport</h1>
              <p className="text-green-400 text-sm">Your Gateway to Marching Music Performance</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm md:text-base max-w-2xl">
            SoundSport provides exciting performance opportunities for community-based musical ensembles
            of all types, all ages, and all instruments. Receive ratings (Gold, Silver, Bronze) based on
            your performance - no rankings, just recognition of excellence.
          </p>
        </div>
      </div>

      {/* Tab Navigation - Premium Pill Style */}
      <div className="w-full sticky top-0 z-10 bg-[#1a1a1a] border-b border-[#333]">
        <div className="w-full px-4 py-1.5">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-bold uppercase tracking-wider
                    whitespace-nowrap rounded-full transition-all duration-200 ease-out
                    ${activeSection === tab.id
                      ? 'text-green-400 bg-green-500/15'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 active:text-white active:bg-white/10'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {/* Active indicator dot */}
                  {activeSection === tab.id && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-6">
        <AnimatePresence mode="wait">
          {/* OVERVIEW SECTION */}
          {activeSection === 'overview' && (
            <m.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Rating System */}
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Medal className="w-5 h-5 text-green-500" />
                  Rating System
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  SoundSport uses a rating system instead of rankings. Your ensemble earns a rating
                  based on your performance score out of 100 points.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RATING_THRESHOLDS.map((rating) => (
                    <RatingCard key={rating.rating} rating={rating} />
                  ))}
                </div>
              </section>

              {/* How Scoring Works */}
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-500" />
                  How Scoring Works
                </h2>
                <Card>
                  <Card.Body className="p-4">
                    <div className="space-y-4">
                      <p className="text-gray-300 text-sm">
                        Three judges each evaluate your performance using the Overall Impression criteria.
                        Each judge scores out of 100 points, and your final score is the average.
                      </p>
                      <div className="bg-[#222] p-4 rounded-sm border border-[#333]">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Formula</div>
                          <div className="text-lg font-mono text-green-400">
                            (Judge 1 + Judge 2 + Judge 3) ÷ 3 = Final Score
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs">
                        Scores are rounded to the nearest hundredth (0.01) point. Numerical scores
                        are not publicly announced - only ratings are shared.
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              </section>

              {/* Adjudication Criteria */}
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  What Judges Look For
                </h2>
                <div className="space-y-2">
                  {ADJUDICATION_CRITERIA.map((criterion) => {
                    const Icon = criterion.icon;
                    return (
                      <div
                        key={criterion.id}
                        className="flex items-start gap-3 p-3 bg-[#1a1a1a] border border-[#333] rounded-sm"
                      >
                        <div className="p-2 bg-green-500/10 rounded">
                          <Icon className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{criterion.title}</h3>
                          <p className="text-gray-400 text-xs">{criterion.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Age Classes */}
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  Age Classifications
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {AGE_CLASSES.map((ageClass) => {
                    const Icon = ageClass.icon;
                    return (
                      <Card key={ageClass.id}>
                        <Card.Body className="p-4 text-center">
                          <Icon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <h3 className="font-bold text-white mb-1">{ageClass.name}</h3>
                          <p className="text-gray-400 text-xs">{ageClass.description}</p>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  Class winners may be awarded within each age classification, along with "Best in Show"
                  for the highest scoring ensemble regardless of class.
                </p>
              </section>

            </m.div>
          )}

          {/* RULES SECTION */}
          {activeSection === 'rules' && (
            <m.div
              key="rules"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Quick Reference - Compact Horizontal Bar */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-green-400 flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4" />
                    Quick Reference
                  </h3>
                  <div className="flex items-center gap-6 text-center">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-500" />
                      <span className="text-lg font-bold font-data text-white">5-7</span>
                      <span className="text-[10px] uppercase text-gray-500">min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <span className="text-lg font-bold font-data text-white">5+</span>
                      <span className="text-[10px] uppercase text-gray-500">members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-500" />
                      <span className="text-lg font-bold font-data text-white">3</span>
                      <span className="text-[10px] uppercase text-gray-500">judges</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Rules */}
              <CollapsibleSection
                title="Performance Requirements"
                icon={Play}
                defaultOpen={true}
              >
                <div className="space-y-3">
                  {PERFORMANCE_RULES.map((rule) => {
                    const Icon = rule.icon;
                    return (
                      <div key={rule.title} className="flex items-start gap-3">
                        <div className="p-2 bg-[#222] rounded">
                          <Icon className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{rule.title}</h4>
                          <p className="text-gray-400 text-xs">{rule.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>

              {/* Equipment Guidelines */}
              <CollapsibleSection title="Equipment & Amplification" icon={Volume2}>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-[#222] rounded border-l-2 border-green-500">
                    <h4 className="font-bold text-white mb-1">Musical Instruments</h4>
                    <p className="text-gray-400 text-xs">
                      Any instrument or implement that is played or struck to create sound in real time,
                      including the human voice.
                    </p>
                  </div>
                  <div className="p-3 bg-[#222] rounded border-l-2 border-green-500">
                    <h4 className="font-bold text-white mb-1">Electronic Instruments</h4>
                    <p className="text-gray-400 text-xs">
                      Music from electronic instruments is allowed if performed live in real-time.
                      Sequenced music and musical loops are prohibited.
                    </p>
                  </div>
                  <div className="p-3 bg-[#222] rounded border-l-2 border-yellow-500">
                    <h4 className="font-bold text-yellow-400 mb-1">Allowed</h4>
                    <p className="text-gray-400 text-xs">
                      Pre-recorded sound effects and human voice may be used.
                    </p>
                  </div>
                  <div className="p-3 bg-[#222] rounded border-l-2 border-red-500">
                    <h4 className="font-bold text-red-400 mb-1">Prohibited</h4>
                    <p className="text-gray-400 text-xs">
                      Motorized carts, pyrotechnics, hazardous materials, powders, glitter, confetti,
                      and anything leaving residue.
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Timing Details */}
              <CollapsibleSection title="Timing & Schedule" icon={Clock}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-[#222] rounded text-center">
                      <div className="text-3xl font-bold text-green-500 mb-1">10 min</div>
                      <div className="text-xs text-gray-400">Total Block Time</div>
                    </div>
                    <div className="p-4 bg-[#222] rounded text-center">
                      <div className="text-3xl font-bold text-green-500 mb-1">3 min</div>
                      <div className="text-xs text-gray-400">Setup Time</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-gray-400">
                    <p className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      Timing starts with first step or first note, whichever occurs first
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      Timing ends with last note of music on performance stage
                    </p>
                    <p className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      Under 5 minutes or over 7 minutes: 0.1 point penalty per 3 seconds
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Stage Conduct */}
              <CollapsibleSection title="Stage Conduct" icon={Shield}>
                <div className="space-y-3 text-sm">
                  <p className="text-gray-300">
                    All musical instruments, implements, equipment, and props must be placed within
                    the performance area. Performers may not enter any viewing area.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                      <h4 className="font-bold text-green-400 text-xs mb-1">Stage Dimensions</h4>
                      <p className="text-gray-400 text-xs">30 yards wide × 20 yards deep (minimum)</p>
                    </div>
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                      <h4 className="font-bold text-green-400 text-xs mb-1">Corner Markers</h4>
                      <p className="text-gray-400 text-xs">Visual markers at all four corners</p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Penalties */}
              <CollapsibleSection title="Penalties" icon={AlertCircle}>
                <div className="space-y-2">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Illegal equipment</span>
                      <span className="text-red-400 font-bold">-2.0 pts</span>
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Timing violation (per 3 sec)</span>
                      <span className="text-yellow-400 font-bold">-0.1 pts</span>
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Late to ready line (per 1.5 min)</span>
                      <span className="text-yellow-400 font-bold">-0.1 pts</span>
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Boundary violation (per member)</span>
                      <span className="text-yellow-400 font-bold">-0.1 pts</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Maximum -2.0 pts for 20+ members</p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Official Rules Link */}
              <div className="mt-6 p-4 bg-[#1a1a1a] border border-[#333] rounded-sm text-center">
                <p className="text-gray-400 text-sm">
                  These are highlights from the official 2025 SoundSport Rulebook.
                </p>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SoundSport;
