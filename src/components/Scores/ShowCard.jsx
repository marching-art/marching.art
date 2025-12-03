// ShowCard - Display card for a show with top 3 scores preview
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const ShowCard = ({ show, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.002 }}
      className="p-4 md:p-6 cursor-pointer hover:bg-cream-50 dark:hover:bg-charcoal-800/30 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base md:text-xl font-semibold text-slate-900 dark:text-cream-100 truncate">{show.eventName}</h3>
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-cream-500/60 truncate">{show.location}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs md:text-sm text-slate-500 dark:text-cream-500/60">{show.date}</p>
          <p className="text-xs text-slate-400 dark:text-cream-500/40">{show.scores?.length || 0} corps</p>
        </div>
      </div>

      {show.scores && show.scores.length > 0 && (
        <div className="border border-cream-200 dark:border-cream-500/10 rounded-lg overflow-hidden">
          {show.scores.slice(0, 3).map((score, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-2.5 md:p-3 border-b border-cream-200 dark:border-cream-500/10 last:border-b-0 hover:bg-cream-50 dark:hover:bg-charcoal-800/50 transition-colors ${
                idx % 2 === 0 ? 'bg-cream-100/50 dark:bg-charcoal-900/30' : 'bg-white dark:bg-charcoal-900/20'
              }`}
            >
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <span className={`text-xs md:text-sm font-bold flex-shrink-0 px-1.5 py-0.5 rounded ${
                  idx === 0 ? 'bg-amber-100 dark:bg-yellow-500/20 text-amber-700 dark:text-yellow-400' :
                  idx === 1 ? 'bg-slate-200 dark:bg-gray-500/20 text-slate-600 dark:text-gray-400' :
                  'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-500'
                }`}>
                  #{idx + 1}
                </span>
                <span className="text-slate-900 dark:text-cream-100 font-medium text-sm md:text-base truncate">{score.corps}</span>
              </div>
              <span className="text-amber-700 dark:text-gold-500 font-bold text-base md:text-lg flex-shrink-0">{score.score.toFixed(3)}</span>
            </div>
          ))}
          {show.scores.length > 3 && (
            <button className="w-full py-2 text-xs md:text-sm text-slate-500 dark:text-cream-500/60 hover:text-slate-700 dark:hover:text-cream-300 flex items-center justify-center gap-1 bg-cream-100 dark:bg-charcoal-900/40 hover:bg-cream-200 dark:hover:bg-charcoal-800/50 transition-colors">
              View all {show.scores.length} corps
              <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ShowCard;
