import React from 'react';

const LoadingScreen = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-background-dark">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-6xl font-bold text-primary dark:text-primary-dark text-shadow animate-pulse">
          marching.art
        </h1>
        <div className="w-24 h-1 bg-primary dark:bg-primary-dark mx-auto mt-4 rounded-full animate-pulse"></div>
      </div>
      
      {/* Optional message */}
      {message && (
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg animate-fade-in">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingScreen;