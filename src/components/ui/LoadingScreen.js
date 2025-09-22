// src/components/ui/LoadingScreen.js
// Simple loading screen without external dependencies

import React from 'react';

const LoadingScreen = ({ message = 'Loading...', subtitle = 'Ultimate Fantasy Drum Corps Game' }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="spinner"></div>
        <h3 className="text-xl font-semibold text-white mb-2">{message}</h3>
        <div className="loading-subtitle">{subtitle}</div>
      </div>
    </div>
  );
};

export default LoadingScreen;