import React from 'react';

const LoadingSpinner = ({ fullScreen = true, size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-6 h-6 border-2',
    medium: 'w-12 h-12 border-4',
    large: 'w-16 h-16 border-4'
  };

  const spinner = (
    <div className={`${sizeClasses[size]} border-primary dark:border-primary-dark border-t-transparent rounded-full animate-spin`}></div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark">
        <div className="text-center space-y-4">
          {spinner}
          <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;