// =============================================================================
// AVATAR SELECTOR MODAL
// =============================================================================
// Picks which corps uniform/avatar to display on the profile hero. Extracted
// from DirectorProfile to keep that file under the max-lines guardrail.

import React from 'react';
import { m } from 'framer-motion';
import { X, Star } from 'lucide-react';
import type { CorpsClass } from '../../types';
import { getClassDisplay } from './directorProfileHelpers';

interface AvatarSelectorModalProps {
  corpsWithAvatars: { corpsClass: CorpsClass; corpsName: string; avatarUrl: string }[];
  selectedCorpsClass: CorpsClass | null;
  saving: boolean;
  onSelect: (corpsClass: CorpsClass) => void;
  onClose: () => void;
}

const AvatarSelectorModal: React.FC<AvatarSelectorModalProps> = ({
  corpsWithAvatars,
  selectedCorpsClass,
  saving,
  onSelect,
  onClose,
}) => (
  <m.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <m.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-surface-card border border-line w-full max-w-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Select Profile Avatar
        </span>
        <button
          onClick={onClose}
          className="p-1 text-muted hover:text-white"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {corpsWithAvatars.map((corps) => {
          const isSelected = selectedCorpsClass === corps.corpsClass;
          const classConfig = getClassDisplay(corps.corpsClass);
          return (
            <button
              key={corps.corpsClass}
              onClick={() => onSelect(corps.corpsClass)}
              disabled={saving}
              className={`relative border-2 p-1 transition-all ${
                isSelected
                  ? 'border-interactive bg-interactive/10'
                  : 'border-line hover:border-line-strong'
              } ${saving ? 'opacity-50' : ''}`}
            >
              {/* OPTIMIZATION #7: Added lazy loading for corps avatar */}
              <img
                src={corps.avatarUrl}
                alt={corps.corpsName}
                className="w-full aspect-square object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                <div className="text-[10px] text-white font-bold truncate">{corps.corpsName}</div>
                <div className={`text-[9px] ${classConfig.color}`}>{classConfig.short}</div>
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-interactive flex items-center justify-center">
                  <Star className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <p className="text-[10px] text-muted text-center">
          Choose which corps uniform to display on your profile
        </p>
      </div>
    </m.div>
  </m.div>
);

export default AvatarSelectorModal;
