// =============================================================================
// SHOW DETAIL MODAL - ESPN DATA STYLE
// =============================================================================

import React from 'react';
import { X } from 'lucide-react';
import Portal from '../Portal';
import ScoreRow from './ScoreRow';

const ShowDetailModal = ({ show, onClose }) => {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl max-h-[85vh] bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white truncate">{show.eventName}</h2>
                <p className="text-[10px] text-gray-500 mt-1">
                  {show.location} • {show.date}
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-gray-500 hover:text-white flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
              Full Results
            </h3>
            <div className="space-y-1">
              {show.scores?.map((score, idx) => (
                <ScoreRow key={idx} score={score} rank={idx + 1} />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ShowDetailModal;
