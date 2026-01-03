// src/components/Dashboard/OnboardingTour.jsx
// Contextual tooltips for first-time dashboard visitors
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, Trophy, Calendar, Users, Music, HelpCircle } from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Your Dashboard!',
    description: 'This is your command center. Let\'s take a quick tour of the key features.',
    icon: Sparkles,
    target: null, // Full screen welcome
    position: 'center'
  },
  {
    id: 'corps-card',
    title: 'Your Corps',
    description: 'This shows your corps info, rank, and season score. Click the edit button to customize your corps details.',
    icon: Trophy,
    target: '[data-tour="corps-card"]',
    position: 'bottom'
  },
  {
    id: 'lineup',
    title: 'Your Lineup',
    description: 'Your fantasy lineup is shown here. Click "Edit" to change your corps selections for each caption.',
    icon: Music,
    target: '[data-tour="lineup"]',
    position: 'top'
  },
  {
    id: 'schedule',
    title: 'This Week\'s Shows',
    description: 'See which shows you\'re registered for. Click "View Schedule" to manage your show registrations.',
    icon: Calendar,
    target: '[data-tour="schedule"]',
    position: 'left'
  },
  {
    id: 'league',
    title: 'Join a League!',
    description: 'Compete with friends! Create or join a league to track scores together and climb the leaderboards.',
    icon: Users,
    target: '[data-tour="league"]',
    position: 'top'
  }
];

const OnboardingTour = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: '50%', left: '50%' });

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  useEffect(() => {
    if (!isOpen) return;

    // Position tooltip based on target element
    if (step.target) {
      const target = document.querySelector(step.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        const pos = calculatePosition(rect, step.position);
        setTooltipPosition(pos);

        // Add highlight to target
        target.classList.add('tour-highlight');
        return () => target.classList.remove('tour-highlight');
      }
    } else {
      // Center for welcome step
      setTooltipPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
    }
  }, [currentStep, isOpen, step]);

  const calculatePosition = (rect, position) => {
    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    switch (position) {
      case 'bottom':
        return {
          top: `${rect.bottom + padding}px`,
          left: `${Math.min(rect.left, window.innerWidth - tooltipWidth - padding)}px`
        };
      case 'top':
        return {
          top: `${rect.top - tooltipHeight - padding}px`,
          left: `${Math.min(rect.left, window.innerWidth - tooltipWidth - padding)}px`
        };
      case 'left':
        return {
          top: `${rect.top}px`,
          left: `${Math.max(padding, rect.left - tooltipWidth - padding)}px`
        };
      case 'right':
        return {
          top: `${rect.top}px`,
          left: `${rect.right + padding}px`
        };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    onComplete?.();
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={tooltipPosition}
        className="fixed z-50 w-80 bg-charcoal-900 border border-gold-500/30 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-gold-500/10 border-b border-gold-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-cream-100">{step.title}</h3>
                <p className="text-xs text-cream-500">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-cream-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-cream-300 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-charcoal-950/50 border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentStep ? 'bg-gold-400' : idx < currentStep ? 'bg-green-400' : 'bg-charcoal-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-cream-400 hover:text-cream-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-gold-500 text-charcoal-900 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors"
            >
              {currentStep < TOUR_STEPS.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                'Get Started!'
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* CSS for highlighting */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.3), 0 0 20px rgba(234, 179, 8, 0.2);
          border-radius: 12px;
        }
      `}</style>
    </>
  );
};

export default OnboardingTour;
