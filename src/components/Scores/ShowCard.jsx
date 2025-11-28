// ShowCard - Display card for a show with top 3 scores preview
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const ShowCard = ({ show, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      className="card p-4 md:p-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base md:text-xl font-semibold text-cream-100 truncate">{show.eventName}</h3>
          </div>
          <p className="text-xs md:text-sm text-cream-500/60 truncate">{show.location}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs md:text-sm text-cream-500/60">{show.date}</p>
          <p className="text-xs text-cream-500/40">{show.scores?.length || 0} corps</p>
        </div>
      </div>

      {show.scores && show.scores.length > 0 && (
        <div className="space-y-1.5 md:space-y-2">
          {show.scores.slice(0, 3).map((score, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 md:p-3 bg-charcoal-900/30 rounded-lg"
            >
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <span className={`text-xs md:text-sm font-bold flex-shrink-0 ${
                  idx === 0 ? 'text-yellow-500' :
                  idx === 1 ? 'text-gray-400' :
                  'text-orange-600'
                }`}>
                  #{idx + 1}
                </span>
                <span className="text-cream-100 font-medium text-sm md:text-base truncate">{score.corps}</span>
              </div>
              <span className="text-gold-500 font-bold text-base md:text-lg flex-shrink-0">{score.score.toFixed(3)}</span>
            </div>
          ))}
          {show.scores.length > 3 && (
            <button className="w-full py-2 text-xs md:text-sm text-cream-500/60 hover:text-cream-300 flex items-center justify-center gap-1">
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
