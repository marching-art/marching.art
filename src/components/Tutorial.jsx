// src/components/Tutorial.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';

/**
 * Interactive Tutorial Component
 * Guides first-time users through the game mechanics
 * Stores completion state in localStorage
 */
const Tutorial = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const tutorialSteps = [
    {
      title: 'Welcome to marching.art! 🎺',
      description: 'Transform into a drum corps director and build your dream fantasy corps!',
      highlight: null,
      action: 'Let me show you around'
    },
    {
      title: 'Register Your Corps',
      description: 'Start by creating your first corps. Choose a class based on your level - beginners start with SoundSport!',
      highlight: 'corps-registration',
      action: 'Got it!'
    },
    {
      title: 'Select Your Captions',
      description: 'Build your lineup by selecting 8 caption heads from historical performances. Each has a point value - stay within your class limit!',
      highlight: 'caption-selection',
      action: 'Understood'
    },
    {
      title: 'Choose Your Shows',
      description: 'Select up to 4 shows per week to attend. Strategic choices matter - more competitive shows offer higher scores!',
      highlight: 'show-selection',
      action: 'Makes sense'
    },
    {
      title: 'Level Up & Unlock Classes',
      description: 'Earn XP through performances and achievements. Level up to unlock World Class, Open Class, and A Class corps!',
      highlight: 'xp-bar',
      action: 'Awesome!'
    },
    {
      title: 'Join Leagues & Compete',
      description: 'Create or join leagues with friends. Compete for the top spot and earn bragging rights!',
      highlight: 'leagues',
      action: 'Ready to play'
    },
    {
      title: 'You\'re All Set! 🎉',
      description: 'Time to build your corps and become a legendary director. Good luck!',
      highlight: null,
      action: 'Start Playing'
    }
  ];

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial-completed');
    const firstLogin = localStorage.getItem('first-login');

    // Show tutorial on first login or if not completed
    if (!tutorialCompleted && firstLogin !== 'false') {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('tutorial-completed', 'true');
    setIsVisible(false);
    if (onComplete) {
      onComplete();
    }
  };

  const currentTutorial = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25 }}
          className="relative w-full max-w-2xl"
        >
          <div className="glass-dark rounded-2xl p-8 shadow-2xl border-2 border-gold-500/30">
            {/* Skip Button */}
            {currentStep < tutorialSteps.length - 1 && (
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-cream-500/10 transition-colors group"
                aria-label="Skip tutorial"
              >
                <X className="w-5 h-5 text-cream-400 group-hover:text-cream-100" />
              </button>
            )}

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-cream-400">
                  Step {currentStep + 1} of {tutorialSteps.length}
                </span>
                <span className="text-sm font-medium text-gold-500">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-gold rounded-full"
                />
              </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="mb-8"
              >
                {/* Icon */}
                <div className="w-16 h-16 bg-gradient-gold rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-charcoal-900" />
                </div>

                {/* Title */}
                <h2 className="text-3xl md:text-4xl font-display font-bold text-gradient mb-4">
                  {currentTutorial.title}
                </h2>

                {/* Description */}
                <p className="text-lg text-cream-300 leading-relaxed">
                  {currentTutorial.description}
                </p>

                {/* Visual Indicators for specific areas */}
                {currentTutorial.highlight && (
                  <div className="mt-6 p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                    <p className="text-sm text-gold-300">
                      💡 Look for the highlighted area on your dashboard
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="btn-ghost flex-shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
              )}

              <button
                onClick={handleNext}
                className="btn-primary flex-1"
              >
                {currentStep === tutorialSteps.length - 1 ? (
                  <>
                    <Check className="w-5 h-5" />
                    {currentTutorial.action}
                  </>
                ) : (
                  <>
                    {currentTutorial.action}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-6">
              {tutorialSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-gold-500'
                      : index < currentStep
                      ? 'bg-gold-500/50'
                      : 'bg-charcoal-700'
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Tutorial;
