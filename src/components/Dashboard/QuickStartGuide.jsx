// src/components/Dashboard/QuickStartGuide.jsx
// Accessible quick start guide for new users
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X, ChevronRight, Check, Trophy, Calendar, Users, Music,
  HelpCircle, BookOpen, Zap, Target, Star, ArrowRight
} from 'lucide-react';

const QUICK_START_STEPS = [
  {
    id: 'lineup',
    title: 'Build Your Lineup',
    description: 'Pick historical corps performances for each of the 8 scoring captions. Stay within your point budget!',
    icon: Music,
    color: 'gold',
    action: { label: 'Edit Lineup', target: 'lineup' },
    tips: [
      'Each caption needs one corps selection',
      'Higher-scoring corps cost more points',
      'You can change your lineup anytime'
    ]
  },
  {
    id: 'schedule',
    title: 'Register for Shows',
    description: 'Sign up for shows each week to earn points. You can register for up to 4 shows per week.',
    icon: Calendar,
    color: 'purple',
    action: { label: 'View Schedule', target: '/schedule' },
    tips: [
      'Weekend shows often have more participants',
      'Register early to secure your spots',
      'Points are based on real DCI scores'
    ]
  },
  {
    id: 'league',
    title: 'Join a League',
    description: 'Compete with friends or join a public league. Track standings and compete for bragging rights!',
    icon: Users,
    color: 'blue',
    action: { label: 'Browse Leagues', target: '/leagues' },
    tips: [
      'Create a private league for your friends',
      'Public leagues are open to everyone',
      'League standings update after each show'
    ]
  },
  {
    id: 'scores',
    title: 'Check Your Scores',
    description: 'After shows complete, check how your lineup performed. See detailed breakdowns by caption.',
    icon: Trophy,
    color: 'green',
    action: { label: 'View Scores', target: '/scores' },
    tips: [
      'Scores are calculated from real DCI data',
      'Track your season total over time',
      'Compare your scores with others'
    ]
  }
];

const colorClasses = {
  gold: { bg: 'bg-gold-500/20', border: 'border-gold-500/30', text: 'text-gold-400', button: 'bg-gold-500 hover:bg-gold-400' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', button: 'bg-purple-500 hover:bg-purple-400' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', button: 'bg-blue-500 hover:bg-blue-400' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', button: 'bg-green-500 hover:bg-green-400' }
};

const QuickStartGuide = ({ isOpen, onClose, onAction, completedSteps = [] }) => {
  const [expandedStep, setExpandedStep] = useState(null);

  if (!isOpen) return null;

  const progress = (completedSteps.length / QUICK_START_STEPS.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85vh] bg-charcoal-900 border border-white/10 rounded-sm overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-gold-500/10 to-purple-500/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-sm bg-gold-500/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-cream-100">Quick Start Guide</h2>
                  <p className="text-sm text-cream-400">Get the most out of marching.art</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-sm transition-colors"
              >
                <X className="w-5 h-5 text-cream-400" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-charcoal-800 rounded-sm overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-gold-500 to-green-500"
                />
              </div>
              <span className="text-sm font-bold text-cream-400">
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
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`rounded-sm border transition-all ${
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
                    <div className={`w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-green-500/20' : colors.bg
                    }`}>
                      {isCompleted ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-display font-bold ${isCompleted ? 'text-green-300' : 'text-cream-100'}`}>
                        {step.title}
                      </h3>
                      <p className="text-sm text-cream-400 truncate">{step.description}</p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-cream-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="p-4 bg-charcoal-950/50 rounded-sm mb-3">
                            <h4 className="text-sm font-semibold text-cream-200 mb-2 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-gold-400" />
                              Pro Tips
                            </h4>
                            <ul className="space-y-1.5">
                              {step.tips.map((tip, tipIdx) => (
                                <li key={tipIdx} className="flex items-start gap-2 text-sm text-cream-400">
                                  <Star className="w-3 h-3 text-gold-400 mt-1 flex-shrink-0" />
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
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-charcoal-900 font-semibold ${colors.button} transition-colors`}
                            >
                              {step.action.label}
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <Link
                              to={step.action.target}
                              onClick={onClose}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-charcoal-900 font-semibold ${colors.button} transition-colors`}
                            >
                              {step.action.label}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-charcoal-950/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-cream-500">
                <HelpCircle className="w-4 h-4 inline mr-1" />
                Need more help? Check out the{' '}
                <Link to="/how-to-play" onClick={onClose} className="text-gold-400 hover:underline">
                  How to Play
                </Link>
                {' '}guide.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-cream-400 hover:text-cream-200 transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Floating Quick Start Button for Dashboard
export const QuickStartButton = ({ onClick, show = true }) => {
  if (!show) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2 bg-[#0057B8] text-white rounded-sm font-bold text-sm hover:bg-[#0066d6] transition-colors"
    >
      <HelpCircle className="w-5 h-5" />
      Quick Start
    </motion.button>
  );
};

export default QuickStartGuide;
