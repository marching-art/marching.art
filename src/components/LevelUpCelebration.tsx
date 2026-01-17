// =============================================================================
// LEVEL UP CELEBRATION - Full-screen dramatic level up animation
// =============================================================================
// Displays a full-screen celebration when user levels up
// Usage: triggerLevelUp(5) or triggerLevelUp(5, 'A Class')

import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { TrendingUp, Unlock, Star } from 'lucide-react';
import { useShouldReduceMotion } from '../hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

interface LevelUpData {
  id: string;
  newLevel: number;
  classUnlocked?: string;
}

// =============================================================================
// LAZY CONFETTI
// =============================================================================

let confettiModule: any = null;

const triggerLevelUpConfetti = async () => {
  if (!confettiModule) {
    try {
      const module = await import('canvas-confetti');
      confettiModule = module.default;
    } catch (error) {
      console.warn('Failed to load confetti:', error);
      return;
    }
  }

  const confetti = confettiModule;
  const duration = 3000;
  const animationEnd = Date.now() + duration;

  // Initial burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#0057B8', '#3B82F6', '#60A5FA', '#93C5FD', '#FFFFFF'],
    shapes: ['star', 'circle'],
    scalar: 1.2,
    zIndex: 10000,
  });

  // Side cannons
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#0057B8', '#3B82F6', '#FFD700'],
      zIndex: 10000,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#0057B8', '#3B82F6', '#FFD700'],
      zIndex: 10000,
    });
  }, 200);

  // Continuous celebration
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    confetti({
      particleCount: 15,
      spread: 360,
      origin: { x: Math.random(), y: Math.random() - 0.2 },
      colors: ['#0057B8', '#3B82F6', '#60A5FA', '#FFD700'],
      shapes: ['star'],
      scalar: 0.8,
      zIndex: 10000,
    });
  }, 400);

  setTimeout(() => clearInterval(interval), duration);
};

// =============================================================================
// GLOBAL EVENT SYSTEM
// =============================================================================

export const triggerLevelUp = (newLevel: number, classUnlocked?: string) => {
  const event = new CustomEvent('level-up', {
    detail: { newLevel, classUnlocked },
  });
  window.dispatchEvent(event);
};

// =============================================================================
// LEVEL UP MODAL COMPONENT
// =============================================================================

const LevelUpModal: React.FC<{
  data: LevelUpData;
  onComplete: () => void;
}> = ({ data, onComplete }) => {
  const shouldReduceMotion = useShouldReduceMotion();

  useEffect(() => {
    // Trigger confetti unless reduced motion
    if (!shouldReduceMotion) {
      triggerLevelUpConfetti();
    }

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete, shouldReduceMotion]);

  return (
    <m.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
    >
      <m.div
        className="relative flex flex-col items-center text-center px-8"
        initial={{ scale: 0.5, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -30 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
          delay: 0.1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-sm scale-150" />

        {/* Stars background */}
        {!shouldReduceMotion && (
          <>
            {[...Array(8)].map((_, i) => (
              <m.div
                key={i}
                className="absolute"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: Math.cos((i * 45 * Math.PI) / 180) * (120 + i * 20),
                  y: Math.sin((i * 45 * Math.PI) / 180) * (120 + i * 20),
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  repeat: 1,
                }}
              >
                <Star className="w-6 h-6 text-blue-400 fill-blue-400" />
              </m.div>
            ))}
          </>
        )}

        {/* Level Up Text */}
        <m.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <p className="text-lg font-bold uppercase tracking-[0.3em] text-blue-400 mb-2">
            Level Up!
          </p>
        </m.div>

        {/* Level Number */}
        <m.div
          className="relative mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="relative">
            <m.div
              className="text-[120px] md:text-[160px] font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-300 via-blue-400 to-blue-600 leading-none"
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      textShadow: [
                        '0 0 20px rgba(59,130,246,0.5)',
                        '0 0 40px rgba(59,130,246,0.8)',
                        '0 0 20px rgba(59,130,246,0.5)',
                      ],
                    }
              }
              transition={{ duration: 1, repeat: Infinity }}
            >
              {data.newLevel}
            </m.div>
            <TrendingUp className="absolute -top-2 -right-4 w-10 h-10 text-blue-400" />
          </div>
        </m.div>

        {/* Class Unlocked */}
        {data.classUnlocked && (
          <m.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-3 px-6 py-3 bg-green-500/20 border border-green-500/50 rounded-sm"
          >
            <Unlock className="w-6 h-6 text-green-400" />
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-green-400">
                New Class Unlocked!
              </p>
              <p className="text-lg font-bold text-white">{data.classUnlocked}</p>
            </div>
          </m.div>
        )}

        {/* Tap to dismiss */}
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.5 }}
          className="mt-8 text-sm text-gray-500"
        >
          Tap anywhere to continue
        </m.p>
      </m.div>
    </m.div>
  );
};

// =============================================================================
// CONTAINER COMPONENT
// =============================================================================

export const LevelUpCelebrationContainer: React.FC = () => {
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);

  useEffect(() => {
    const handleLevelUp = (
      event: CustomEvent<{ newLevel: number; classUnlocked?: string }>
    ) => {
      const { newLevel, classUnlocked } = event.detail;
      setLevelUpData({
        id: `levelup-${Date.now()}`,
        newLevel,
        classUnlocked,
      });
    };

    window.addEventListener('level-up', handleLevelUp as EventListener);
    return () =>
      window.removeEventListener('level-up', handleLevelUp as EventListener);
  }, []);

  const handleComplete = () => {
    setLevelUpData(null);
  };

  return (
    <AnimatePresence>
      {levelUpData && (
        <LevelUpModal
          key={levelUpData.id}
          data={levelUpData}
          onComplete={handleComplete}
        />
      )}
    </AnimatePresence>
  );
};

export default LevelUpCelebrationContainer;
