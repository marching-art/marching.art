// =============================================================================
// COMMAND CONSOLE UI COMPONENTS
// System Initialization Loader & Tactical Empty States
// Aesthetic: Terminal-style, monospace, technical HUD feel
// =============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, AlertTriangle, Radar, Shield, Server, Wifi, WifiOff } from 'lucide-react';
import { useShouldReduceMotion } from '../../hooks/useReducedMotion';

// =============================================================================
// SYSTEM INITIALIZATION LOADER
// Technical boot sequence with cycling status messages
// =============================================================================

export interface SystemLoaderProps {
  /** Array of status messages to cycle through */
  messages?: string[];
  /** Show progress bar */
  showProgress?: boolean;
  /** Progress value (0-100) - if provided, shows determinate progress */
  progress?: number;
  /** Full screen mode */
  fullScreen?: boolean;
  /** Custom className */
  className?: string;
}

const DEFAULT_MESSAGES = [
  'INITIALIZING SYSTEM...',
  'LOADING ASSETS...',
  'CONNECTING TO MAINFRAME...',
  'SYNCING ROSTER DATA...',
  'CALIBRATING SENSORS...',
  'ESTABLISHING UPLINK...',
];

export const SystemLoader: React.FC<SystemLoaderProps> = ({
  messages = DEFAULT_MESSAGES,
  showProgress = true,
  progress,
  fullScreen = false,
  className = '',
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [internalProgress, setInternalProgress] = useState(0);
  const shouldReduceMotion = useShouldReduceMotion();

  // Cycle through messages - slower interval on mobile
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, shouldReduceMotion ? 3000 : 1800); // Slower on mobile
    return () => clearInterval(interval);
  }, [messages.length, shouldReduceMotion]);

  // Animate internal progress if no external progress provided
  useEffect(() => {
    if (progress === undefined) {
      const interval = setInterval(() => {
        setInternalProgress((prev) => {
          if (prev >= 95) return 15; // Loop back
          return prev + Math.random() * 8 + 2;
        });
      }, shouldReduceMotion ? 800 : 400); // Slower on mobile
      return () => clearInterval(interval);
    }
  }, [progress, shouldReduceMotion]);

  const displayProgress = progress ?? internalProgress;

  const content = (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      {/* Terminal Header - simplified on mobile */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {shouldReduceMotion ? (
            <div className="w-2 h-2 bg-gold-500 rounded-full" />
          ) : (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-2 h-2 bg-gold-500 rounded-full"
            />
          )}
          <span className="font-mono text-[10px] text-gold-500/80 uppercase tracking-[0.3em]">
            System Boot
          </span>
          {shouldReduceMotion ? (
            <div className="w-2 h-2 bg-gold-500 rounded-full" />
          ) : (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 bg-gold-500 rounded-full"
            />
          )}
        </div>
      </div>

      {/* Status Message - Monospace Terminal Style */}
      <div className="relative min-w-[280px] max-w-md">
        {/* Message Container with Border */}
        <div className="border border-gold-500/30 bg-black/60 backdrop-blur-sm px-4 py-3">
          {shouldReduceMotion ? (
            <div className="flex items-center gap-3">
              <span className="text-gold-500 font-mono">&gt;</span>
              <span className="font-mono text-sm text-cream tracking-wide">
                {messages[currentMessageIndex]}
              </span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                {/* Blinking Cursor */}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-gold-500 font-mono"
                >
                  &gt;
                </motion.span>
                <span className="font-mono text-sm text-cream tracking-wide">
                  {messages[currentMessageIndex]}
                </span>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Corner Brackets */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-gold-500/50" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-gold-500/50" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-gold-500/50" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-gold-500/50" />
      </div>

      {/* Technical Progress Bar */}
      {showProgress && (
        <div className="w-full max-w-md">
          {/* Progress Container */}
          <div className="relative h-1.5 bg-charcoal-800 border border-gold-500/20 overflow-hidden">
            {/* Progress Fill */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gold-500"
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3, ease: 'linear' }}
            />
            {/* Scanline Effect - skip on mobile */}
            {!shouldReduceMotion && (
              <motion.div
                className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-gold-400/50 to-transparent"
                animate={{ left: ['-10%', '110%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
          {/* Progress Percentage */}
          <div className="flex justify-between mt-1.5">
            <span className="font-mono text-[9px] text-cream/40 uppercase tracking-widest">
              Progress
            </span>
            <span className="font-mono text-[10px] text-gold-500 tabular-nums">
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>
      )}

      {/* Technical Footer */}
      <div className="flex items-center gap-4 text-[8px] font-mono text-cream/20 uppercase tracking-widest">
        <span>SYS.INIT</span>
        <span className="text-gold-500/40">|</span>
        <span>v2.4.1</span>
        <span className="text-gold-500/40">|</span>
        {shouldReduceMotion ? (
          <span className="opacity-60">STANDBY</span>
        ) : (
          <motion.span
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            STANDBY
          </motion.span>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-charcoal-950 z-50">
        {/* Background Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(250, 204, 21, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(250, 204, 21, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Radial Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/80" />
        {content}
      </div>
    );
  }

  return content;
};

// =============================================================================
// LOADING OVERLAY - Command Console Style
// =============================================================================

export interface ConsoleLoadingOverlayProps {
  isLoading: boolean;
  messages?: string[];
  children: React.ReactNode;
}

export const ConsoleLoadingOverlay: React.FC<ConsoleLoadingOverlayProps> = ({
  isLoading,
  messages,
  children,
}) => {
  return (
    <div className="relative">
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-charcoal-950/80 backdrop-blur-sm z-10"
          >
            <SystemLoader messages={messages} showProgress={true} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// TACTICAL SVG ICONS
// =============================================================================

// Radar Grid Icon - Technical scanning aesthetic
const RadarGridIcon = ({ className = 'w-32 h-32' }: { className?: string }) => (
  <svg viewBox="0 0 120 120" fill="none" className={className}>
    {/* Grid Background */}
    <defs>
      <pattern id="radarGrid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.15" />
      </pattern>
    </defs>
    <rect width="120" height="120" fill="url(#radarGrid)" />

    {/* Concentric Circles */}
    <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 2" opacity="0.3" />
    <circle cx="60" cy="60" r="35" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.25" />
    <circle cx="60" cy="60" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />

    {/* Crosshairs */}
    <line x1="60" y1="5" x2="60" y2="115" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
    <line x1="5" y1="60" x2="115" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />

    {/* Diagonal Lines */}
    <line x1="18" y1="18" x2="102" y2="102" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
    <line x1="102" y1="18" x2="18" y2="102" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />

    {/* Center Point */}
    <circle cx="60" cy="60" r="3" fill="currentColor" opacity="0.4" />

    {/* Corner Brackets */}
    <path d="M8 25 L8 8 L25 8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    <path d="M95 8 L112 8 L112 25" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    <path d="M112 95 L112 112 L95 112" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    <path d="M25 112 L8 112 L8 95" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />

    {/* Tick Marks */}
    <line x1="60" y1="10" x2="60" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    <line x1="60" y1="105" x2="60" y2="110" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    <line x1="10" y1="60" x2="15" y2="60" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    <line x1="105" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="1" opacity="0.3" />
  </svg>
);

// Wireframe Shield Icon - Security/Protection aesthetic
const WireframeShieldIcon = ({ className = 'w-32 h-32' }: { className?: string }) => (
  <svg viewBox="0 0 120 120" fill="none" className={className}>
    {/* Outer Shield Shape */}
    <path
      d="M60 10 L100 25 L100 60 Q100 90 60 110 Q20 90 20 60 L20 25 Z"
      stroke="currentColor"
      strokeWidth="1"
      fill="none"
      opacity="0.3"
    />
    {/* Inner Shield */}
    <path
      d="M60 22 L90 34 L90 58 Q90 82 60 98 Q30 82 30 58 L30 34 Z"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeDasharray="4 2"
      fill="none"
      opacity="0.2"
    />
    {/* Core Shield */}
    <path
      d="M60 34 L80 43 L80 56 Q80 74 60 86 Q40 74 40 56 L40 43 Z"
      stroke="currentColor"
      strokeWidth="0.5"
      fill="currentColor"
      fillOpacity="0.05"
      opacity="0.25"
    />

    {/* Center Icon */}
    <circle cx="60" cy="58" r="10" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <line x1="60" y1="52" x2="60" y2="64" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    <line x1="54" y1="58" x2="66" y2="58" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />

    {/* Grid Lines */}
    <line x1="60" y1="10" x2="60" y2="110" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.15" />
    <line x1="20" y1="60" x2="100" y2="60" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.15" />

    {/* Corner Indicators */}
    <circle cx="20" cy="25" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="100" cy="25" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="60" cy="10" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="60" cy="110" r="2" fill="currentColor" opacity="0.3" />
  </svg>
);

// =============================================================================
// CONSOLE EMPTY STATE
// Tactical "No Signal" aesthetic with dashed warning border
// =============================================================================

export type EmptyStateVariant = 'radar' | 'shield' | 'network' | 'server' | 'minimal';

export interface ConsoleEmptyStateProps {
  /** Visual variant */
  variant?: EmptyStateVariant;
  /** Main title */
  title?: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Custom icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Custom className */
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, {
  icon: React.ComponentType<{ className?: string }>;
  defaultTitle: string;
  defaultSubtitle: string;
}> = {
  radar: {
    icon: RadarGridIcon,
    defaultTitle: 'NO ACTIVE SIGNALS DETECTED',
    defaultSubtitle: 'Scanning frequencies... awaiting transmission.',
  },
  shield: {
    icon: WireframeShieldIcon,
    defaultTitle: 'SECTOR SECURE - NO DATA',
    defaultSubtitle: 'All systems nominal. No records to display.',
  },
  network: {
    icon: WifiOff,
    defaultTitle: 'CONNECTION OFFLINE',
    defaultSubtitle: 'Unable to establish uplink. Check network status.',
  },
  server: {
    icon: Server,
    defaultTitle: 'AWAITING SERVER RESPONSE',
    defaultSubtitle: 'Mainframe is processing request...',
  },
  minimal: {
    icon: Radar,
    defaultTitle: 'NO DATA AVAILABLE',
    defaultSubtitle: 'Nothing to display at this time.',
  },
};

export const ConsoleEmptyState: React.FC<ConsoleEmptyStateProps> = ({
  variant = 'radar',
  title,
  subtitle,
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = '',
}) => {
  const config = variantConfig[variant];
  const IconComponent = CustomIcon || config.icon;
  const displayTitle = title || config.defaultTitle;
  const displaySubtitle = subtitle || config.defaultSubtitle;
  const shouldReduceMotion = useShouldReduceMotion();

  // Minimal variant - compact version
  if (variant === 'minimal') {
    return (
      <div className={`
        border-2 border-dashed border-warning/30
        bg-warning/5 backdrop-blur-sm
        rounded-lg p-6 md:p-8
        ${className}
      `}>
        <div className="text-center">
          <IconComponent className="w-10 h-10 text-warning/50 mx-auto mb-4" />
          <h3 className="font-mono text-sm text-cream/70 uppercase tracking-wider mb-2">
            {displayTitle}
          </h3>
          <p className="font-mono text-xs text-cream/40 mb-4">
            {displaySubtitle}
          </p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-charcoal-900 font-mono font-bold text-xs uppercase tracking-wider hover:bg-gold-400 transition-colors shadow-lg"
            >
              <Plus className="w-3 h-3" />
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full tactical display
  return (
    <div className={`
      relative min-h-[320px] flex items-center justify-center
      border-2 border-dashed border-warning/30
      bg-gradient-to-b from-warning/[0.02] to-transparent
      rounded-lg overflow-hidden
      ${className}
    `}>
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span
          className="font-display font-black text-warning/[0.03] uppercase leading-none whitespace-nowrap"
          style={{ fontSize: 'clamp(4rem, 20vw, 12rem)' }}
        >
          STANDBY
        </span>
      </div>

      {/* Scanning Line Animation - skip on mobile */}
      {!shouldReduceMotion && (
        <motion.div
          className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-warning/40 to-transparent pointer-events-none"
          initial={{ top: '10%' }}
          animate={{ top: ['10%', '90%', '10%'] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Main Content */}
      <div className="relative z-10 text-center px-4 py-8 max-w-md mx-auto">
        {/* Technical Icon - static on mobile */}
        <div className="mb-6">
          <IconComponent className="w-20 h-20 md:w-28 md:h-28 text-warning/40 mx-auto" />
        </div>

        {/* Status Indicator - static on mobile */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-2 h-2 bg-warning rounded-full" />
          <span className="font-mono text-[9px] text-warning/60 uppercase tracking-[0.2em]">
            Status: Awaiting Input
          </span>
        </div>

        {/* Title */}
        <h3 className="font-mono font-bold text-base md:text-lg text-cream/80 uppercase tracking-wider mb-2">
          {displayTitle}
        </h3>

        {/* Subtitle */}
        <p className="font-mono text-xs text-cream/40 mb-6 max-w-xs mx-auto leading-relaxed">
          {displaySubtitle}
        </p>

        {/* Action Button - static shadow instead of pulsing */}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-500 text-charcoal-900 font-mono font-bold text-sm uppercase tracking-wider border border-gold-400 hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/20"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        )}

        {/* Technical Footer */}
        <div className="mt-8 pt-4 border-t border-warning/10">
          <div className="flex items-center justify-center gap-4 text-[8px] font-mono text-cream/20 uppercase tracking-widest">
            <span>Signal: --</span>
            <span className="text-warning/30">|</span>
            <span>Queue: 0</span>
            <span className="text-warning/30">|</span>
            <span>Uptime: Active</span>
          </div>
        </div>
      </div>

      {/* Corner Brackets */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-warning/30 pointer-events-none" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-warning/30 pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-warning/30 pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-warning/30 pointer-events-none" />

      {/* Warning Icon */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 bg-warning/10 border border-warning/20 rounded">
        <AlertTriangle className="w-3 h-3 text-warning/60" />
        <span className="font-mono text-[8px] text-warning/60 uppercase tracking-wider">No Data</span>
      </div>
    </div>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  SystemLoader,
  ConsoleLoadingOverlay,
  ConsoleEmptyState,
  RadarGridIcon,
  WireframeShieldIcon,
};
