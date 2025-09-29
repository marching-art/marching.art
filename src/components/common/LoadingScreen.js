import React from 'react';

const LoadingScreen = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-background-dark">
      {/* Simple pulsing logo */}
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary dark:text-primary-dark animate-pulse mb-4">
          marching.art
        </h1>
        
        {/* Optional message */}
        {message && (
          <p className="text-text-secondary dark:text-text-secondary-dark text-lg animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;