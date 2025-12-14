// =============================================================================
// SKELETON COMPONENT (TypeScript)
// =============================================================================
// Base skeleton component with shimmer animation and pre-built layouts

import React from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type SkeletonVariant = 'text' | 'title' | 'avatar' | 'card' | 'button';

export interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Skeleton variant for preset sizing */
  variant?: SkeletonVariant;
  /** Custom width (CSS value) */
  width?: string | number;
  /** Custom height (CSS value) */
  height?: string | number;
}

// =============================================================================
// BASE SKELETON COMPONENT
// =============================================================================

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  title: 'h-6 rounded',
  avatar: 'rounded-full',
  card: 'rounded-lg',
  button: 'h-10 rounded-lg',
};

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const baseClasses = 'animate-pulse bg-[#2A2A2A] rounded';

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant] || ''} ${className}`}
      style={style}
    />
  );
};

// =============================================================================
// PRE-BUILT SKELETON LAYOUTS
// =============================================================================

export const CardSkeleton: React.FC = () => (
  <div className="bg-charcoal-800 rounded-xl border border-cream-500/10 p-6">
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="avatar" width="48px" height="48px" />
      <div className="flex-1">
        <Skeleton variant="title" className="w-1/3 mb-2" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
    <Skeleton variant="text" className="w-full mb-2" />
    <Skeleton variant="text" className="w-4/5 mb-2" />
    <Skeleton variant="text" className="w-2/3" />
  </div>
);

export const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 border-b border-cream-500/10">
    <Skeleton variant="avatar" width="40px" height="40px" />
    <div className="flex-1">
      <Skeleton variant="text" className="w-1/3 mb-2" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
    <Skeleton variant="button" className="w-20" />
  </div>
);

export interface TableRowSkeletonProps {
  /** Number of columns to render */
  columns?: number;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({ columns = 4 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton variant="text" className="w-full" />
      </td>
    ))}
  </tr>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="bg-charcoal-800 rounded-lg border border-cream-500/10 p-4">
    <Skeleton variant="text" className="w-1/2 mb-2" />
    <Skeleton variant="title" className="w-2/3" />
  </div>
);

export interface LeaderboardSkeletonProps {
  /** Number of rows to render */
  rows?: number;
}

export const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ rows = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-3 bg-charcoal-800/50 rounded-lg">
        <Skeleton variant="text" className="w-8" />
        <Skeleton variant="avatar" width="36px" height="36px" />
        <div className="flex-1">
          <Skeleton variant="text" className="w-1/3" />
        </div>
        <Skeleton variant="text" className="w-16" />
      </div>
    ))}
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header section */}
    <div className="bg-charcoal-800 rounded-xl border border-cream-500/10 p-6">
      <div className="flex items-start gap-4">
        <Skeleton variant="avatar" width="80px" height="80px" />
        <div className="flex-1">
          <Skeleton variant="title" className="w-1/3 mb-2" />
          <Skeleton variant="text" className="w-1/4 mb-2" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
    </div>

    {/* Stats grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>

    {/* Content section */}
    <div className="bg-charcoal-800 rounded-xl border border-cream-500/10 p-6">
      <Skeleton variant="title" className="w-1/4 mb-4" />
      <Skeleton variant="text" className="w-full mb-2" />
      <Skeleton variant="text" className="w-4/5 mb-2" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  </div>
);

export interface ScoresSkeletonProps {
  /** Number of rows to render */
  rows?: number;
}

export const ScoresSkeleton: React.FC<ScoresSkeletonProps> = ({ rows = 5 }) => (
  <div className="bg-charcoal-800 rounded-xl border border-cream-500/10 p-6">
    <Skeleton variant="title" className="w-1/3 mb-4" />
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-charcoal-700/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Skeleton variant="text" className="w-8" />
            <Skeleton variant="text" className="w-32" />
          </div>
          <Skeleton variant="text" className="w-16" />
        </div>
      ))}
    </div>
  </div>
);

// =============================================================================
// TABLE SKELETON COMPONENT
// =============================================================================

export interface TableSkeletonProps {
  /** Number of rows to render (default: 5) */
  rows?: number;
  /** Number of columns to render (default: 4) */
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => (
  <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
    <table className="w-full">
      <thead className="bg-charcoal-900/95">
        <tr className="border-b border-cream-500/10">
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <div className="animate-pulse bg-[#2A2A2A] h-3 w-16 rounded" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex} className="h-12 border-b border-cream-500/5">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex} className="px-4 py-2">
                <div className="animate-pulse bg-[#2A2A2A] h-4 w-4/5 rounded" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Skeleton;
