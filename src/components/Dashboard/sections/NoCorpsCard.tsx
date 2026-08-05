// The dashboard's empty state: a director with no corps in the selected class.
//
// This is the first screen a brand-new account sees after onboarding, so it
// stays deliberately singular — one card, one sentence, one button. Extracted
// from Dashboard.jsx, where it was inline.

import React from 'react';
import { Trophy } from 'lucide-react';

export interface NoCorpsCardProps {
  onRegister: () => void;
}

const NoCorpsCard: React.FC<NoCorpsCardProps> = ({ onRegister }) => (
  <div className="flex items-center justify-center min-h-[60vh] p-4">
    <div className="bg-surface-card border border-line max-w-sm w-full">
      {/* The 10px uppercase label every dashboard panel header uses. */}
      <div className="bg-surface-raised px-4 py-3 border-b border-line">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Start Your Season
        </h3>
      </div>
      <div className="p-6 text-center">
        <Trophy className="w-12 h-12 text-muted mx-auto mb-4" aria-hidden="true" />
        <p className="text-sm text-muted mb-4">
          Create your first fantasy corps to begin competing.
        </p>
        <button
          type="button"
          onClick={onRegister}
          className="w-full min-h-touch py-3 bg-interactive text-white text-sm font-bold hover:bg-interactive-hover transition-colors duration-150 press-feedback"
        >
          Register Corps
        </button>
      </div>
    </div>
  </div>
);

export default NoCorpsCard;
