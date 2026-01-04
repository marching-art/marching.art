// EmptyState - Diegetic "System Status" Empty State Component
// Designed to feel like part of the game world, not a broken website
import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useShouldReduceMotion } from '../hooks/useReducedMotion';

// =============================================================================
// TACTICAL SVG ICONS - Technical, in-world graphics
// =============================================================================

// Satellite Dish / Signal Scanner icon
const SignalScannerIcon = ({ className = "w-32 h-32" }) => (
  <svg viewBox="0 0 120 120" fill="none" className={className}>
    {/* Outer scanning rings */}
    <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
    <circle cx="60" cy="60" r="45" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.2" />
    <circle cx="60" cy="60" r="35" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />

    {/* Radar sweep arc */}
    <path
      d="M60 60 L60 15 A45 45 0 0 1 97 75 Z"
      fill="currentColor"
      opacity="0.08"
    />

    {/* Center dish structure */}
    <ellipse cx="60" cy="50" rx="25" ry="8" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <line x1="60" y1="50" x2="60" y2="85" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    <line x1="45" y1="85" x2="75" y2="85" stroke="currentColor" strokeWidth="2" opacity="0.5" />

    {/* Signal waves emanating */}
    <path d="M75 35 Q85 25 95 35" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M80 30 Q90 18 100 30" stroke="currentColor" strokeWidth="0.75" fill="none" opacity="0.2" />
    <path d="M85 25 Q95 12 105 25" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.15" />

    {/* Crosshair markers */}
    <line x1="60" y1="5" x2="60" y2="15" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
    <line x1="60" y1="105" x2="60" y2="115" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
    <line x1="5" y1="60" x2="15" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
    <line x1="105" y1="60" x2="115" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />

    {/* Corner brackets */}
    <path d="M10 25 L10 10 L25 10" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M95 10 L110 10 L110 25" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M110 95 L110 110 L95 110" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M25 110 L10 110 L10 95" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
  </svg>
);

// Network/Connection Lost icon
const NetworkLostIcon = ({ className = "w-32 h-32" }) => (
  <svg viewBox="0 0 120 120" fill="none" className={className}>
    {/* Hexagonal grid background */}
    <pattern id="hexgrid" width="20" height="17.32" patternUnits="userSpaceOnUse">
      <path d="M10 0 L20 5.77 L20 11.55 L10 17.32 L0 11.55 L0 5.77 Z" stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.1" />
    </pattern>
    <rect width="120" height="120" fill="url(#hexgrid)" opacity="0.5" />

    {/* Central broken link */}
    <circle cx="45" cy="60" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    <circle cx="75" cy="60" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />

    {/* Broken connection line */}
    <line x1="57" y1="60" x2="63" y2="60" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeDasharray="2 2" />

    {/* X mark over connection */}
    <line x1="55" y1="55" x2="65" y2="65" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    <line x1="65" y1="55" x2="55" y2="65" stroke="currentColor" strokeWidth="2" opacity="0.5" />

    {/* Status indicators */}
    <circle cx="30" cy="30" r="3" fill="currentColor" opacity="0.2" />
    <circle cx="90" cy="30" r="3" fill="currentColor" opacity="0.2" />
    <circle cx="30" cy="90" r="3" fill="currentColor" opacity="0.2" />
    <circle cx="90" cy="90" r="3" fill="currentColor" opacity="0.2" />

    {/* Corner frames */}
    <path d="M5 20 L5 5 L20 5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M100 5 L115 5 L115 20" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M115 100 L115 115 L100 115" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M20 115 L5 115 L5 100" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
  </svg>
);

// Simple void icon (fallback)
const VoidIcon = ({ className = "w-16 h-16" }) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="32" cy="32" r="28" />
    <line x1="12" y1="12" x2="52" y2="52" />
  </svg>
);

// =============================================================================
// GLITCH TEXT EFFECT
// =============================================================================
const GlitchText = ({ children, className = "" }) => (
  <div className={`relative ${className}`}>
    {/* Main text */}
    <span className="relative z-10">{children}</span>
    {/* Glitch layers */}
    <span
      className="absolute inset-0 text-red-500/30 z-0"
      style={{ clipPath: 'inset(20% 0 30% 0)', transform: 'translateX(-2px)' }}
      aria-hidden="true"
    >
      {children}
    </span>
    <span
      className="absolute inset-0 text-cyan-500/30 z-0"
      style={{ clipPath: 'inset(50% 0 20% 0)', transform: 'translateX(2px)' }}
      aria-hidden="true"
    >
      {children}
    </span>
  </div>
);

// =============================================================================
// MAIN EMPTY STATE COMPONENT
// =============================================================================
const EmptyState = ({
  variant = 'default', // 'default', 'signal', 'network', 'minimal'
  title = 'NO DATA FOUND',
  subtitle = 'Waiting for DCI season to commence...',
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = ''
}) => {
  const shouldReduceMotion = useShouldReduceMotion();

  // Select icon based on variant
  const IconComponent = CustomIcon || (
    variant === 'signal' ? SignalScannerIcon :
    variant === 'network' ? NetworkLostIcon :
    VoidIcon
  );

  const iconSize = variant === 'minimal' ? 'w-16 h-16' : 'w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40';

  // Minimal variant (original style)
  if (variant === 'minimal') {
    return (
      <div className={`bg-black/30 backdrop-blur-sm border border-white/10 rounded-sm p-8 md:p-12 ${className}`}>
        <div className="text-center">
          <IconComponent className="w-12 h-12 md:w-16 md:h-16 text-cream/30 mx-auto mb-6" />
          <h3 className="text-lg md:text-xl font-display font-bold text-cream/60 uppercase tracking-wide mb-2">
            {title}
          </h3>
          <p className="font-mono text-sm text-cream/40">
            {subtitle}
          </p>
          {actionLabel && onAction && (
            <button onClick={onAction} className="btn-primary mt-6">
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full tactical "System Status" variant
  return (
    <div className={`relative min-h-[400px] flex items-center justify-center ${className}`}>
      {/* Massive background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span
          className="font-display font-black text-cream/[0.015] uppercase leading-none whitespace-nowrap"
          style={{ fontSize: 'clamp(6rem, 25vw, 16rem)' }}
        >
          OFFLINE
        </span>
      </div>

      {/* Scanning line animation - skip on mobile */}
      {!shouldReduceMotion && (
        <motion.div
          className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-gold-500/30 to-transparent pointer-events-none"
          initial={{ top: '10%' }}
          animate={{ top: ['10%', '90%', '10%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Main content container */}
      <div className="relative z-10 text-center px-4 py-12 max-w-lg mx-auto">
        {/* Technical icon - static on mobile */}
        <div className="mb-6">
          <IconComponent className={`${iconSize} text-cream/30 mx-auto`} />
        </div>

        {/* Status indicator - static on mobile */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-2 h-2 bg-gold-500/60 rounded-sm" />
          <span className="font-mono text-[10px] text-cream/40 uppercase tracking-widest">
            System Status
          </span>
        </div>

        {/* Main title with glitch effect */}
        <GlitchText className="font-mono font-bold text-lg md:text-xl lg:text-2xl text-cream/70 uppercase tracking-wider mb-3">
          {title}
        </GlitchText>

        {/* Subtitle */}
        <p className="font-mono text-xs md:text-sm text-cream/40 mb-8 max-w-sm mx-auto leading-relaxed">
          {subtitle}
        </p>

        {/* Action button - static shadow instead of pulsing */}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 text-black font-mono font-bold text-sm uppercase tracking-widest border-2 border-gold-400 hover:bg-gold-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        )}

        {/* Technical readout footer */}
        <div className="mt-10 pt-6 border-t border-cream/5">
          <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-cream/20 uppercase tracking-widest">
            <span>Signal: --</span>
            <span>|</span>
            <span>Connections: 0</span>
            <span>|</span>
            <span>Status: Awaiting</span>
          </div>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cream/10 pointer-events-none" />
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-cream/10 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-cream/10 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-cream/10 pointer-events-none" />
    </div>
  );
};

export default EmptyState;
