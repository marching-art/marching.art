// =============================================================================
// LOADING SCREEN COMPONENT (Migrated to use UI Library)
// =============================================================================
// This component has been migrated to use the new shared UI components.
// Migration benefits:
// - TypeScript type safety
// - Consistent styling via centralized components
// - Reusable Spinner and Skeleton components
// - Better animation via framer-motion

import React from 'react';
import { FullPageLoading, Skeleton, SkeletonText } from './ui/Spinner';
import { Card } from './ui/Card';
import BrandLogo from './BrandLogo';

// =============================================================================
// LOADING SCREEN COMPONENT
// =============================================================================

export interface LoadingScreenProps {
  /** Whether to show full-screen loading overlay */
  fullScreen?: boolean;
  /** Optional loading message */
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  fullScreen = true,
  message,
}) => {
  if (fullScreen) {
    return <FullPageLoading label={message || 'Loading...'} showLogo={true} />;
  }

  // Inline loading with centered brand logo
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="glow-pulse">
        <BrandLogo className="w-16 h-16" color="text-gold-500" />
      </div>
      {message && (
        <p className="font-mono text-sm text-gold-400/60 tracking-wide">{message}</p>
      )}
    </div>
  );
};

// =============================================================================
// SKELETON LOADER COMPONENT (Using UI Library)
// =============================================================================

export type SkeletonType = 'card' | 'table-row' | 'text' | 'default';

export interface SkeletonLoaderProps {
  /** Type of skeleton to render */
  type?: SkeletonType;
  /** Number of skeleton items to render */
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'card',
  count = 1,
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <Card variant="default" padding="md">
            <Skeleton width="75%" height={16} rounded="sm" className="mb-4" />
            <SkeletonText lines={2} lastLineWidth="85%" />
          </Card>
        );

      case 'table-row':
        return (
          <div className="flex items-center gap-4 p-4">
            <Skeleton width={32} height={32} rounded="full" />
            <div className="flex-1">
              <Skeleton width="33%" height={16} rounded="sm" className="mb-2" />
              <Skeleton width="25%" height={12} rounded="sm" />
            </div>
            <Skeleton width={64} height={24} rounded="md" />
          </div>
        );

      case 'text':
        return <SkeletonText lines={3} lastLineWidth="60%" />;

      default:
        return <Skeleton width="100%" height={128} rounded="lg" />;
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderSkeleton()}</div>
      ))}
    </>
  );
};

// =============================================================================
// CONTENT SKELETON (For page sections)
// =============================================================================

export interface ContentSkeletonProps {
  /** Title skeleton */
  showTitle?: boolean;
  /** Number of paragraph lines */
  paragraphLines?: number;
  /** Show card wrapper */
  inCard?: boolean;
}

export const ContentSkeleton: React.FC<ContentSkeletonProps> = ({
  showTitle = true,
  paragraphLines = 3,
  inCard = true,
}) => {
  const content = (
    <div className="space-y-4">
      {showTitle && (
        <Skeleton width="40%" height={24} rounded="sm" />
      )}
      <SkeletonText lines={paragraphLines} lastLineWidth="70%" />
    </div>
  );

  if (inCard) {
    return <Card variant="default" padding="md">{content}</Card>;
  }

  return content;
};

// =============================================================================
// STATS SKELETON (For dashboard stats)
// =============================================================================

export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} variant="glass" padding="sm">
          <Skeleton width="50%" height={12} rounded="sm" className="mb-2" />
          <Skeleton width="70%" height={28} rounded="sm" />
        </Card>
      ))}
    </div>
  );
};

export default LoadingScreen;
