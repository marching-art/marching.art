import React from 'react';

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-background-dark">
      {/* Animated Logo Rings */}
      <div className="relative w-32 h-32 mb-8">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-primary dark:border-primary-dark opacity-20 animate-ping"></div>
        
        {/* Middle ring */}
        <div className="absolute inset-4 rounded-full border-3 border-primary dark:border-primary-dark opacity-40"></div>
        
        {/* Inner spinning ring */}
        <div className="absolute inset-0 rounded-full border-t-4 border-r-4 border-primary dark:border-primary-dark animate-spin"></div>
        
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-primary dark:bg-primary-dark animate-pulse"></div>
        </div>
      </div>
      
      {/* Brand name */}
      <div className="text-center mb-6">
        <h1 className="text-5xl font-bold text-primary dark:text-primary-dark mb-2">
          marching.art
        </h1>
        <div className="w-48 h-1 bg-gradient-to-r from-transparent via-primary dark:via-primary-dark to-transparent mx-auto rounded-full"></div>
      </div>
      
      {/* Loading message */}
      {message && (
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg animate-pulse mb-4">
          {message}
        </p>
      )}
      
      {/* Loading dots animation */}
      <div className="flex gap-2">
        <div className="w-3 h-3 bg-primary dark:bg-primary-dark rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 bg-primary dark:bg-primary-dark rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 bg-primary dark:bg-primary-dark rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
};

export default LoadingScreen;