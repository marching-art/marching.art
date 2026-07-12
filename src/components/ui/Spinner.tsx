import React from 'react';
import { m } from 'framer-motion';
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
  default: 'text-muted',
  gold: 'text-brand',
  white: 'text-white',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'gold',
  label,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={label || 'Loading...'}
    >
      <BrandLogo className={`animate-pulse ${sizeStyles[size]}`} color={variantStyles[variant]} />
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
            bg-charcoal-900/60 rounded-none z-10
            ${blur ? 'backdrop-blur-sm' : ''}
          `}
        >
          <div
            className="flex flex-col items-center gap-3"
            role="status"
            aria-label={label || 'Loading...'}
          >
            <div className="animate-pulse">
              <BrandLogo className="w-12 h-12" color="text-brand" />
            </div>
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
            role="status"
            aria-label={label}
          >
            <BrandLogo className="w-24 h-24" color="text-brand" />
          </m.div>
        )}
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
  sm: 'rounded-none',
  md: 'rounded-none',
  lg: 'rounded-none',
  full: 'rounded-full',
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
