// =============================================================================
// GAME GUIDE - COMPREHENSIVE HELP SYSTEM
// =============================================================================
// Integrated help documentation matching the app's data terminal aesthetic
// Laws: No glow, no shadow, dense data, ESPN style

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Users, Calendar, Target, TrendingUp, Award,
  Clock, Star, DollarSign, Book, ChevronDown, ChevronRight,
  HelpCircle, Music, Zap, Search
} from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'classes', label: 'Classes' },
  { id: 'captions', label: 'Captions' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'faq', label: 'FAQ' },
];

const CAPTIONS = [
  { abbr: 'GE1', name: 'General Effect 1', desc: 'Overall show design and creativity' },
  { abbr: 'GE2', name: 'General Effect 2', desc: 'Performance quality and audience impact' },
  { abbr: 'VP', name: 'Visual Proficiency', desc: 'Marching and movement execution' },
  { abbr: 'VA', name: 'Visual Analysis', desc: 'Visual design and staging' },
  { abbr: 'CG', name: 'Color Guard', desc: 'Flag, rifle, and saber performance' },
  { abbr: 'B', name: 'Brass', desc: 'Horn line performance quality' },
  { abbr: 'MA', name: 'Music Analysis', desc: 'Musical arrangement and design' },
  { abbr: 'P', name: 'Percussion', desc: 'Battery and front ensemble' },
];

const CLASSES = [
  { id: 'soundSport', name: 'SoundSport', points: 90, unlock: 'Default', color: 'green', desc: 'Entry level - perfect for learning' },
  { id: 'aClass', name: 'A Class', points: 60, unlock: 'Level 3', color: 'blue', desc: 'Tighter budget, strategic drafting' },
  { id: 'openClass', name: 'Open Class', points: 120, unlock: 'Level 5', color: 'purple', desc: 'Expanded options, more competition' },
  { id: 'worldClass', name: 'World Class', points: 150, unlock: 'Level 10', color: 'yellow', desc: 'Elite competition, maximum flexibility' },
];

const GLOSSARY = [
  { term: 'DCI', def: 'Drum Corps International - the governing body for competitive drum corps in North America' },
  { term: 'Caption', def: 'A scoring category (GE, Visual, Music, etc.) - judges score each caption separately' },
  { term: 'General Effect', def: 'How the overall show impacts the audience emotionally and artistically' },
  { term: 'Visual', def: 'Marching, staging, and choreography quality' },
  { term: 'Color Guard', def: 'The flag, rifle, and saber performers who add visual artistry' },
  { term: 'Finals', def: 'Championship competition held in August - the culmination of the DCI season' },
  { term: 'World Class', def: 'The top competitive tier in real DCI (and our game!)' },
  { term: 'Open Class', def: 'Developing corps working toward World Class' },
];

const FAQ = [
  { q: 'How are scores calculated?', a: 'Your corps score is the sum of your 8 caption scores. Each caption score comes from the historical (or live) performance of the corps you selected for that caption.' },
  { q: 'Can I change my lineup?', a: 'Yes! Early in the season you have unlimited changes. As finals approach, changes become limited (3/week mid-season, 2 per round during finals).' },
  { q: 'What happens when a season ends?', a: 'Leaderboards reset and a new season begins. Your XP, level, unlocked classes, and CorpsCoin carry over.' },
  { q: 'How do I unlock higher classes?', a: 'Reach the required level (3/5/10) OR spend CorpsCoin to unlock early. Classes remain unlocked permanently.' },
  { q: 'Can I compete in multiple classes?', a: 'Yes! You can have a separate corps in each unlocked class, each with its own lineup and rankings.' },
];

// =============================================================================
// COMPONENTS
// =============================================================================

const TabButton = ({ tab, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
      isActive
        ? 'text-white border-b-2 border-[#0057B8]'
        : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
    }`}
  >
    {tab.label}
  </button>
);

const SectionCard = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-[#111] border border-white/10 rounded-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0057B8]/20 rounded-sm flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#0057B8]" />
          </div>
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-gray-300">
          {children}
        </div>
      )}
    </div>
  );
};

const DataRow = ({ label, value, accent = false }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-gray-400 text-xs">{label}</span>
    <span className={`text-xs font-bold ${accent ? 'text-[#0057B8]' : 'text-white'}`}>{value}</span>
  </div>
);

// =============================================================================
// TAB CONTENT
// =============================================================================

const BasicsTab = () => (
  <div className="space-y-4">
    {/* Quick Start */}
    <div className="bg-[#0057B8]/10 border border-[#0057B8]/30 rounded-sm p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0057B8] mb-3">Quick Start</h3>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[#0057B8] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
          <div>
            <p className="text-sm font-semibold text-white">Create Your Corps</p>
            <p className="text-xs text-gray-400">Register with a unique name. Start in SoundSport class.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[#0057B8] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
          <div>
            <p className="text-sm font-semibold text-white">Draft Your Lineup</p>
            <p className="text-xs text-gray-400">Select 8 captions from historical DCI corps. Stay within budget.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[#0057B8] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
          <div>
            <p className="text-sm font-semibold text-white">Compete & Level Up</p>
            <p className="text-xs text-gray-400">Earn scores, gain XP, unlock higher classes, climb leaderboards.</p>
          </div>
        </div>
      </div>
    </div>

    {/* How Scoring Works */}
    <SectionCard title="How Scoring Works" icon={Trophy} defaultOpen>
      <p className="mb-3">Your corps score = sum of 8 caption scores from your selected historical performances.</p>
      <div className="bg-black/30 rounded-sm p-3">
        <DataRow label="Live Season" value="Real DCI scores" />
        <DataRow label="Off-Season" value="Historical data" />
        <DataRow label="Captions per lineup" value="8" accent />
      </div>
    </SectionCard>

    {/* XP & Progression */}
    <SectionCard title="XP & Leveling" icon={TrendingUp}>
      <p className="mb-3">Earn XP to level up and unlock higher classes.</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-black/30 rounded-sm p-2 text-center">
          <Zap className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Daily Check-in</p>
        </div>
        <div className="bg-black/30 rounded-sm p-2 text-center">
          <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Competition Scores</p>
        </div>
        <div className="bg-black/30 rounded-sm p-2 text-center">
          <Award className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Achievements</p>
        </div>
        <div className="bg-black/30 rounded-sm p-2 text-center">
          <Star className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Streak Bonuses</p>
        </div>
      </div>
    </SectionCard>

    {/* CorpsCoin */}
    <SectionCard title="CorpsCoin Economy" icon={DollarSign}>
      <p className="mb-3">Earn CorpsCoin (CC) through gameplay. Spend on class unlocks and streak protection.</p>
      <div className="bg-black/30 rounded-sm p-3">
        <DataRow label="A Class unlock" value="1,000 CC" />
        <DataRow label="Open Class unlock" value="2,500 CC" />
        <DataRow label="World Class unlock" value="5,000 CC" />
        <DataRow label="Streak Freeze" value="300 CC" accent />
      </div>
    </SectionCard>

    {/* Leagues */}
    <SectionCard title="Leagues & Social" icon={Users}>
      <p className="mb-3">Compete with friends in public or private leagues.</p>
      <ul className="space-y-1 text-xs text-gray-400">
        <li className="flex items-center gap-2">
          <div className="w-1 h-1 bg-[#0057B8] rounded-full" />
          Public or private leagues with join codes
        </li>
        <li className="flex items-center gap-2">
          <div className="w-1 h-1 bg-[#0057B8] rounded-full" />
          League standings and head-to-head matchups
        </li>
        <li className="flex items-center gap-2">
          <div className="w-1 h-1 bg-[#0057B8] rounded-full" />
          Global leaderboards per class
        </li>
      </ul>
    </SectionCard>
  </div>
);

const ClassesTab = () => (
  <div className="space-y-4">
    <p className="text-sm text-gray-300 mb-4">
      Four competitive classes with different point budgets. Higher classes = more points to spend on premium captions.
    </p>

    <div className="grid gap-3">
      {CLASSES.map((cls) => (
        <div
          key={cls.id}
          className={`bg-[#111] border rounded-sm p-4 ${
            cls.color === 'green' ? 'border-green-500/30' :
            cls.color === 'blue' ? 'border-[#0057B8]/30' :
            cls.color === 'purple' ? 'border-purple-500/30' :
            'border-yellow-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className={`w-4 h-4 ${
                cls.color === 'green' ? 'text-green-500' :
                cls.color === 'blue' ? 'text-[#0057B8]' :
                cls.color === 'purple' ? 'text-purple-500' :
                'text-yellow-500'
              }`} />
              <span className="text-sm font-bold text-white">{cls.name}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-sm ${
              cls.color === 'green' ? 'bg-green-500/20 text-green-400' :
              cls.color === 'blue' ? 'bg-[#0057B8]/20 text-[#0057B8]' :
              cls.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {cls.unlock}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{cls.desc}</p>
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-gray-500" />
            <span className="text-xs font-bold text-white">{cls.points} Point Budget</span>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-[#0057B8]/10 border border-[#0057B8]/30 rounded-sm p-3">
      <p className="text-xs text-gray-300">
        <strong className="text-white">Tip:</strong> Unlock via level OR CorpsCoin.
        A Class = Lvl 3 or 1,000 CC. Open = Lvl 5 or 2,500 CC. World = Lvl 10 or 5,000 CC.
      </p>
    </div>
  </div>
);

const CaptionsTab = () => (
  <div className="space-y-4">
    <p className="text-sm text-gray-300 mb-4">
      Your lineup = 8 captions, one from each DCI scoring category. Each comes from a historical corps performance.
    </p>

    {/* Caption Grid */}
    <div className="grid grid-cols-2 gap-2">
      {CAPTIONS.map((cap) => (
        <div key={cap.abbr} className="bg-[#111] border border-white/10 rounded-sm p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#0057B8]">{cap.abbr}</span>
            <span className="text-xs text-white">{cap.name}</span>
          </div>
          <p className="text-[10px] text-gray-500">{cap.desc}</p>
        </div>
      ))}
    </div>

    {/* Point Costs */}
    <SectionCard title="Point Costs" icon={Target} defaultOpen>
      <p className="mb-3">Each caption costs 1-25 points based on historical performance. Stay within your class budget!</p>
      <div className="bg-black/30 rounded-sm p-3">
        <DataRow label="Min caption cost" value="1 pt" />
        <DataRow label="Max caption cost" value="25 pts" />
        <DataRow label="Captions per lineup" value="8" accent />
      </div>
    </SectionCard>

    {/* Change Rules */}
    <SectionCard title="Lineup Change Rules" icon={Calendar}>
      <div className="bg-black/30 rounded-sm p-3">
        <DataRow label="5+ weeks left" value="Unlimited" accent />
        <DataRow label="1-4 weeks left" value="3 per week" />
        <DataRow label="Finals week" value="2 per round" />
      </div>
    </SectionCard>
  </div>
);

const SeasonsTab = () => (
  <div className="space-y-4">
    <p className="text-sm text-gray-300 mb-4">
      Two alternating season types run throughout the year.
    </p>

    {/* Live Season */}
    <div className="bg-[#111] border border-[#0057B8]/30 rounded-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-[#0057B8]" />
        <span className="text-sm font-bold text-white">Live Season</span>
        <span className="text-xs text-gray-500">June - August</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Runs alongside real DCI. Scores based on actual competition results.
      </p>
      <div className="bg-black/30 rounded-sm p-2">
        <DataRow label="Duration" value="~10 weeks" />
        <DataRow label="Ends" value="DCI Finals (Aug)" />
      </div>
    </div>

    {/* Off-Season */}
    <div className="bg-[#111] border border-purple-500/30 rounded-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-bold text-white">Off-Season</span>
        <span className="text-xs text-gray-500">August - May</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Uses historical DCI data. Six 7-week periods with 49-show schedule.
      </p>
      <div className="bg-black/30 rounded-sm p-2">
        <DataRow label="Duration" value="~42 weeks" />
        <DataRow label="Structure" value="6 × 7-week periods" />
      </div>
    </div>

    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-sm p-3">
      <p className="text-xs text-gray-300">
        <strong className="text-white">Season End:</strong> Leaderboards reset, XP/level/classes carry over.
      </p>
    </div>
  </div>
);

const GlossaryTab = () => (
  <div className="space-y-2">
    <p className="text-sm text-gray-300 mb-4">New to drum corps? Key terms explained.</p>
    {GLOSSARY.map((item) => (
      <div key={item.term} className="bg-[#111] border border-white/10 rounded-sm p-3">
        <span className="text-xs font-bold text-[#0057B8]">{item.term}</span>
        <p className="text-xs text-gray-400 mt-1">{item.def}</p>
      </div>
    ))}
  </div>
);

const FAQTab = () => (
  <div className="space-y-3">
    {FAQ.map((item, idx) => (
      <SectionCard key={idx} title={item.q} icon={HelpCircle}>
        <p>{item.a}</p>
      </SectionCard>
    ))}
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const HowToPlay = () => {
  const [activeTab, setActiveTab] = useState('basics');
  const [searchQuery, setSearchQuery] = useState('');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basics': return <BasicsTab />;
      case 'classes': return <ClassesTab />;
      case 'captions': return <CaptionsTab />;
      case 'seasons': return <SeasonsTab />;
      case 'glossary': return <GlossaryTab />;
      case 'faq': return <FAQTab />;
      default: return <BasicsTab />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-[#0057B8]/20 rounded-sm flex items-center justify-center">
            <Book className="w-4 h-4 text-[#0057B8]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Game Guide</h1>
            <p className="text-[10px] text-gray-500">Everything you need to know</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-black/30 border border-white/10 rounded-sm text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#0057B8]/50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-white/10 overflow-x-auto">
        <div className="flex px-2">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderTabContent()}
      </div>

      {/* Quick Reference Footer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-black/30">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Budgets</p>
            <p className="text-xs text-white font-mono">90/60/120/150</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Unlocks</p>
            <p className="text-xs text-white font-mono">Lvl 3/5/10</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Captions</p>
            <p className="text-xs text-white font-mono">8 per lineup</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;
