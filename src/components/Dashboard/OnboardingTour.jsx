// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/components/Dashboard/OnboardingTour.jsx
// First-run tour of the dashboard.
//
// Desktop anchors a tooltip beside each target — the layout is all on screen,
// so pointing at parts of it works. Mobile does not get that treatment: the
// tooltip was a fixed 320px box on a 360px screen, its "left" placement for the
// scorecard computed off-screen and was clamped into a corner, and it never
// repositioned on scroll, resize, or rotate. So on mobile the card is simply
// docked above the bottom nav — no anchoring math to get wrong — and the target
// is scrolled to and outlined instead.
//
// The step lists themselves live in tourSteps.ts, one per device.

import React, { useEffect, useState } from 'react';
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
  Target,
  Layers,
  Compass,
  Heart,
} from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getTourSteps } from './tourSteps';

const ICONS = {
  sparkles: Sparkles,
  target: Target,
  music: Music,
  layers: Layers,
  compass: Compass,
  trophy: Trophy,
  calendar: Calendar,
  users: Users,
  heart: Heart,
};

// `variant` picks the step list: 'fantasy' (the drafted-lineup dashboard, split
// by device) or 'podium' (the director-sim daily loop, one list either way).
const OnboardingTour = ({ isOpen, onClose, onComplete, onRequestZone, variant = 'fantasy' }) => {
  const isMobile = useIsMobile();
  const steps = getTourSteps(variant, isMobile);

  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: '50%', left: '50%' });

  // Device can change mid-tour (rotation, a resized desktop window). The step
  // lists differ, so clamp rather than index past the end of the new one.
  const stepIndex = Math.min(currentStep, steps.length - 1);
  const step = steps[stepIndex];
  const Icon = ICONS[step.icon];

  // A mobile step may live in a zone that is not showing. Ask the dashboard to
  // switch before the positioning effect looks for the target, or the tour
  // points at a display:none element.
  useEffect(() => {
    if (!isOpen || !isMobile || !step.zone) return;
    onRequestZone?.(step.zone);
  }, [isOpen, isMobile, step.zone, onRequestZone]);

  useEffect(() => {
    if (!isOpen) return;

    // Give a zone switch (or any pending layout) a frame to land before
    // measuring, so the first mobile step of a zone is not measured against
    // the element's pre-reveal position.
    let cleanup = () => {};
    const frame = requestAnimationFrame(() => {
      const target = step.target ? document.querySelector(step.target) : null;
      if (!target) {
        setTooltipPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
        return;
      }

      target.scrollIntoView({ block: 'center' });
      target.classList.add('tour-highlight');
      cleanup = () => target.classList.remove('tour-highlight');

      // Mobile docks the card; only desktop anchors it to the target.
      if (!isMobile) {
        setTooltipPosition(calculatePosition(target.getBoundingClientRect(), step.position));
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [stepIndex, isOpen, step, isMobile]);

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
    if (stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) setCurrentStep(stepIndex - 1);
  };

  const handleComplete = () => {
    onComplete?.();
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  // Mobile docks the card to the bottom of the screen, clear of the nav
  // (.above-bottom-nav owns that math). Desktop anchors it to the target.
  const cardStyle = isMobile ? undefined : tooltipPosition;
  const cardClass = isMobile
    ? 'fixed z-50 left-3 right-3 above-bottom-nav bg-surface-card border border-line rounded-none overflow-hidden'
    : 'fixed z-50 w-80 bg-surface-card border border-line rounded-none overflow-hidden';

  return (
    <>
      {/* Backdrop */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40"
        onClick={handleSkip}
      />

      <m.div
        key={stepIndex}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
        className={cardClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        {/* Header */}
        <div className="p-4 bg-surface-raised border-b border-line">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-interactive/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-interactive" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="tour-step-title" className="font-bold text-white">
                  {step.title}
                </h3>
                <p className="text-xs text-muted">
                  Step {stepIndex + 1} of {steps.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              aria-label="Skip tour"
              className="min-w-touch min-h-touch -mr-2 flex items-center justify-center text-muted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-secondary leading-relaxed">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-sunken border-t border-line flex items-center justify-between gap-3">
          <div className="flex gap-1.5 flex-shrink-0">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`w-2 h-2 rounded-none transition-colors ${
                  idx === stepIndex
                    ? 'bg-interactive'
                    : idx < stepIndex
                      ? 'bg-green-400'
                      : 'bg-line'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 min-h-touch text-sm text-muted hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 min-h-touch bg-interactive text-white rounded-none text-sm font-bold hover:bg-interactive-hover transition-colors press-feedback"
            >
              {stepIndex < steps.length - 1 ? (
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
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.7);
          border-radius: 2px;
        }
      `}</style>
    </>
  );
};

export default OnboardingTour;
