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
  avatar: 'rounded-sm',
  card: 'rounded-sm',
  button: 'h-10 rounded-sm',
};

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const baseClasses = 'animate-pulse bg-charcoal-800 rounded';

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
  <div className="bg-charcoal-800 rounded-sm border border-cream-500/10 p-6">
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
  <div className="bg-charcoal-800 rounded-sm border border-cream-500/10 p-4">
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
      <div key={i} className="flex items-center gap-4 p-3 bg-charcoal-800/50 rounded-sm">
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
    <div className="bg-charcoal-800 rounded-sm border border-cream-500/10 p-6">
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
    <div className="bg-charcoal-800 rounded-sm border border-cream-500/10 p-6">
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
  <div className="bg-charcoal-800 rounded-sm border border-cream-500/10 p-6">
    <Skeleton variant="title" className="w-1/3 mb-4" />
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-charcoal-700/30 rounded-sm">
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
  <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden">
    <table className="w-full">
      <thead className="bg-charcoal-900/95">
        <tr className="border-b border-cream-500/10">
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <div className="animate-pulse bg-charcoal-800 h-3 w-16 rounded" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex} className="h-12 border-b border-cream-500/5">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex} className="px-4 py-2">
                <div className="animate-pulse bg-charcoal-800 h-4 w-4/5 rounded" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// =============================================================================
// PAGE-SPECIFIC SKELETON SCREENS
// =============================================================================

/**
 * Dashboard Page Skeleton
 * Matches the ESPN data grid layout with stats, corps table, and recent shows
 * Works inside GameShell layout
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
    {/* Stats Row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-cream-500/10 rounded-sm overflow-hidden mb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-charcoal-900 p-4">
          <Skeleton variant="text" className="w-16 mb-2" />
          <Skeleton variant="title" className="w-24" />
        </div>
      ))}
    </div>

    {/* Main Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-cream-500/10 rounded-sm overflow-hidden">
      {/* Corps Table - 2 cols */}
      <div className="lg:col-span-2 bg-charcoal-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="title" className="w-32" />
          <Skeleton variant="button" className="w-24 h-8" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-charcoal-800/50 rounded">
              <Skeleton variant="text" className="w-8" />
              <Skeleton variant="text" className="w-32 flex-1" />
              <Skeleton variant="text" className="w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="bg-charcoal-900 p-4 space-y-4">
        <Skeleton variant="title" className="w-24 mb-3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 bg-charcoal-800/50 rounded">
            <Skeleton variant="text" className="w-full mb-2" />
            <Skeleton variant="text" className="w-2/3" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Scores Page Skeleton
 * Matches the ESPN spreadsheet view with tabs and data table
 * Works inside GameShell layout
 */
export const ScoresPageSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto">
    {/* Ticker skeleton */}
    <div className="h-10 bg-charcoal-900 border-b border-gold-500/30 flex items-center px-4">
      <Skeleton variant="text" className="w-24 mr-6" />
      <Skeleton variant="text" className="w-32 mr-6" />
      <Skeleton variant="text" className="w-20" />
    </div>

    {/* Tabs skeleton */}
    <div className="flex gap-1 p-2 bg-charcoal-900 border-b border-cream-500/10">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="button" className="w-20 h-8" />
      ))}
    </div>

    {/* Table skeleton */}
    <div className="p-4">
      <TableSkeleton rows={10} columns={6} />
    </div>
  </div>
);

/**
 * Leagues Page Skeleton
 * Matches the ESPN league office style with standings and matchups
 * Works inside GameShell layout
 */
export const LeaguesPageSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <Skeleton variant="title" className="w-32" />
      <Skeleton variant="button" className="w-28 h-9" />
    </div>

    {/* League Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-charcoal-900 rounded-sm border border-cream-500/10 p-4">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="avatar" width="48px" height="48px" />
            <div className="flex-1">
              <Skeleton variant="title" className="w-32 mb-2" />
              <Skeleton variant="text" className="w-20" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between p-2 bg-charcoal-800/50 rounded">
                <Skeleton variant="text" className="w-24" />
                <Skeleton variant="text" className="w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Schedule Page Skeleton
 * Calendar view with event cards
 * Works inside GameShell layout
 */
export const SchedulePageSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
    {/* Month header */}
    <div className="flex items-center justify-between mb-6">
      <Skeleton variant="button" className="w-10 h-10" />
      <Skeleton variant="title" className="w-40" />
      <Skeleton variant="button" className="w-10 h-10" />
    </div>

    {/* Calendar grid */}
    <div className="bg-charcoal-900 rounded-sm border border-cream-500/10 p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="text" className="h-4" />
        ))}
      </div>
      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square bg-charcoal-800/50 rounded p-1">
            <Skeleton variant="text" className="w-6 h-4 mb-1" />
            {i % 7 === 3 && <Skeleton variant="text" className="w-full h-3" />}
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Profile Page Skeleton
 * User profile with stats and settings
 * Works inside GameShell layout
 */
export const ProfilePageSkeleton: React.FC = () => (
  <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4">
    {/* Profile Header */}
    <div className="bg-charcoal-900 rounded-sm border border-cream-500/10 p-6 mb-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="avatar" width="80px" height="80px" />
        <div className="flex-1">
          <Skeleton variant="title" className="w-40 mb-2" />
          <Skeleton variant="text" className="w-24 mb-3" />
          <div className="flex gap-4">
            <Skeleton variant="text" className="w-20" />
            <Skeleton variant="text" className="w-20" />
          </div>
        </div>
        <Skeleton variant="button" className="w-20 h-9" />
      </div>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-charcoal-900 rounded-sm border border-cream-500/10 p-4">
          <Skeleton variant="text" className="w-16 mb-2" />
          <Skeleton variant="title" className="w-12" />
        </div>
      ))}
    </div>

    {/* Content Sections */}
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-charcoal-900 rounded-sm border border-cream-500/10 p-4">
          <Skeleton variant="title" className="w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded">
                <Skeleton variant="text" className="w-32" />
                <Skeleton variant="text" className="w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Skeleton;
