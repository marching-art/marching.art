// src/components/Celebration.jsx
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShouldReduceMotion } from '../hooks/useReducedMotion';

// Lazy-loaded confetti module (only loaded when celebration triggers)
let confettiModule = null;

/**
 * Celebration Component
 * Triggers confetti and celebratory animations for achievements
 * Usage: <Celebration trigger={true} message="Level Up!" />
 *
 * Performance optimizations:
 * - Skips confetti on mobile/reduced motion devices
 * - Reduced interval frequency (500ms instead of 250ms)
 * - Fewer particles on mobile
 */
const Celebration = ({ trigger, message, type = 'default' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const shouldReduceMotion = useShouldReduceMotion();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (trigger) {
      setIsVisible(true);

      // Only trigger confetti if not reducing motion
      if (!shouldReduceMotion) {
        triggerConfetti(type);
      }

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => {
        clearTimeout(timer);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [trigger, type, shouldReduceMotion]);

  const triggerConfetti = async (celebrationType) => {
    // Lazy-load confetti module on first use
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

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const duration = 2000; // Reduced from 3000ms
    const animationEnd = Date.now() + duration;
    // Reduced ticks for better performance
    const defaults = { startVelocity: 25, spread: 360, ticks: 40, zIndex: 1000 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    // Use 500ms interval instead of 250ms for better performance
    intervalRef.current = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }

      // Reduced particle count (max 25 instead of 50)
      const particleCount = Math.min(25, 25 * (timeLeft / duration));

      switch (celebrationType) {
        case 'achievement':
          // Single burst instead of double
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.3, 0.7), y: Math.random() - 0.2 },
            colors: ['#FFD44D', '#FFCA26', '#D9A300', '#E5D396']
          });
          break;

        case 'levelup':
          confetti({
            ...defaults,
            particleCount,
            origin: { x: 0.5, y: 0.5 },
            colors: ['#FFD44D', '#FFF0BF', '#FFCA26'],
            shapes: ['star']
          });
          break;

        case 'victory':
          confetti({
            ...defaults,
            particleCount: Math.min(40, particleCount * 1.5), // Reduced from *2
            origin: { x: 0.5, y: 0.2 },
            colors: ['#FFD44D', '#E5D396', '#FAF6EA', '#C3A54E'],
            scalar: 1.2,
            gravity: 0.8
          });
          break;

        default:
          confetti({
            ...defaults,
            particleCount,
            origin: { x: Math.random(), y: Math.random() - 0.2 },
            colors: ['#FFD44D', '#E5D396']
          });
      }
    }, 500); // Increased from 250ms to 500ms
  };

  return (
    <AnimatePresence>
      {isVisible && message && (
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -10 }}
          animate={{
            scale: [0, 1.2, 1],
            opacity: [0, 1, 1, 0],
            rotate: [-10, 5, 0],
            y: [0, -20, -40, -60]
          }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 3, times: [0, 0.2, 0.8, 1] }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-[999]"
        >
          <div className="relative">
            {/* Glow effect - static on mobile */}
            <div className={`absolute inset-0 bg-gold-500/30 blur-3xl rounded-sm ${shouldReduceMotion ? '' : 'animate-pulse'}`} />

            {/* Message - no wiggle animation on mobile */}
            <motion.div
              animate={shouldReduceMotion ? {} : {
                scale: [1, 1.05, 1],
                rotate: [-2, 2, -2]
              }}
              transition={shouldReduceMotion ? {} : {
                duration: 0.5,
                repeat: 2, // Only repeat twice instead of Infinity
                repeatType: 'reverse'
              }}
              className="relative bg-gradient-gold rounded-sm px-12 py-8 border-4 border-gold-300"
            >
              <h2 className="text-5xl md:text-6xl font-display font-black text-charcoal-900 text-center">
                {message}
              </h2>
            </motion.div>

            {/* Sparkles - skip on mobile for performance */}
            {!shouldReduceMotion && [...Array(4)].map((_, i) => ( // Reduced from 8 to 4 sparkles
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  x: [0, Math.cos(i * 90 * Math.PI / 180) * 80], // Simplified angles
                  y: [0, Math.sin(i * 90 * Math.PI / 180) * 80]
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.15,
                  repeat: 1, // Only repeat once instead of Infinity
                }}
                className="absolute top-1/2 left-1/2 w-4 h-4"
                style={{ transformOrigin: 'center' }}
              >
                <div className="w-full h-full bg-gold-400 rounded-sm blur-sm" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook to trigger celebrations programmatically
 */
export const useCelebration = () => {
  const celebrate = (message, type = 'default') => {
    const event = new CustomEvent('celebration', { detail: { message, type } });
    window.dispatchEvent(event);
  };

  return { celebrate };
};

/**
 * Global Celebration Container
 * Place once in your app root to handle all celebrations
 */
export const CelebrationContainer = () => {
  const [celebration, setCelebration] = useState(null);

  useEffect(() => {
    const handleCelebration = (event) => {
      setCelebration({
        trigger: true,
        message: event.detail.message,
        type: event.detail.type,
        id: Date.now()
      });

      setTimeout(() => {
        setCelebration(null);
      }, 3100);
    };

    window.addEventListener('celebration', handleCelebration);
    return () => window.removeEventListener('celebration', handleCelebration);
  }, []);

  return celebration ? (
    <Celebration
      key={celebration.id}
      trigger={celebration.trigger}
      message={celebration.message}
      type={celebration.type}
    />
  ) : null;
};

export default Celebration;
