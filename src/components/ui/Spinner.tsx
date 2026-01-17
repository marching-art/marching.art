import React from 'react';
import { m } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import BrandLogo from '../BrandLogo';

// =============================================================================
// SPINNER COMPONENT
// =============================================================================

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'default' | 'gold' | 'white';

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  label?: string;
  className?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const variantStyles: Record<SpinnerVariant, string> = {
  default: 'text-cream-500',
  gold: 'text-gold-500',
  white: 'text-white',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'gold',
  label,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status">
      <Loader2
        className={`animate-spin ${sizeStyles[size]} ${variantStyles[variant]}`}
      />
      {label && (
        <span className="text-sm text-cream-400">{label}</span>
      )}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
};

// =============================================================================
// LOADING OVERLAY
// =============================================================================

export interface LoadingOverlayProps {
  isLoading: boolean;
  label?: string;
  blur?: boolean;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  label,
  blur = true,
  children,
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`
            absolute inset-0 flex items-center justify-center
            bg-charcoal-900/60 rounded-sm z-10
            ${blur ? 'backdrop-blur-sm' : ''}
          `}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="animate-pulse">
              <BrandLogo className="w-12 h-12" color="text-gold-500" />
            </div>
            {label && (
              <p className="font-mono text-xs text-gold-500/50 tracking-wide">{label}</p>
            )}
          </div>
        </m.div>
      )}
    </div>
  );
};

// =============================================================================
// FULL PAGE LOADING
// =============================================================================

export interface FullPageLoadingProps {
  label?: string;
  showLogo?: boolean;
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({
  label = 'Loading...',
  showLogo = true,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-charcoal-950 z-50">
      <div className="flex flex-col items-center gap-4">
        {showLogo && (
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="glow-pulse"
          >
            <BrandLogo className="w-24 h-24" color="text-gold-500" />
          </m.div>
        )}
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-mono text-sm text-gold-400/60 tracking-wide"
        >
          {label}
        </m.p>
      </div>
    </div>
  );
};

// =============================================================================
// SKELETON COMPONENT
// =============================================================================

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const roundedStyles: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-sm',
  lg: 'rounded-sm',
  full: 'rounded-sm',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  rounded = 'md',
  className = '',
}) => {
  return (
    <div
      className={`
        animate-pulse bg-charcoal-700
        ${roundedStyles[rounded]}
        ${className}
      `}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
};

// =============================================================================
// SKELETON TEXT
// =============================================================================

export interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineWidth = '60%',
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
};

export default Spinner;
