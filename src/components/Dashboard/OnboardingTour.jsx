// src/components/Dashboard/OnboardingTour.jsx
// Contextual tooltips for first-time dashboard visitors
import React, { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Trophy,
  Calendar,
  Users,
  Music,
} from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Your Dashboard!',
    description: "This is your command center. Let's take a quick tour of the key features.",
    icon: Sparkles,
    target: null, // Full screen welcome
    position: 'center',
  },
  {
    id: 'control-bar',
    title: 'Corps Command Bar',
    description:
      'Switch between your corps and competition classes here, and keep an eye on your CorpsCoin and XP as you play.',
    icon: Users,
    target: '[data-tour="control-bar"]',
    position: 'bottom',
  },
  {
    id: 'lineup',
    title: 'Your Active Lineup',
    description:
      'These are your eight caption picks. Tap any caption row (or Manage) to change a selection — your score comes from how these corps perform.',
    icon: Music,
    target: '[data-tour="lineup"]',
    position: 'bottom',
  },
  {
    id: 'recent-results',
    title: 'Recent Results',
    description:
      'After each show is scored, your results land here so you can see how your lineup performed night to night.',
    icon: Calendar,
    target: '[data-tour="recent-results"]',
    position: 'top',
  },
  {
    id: 'scorecard',
    title: 'Season Scorecard',
    description:
      'Track your season score and rank here. Daily challenges and rivals live in this sidebar too — check back every day!',
    icon: Trophy,
    target: '[data-tour="scorecard"]',
    position: 'left',
  },
];

const OnboardingTour = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: '50%', left: '50%' });

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  useEffect(() => {
    if (!isOpen) return;

    // Position tooltip based on target element; fall back to a centered
    // card whenever the anchor is missing so the tour never points at nothing.
    const target = step.target ? document.querySelector(step.target) : null;
    if (target) {
      target.scrollIntoView({ block: 'center' });
      const rect = target.getBoundingClientRect();
      setTooltipPosition(calculatePosition(rect, step.position));

      // Add highlight to target
      target.classList.add('tour-highlight');
      return () => target.classList.remove('tour-highlight');
    }
    setTooltipPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  }, [currentStep, isOpen, step]);

  const calculatePosition = (rect, position) => {
    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    const clamp = (pos) => {
      if (!('top' in pos) || typeof pos.top !== 'string' || pos.top.endsWith('%')) return pos;
      const top = Math.min(
        Math.max(padding, parseFloat(pos.top)),
        window.innerHeight - tooltipHeight - padding
      );
      const left = Math.min(
        Math.max(padding, parseFloat(pos.left)),
        window.innerWidth - tooltipWidth - padding
      );
      return { top: `${top}px`, left: `${left}px` };
    };

    switch (position) {
      case 'bottom':
        return clamp({ top: `${rect.bottom + padding}px`, left: `${rect.left}px` });
      case 'top':
        return clamp({ top: `${rect.top - tooltipHeight - padding}px`, left: `${rect.left}px` });
      case 'left':
        return clamp({ top: `${rect.top}px`, left: `${rect.left - tooltipWidth - padding}px` });
      case 'right':
        return clamp({ top: `${rect.top}px`, left: `${rect.right + padding}px` });
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
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
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <m.div
        key={currentStep}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={tooltipPosition}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-50 w-80 bg-[#1a1a1a] border border-[#333] rounded-none overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-[#222] border-b border-[#333]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-[#0057B8]/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#0057B8]" />
              </div>
              <div>
                <h3 className="font-bold text-white">{step.title}</h3>
                <p className="text-xs text-muted">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-1.5 hover:bg-white/10 rounded-none transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-300 leading-relaxed">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#111] border-t border-[#333] flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-none transition-colors ${
                  idx === currentStep
                    ? 'bg-[#0057B8]'
                    : idx < currentStep
                      ? 'bg-green-400'
                      : 'bg-[#333]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#0057B8] text-white rounded-none text-sm font-bold hover:bg-[#0066d6] transition-colors"
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
      </m.div>

      {/* CSS for highlighting */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 3px rgba(0, 87, 184, 0.6);
          border-radius: 2px;
        }
      `}</style>
    </>
  );
};

export default OnboardingTour;
