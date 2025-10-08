import React from 'react';

const LoadingScreen = ({ message = null, fullScreen = true }) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background dark:bg-background-dark z-50">
        <div className="flex flex-col items-center gap-3">
          <img 
            src="/favicon-32x32.png" 
            alt="Loading" 
            className="w-8 h-8 animate-spin"
            style={{ animationDuration: '1s' }}
          />
          {message && (
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Inline loading (for components)
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <img 
          src="/favicon-32x32.png" 
          alt="Loading" 
          className="w-8 h-8 animate-spin"
          style={{ animationDuration: '1s' }}
        />
        {message && (
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;