import React from 'react';

// Base skeleton component with shimmer animation
const Skeleton = ({ className = '', variant = 'text', width, height }) => {
  const baseClasses = 'animate-pulse bg-charcoal-700/50 rounded';

  const variantClasses = {
    text: 'h-4 rounded',
    title: 'h-6 rounded',
    avatar: 'rounded-full',
    card: 'rounded-lg',
    button: 'h-10 rounded-lg',
  };

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant] || ''} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton layouts
export const CardSkeleton = () => (
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

export const ListItemSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-cream-500/10">
    <Skeleton variant="avatar" width="40px" height="40px" />
    <div className="flex-1">
      <Skeleton variant="text" className="w-1/3 mb-2" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
    <Skeleton variant="button" className="w-20" />
  </div>
);

export const TableRowSkeleton = ({ columns = 4 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton variant="text" className="w-full" />
      </td>
    ))}
  </tr>
);

export const StatCardSkeleton = () => (
  <div className="bg-charcoal-800 rounded-lg border border-cream-500/10 p-4">
    <Skeleton variant="text" className="w-1/2 mb-2" />
    <Skeleton variant="title" className="w-2/3" />
  </div>
);

export const LeaderboardSkeleton = ({ rows = 5 }) => (
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

export const ProfileSkeleton = () => (
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

export const ScoresSkeleton = ({ rows = 5 }) => (
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

export default Skeleton;
