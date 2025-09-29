import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Star, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/auth/AuthModal';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // If user is already logged in, don't show the "Start Your Journey" button
  // They'll be automatically redirected to dashboard by UserProfileFetcher
  if (currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-primary-dark">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-12">
        {/* Hero Section */}
        <div className="text-center py-16">
          <h1 className="text-6xl font-bold text-text-primary-dark mb-6">
            Welcome to <span className="text-primary text-shadow">marching.art</span>
          </h1>
          <p className="text-xl text-text-secondary-dark mb-8 max-w-2xl mx-auto">
            The ultimate fantasy drum corps game where legends are made and championships are won.
          </p>
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="inline-block bg-primary hover:bg-primary-dark text-on-primary font-bold py-4 px-8 rounded-theme text-lg transition-colors shadow-theme hover:shadow-glow"
          >
            Start Your Journey
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface-dark p-6 rounded-theme text-center shadow-theme-dark">
            <Trophy className="w-12 h-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold text-text-primary-dark mb-2">Compete</h3>
            <p className="text-text-secondary-dark">Build your dream corps and compete in seasons</p>
          </div>
          <div className="bg-surface-dark p-6 rounded-theme text-center shadow-theme-dark">
            <Users className="w-12 h-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold text-text-primary-dark mb-2">Manage</h3>
            <p className="text-text-secondary-dark">Hire legendary staff and optimize your lineup</p>
          </div>
          <div className="bg-surface-dark p-6 rounded-theme text-center shadow-theme-dark">
            <Star className="w-12 h-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold text-text-primary-dark mb-2">Progress</h3>
            <p className="text-text-secondary-dark">Unlock classes from SoundSport to World Class</p>
          </div>
          <div className="bg-surface-dark p-6 rounded-theme text-center shadow-theme-dark">
            <Award className="w-12 h-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold text-text-primary-dark mb-2">Achieve</h3>
            <p className="text-text-secondary-dark">Climb leaderboards and become a legend</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-surface-dark p-8 rounded-theme text-center shadow-theme-dark">
          <h2 className="text-3xl font-bold text-text-primary-dark mb-4">
            Ready to Create Your Legacy?
          </h2>
          <p className="text-text-secondary-dark mb-6 max-w-lg mx-auto">
            Join thousands of directors competing in the most realistic fantasy drum corps experience.
          </p>
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-8 rounded-theme transition-colors shadow-theme"
          >
            Get Started Today
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};

export default HomePage;