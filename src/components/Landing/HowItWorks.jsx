/**
 * HowItWorks Component - Educational Accordion for New Visitors
 *
 * Explains the core game loop in 3 simple steps. Collapsed by default
 * so users can skip past it. Only shown to first-time visitors.
 * Matches the ESPN-style dark theme.
 */

import React, { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Users, Trophy, TrendingUp, ChevronDown,
  ListChecks, Calendar, Award
} from 'lucide-react';

// =============================================================================
// STEP DATA
// =============================================================================

const STEPS = [
  {
    id: 1,
    title: 'Draft Your Lineup',
    icon: ListChecks,
    iconColor: 'text-[#0057B8]',
    iconBg: 'bg-[#0057B8]/10',
    summary: 'Pick 8 captions from DCI history',
    details: [
      'Choose performers from 50+ years of drum corps legends',
      'Stay within your point budget based on your class level',
      'Mix and match from different eras to build your dream corps'
    ]
  },
  {
    id: 2,
    title: 'Earn Points from Real Shows',
    icon: Calendar,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-500/10',
    summary: 'Your lineup scores when DCI performs',
    details: [
      'Points are calculated from actual DCI competition scores',
      'Watch your corps climb as the season progresses',
      'Scores update after every show throughout the summer'
    ]
  },
  {
    id: 3,
    title: 'Climb the Leaderboard',
    icon: Trophy,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-500/10',
    summary: 'Compete against other fans',
    details: [
      'Join public or private leagues with friends',
      'Earn XP and level up to unlock higher class divisions',
      'Win bragging rights and climb the global rankings'
    ]
  }
];

// =============================================================================
// ACCORDION ITEM COMPONENT
// =============================================================================

const AccordionItem = ({ step, isOpen, onToggle, isLast }) => {
  const Icon = step.icon;

  return (
    <div className={`${!isLast ? 'border-b border-[#333]' : ''}`}>
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors text-left"
        aria-expanded={isOpen}
      >
        {/* Step number + icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-sm ${step.iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${step.iconColor}`} />
        </div>

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Step {step.id}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mt-0.5">
            {step.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
            {step.summary}
          </p>
        </div>

        {/* Expand/collapse indicator */}
        <m.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </m.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-[72px]">
              <ul className="space-y-2">
                {step.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// HOW IT WORKS COMPONENT
// =============================================================================

const HowItWorks = () => {
  // All collapsed by default - users can expand if interested
  const [openSteps, setOpenSteps] = useState(new Set());

  const toggleStep = (stepId) => {
    setOpenSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSteps(new Set(STEPS.map(s => s.id)));
  };

  const collapseAll = () => {
    setOpenSteps(new Set());
  };

  const allExpanded = openSteps.size === STEPS.length;

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#222] border-b border-[#333]">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Award className="w-3.5 h-3.5 text-yellow-500" />
          How It Works
        </h2>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className="text-[10px] font-medium text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Steps */}
      <div>
        {STEPS.map((step, idx) => (
          <AccordionItem
            key={step.id}
            step={step}
            isOpen={openSteps.has(step.id)}
            onToggle={() => toggleStep(step.id)}
            isLast={idx === STEPS.length - 1}
          />
        ))}
      </div>
    </m.div>
  );
};

export default HowItWorks;
