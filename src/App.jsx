import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext'; 

import MainLayout from './components/Layout';
import GlobalLoader from './components/ui/GlobalLoader';

import Hub from './pages/Hub';
import Dashboard from './pages/Dashboard';
import Leagues from './pages/Leagues';
import Scores from './pages/Scores';
import Schedule from './pages/Schedule';
import Champions from './pages/Champions';
import Guide from './pages/Guide';
import Admin from './pages/Admin';
import Login from './pages/Login';

import './index.css';

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
      <Route path="/login" element={<Login />} />
      
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