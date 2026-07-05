// =============================================================================
// ARTICLE SITE HEADER - Fixed header for the Article page
// =============================================================================
// Same layout as Landing page header for consistency

import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ArticleSiteHeader = () => {
  const { user } = useAuth();

  return (
    <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333]">
      <div className="max-w-[1920px] mx-auto h-full flex items-center px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm overflow-hidden">
              <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-bold text-white tracking-wider">marching.art</span>
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Mobile Auth Buttons */}
          {!user && (
            <div className="flex items-center gap-2 lg:hidden">
              <Link
                to="/login"
                className="h-9 px-4 bg-yellow-500 text-slate-900 font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200"
              >
                Sign In
              </Link>
            </div>
          )}
          {/* Authenticated user - Show dashboard link on mobile */}
          {user && (
            <Link
              to="/dashboard"
              className="h-9 px-4 bg-yellow-500 text-slate-900 font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200 lg:hidden"
            >
              Dashboard
            </Link>
          )}
          {/* Desktop links */}
          <div className="hidden lg:flex items-center">
            <a
              href="https://discord.gg/YvFRJ97A5H"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-[#5865F2] active:text-white transition-colors press-feedback flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              Discord
            </a>
            <Link
              to="/privacy"
              className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ArticleSiteHeader;
