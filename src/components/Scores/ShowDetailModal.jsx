// ShowDetailModal - Full show results modal with all scores
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Portal from '../Portal';
import ScoreRow from './ScoreRow';

const ShowDetailModal = ({ show, onClose }) => {
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card max-w-4xl w-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 md:p-6 border-b border-cream-500/20 sticky top-0 bg-charcoal-900/95 backdrop-blur-sm z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-2xl font-bold text-cream-100 mb-1 md:mb-2 truncate">{show.eventName}</h2>
                <p className="text-xs md:text-sm text-cream-500/60">{show.location} • {show.date}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-cream-500/60 hover:text-cream-300 hover:bg-charcoal-800 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-cream-100 mb-3 md:mb-4">Full Results</h3>
            <div className="space-y-2 md:space-y-3">
              {show.scores?.map((score, idx) => (
                <ScoreRow key={idx} score={score} rank={idx + 1} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
};

export default ShowDetailModal;
