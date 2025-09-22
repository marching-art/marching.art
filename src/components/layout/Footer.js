// components/layout/Footer.js
// Footer component for Enhanced Fantasy Drum Corps Game

import React from 'react';
import { Link } from 'react-router-dom';
import LogoIcon from '../ui/LogoIcon';

const Footer = () => {
  return (
    <footer className="bg-surface dark:bg-surface-dark border-t border-accent dark:border-accent-dark">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <LogoIcon className="w-8 h-8" />
              <span className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                marching.art
              </span>
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
              The ultimate fantasy drum corps experience. Build your legacy, compete with friends, and celebrate the art of marching music.
            </p>
          </div>

          {/* Game Links */}
          <div>
            <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-4">Game</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/howtoplay" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  How to Play
                </Link>
              </li>
              <li>
                <Link to="/scores" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Live Scores
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link to="/leagues" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Leagues
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-4">Community</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Discord
                </a>
              </li>
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Reddit
                </a>
              </li>
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Twitter
                </a>
              </li>
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-accent dark:border-accent-dark mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
            &copy; 2024 marching.art. All rights reserved.
          </p>
          <p className="text-text-secondary dark:text-text-secondary-dark text-sm mt-2 sm:mt-0">
            Made with ♪ for the drum corps community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;