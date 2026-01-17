// ShowCard - Individual show card for schedule (Stadium HUD Style)
import React from 'react';
import { m } from 'framer-motion';
import { MapPin, Lock, Music, Plus, ExternalLink, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const ShowCard = React.memo(({
  show,
  index,
  myCorps,
  formattedDate,
  isPast,
  onRegister
}) => {
  const isRegistered = myCorps.length > 0;
  const isLocked = show.locked || isPast;

  // Determine card class based on status
  const getCardClass = () => {
    if (isLocked) return 'event-card event-card-closed';
    if (isRegistered) return 'event-card event-card-registered';
    return 'event-card event-card-open';
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={`${getCardClass()} relative flex`}
    >
      {/* Neon REGISTERED Badge */}
      {isRegistered && !isLocked && (
        <div className="absolute top-3 right-3 z-20">
          <div className="neon-badge neon-badge-registered">
            <Zap className="w-3 h-3 mr-1" />
            Registered
          </div>
        </div>
      )}

      {/* Left: Date Section */}
      <div className={`flex-shrink-0 w-20 md:w-24 p-3 md:p-4 flex flex-col items-center justify-center border-r ${
        isRegistered && !isLocked
          ? 'bg-yellow-500/10 border-yellow-500/20'
          : isLocked
          ? 'bg-black/20 border-white/5'
          : 'bg-yellow-500/5 border-white/10'
      }`}>
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-yellow-50/70">
          {formattedDate.split(' ')[0]}
        </span>
        <span className={`text-2xl md:text-3xl font-display font-bold ${
          isRegistered && !isLocked ? 'score-glow' : 'text-yellow-50'
        }`}>
          {formattedDate.split(' ')[2]}
        </span>
        <span className="text-xs font-display font-medium text-yellow-50/60">
          {formattedDate.split(' ')[1]}
        </span>
      </div>

      {/* Right: Show Info */}
      <div className="flex-1 p-3 md:p-4 flex flex-col min-w-0">
        {/* Show Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className={`font-display font-bold text-sm md:text-base truncate ${
              isLocked ? 'text-yellow-50/70' : 'text-yellow-50'
            }`}>
              {show.eventName || show.name}
            </h3>
            {show.location && (
              <div className="flex items-center gap-1 mt-1 text-xs text-yellow-50/40 font-medium truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{show.location}</span>
              </div>
            )}
          </div>
          {/* Icon Container */}
          <div className={`w-9 h-9 flex items-center justify-center ${
            isLocked
              ? 'bg-white/5 border border-white/10'
              : isRegistered
              ? 'bg-yellow-500/20 border border-yellow-500/30'
              : 'bg-black/30 border border-yellow-500/20'
          }`}>
            {isLocked ? (
              <Lock className="w-4 h-4 text-yellow-50/40" />
            ) : (
              <Music className={`w-4 h-4 ${isRegistered ? 'icon-neon-gold' : 'text-yellow-400/70'}`} />
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-2">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-yellow-50/40 border border-white/10">
              <Lock className="w-3 h-3" />
              {isPast ? 'Closed' : 'Locked'}
            </span>
          ) : show.scoresAvailable ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Scores Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
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
                  className="px-2 py-0.5 text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25"
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
            <Link to="/scores" className="block">
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all">
                <ExternalLink className="w-3.5 h-3.5" />
                View Scores
              </button>
            </Link>
          ) : (
            <button
              onClick={() => onRegister(show)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
                isRegistered
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                  : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {myCorps.length > 0 ? 'Edit Registration' : 'Register Corps'}
            </button>
          )}
        </div>
      </div>
    </m.div>
  );
});

ShowCard.displayName = 'ShowCard';

export default ShowCard;
