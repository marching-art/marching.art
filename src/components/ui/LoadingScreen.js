// components/ui/LoadingScreen.js
// Loading screen component for Enhanced Fantasy Drum Corps Game

import React from 'react';

const LoadingScreen = ({ message = 'Loading...', size = 'large' }) => {
  const spinnerSize = size === 'large' ? 'h-16 w-16' : size === 'medium' ? 'h-12 w-12' : 'h-8 w-8';
  
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
      <div className="text-center">
        <div className={`animate-spin rounded-full ${spinnerSize} border-b-2 border-primary dark:border-primary-dark mx-auto`}></div>
        <p className="mt-4 text-text-secondary dark:text-text-secondary-dark animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;