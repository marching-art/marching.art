// =============================================================================
// PAGE TRANSITION COMPONENT
// =============================================================================
// Smooth page transitions using Framer Motion
// Provides fade + slide animation for page content

import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// =============================================================================
// TYPES
// =============================================================================

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
};

// =============================================================================
// PAGE TRANSITION COMPONENT
// =============================================================================

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
}) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={location.pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        className={`h-full w-full ${className}`}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
};

// =============================================================================
// CONTENT FADE COMPONENT
// =============================================================================
// For fading in content sections within a page

interface ContentFadeProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const ContentFade: React.FC<ContentFadeProps> = ({
  children,
  delay = 0,
  className = '',
}) => {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.25, 0.1, 0.25, 1.0],
      }}
      className={className}
    >
      {children}
    </m.div>
  );
};

// =============================================================================
// STAGGER CONTAINER
// =============================================================================
// For staggering multiple child animations

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

const staggerContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
};

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <m.div
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
      className={className}
    >
      {children}
    </m.div>
  );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <m.div variants={staggerItemVariants} className={className}>
      {children}
    </m.div>
  );
};

// =============================================================================
// SKELETON LOADER COMPONENT
// =============================================================================
// Animated skeleton for loading states

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const baseClass = 'skeleton';
  const variantClass = variant === 'circular' ? 'rounded-sm' : variant === 'text' ? 'rounded' : 'rounded-sm';

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div
      className={`${baseClass} ${variantClass} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

// =============================================================================
// SKELETON GROUP - For common loading patterns
// =============================================================================

interface SkeletonGroupProps {
  type: 'card' | 'list-item' | 'table-row' | 'avatar-with-text';
  count?: number;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  type,
  count = 1,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  switch (type) {
    case 'card':
      return (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4">
              <Skeleton height={20} width="60%" className="mb-3" />
              <Skeleton height={14} width="100%" className="mb-2" />
              <Skeleton height={14} width="80%" />
            </div>
          ))}
        </div>
      );

    case 'list-item':
      return (
        <div className="divide-y divide-[#333]">
          {items.map((i) => (
            <div key={i} className="flex items-center gap-3 py-3 px-4">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="flex-1">
                <Skeleton height={14} width="50%" className="mb-2" />
                <Skeleton height={12} width="30%" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'table-row':
      return (
        <div className="divide-y divide-[#333]">
          {items.map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 px-4">
              <Skeleton width={32} height={24} />
              <Skeleton width="40%" height={16} />
              <div className="flex-1" />
              <Skeleton width={60} height={16} />
            </div>
          ))}
        </div>
      );

    case 'avatar-with-text':
      return (
        <div className="space-y-4">
          {items.map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton variant="circular" width={48} height={48} />
              <div className="flex-1">
                <Skeleton height={16} width="40%" className="mb-2" />
                <Skeleton height={12} width="60%" />
              </div>
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
};

export default PageTransition;
