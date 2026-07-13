// =============================================================================
// DESKTOP NAV ITEM
// =============================================================================
// The app's primary top-nav link, shared by the public-page headers (Landing,
// Article) so they read as the same chrome as GameShell's nav. Shown only to
// signed-in users, since every destination is auth-gated.

import React from 'react';
import { NavLink } from 'react-router-dom';

const DesktopNavItem = ({ to, icon: Icon, label, end = false }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `relative flex items-center gap-2 px-3 py-2.5 min-h-touch text-sm font-medium transition-all duration-150 press-feedback ${
        isActive ? 'text-white' : 'text-muted hover:text-white'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          className={`w-5 h-5 transition-colors duration-150 ${isActive ? 'text-interactive' : ''}`}
        />
        <span>{label}</span>
        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-interactive rounded-none" />
        )}
      </>
    )}
  </NavLink>
);

export default DesktopNavItem;
