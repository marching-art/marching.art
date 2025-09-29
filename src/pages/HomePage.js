import React, { useState } from 'react';
import { Trophy, Users, Star, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/auth/AuthModal';
import LoadingScreen from '../components/common/LoadingScreen';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signup');

  // If user is already logged in, show loading while redirecting
  if (currentUser) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  const openSignUpModal = () => {
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  };

  return (
    <>
      <div className="space-y-12">
        {/* Hero Section */}
        <div className="text-center py-16">
          <h1 className="text-6xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
            Welcome to <span className="text-primary dark:text-primary-dark">marching.art</span>
          </h1>
          <p className="text-xl text-text-secondary dark:text-text-secondary-dark mb-8 max-w-2xl mx-auto">
            The ultimate fantasy drum corps game where legends are made and championships are won.
          </p>
          <button 
            onClick={openSignUpModal}
            className="inline-block bg-primary dark:bg-primary-dark hover:bg-secondary dark:hover:bg-secondary-dark text-on-primary dark:text-on-primary-dark font-bold py-4 px-8 rounded-theme text-lg transition-all shadow-theme hover:shadow-glow"
          >
            Start Your Journey
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme text-center shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
            <Trophy className="w-12 h-12 mx-auto text-primary dark:text-primary-dark mb-4" />
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">Compete</h3>
            <p className="text-text-secondary dark:text-text-secondary-dark">Build your dream corps and compete in seasons</p>
          </div>
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme text-center shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
            <Users className="w-12 h-12 mx-auto text-primary dark:text-primary-dark mb-4" />
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">Manage</h3>
            <p className="text-text-secondary dark:text-text-secondary-dark">Hire legendary staff and optimize your lineup</p>
          </div>
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme text-center shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
            <Star className="w-12 h-12 mx-auto text-primary dark:text-primary-dark mb-4" />
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">Progress</h3>
            <p className="text-text-secondary dark:text-text-secondary-dark">Unlock classes from SoundSport to World Class</p>
          </div>
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme text-center shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
            <Award className="w-12 h-12 mx-auto text-primary dark:text-primary-dark mb-4" />
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">Achieve</h3>
            <p className="text-text-secondary dark:text-text-secondary-dark">Climb leaderboards and become a legend</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme text-center shadow-theme dark:shadow-theme-dark border border-accent dark:border-accent-dark">
          <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Ready to Create Your Legacy?
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark mb-6 max-w-lg mx-auto">
            Join thousands of directors competing in the most realistic fantasy drum corps experience.
          </p>
          <div className="text-text-secondary dark:text-text-secondary-dark text-sm">
            Already have an account?{' '}
            <button 
              onClick={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
              className="text-primary dark:text-primary-dark hover:text-secondary dark:hover:text-secondary-dark font-semibold hover:underline"
            >
              Log in from the header
            </button>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
      />
    </>
  );
};

export default HomePage;