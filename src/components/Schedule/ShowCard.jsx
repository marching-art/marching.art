// ShowCard - Individual show card for schedule (Tactical Luxury: Ticket Stub Style)
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Check, Music, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const ShowCard = ({
  show,
  index,
  myCorps,
  formattedDate,
  isPast,
  onRegister
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`ticket-stub flex ${isPast ? 'opacity-70' : ''} ${
        myCorps.length > 0 ? 'ring-2 ring-green-500/40' : ''
      }`}
    >
      {/* Left: Date Section */}
      <div className="flex-shrink-0 w-20 md:w-24 p-3 md:p-4 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/10 to-amber-500/5 dark:from-gold-500/20 dark:to-gold-500/10">
        <div className="text-[10px] font-display font-bold uppercase tracking-wider text-slate-500 dark:text-[#FAF6EA]/50">
          {formattedDate.split(' ')[0]}
        </div>
        <div className="text-2xl md:text-3xl font-display font-bold text-slate-800 dark:text-[#FAF6EA]">
          {formattedDate.split(' ')[2]}
        </div>
        <div className="text-xs font-display font-medium text-slate-600 dark:text-[#FAF6EA]/60">
          {formattedDate.split(' ')[1]}
        </div>
      </div>

      {/* Dashed Divider */}
      <div className="ticket-stub-divider" />

      {/* Right: Show Info */}
      <div className="flex-1 p-3 md:p-4 flex flex-col min-w-0">
        {/* Show Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-slate-800 dark:text-[#FAF6EA] truncate text-sm md:text-base uppercase tracking-wide">
              {show.eventName || show.name}
            </h3>
            {show.location && (
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-[#FAF6EA]/50 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{show.location}</span>
              </div>
            )}
          </div>
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${
            isPast ? 'bg-stone-200 dark:bg-[#3A3A3A]' : 'bg-amber-500/20 dark:bg-gold-500/20'
          }`}>
            <Music className={`w-4 h-4 ${
              isPast ? 'text-slate-400 dark:text-[#FAF6EA]/40' : 'text-amber-600 dark:text-gold-500'
            }`} />
          </div>
        </div>

        {/* Registered Corps */}
        {myCorps.length > 0 && (
          <div className="mb-2 p-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
            <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 mb-1">
              <Check className="w-3 h-3" />
              <span className="font-display font-bold uppercase tracking-wide">Registered</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {myCorps.map((corps, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded text-xs font-medium"
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
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wide border-2 border-stone-300 dark:border-[#3A3A3A] text-slate-600 dark:text-[#FAF6EA]/60 hover:border-stone-400 dark:hover:border-[#5A5A5A] transition-colors"
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
