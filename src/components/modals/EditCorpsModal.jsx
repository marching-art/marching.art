// =============================================================================
// EDIT CORPS MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState } from 'react';
import { X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const EditCorpsModal = ({ onClose, onSubmit, currentData }) => {
  const [formData, setFormData] = useState({
    name: currentData?.name || '',
    location: currentData?.location || '',
    showConcept: currentData?.showConcept || '',
  });

  // Close on Escape key
  useEscapeKey(onClose);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Edit Corps Details
            </h2>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {/* Corps Name */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Corps Name
                </label>
                <input
                  type="text"
                  placeholder="Corps name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={50}
                  className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Home Location
                </label>
                <input
                  type="text"
                  placeholder="City, State"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                  maxLength={50}
                  className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                />
              </div>

              {/* Show Concept */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Show Concept
                </label>
                <textarea
                  placeholder="Describe your show concept..."
                  value={formData.showConcept}
                  onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                  maxLength={500}
                  className="w-full h-20 px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  {formData.showConcept.length}/500
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default EditCorpsModal;
