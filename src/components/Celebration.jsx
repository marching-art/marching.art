// src/components/Celebration.jsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

/**
 * Celebration Component
 * Triggers confetti and celebratory animations for achievements
 * Usage: <Celebration trigger={true} message="Level Up!" />
 */
const Celebration = ({ trigger, message, type = 'default' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsVisible(true);
      triggerConfetti(type);

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [trigger, type]);

  const triggerConfetti = (celebrationType) => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      switch (celebrationType) {
        case 'achievement':
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#FFD44D', '#FFCA26', '#D9A300', '#E5D396']
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
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
            particleCount: particleCount * 2,
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
    }, 250);
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
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gold-500/30 blur-3xl rounded-full animate-pulse" />

            {/* Message */}
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [-2, 2, -2]
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="relative bg-gradient-gold rounded-2xl px-12 py-8 shadow-2xl border-4 border-gold-300"
            >
              <h2 className="text-5xl md:text-6xl font-display font-black text-charcoal-900 text-center">
                {message}
              </h2>
            </motion.div>

            {/* Sparkles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  x: [0, Math.cos(i * 45 * Math.PI / 180) * 100],
                  y: [0, Math.sin(i * 45 * Math.PI / 180) * 100]
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
                className="absolute top-1/2 left-1/2 w-4 h-4"
                style={{ transformOrigin: 'center' }}
              >
                <div className="w-full h-full bg-gold-400 rounded-full blur-sm" />
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
