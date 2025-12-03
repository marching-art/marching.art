// ShowCard - Individual show card for schedule (Travel Itinerary Style)
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Check, Music, Plus, ExternalLink, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const ShowCard = ({
  show,
  index,
  myCorps,
  formattedDate,
  isPast,
  onRegister
}) => {
  const isRegistered = myCorps.length > 0;
  const isLocked = show.locked || isPast;
  const isOpen = !isLocked && !isRegistered;

  // Determine card state styling
  const getCardClasses = () => {
    if (isLocked) {
      // Past shows: grayscale with hatched overlay
      return 'ticket-stub-past';
    }
    if (isRegistered) {
      // Registered shows: thick green left border
      return 'ticket-stub-registered';
    }
    // Open shows: clean white with hard shadow
    return 'ticket-stub-open';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`relative flex overflow-hidden ${getCardClasses()}`}
    >
      {/* Hatched Pattern Overlay for Past Shows */}
      {isLocked && (
        <div className="absolute inset-0 z-10 pointer-events-none hatched-overlay" />
      )}

      {/* REGISTERED Stamp Effect for registered cards */}
      {isRegistered && !isLocked && (
        <div className="absolute top-3 right-3 z-20 transform rotate-12">
          <div className="px-3 py-1.5 bg-green-600 text-white text-xs font-display font-black uppercase tracking-widest shadow-brutal-sm border-2 border-green-800">
            REGISTERED
          </div>
        </div>
      )}

      {/* Left: Date Section */}
      <div className={`flex-shrink-0 w-20 md:w-24 p-3 md:p-4 flex flex-col items-center justify-center ${
        isRegistered && !isLocked
          ? 'bg-gradient-to-br from-green-500/20 to-green-500/10 dark:from-green-500/30 dark:to-green-500/15'
          : 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 dark:from-gold-500/20 dark:to-gold-500/10'
      }`}>
        <div className="text-[10px] font-display font-bold uppercase tracking-wider text-slate-600 dark:text-text-muted">
          {formattedDate.split(' ')[0]}
        </div>
        <div className="text-2xl md:text-3xl font-display font-bold text-text-main">
          {formattedDate.split(' ')[2]}
        </div>
        <div className="text-xs font-display font-medium text-slate-700 dark:text-text-muted">
          {formattedDate.split(' ')[1]}
        </div>
      </div>

      {/* Dashed Divider */}
      <div className={`ticket-stub-divider ${
        isRegistered && !isLocked ? 'border-green-500/50 dark:border-green-400/50' : ''
      }`} />

      {/* Right: Show Info */}
      <div className="flex-1 p-3 md:p-4 flex flex-col min-w-0">
        {/* Show Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {/* CRITICAL: Dark slate text on white cards for high contrast */}
            <h3 className="font-display font-black text-slate-900 dark:text-white truncate text-sm md:text-base uppercase tracking-tight">
              {show.eventName || show.name}
            </h3>
            {show.location && (
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-600 dark:text-stone-400 font-bold truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{show.location}</span>
              </div>
            )}
          </div>
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${
            isLocked
              ? 'bg-stone-200 dark:bg-surface-highlight'
              : isRegistered
              ? 'bg-green-500/20 dark:bg-green-500/20'
              : 'bg-amber-500/20 dark:bg-gold-500/20'
          }`}>
            {isLocked ? (
              <Lock className="w-4 h-4 text-text-muted" />
            ) : (
              <Music className={`w-4 h-4 ${
                isRegistered ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-gold-500'
              }`} />
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-2">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-stone-500 text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-full">
              <Lock className="w-3 h-3" />
              {isPast ? 'Closed' : 'Locked'}
            </span>
          ) : show.scoresAvailable ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-full">
              Scores Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-full">
              Open
            </span>
          )}
        </div>

        {/* Registered Corps List */}
        {isRegistered && (
          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
              {myCorps.map((corps, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded text-xs font-medium border border-green-200 dark:border-green-500/30"
                >
                  {corps.corpsName.length > 12
                    ? corps.corpsName.substring(0, 12) + '...'
                    : corps.corpsName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-2">
          {isPast ? (
            <Link
              to="/scores"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wide bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Scores
            </Link>
          ) : (
            <button
              onClick={() => onRegister(show)}
              className="btn-pill w-full text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {myCorps.length > 0 ? 'Edit Registration' : 'Register Corps'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ShowCard;
