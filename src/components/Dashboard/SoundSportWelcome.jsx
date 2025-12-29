// =============================================================================
// SOUNDSPORT WELCOME CARD - Dashboard Component for SoundSport Directors
// =============================================================================
// Welcoming, educational card for directors with SoundSport ensembles
// Shows quick tips, links to learn more, and celebrates the SoundSport journey

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Medal, ChevronRight, ChevronDown, Star, Clock,
  Users, Target, Sparkles, BookOpen, Play, Trophy, X
} from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const QUICK_TIPS = [
  {
    icon: Clock,
    title: 'Performance Time',
    tip: 'Your show should be 5-7 minutes long.',
  },
  {
    icon: Users,
    title: 'Minimum Members',
    tip: '5+ members must be on stage during performance.',
  },
  {
    icon: Target,
    title: 'Live Music',
    tip: 'All music must be performed live - no loops or sequences.',
  },
  {
    icon: Star,
    title: 'Rating System',
    tip: 'Earn Gold (90+), Silver (75+), or Bronze (60+) ratings.',
  },
];

const ADJUDICATION_FOCUS = [
  { label: 'Audience Engagement', icon: Sparkles },
  { label: 'Entertainment Value', icon: Star },
  { label: 'Creative Concept', icon: Target },
  { label: 'Proficiency', icon: Trophy },
];

// =============================================================================
// SOUNDSPORT WELCOME CARD COMPONENT
// =============================================================================

const SoundSportWelcome = ({ onDismiss, showCompact = false }) => {
  const [isExpanded, setIsExpanded] = useState(!showCompact);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative bg-gradient-to-br from-green-900/30 via-[#1a1a1a] to-[#1a1a1a] border border-green-500/30 rounded-lg overflow-hidden mb-4"
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 pr-10"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
            <Music className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm">Welcome to SoundSport!</h3>
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase rounded">
                New
              </span>
            </div>
            <p className="text-gray-400 text-xs truncate">
              Your gateway to marching music performance
            </p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-400"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Quick Tips Grid */}
              <div className="grid grid-cols-2 gap-2">
                {QUICK_TIPS.map((tip, idx) => {
                  const Icon = tip.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-[#222] rounded border border-[#333]"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-green-500" />
                        <span className="font-bold text-white text-[11px]">{tip.title}</span>
                      </div>
                      <p className="text-gray-400 text-[10px] leading-tight">{tip.tip}</p>
                    </div>
                  );
                })}
              </div>

              {/* What Judges Look For */}
              <div className="p-3 bg-[#222] rounded border border-[#333]">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
                  What Judges Look For
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {ADJUDICATION_FOCUS.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-1 px-2 py-1 bg-[#333] rounded text-[10px]"
                      >
                        <Icon className="w-3 h-3 text-green-500" />
                        <span className="text-gray-300">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rating Preview */}
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-primary border-2 border-black rounded-sm">
                  <Medal className="w-3 h-3 text-black" />
                  <span className="text-[10px] font-bold text-black">Gold 90+</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-stone-300 border-2 border-black rounded-sm">
                  <Medal className="w-3 h-3 text-black" />
                  <span className="text-[10px] font-bold text-black">Silver 75+</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-300 border-2 border-black rounded-sm">
                  <Medal className="w-3 h-3 text-black" />
                  <span className="text-[10px] font-bold text-black">Bronze 60+</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-2">
                <Link
                  to="/soundsport"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-black font-bold text-xs rounded hover:bg-green-400 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Learn the Rules
                </Link>
                <Link
                  to="/scores?tab=soundsport"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#333] text-white font-bold text-xs rounded hover:bg-[#444] transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  View Results
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact CTA when collapsed */}
      {!isExpanded && (
        <div className="px-4 pb-3">
          <Link
            to="/soundsport"
            className="flex items-center justify-center gap-2 w-full py-2 bg-green-500/20 text-green-400 text-xs font-bold rounded hover:bg-green-500/30 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Get Started
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// MINI SOUNDSPORT BANNER - For inline placement
// =============================================================================

export const SoundSportBanner = () => (
  <Link
    to="/soundsport"
    className="flex items-center justify-between p-3 bg-gradient-to-r from-green-900/30 to-transparent border border-green-500/30 rounded-lg hover:border-green-500/50 transition-colors group"
  >
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-green-500/20 rounded">
        <Music className="w-4 h-4 text-green-500" />
      </div>
      <div>
        <span className="font-bold text-white text-sm">SoundSport Guide</span>
        <p className="text-gray-500 text-[10px]">Rules, ratings & tips</p>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-green-500 group-hover:translate-x-1 transition-transform" />
  </Link>
);

export default SoundSportWelcome;
