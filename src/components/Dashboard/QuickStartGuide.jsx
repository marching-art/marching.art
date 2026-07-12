// src/components/Dashboard/QuickStartGuide.jsx
// Accessible quick start guide for new users
import React, { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X,
  ChevronRight,
  Check,
  Trophy,
  Calendar,
  Music,
  HelpCircle,
  BookOpen,
  Zap,
  Star,
  ArrowRight,
} from 'lucide-react';
import { WEEKLY_TRADE_LIMIT, CHAMPIONSHIP_TRADE_LIMIT } from '../../utils/seasonClock';
import { getMaxShowsForWeek } from '../../utils/captionPricing';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// Rule numbers come from the same constants the game enforces
// (WEEKLY_TRADE_LIMIT, getMaxShowsForWeek) so this guide can't drift out of
// sync with actual gameplay again.
const REGULAR_WEEK_SHOWS = getMaxShowsForWeek(1);
const FINAL_WEEK_SHOWS = getMaxShowsForWeek(7);

const QUICK_START_STEPS = [
  {
    id: 'lineup',
    title: 'Build Your Lineup',
    description:
      'Pick historical corps performances for each of the 8 scoring captions. Stay within your draft budget!',
    icon: Music,
    color: 'blue',
    action: { label: 'Edit Lineup', target: 'lineup' },
    tips: [
      'Each caption needs one corps selection',
      'Stronger corps cost more of your budget',
      `Changes are unlimited through Day 14, then limited to ${WEEKLY_TRADE_LIMIT} per week (${CHAMPIONSHIP_TRADE_LIMIT} total during Championship Week)`,
    ],
  },
  {
    id: 'schedule',
    title: 'Register for Shows',
    description: `Sign up for shows each week to earn scores. You can register for up to ${REGULAR_WEEK_SHOWS} shows per week (${FINAL_WEEK_SHOWS} in Championship Week).`,
    icon: Calendar,
    color: 'purple',
    action: { label: 'View Schedule', target: '/schedule' },
    tips: [
      'Weekend shows often have more participants',
      'Register early to secure your spots',
      'Scores are based on real DCI results',
    ],
  },
  {
    id: 'scores',
    title: 'Check Your Scores',
    description:
      'After shows complete, check how your lineup performed. See detailed breakdowns by caption.',
    icon: Trophy,
    color: 'green',
    action: { label: 'View Scores', target: '/scores' },
    tips: [
      'Scores are calculated from real DCI data',
      'Track your season total over time',
      'Compare your scores with others',
    ],
  },
];

const colorClasses = {
  purple: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    button: 'bg-purple-500 hover:bg-purple-400',
  },
  blue: {
    bg: 'bg-interactive/15',
    border: 'border-interactive/40',
    text: 'text-interactive',
    button: 'bg-interactive hover:bg-interactive-hover',
  },
  green: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
    button: 'bg-green-500 hover:bg-green-400',
  },
};

const QuickStartGuide = ({ isOpen, onClose, onAction, completedSteps = [] }) => {
  const [expandedStep, setExpandedStep] = useState(null);
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const progress = (completedSteps.length / QUICK_START_STEPS.length) * 100;

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Quick start guide"
      >
        <m.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85dvh] bg-surface-card border border-line rounded-none overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-line bg-surface-raised">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-none bg-interactive/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-interactive" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Quick Start Guide</h2>
                  <p className="text-sm text-muted">Get the most out of marching.art</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-none transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-charcoal-800 rounded-none overflow-hidden">
                <m.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-interactive"
                />
              </div>
              <span className="text-sm font-bold text-muted">
                {completedSteps.length}/{QUICK_START_STEPS.length}
              </span>
            </div>
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {QUICK_START_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const colors = colorClasses[step.color];
              const isCompleted = completedSteps.includes(step.id);
              const isExpanded = expandedStep === step.id;

              return (
                <m.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`rounded-none border transition-all ${
                    isCompleted
                      ? 'bg-green-500/10 border-green-500/30'
                      : `${colors.bg} ${colors.border}`
                  }`}
                >
                  {/* Step header */}
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                  >
                    <div
                      className={`w-10 h-10 rounded-none flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? 'bg-green-500/20' : colors.bg
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold ${isCompleted ? 'text-green-300' : 'text-white'}`}>
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted truncate">{step.description}</p>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="p-4 bg-surface-sunken rounded-none mb-3">
                            <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-interactive" />
                              Pro Tips
                            </h4>
                            <ul className="space-y-1.5">
                              {step.tips.map((tip, tipIdx) => (
                                <li
                                  key={tipIdx}
                                  className="flex items-start gap-2 text-sm text-muted"
                                >
                                  <Star className="w-3 h-3 text-interactive mt-1 flex-shrink-0" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {step.action.target === 'lineup' ? (
                            <button
                              onClick={() => {
                                onAction?.(step.action.target);
                                onClose();
                              }}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-none text-white font-semibold ${colors.button} transition-colors`}
                            >
                              {step.action.label}
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <Link
                              to={step.action.target}
                              onClick={onClose}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-none text-white font-semibold ${colors.button} transition-colors`}
                            >
                              {step.action.label}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </m.div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-line bg-surface-sunken">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">
                <HelpCircle className="w-4 h-4 inline mr-1" />
                Need more help? Check out the{' '}
                <Link
                  to="/how-to-play"
                  onClick={onClose}
                  className="text-interactive hover:underline"
                >
                  How to Play
                </Link>{' '}
                guide.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-muted hover:text-white transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
};

// Floating Quick Start Button for Dashboard
export const QuickStartButton = ({ onClick, show = true }) => {
  if (!show) return null;

  return (
    <m.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2 bg-interactive text-white rounded-none font-bold text-sm hover:bg-interactive-hover transition-colors"
    >
      <HelpCircle className="w-5 h-5" />
      Quick Start
    </m.button>
  );
};

export default QuickStartGuide;
