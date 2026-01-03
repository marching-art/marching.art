// WelcomeStep - Season setup wizard welcome screen
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, Star, Calendar, Trophy, Rocket } from 'lucide-react';
import { getCorpsClassName, formatSeasonName } from '../constants';

const WelcomeStep = ({
  seasonData,
  corpsNeedingSetup,
  needsVerification,
  onContinue
}) => {
  const totalCorps = corpsNeedingSetup.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center max-w-2xl mx-auto px-2"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gradient-gold rounded-sm flex items-center justify-center"
      >
        <Rocket className="w-8 h-8 md:w-12 md:h-12 text-charcoal-900" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-gradient mb-2 md:mb-4"
      >
        Welcome to {formatSeasonName(seasonData?.name)}!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base md:text-xl text-cream-300 mb-6 md:mb-8"
      >
        A new season means fresh opportunities for glory!
        Let's get your corps ready to compete.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 md:mb-8"
      >
        <div className="glass rounded-sm p-3 md:p-4">
          <Star className="w-6 h-6 md:w-8 md:h-8 text-gold-500 mx-auto mb-1 md:mb-2" />
          <h3 className="font-semibold text-cream-100 text-sm md:text-base">Build Your Lineup</h3>
          <p className="text-xs md:text-sm text-cream-500/60">Select DCI corps for each caption</p>
        </div>
        <div className="glass rounded-sm p-3 md:p-4">
          <Calendar className="w-6 h-6 md:w-8 md:h-8 text-blue-500 mx-auto mb-1 md:mb-2" />
          <h3 className="font-semibold text-cream-100 text-sm md:text-base">Pick Your Shows</h3>
          <p className="text-xs md:text-sm text-cream-500/60">Choose events to compete in</p>
        </div>
        <div className="glass rounded-sm p-3 md:p-4">
          <Trophy className="w-6 h-6 md:w-8 md:h-8 text-purple-500 mx-auto mb-1 md:mb-2" />
          <h3 className="font-semibold text-cream-100 text-sm md:text-base">Chase Glory</h3>
          <p className="text-xs md:text-sm text-cream-500/60">Climb the leaderboards</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-charcoal-900/50 rounded-sm p-3 md:p-4 mb-6 md:mb-8"
      >
        <h3 className="font-semibold text-cream-100 mb-2 text-sm md:text-base">
          {totalCorps} Corps to Set Up
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {corpsNeedingSetup.map((classId) => (
            <span key={classId} className="badge badge-ghost text-xs md:text-sm">
              {getCorpsClassName(classId)}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        onClick={() => onContinue(needsVerification ? 'corps-verification' : 'corps-setup')}
        className="btn-primary text-sm md:text-lg px-6 md:px-8 py-3 md:py-4 w-full sm:w-auto"
      >
        <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2" />
        Let's Get Started
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
      </motion.button>
    </motion.div>
  );
};

export default WelcomeStep;
