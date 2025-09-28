import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Crown, Zap } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface-dark border-t border-accent-dark/20 mt-auto">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img 
              src="/logo192.png" 
              alt="marching.art logo" 
              className="w-10 h-10 rounded-lg shadow-lg"
            />
            <div>
              <h3 className="text-lg font-bold text-gradient-primary">marching.art</h3>
              <p className="text-sm text-text-secondary-dark">The Ultimate Fantasy Drum Corps Game</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link 
              to="/how-to-play" 
              className="text-text-secondary-dark hover:text-primary-dark transition-colors"
            >
              How to Play
            </Link>
            <Link 
              to="/privacy" 
              className="text-text-secondary-dark hover:text-primary-dark transition-colors"
            >
              Privacy
            </Link>
            <Link 
              to="/terms" 
              className="text-text-secondary-dark hover:text-primary-dark transition-colors"
            >
              Terms
            </Link>
            <Link 
              to="/contact" 
              className="text-text-secondary-dark hover:text-primary-dark transition-colors"
            >
              Contact
            </Link>
          </div>

          {/* Social Links */}
          <div className="flex gap-3">
            <a 
              href="https://twitter.com/marching_art" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-icon group"
              aria-label="Follow us on Twitter"
            >
              <svg className="w-5 h-5 text-text-secondary-dark group-hover:text-blue-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a 
              href="https://discord.gg/marching-art" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-icon group"
              aria-label="Join our Discord"
            >
              <svg className="w-5 h-5 text-text-secondary-dark group-hover:text-indigo-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.246.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-accent-dark/10 bg-background-dark/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-sm text-text-secondary-dark">
            <div className="flex items-center gap-2">
              <span>&copy; {currentYear} marching.art</span>
              <span className="hidden md:inline">•</span>
              <span className="flex items-center gap-1">
                Made with <Heart className="w-4 h-4 text-red-500 animate-pulse" /> for the marching arts community
              </span>
            </div>

            {/* Season Info */}
            <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
              <Crown className="w-4 h-4 text-primary-dark" />
              <span className="font-medium text-primary-dark">
                Season 2025 Active
              </span>
              <Zap className="w-4 h-4 text-primary-dark animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;