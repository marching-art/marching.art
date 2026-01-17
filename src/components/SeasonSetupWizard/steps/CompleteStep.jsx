// CompleteStep - Season setup completion screen
import React from 'react';
import { m } from 'framer-motion';
import { ChevronRight, PartyPopper, Zap, Info } from 'lucide-react';
import { formatSeasonName } from '../constants';

const CompleteStep = ({
  seasonData,
  totalCorps,
  currentWeek,
  onComplete
}) => {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-2xl mx-auto px-2"
    >
      <m.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-gold-500 to-yellow-400 rounded-sm flex items-center justify-center"
      >
        <PartyPopper className="w-8 h-8 md:w-12 md:h-12 text-charcoal-900" />
      </m.div>

      <m.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-gradient mb-2 md:mb-4"
      >
        You're All Set!
      </m.h1>

      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base md:text-xl text-cream-300 mb-6 md:mb-8"
      >
        Your corps are ready to compete in {formatSeasonName(seasonData?.name)}!
      </m.p>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8"
      >
        <div className="glass rounded-sm p-3 md:p-4">
          <div className="text-xl md:text-3xl font-bold text-gold-500 mb-1">{totalCorps}</div>
          <div className="text-xs md:text-base text-cream-500/60">Corps Ready</div>
        </div>
        <div className="glass rounded-sm p-3 md:p-4">
          <div className="text-xl md:text-3xl font-bold text-blue-500 mb-1">Week {currentWeek}</div>
          <div className="text-xs md:text-base text-cream-500/60">Shows Selected</div>
        </div>
      </m.div>

      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-blue-500/10 border border-blue-500/20 rounded-sm p-3 md:p-4 mb-6 md:mb-8"
      >
        <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mx-auto mb-2" />
        <p className="text-xs md:text-sm text-cream-300">
          Don't forget to rehearse your corps regularly to boost performance!
          {currentWeek < 7 && ' You can select shows for upcoming weeks from your Schedule.'}
        </p>
      </m.div>

      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        onClick={onComplete}
        className="btn-primary text-sm md:text-lg px-6 md:px-8 py-3 md:py-4 w-full sm:w-auto"
      >
        <Zap className="w-4 h-4 md:w-5 md:h-5 mr-2" />
        Go to Dashboard
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
      </m.button>
    </m.div>
  );
};

export default CompleteStep;
