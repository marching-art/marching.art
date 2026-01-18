// =============================================================================
// OPTIMIZED IMAGE COMPONENT
// =============================================================================
// Lazy loading images with aspect ratios to prevent CLS
// Includes placeholder skeleton and smooth fade-in

import React, { useState, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: '1/1' | '16/9' | '4/3' | '3/2' | '2/1' | string;
  className?: string;
  containerClassName?: string;
  priority?: boolean; // Skip lazy loading for LCP images
  onLoad?: () => void;
  onError?: () => void;
}

// =============================================================================
// INTERSECTION OBSERVER HOOK
// =============================================================================

const useIntersectionObserver = (
  ref: React.RefObject<HTMLElement>,
  options: IntersectionObserverInit = {}
): boolean => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0, ...options }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
};

// =============================================================================
// OPTIMIZED IMAGE COMPONENT
// =============================================================================

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  aspectRatio = '16/9',
  className = '',
  containerClassName = '',
  priority = false,
  onLoad,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isInView = useIntersectionObserver(containerRef);
  const shouldLoad = priority || isInView;

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Parse aspect ratio to CSS value
  const aspectRatioStyle = aspectRatio.includes('/')
    ? aspectRatio
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-[#1a1a1a] ${containerClassName}`}
      style={{
        aspectRatio: aspectRatioStyle,
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
    >
      {/* Skeleton Placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 skeleton-pulse" />
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#222]">
          <span className="text-xs text-gray-500">Failed to load</span>
        </div>
      )}

      {/* Actual Image */}
      {shouldLoad && !hasError && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`
            w-full h-full object-cover
            transition-opacity duration-300 ease-out
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            ${className}
          `}
        />
      )}
    </div>
  );
};

// =============================================================================
// AVATAR IMAGE COMPONENT
// =============================================================================
// Specialized for circular avatar images

interface AvatarImageProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  className?: string;
}

const avatarSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  alt,
  size = 'md',
  fallback,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset state when src changes to handle avatar updates
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  // Get initials from alt text
  const initials = alt
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const showFallback = !src || hasError;

  return (
    <div
      className={`
        relative rounded-sm overflow-hidden bg-[#333] flex items-center justify-center
        ${avatarSizes[size]}
        ${className}
      `}
    >
      {/* Fallback with initials */}
      {showFallback && (
        <span className="text-gray-400 font-bold text-xs">
          {fallback || initials}
        </span>
      )}

      {/* Avatar Image */}
      {!showFallback && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`
            w-full h-full object-cover
            transition-opacity duration-200
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
          `}
        />
      )}

      {/* Loading skeleton */}
      {!showFallback && !isLoaded && (
        <div className="absolute inset-0 skeleton-pulse rounded-sm" />
      )}
    </div>
  );
};

// =============================================================================
// CORPS LOGO IMAGE COMPONENT
// =============================================================================
// Specialized for corps logos with consistent sizing

interface CorpsLogoProps {
  src?: string;
  corpsName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const logoSizes = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export const CorpsLogo: React.FC<CorpsLogoProps> = ({
  src,
  corpsName,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset state when src changes to handle avatar/logo updates
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  // Get initials from corps name
  const initials = corpsName
    .split(' ')
    .filter((word) => word.length > 2 || word === word.toUpperCase())
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  const showFallback = !src || hasError;

  return (
    <div
      className={`
        relative rounded-sm overflow-hidden bg-[#222] border border-[#333]
        flex items-center justify-center aspect-avatar
        ${logoSizes[size]}
        ${className}
      `}
    >
      {/* Fallback with initials */}
      {showFallback && (
        <span className="text-gray-500 font-bold text-[10px]">
          {initials}
        </span>
      )}

      {/* Logo Image */}
      {!showFallback && (
        <img
          src={src}
          alt={`${corpsName} logo`}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`
            w-full h-full object-contain p-1
            transition-opacity duration-200
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
          `}
        />
      )}

      {/* Loading skeleton */}
      {!showFallback && !isLoaded && (
        <div className="absolute inset-0 skeleton-pulse" />
      )}
    </div>
  );
};

export default OptimizedImage;
