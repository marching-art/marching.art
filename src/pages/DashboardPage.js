import React from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import NewUserSetup from '../components/dashboard/NewUserSetup'; // Import the new component
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';

const DashboardPage = () => {
  const { currentUser } = useAuth();
  // Get the fetch function to refresh the profile after setup is complete
  const { profile, isLoading, fetchUserProfile } = useUserStore();

  if (isLoading) {
    return <div>Loading Dashboard...</div>;
  }

  if (!currentUser || !profile) {
    return <div>Please log in to view your dashboard.</div>;
  }
  
  // Check if the user's corps name is still the default value.
  const isNewUser = profile.corps?.corpsName === 'New Corps';

  const handleSetupComplete = () => {
    // Re-fetch the user profile to get the updated corps name
    fetchUserProfile(currentUser.uid);
  };

  return (
    <div className="space-y-8">
      {isNewUser ? (
        <NewUserSetup profile={profile} onComplete={handleSetupComplete} />
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold text-text-primary-dark">{profile.corps.corpsName}</h1>
            <p className="text-text-secondary-dark">Manage your corps for the season, {profile.corps.alias}.</p>
          </div>
          <LineupEditor userProfile={profile} />
        </>
      )}
    </div>
  );
};

export default DashboardPage;