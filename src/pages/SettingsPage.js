import React from 'react';
import LoadingScreen from '../components/common/LoadingScreen';

const SettingsPage = () => {
  // This will be implemented later, just showing structure
  const loading = false;
  
  if (loading) {
    return <LoadingScreen message="Loading settings..." />;
  }
  
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Settings</h1>
      <p className="text-text-secondary dark:text-text-secondary-dark">Coming Soon</p>
    </div>
  );
};

export default SettingsPage;