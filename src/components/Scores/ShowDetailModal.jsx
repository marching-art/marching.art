// =============================================================================
// SHOW DETAIL MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Portal from '../Portal';
import ScoreRow from './ScoreRow';
import { useFocusTrap } from '../a11y';

const ShowDetailModal = ({ show, onClose }) => {
  const modalRef = useRef(null);

  // Focus trap - keeps Tab navigation within modal for accessibility
  useFocusTrap(modalRef, true);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="show-detail-title"
          className="w-full max-w-4xl max-h-[85vh] bg-[#1a1a1a] border border-[#333] rounded-sm flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 id="show-detail-title" className="text-sm font-bold text-white truncate">{show.eventName}</h2>
                <p className="text-[10px] text-gray-500 mt-1">
                  {show.location} • {show.date}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1 text-gray-500 hover:text-white flex-shrink-0"
              >
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
          <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end flex-shrink-0">
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
