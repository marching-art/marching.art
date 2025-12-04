// EmptyState - Night Mode Stadium HUD empty state
import React from 'react';

// Void icon - slashed circle with subtle glow
const VoidIcon = ({ className = "w-16 h-16" }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    {/* Outer circle */}
    <circle cx="32" cy="32" r="28" />
    {/* Diagonal slash */}
    <line x1="12" y1="12" x2="52" y2="52" />
  </svg>
);

const EmptyState = ({
  title = 'NO DATA FOUND',
  subtitle = 'Waiting for DCI season to commence...',
  className = ''
}) => {
  return (
    <div className={`bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 ${className}`}>
      <div className="text-center">
        {/* Void Icon */}
        <VoidIcon className="w-12 h-12 md:w-16 md:h-16 text-yellow-50/30 mx-auto mb-6" />

        {/* Header */}
        <h3 className="text-lg md:text-xl font-display font-bold text-yellow-50/60 uppercase tracking-wide mb-2">
          {title}
        </h3>

        {/* Subtext */}
        <p className="font-mono text-sm text-yellow-50/40">
          {subtitle}
        </p>
      </div>
    </div>
  );
};

export default EmptyState;
