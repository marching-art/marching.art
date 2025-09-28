import React from 'react';
import LineupEditor from '../components/dashboard/LineupEditor';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { profile, isLoading } = useUserStore();

  if (isLoading) {
    return <div>Loading Dashboard...</div>;
  }

  if (!currentUser || !profile) {
    // This shouldn't typically be seen due to the redirect, but it's good practice.
    return <div>Please log in to view your dashboard.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary-dark">Dashboard</h1>
        <p className="text-text-secondary-dark">Manage your corps for the season, {profile.displayName}.</p>
      </div>

      {/* Lineup Editor Component */}
      <LineupEditor userProfile={profile} />

      {/* Other dashboard components will be added here later */}
    </div>
  );
};

export default DashboardPage;