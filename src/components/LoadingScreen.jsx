// src/components/LoadingScreen.jsx
import React from 'react';
import { motion } from 'framer-motion';

const LoadingScreen = ({ fullScreen = false }) => {
  const containerClass = fullScreen 
    ? 'fixed inset-0 bg-gradient-main z-50' 
    : 'w-full h-64';

  // Animation for the marching dots
  const dotVariants = {
    start: {
      y: 0,
      opacity: 0.3
    },
    bounce: {
      y: [-20, 0],
      opacity: [1, 0.3],
      transition: {
        y: {
          duration: 0.5,
          ease: "easeOut",
          repeat: Infinity,
          repeatDelay: 0.5
        },
        opacity: {
          duration: 0.5,
          ease: "easeOut",
          repeat: Infinity,
          repeatDelay: 0.5
        }
      }
    }
  };

  const containerVariants = {
    start: {
      transition: {
        staggerChildren: 0.1
      }
    },
    end: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className={`${containerClass} flex items-center justify-center`}>
      <div className="text-center">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gold-500/30 rounded-full blur-2xl animate-pulse" />
            
            {/* Main logo */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-glow"
            >
              <img src="/logo192.png" alt="marching.art logo" className="w-full h-full object-cover" />
            </motion.div>

            {/* Orbiting dots */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-gold-500 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0 0'
                }}
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                  delay: i * 0.75
                }}
              >
                <div 
                  className="w-2 h-2 bg-gold-500 rounded-full"
                  style={{
                    transform: `translate(${35 * Math.cos(i * Math.PI / 2)}px, ${35 * Math.sin(i * Math.PI / 2)}px)`
                  }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-display font-bold text-gradient mb-4">
            marching.art
          </h2>
          
          {/* Marching dots */}
          <motion.div
            variants={containerVariants}
            initial="start"
            animate="end"
            className="flex justify-center gap-2"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                variants={dotVariants}
                animate="bounce"
                transition={{ delay: i * 0.1 }}
                className="w-2 h-2 bg-gold-500 rounded-full"
              />
            ))}
          </motion.div>

          {/* Loading message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-cream-500/60 text-sm mt-4"
          >
            Preparing your fantasy corps...
          </motion.p>
        </motion.div>

        {/* Progress bar (optional) */}
        {fullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 w-64 mx-auto"
          >
            <div className="h-1 bg-charcoal-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-gold"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Skeleton loading for content
export const SkeletonLoader = ({ type = 'card', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="card animate-pulse">
            <div className="h-4 bg-charcoal-800 rounded w-3/4 mb-4" />
            <div className="h-3 bg-charcoal-800 rounded w-full mb-2" />
            <div className="h-3 bg-charcoal-800 rounded w-5/6" />
          </div>
        );
      
      case 'table-row':
        return (
          <div className="flex items-center gap-4 p-4 animate-pulse">
            <div className="w-8 h-8 bg-charcoal-800 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-charcoal-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-charcoal-800 rounded w-1/4" />
            </div>
            <div className="h-6 bg-charcoal-800 rounded w-16" />
          </div>
        );
      
      case 'profile':
        return (
          <div className="animate-pulse">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-charcoal-800 rounded-full" />
              <div className="flex-1">
                <div className="h-6 bg-charcoal-800 rounded w-1/3 mb-2" />
                <div className="h-4 bg-charcoal-800 rounded w-1/4" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-charcoal-800 rounded w-full" />
              <div className="h-4 bg-charcoal-800 rounded w-5/6" />
              <div className="h-4 bg-charcoal-800 rounded w-4/6" />
            </div>
          </div>
        );
      
      case 'list':
        return (
          <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 bg-charcoal-800 rounded-full" />
                <div className="h-4 bg-charcoal-800 rounded flex-1" />
              </div>
            ))}
          </div>
        );
      
      default:
        return (
          <div className="h-32 bg-charcoal-800 rounded-lg animate-pulse" />
        );
    }
  };

  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  );
};

export default LoadingScreen;
