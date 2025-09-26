// src/components/ui/LoadingScreen.js - Enhanced loading component with better UX
import React from 'react';

const LoadingScreen = ({ message = "Loading...", fullScreen = true }) => {
  const containerClass = fullScreen 
    ? "min-h-screen bg-background dark:bg-background-dark flex items-center justify-center"
    : "flex items-center justify-center p-8";

  return (
    <div className={containerClass}>
      <div className="text-center">
        {/* Animated Logo/Icon */}
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto">
            {/* Spinning drum icon */}
            <div className="w-full h-full bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center animate-spin">
              <span className="text-2xl text-white">🥁</span>
            </div>
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 w-16 h-16 mx-auto border-4 border-primary/20 dark:border-primary-dark/20 rounded-full animate-pulse"></div>
        </div>

        {/* Loading text */}
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          {message}
        </h3>
        
        {/* Animated dots */}
        <div className="flex justify-center space-x-1">
          <div className="w-2 h-2 bg-primary dark:bg-primary-dark rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-primary dark:bg-primary-dark rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-2 h-2 bg-primary dark:bg-primary-dark rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>

        {/* Optional loading progress */}
        <div className="mt-6 w-48 mx-auto">
          <div className="bg-accent/20 dark:bg-accent-dark/20 rounded-full h-1 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-accent h-full rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;