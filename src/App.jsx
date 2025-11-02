import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext'; 

import MainLayout from './components/Layout';
import GlobalLoader from './components/ui/GlobalLoader';

import PageHub from './pages/Hub';
import PageDashboard from './pages/Dashboard';
import PageLeagues from './pages/Leagues';
import PageScores from './pages/Scores';
import PageSchedule from './pages/Schedule';
import PageChampions from './pages/Champions';
import PageGuide from './pages/Guide';
import PageAdmin from './pages/Admin';
import PageLogin from './pages/Login';

import './global.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutesWrapper />
      </BrowserRouter>
    </AuthProvider>
  );
}

const AppRoutesWrapper = () => {
  const { isLoadingAuth } = useAuth();
  
  if (isLoadingAuth) {
    return <GlobalLoader />;
  }

  return <AppRoutes />;
}

const AppRoutes = () => {
  const { loggedInProfile } = useAuth();
  const isAdmin = loggedInProfile?.isAdmin === true;

  return (
    <Routes>
      <Route path="/login" element={<PageLogin />} />
      
      {/* Protected Routes */}
      <Route 
        element={
          <ProtectedRoutes>
            <MainLayout />
          </ProtectedRoutes>
        }
      >
        <Route path="/" element={<Hub />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/scores" element={<Scores />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/champions" element={<Champions />} />
        <Route path="/guide" element={<Guide />} />
        
        {/* Admin Only Route */}
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        
        {/* Redirect any other path to the hub */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

const ProtectedRoutes = ({ children }) => {
  const { isLoadingAuth, user } = useAuth();

  if (isLoadingAuth) {
    return <GlobalLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};