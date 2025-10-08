import React, { useState } from 'react';
import { Trophy, Users, Star, Award } from 'lucide-react';
import AuthModal from '../components/auth/AuthModal';

const HomePage = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-16 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary dark:text-text-primary-dark">
            Welcome to marching.art
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary dark:text-text-secondary-dark max-w-3xl mx-auto">
            The ultimate fantasy drum corps game where legends are made and championships are won.
          </p>
          
          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <button
              onClick={() => setShowAuthModal(true)}
              style={{ backgroundColor: '#F7941D', color: '#FFFFFF' }}
              className="w-full sm:w-auto px-8 py-4 hover:opacity-90 rounded-theme font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Start Your Journey
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              style={{ 
                backgroundColor: '#FFFFFF',
                color: '#2C1810',
                borderColor: '#F7941D',
                borderWidth: '2px'
              }}
              className="w-full sm:w-auto px-8 py-4 hover:bg-accent dark:hover:bg-accent-dark rounded-theme font-bold text-lg transition-all"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-2 border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all shadow-theme dark:shadow-theme-dark">
            <Trophy className="w-12 h-12 text-primary dark:text-primary-dark mb-4 mx-auto" />
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2 text-center">
              Compete
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark text-center">
              Build your dream corps and compete in seasons
            </p>
          </div>

          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-2 border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all shadow-theme dark:shadow-theme-dark">
            <Users className="w-12 h-12 text-primary dark:text-primary-dark mb-4 mx-auto" />
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2 text-center">
              Manage
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark text-center">
              Hire legendary staff and optimize your lineup
            </p>
          </div>

          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-2 border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all shadow-theme dark:shadow-theme-dark">
            <Star className="w-12 h-12 text-primary dark:text-primary-dark mb-4 mx-auto" />
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2 text-center">
              Progress
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark text-center">
              Unlock classes from SoundSport to World Class
            </p>
          </div>

          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-2 border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all shadow-theme dark:shadow-theme-dark">
            <Award className="w-12 h-12 text-primary dark:text-primary-dark mb-4 mx-auto" />
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2 text-center">
              Achieve
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark text-center">
              Climb leaderboards and become a legend
            </p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-surface dark:bg-surface-dark p-8 sm:p-12 rounded-theme border-2 border-accent dark:border-accent-dark shadow-theme dark:shadow-theme-dark text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Ready to Create Your Legacy?
          </h2>
          <p className="text-lg text-text-secondary dark:text-text-secondary-dark mb-8 max-w-2xl mx-auto">
            Join thousands of directors competing in the most realistic fantasy drum corps experience.
          </p>
          
          <button
            onClick={() => setShowAuthModal(true)}
            style={{ backgroundColor: '#F7941D', color: '#FFFFFF' }}
            className="px-10 py-4 hover:opacity-90 rounded-theme font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            Get Started Free
          </button>
          
          <p className="mt-6 text-text-secondary dark:text-text-secondary-dark">
            Already have an account?{' '}
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-primary dark:text-primary-dark hover:underline font-bold"
            >
              Sign in here
            </button>
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary dark:text-primary-dark mb-2">
              100+
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              DCI Hall of Fame Staff
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary dark:text-primary-dark mb-2">
              Real
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              DCI Data & Performances
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary dark:text-primary-dark mb-2">
              24/7
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Compete Anytime
            </p>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};

export default HomePage;