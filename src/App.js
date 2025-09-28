import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useUserStore } from './store/userStore';

// Layout Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Page Components (create placeholder files for these in a `src/pages` directory)
const HomePage = () => <h1>Home Page</h1>;
const DashboardPage = () => <h1>Dashboard</h1>;
const LeaguesPage = () => <h1>Leagues</h1>;
const ScoresPage = () => <h1>Scores</h1>;
const SchedulePage = () => <h1>Schedule</h1>;
const LeaderboardPage = () => <h1>Leaderboard</h1>;
const ProfilePage = () => <h1>Profile</h1>;
const SettingsPage = () => <h1>Settings</h1>;

// Main layout wrapper
const AppLayout = () => (
  <div className="flex flex-col min-h-screen bg-background dark:bg-background-dark">
    <Header />
    <main className="flex-grow container mx-auto p-4">
      <Outlet /> {/* Child routes will render here */}
    </main>
    <Footer />
  </div>
);

// A component to fetch user profile data when auth state changes
const UserProfileFetcher = () => {
  const { currentUser } = useAuth();
  const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);

  useEffect(() => {
    if (currentUser) {
      fetchUserProfile(currentUser.uid);
    }
  }, [currentUser, fetchUserProfile]);

  return null; // This component does not render anything
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <UserProfileFetcher />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/scores" element={<ScoresPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Add other routes from your sitemap here */}
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;