// =============================================================================
// CORPS REGISTRATION MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState } from 'react';
import { Lock, Check, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CLASSES = [
  { id: 'worldClass', name: 'World Class', budget: '150 pts', reqLevel: 6 },
  { id: 'openClass', name: 'Open Class', budget: '120 pts', reqLevel: 5 },
  { id: 'aClass', name: 'A Class', budget: '60 pts', reqLevel: 4 },
  { id: 'soundSport', name: 'SoundSport', budget: '90 pts', reqLevel: 0 },
];

const CorpsRegistrationModal = ({ onClose, onSubmit, unlockedClasses = ['soundSport'], defaultClass }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    showConcept: '',
    class: defaultClass || 'soundSport',
  });

  // Close on Escape key
  useEscapeKey(onClose);

  const classes = CLASSES.map((cls) => ({
    ...cls,
    unlocked: cls.id === 'soundSport' || unlockedClasses.includes(cls.id),
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-corps-registration"
      >
        <div
          className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <h2 id="modal-title-corps-registration" className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Register Corps
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
                  Corps Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter corps name"
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
                  Home Location *
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

              {/* Class Selection Table */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Competition Class
                </label>
                <div className="border border-[#333] divide-y divide-[#333]">
                  {classes.map((cls) => {
                    const isSelected = formData.class === cls.id;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        disabled={!cls.unlocked}
                        onClick={() => cls.unlocked && setFormData({ ...formData, class: cls.id })}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 text-left
                          ${cls.unlocked ? 'hover:bg-white/5 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
                          ${isSelected ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]' : ''}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-[#0057B8] bg-[#0057B8]' : 'border-[#444]'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-sm font-medium text-white">{cls.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 tabular-nums">{cls.budget}</span>
                          {!cls.unlocked && <Lock className="w-3 h-3 text-gray-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
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
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default CorpsRegistrationModal;
