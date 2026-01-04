// src/components/Dashboard/MorningReport.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Coffee, Flame, X } from 'lucide-react';

/**
 * Morning Report Modal - Simple welcome greeting
 * No daily tasks or challenges - just a friendly welcome back
 */
const MorningReport = ({
  isOpen,
  onClose,
  profile,
  activeCorps,
  activeCorpsClass,
  engagementData,
}) => {
  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Coffee };
    if (hour < 17) return { text: 'Good Afternoon', icon: Sun };
    return { text: 'Good Evening', icon: Moon };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-charcoal-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-premium rounded-sm w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Compact greeting */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-gold-500/20">
                <GreetingIcon className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-cream-100">
                  {greeting.text}, {profile?.displayName?.split(' ')[0] || 'Director'}
                </h2>
                {engagementData?.loginStreak > 1 && (
                  <div className="flex items-center gap-1.5 text-orange-400">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{engagementData.loginStreak} day streak</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-sm hover:bg-cream-500/10 transition-colors"
            >
              <X className="w-5 h-5 text-cream-500/60" />
            </button>
          </div>

          {/* Corps Status */}
          {activeCorps && (
            <div className="px-6 pb-5">
              <div className="rounded-sm p-4 bg-gold-500/10 ring-1 ring-gold-500/30">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-cream-100 truncate">
                      {activeCorps.corpsName || activeCorps.name}
                    </h3>
                    <p className="text-xs text-cream-500/60 truncate">
                      {typeof activeCorps.showConcept === 'object'
                        ? activeCorps.showConcept.theme || 'Ready for competition'
                        : activeCorps.showConcept || 'Ready for competition'}
                    </p>
                  </div>
                  {activeCorpsClass !== 'soundSport' && activeCorps.totalSeasonScore > 0 && (
                    <div className="flex flex-col items-end ml-4">
                      <span className="text-3xl font-bold text-gold-400">
                        {activeCorps.totalSeasonScore?.toFixed(1)}
                      </span>
                      <span className="text-xs text-cream-500/60">Season Score</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dismiss button */}
          <div className="px-6 pb-5">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-sm bg-gold-500 hover:bg-gold-400
                text-charcoal-900 text-sm font-semibold transition-colors"
            >
              Let&apos;s Go!
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MorningReport;
