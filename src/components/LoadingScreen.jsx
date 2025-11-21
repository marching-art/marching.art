// src/components/LoadingScreen.jsx
import React from 'react';

const LoadingScreen = ({ fullScreen = true }) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-main z-50 flex items-center justify-center">
        <div className="text-center">
          <img
            src="/logo192.png"
            alt="marching.art"
            className="w-20 h-20 mx-auto rounded-2xl shadow-glow"
          />
        </div>
      </div>
    );
  }

  // Inline loading - centered logo for page content loading
  return (
    <div className="flex items-center justify-center py-20">
      <img
        src="/logo192.png"
        alt="Loading"
        className="w-16 h-16 rounded-xl opacity-50"
      />
    </div>
  );
};

// Skeleton loading for content - kept for potential future use
export const SkeletonLoader = ({ type = 'card', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="card animate-pulse">
            <div className="h-4 bg-charcoal-800 rounded w-3/4 mb-4" />
            <div className="h-3 bg-charcoal-800 rounded w-full mb-2" />
            <div className="h-3 bg-charcoal-800 rounded w-5/6" />
          </div>
        );

      case 'table-row':
        return (
          <div className="flex items-center gap-4 p-4 animate-pulse">
            <div className="w-8 h-8 bg-charcoal-800 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-charcoal-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-charcoal-800 rounded w-1/4" />
            </div>
            <div className="h-6 bg-charcoal-800 rounded w-16" />
          </div>
        );

      default:
        return (
          <div className="h-32 bg-charcoal-800 rounded-lg animate-pulse" />
        );
    }
  };

  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  );
};

export default LoadingScreen;
