// ClassUnlockModal - Congratulations modal when user unlocks a new class
import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import Portal from '../Portal';

const CLASS_INFO = {
  aClass: {
    name: 'A Class',
    description: 'Intermediate level corps with higher point limits and more competitive shows',
    icon: '\uD83C\uDFBA',
    color: 'from-blue-500 to-blue-600',
    xpRequired: '3,000 XP'
  },
  open: {
    name: 'Open Class',
    description: 'Advanced level corps with expanded opportunities and prestigious competitions',
    icon: '\uD83C\uDF96\uFE0F',
    color: 'from-purple-500 to-purple-600',
    xpRequired: '5,000 XP'
  },
  world: {
    name: 'World Class',
    description: 'Elite level corps competing at the highest tier of drum corps activity',
    icon: '\uD83D\uDC51',
    color: 'from-gold-500 to-gold-600',
    xpRequired: '10,000 XP'
  }
};

const ClassUnlockModal = ({ unlockedClass, onSetup, onDecline }) => {
  const classInfo = CLASS_INFO[unlockedClass] || CLASS_INFO.aClass;

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-premium rounded-2xl p-8 border-2 border-gold-500/30 relative overflow-hidden">
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${classInfo.color} opacity-10 animate-pulse`} />

            <div className="relative z-10">
              {/* Celebration icon */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="text-7xl mb-4"
                >
                  {classInfo.icon}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-4xl font-display font-bold text-gradient mb-2">
                    Congratulations!
                  </h2>
                  <p className="text-xl text-cream-100 font-semibold">
                    You've earned {classInfo.xpRequired}!
                  </p>
                </motion.div>
              </div>

              {/* Class unlock info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-dark rounded-xl p-6 mb-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${classInfo.color} flex items-center justify-center`}>
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      {classInfo.name} Unlocked!
                    </h3>
                    <p className="text-cream-300 text-sm leading-relaxed">
                      {classInfo.description}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Call to action */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-3"
              >
                <p className="text-center text-cream-300 mb-4">
                  Would you like to register a corps for {classInfo.name} now?
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={onDecline}
                    className="btn-ghost flex-1"
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={onSetup}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    Register Corps
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default ClassUnlockModal;
