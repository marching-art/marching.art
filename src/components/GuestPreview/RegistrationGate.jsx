/**
 * RegistrationGate - Modal prompt for gated actions in Guest Preview Mode
 *
 * Shows contextual prompts when guests try to perform actions that require
 * an account. Different messages based on what action they attempted.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  X, UserPlus, Lock, Trophy, Users, Save, Calendar,
  ChevronRight, Zap, Star
} from 'lucide-react';

// =============================================================================
// GATE TYPES - Different prompts for different actions
// =============================================================================

const GATE_CONFIGS = {
  // Trying to save lineup changes
  save: {
    icon: Save,
    iconColor: 'text-[#0057B8]',
    iconBg: 'bg-[#0057B8]/20',
    title: 'Save Your Progress',
    description: 'Create a free account to save your lineup and compete in leagues.',
    benefit: 'Your draft picks will be waiting for you',
    ctaText: 'Create Free Account',
  },

  // Trying to join a league
  league: {
    icon: Users,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-500/20',
    title: 'Join the Competition',
    description: 'Create a free account to join leagues and compete against other fans.',
    benefit: 'Weekly matchups, leaderboards, and bragging rights',
    ctaText: 'Start Competing Free',
  },

  // Trying to edit roster
  edit: {
    icon: Trophy,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-500/20',
    title: 'Build Your Corps',
    description: 'Create a free account to draft your own lineup and track scores.',
    benefit: 'Pick from 50+ years of DCI legends',
    ctaText: 'Create Your Corps',
  },

  // Trying to select shows
  shows: {
    icon: Calendar,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-500/20',
    title: 'Choose Your Shows',
    description: 'Create a free account to select which shows your corps competes in.',
    benefit: 'Strategic show selection affects your season score',
    ctaText: 'Start Playing Free',
  },

  // Generic gated action
  default: {
    icon: Lock,
    iconColor: 'text-gray-400',
    iconBg: 'bg-gray-500/20',
    title: 'Account Required',
    description: 'Create a free account to unlock this feature.',
    benefit: 'It only takes 30 seconds',
    ctaText: 'Sign Up Free',
  },
};

// =============================================================================
// REGISTRATION GATE COMPONENT
// =============================================================================

const RegistrationGate = ({
  isOpen,
  onClose,
  gateType = 'default',
  hasEngaged = false,
}) => {
  const config = GATE_CONFIGS[gateType] || GATE_CONFIGS.default;
  const GateIcon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-[#1a1a1a] border border-[#333] rounded-sm w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-sm transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="p-6 text-center">
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-sm ${config.iconBg} mb-4`}>
                <GateIcon className={`w-8 h-8 ${config.iconColor}`} />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-white mb-2">
                {config.title}
              </h2>

              {/* Description */}
              <p className="text-gray-400 mb-4">
                {config.description}
              </p>

              {/* Benefit highlight */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-sm mb-6">
                <Star className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-400">{config.benefit}</span>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 w-full h-12 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider rounded-sm hover:bg-[#0066d6] active:bg-[#004a9e] transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {config.ctaText}
                </Link>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 w-full h-12 border border-[#333] text-gray-400 font-medium text-sm rounded-sm hover:border-[#444] hover:text-white transition-colors"
                >
                  Already have an account? Sign in
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Free badge */}
              <div className="flex items-center justify-center gap-2 mt-4 text-gray-500">
                <Zap className="w-4 h-4 text-green-500" />
                <span className="text-xs">100% free, no credit card required</span>
              </div>
            </div>

            {/* Progress preservation message for engaged users */}
            {hasEngaged && (
              <div className="px-6 pb-4">
                <div className="p-3 bg-[#0057B8]/10 border border-[#0057B8]/20 rounded-sm">
                  <p className="text-xs text-[#0057B8] text-center">
                    Your preview progress will be saved when you register
                  </p>
                </div>
              </div>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default RegistrationGate;
