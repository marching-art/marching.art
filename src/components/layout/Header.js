import React, { useState } from 'react';
// Import Link from react-router-dom
import { Link, useNavigate } from 'react-router-dom';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';
import NotificationsIcon from '../ui/NotificationsIcon';
import { useUserStore } from '../../store/userStore';

const Header = ({
  // Remove setPage, onViewLeague
  onLoginClick,
  onSignUpClick,
  onLogout,
  onViewOwnProfile,
  themeMode,
  toggleThemeMode,
}) => {
    const { user, loggedInProfile } = useUserStore();
    const isLoggedIn = !!user;
    const isAdmin = loggedInProfile?.isAdmin;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    // NavLink replaces NavButton for routing
    const NavLink = ({ to, children }) => (
        <Link to={to} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors">
            {children}
        </Link>
    );

    // MobileNavLink replaces MobileNavButton
    const MobileNavLink = ({ to, children }) => (
         <Link to={to} onClick={() => setIsMobileMenuOpen(false)} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full block">
            {children}
        </Link>
    );

    return (
        <header className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark p-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80">
            {/* Use Link for the logo */}
            <Link to="/" className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-8 w-8" />
                <span className="text-xl sm:text-2xl font-semibold text-text-primary dark:text-text-primary-dark tracking-tight">
                    marching<span className="text-primary dark:text-primary-dark font-bold">.art</span>
                </span>
            </Link>
            
            <nav className="hidden md:flex items-center space-x-6">
                <div className="flex items-center space-x-6">
                    {/* Use NavLink component */}
                    <NavLink to="/howtoplay">How to Play</NavLink>
                    <NavLink to="/schedule">Schedule</NavLink>
                    <NavLink to="/scores">Scores</NavLink>
                    <NavLink to="/stats">Stats</NavLink>
                    {isLoggedIn && (
                        <>
                            <NavLink to="/leaderboard">Leaderboard</NavLink>
                            <NavLink to="/leagues">Leagues</NavLink>
                            <NavLink to="/dashboard">Dashboard</NavLink>
                        </>
                    )}
                </div>

                <div className="flex items-center space-x-4">
                    {isLoggedIn ? (
                        <>
                            {/* Pass navigate to NotificationsIcon if it needs it */}
                            <NotificationsIcon user={user} onViewLeague={(leagueId) => navigate(`/league/${leagueId}`)} />
                            <button onClick={onViewOwnProfile} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors">Profile</button>
                            {isAdmin && <Link to="/admin" className="text-red-500 font-bold hover:underline text-sm">Admin</Link>}
                            <button onClick={onLogout} className="border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark font-bold py-2 px-3 rounded-theme transition-all text-sm">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onLoginClick} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors font-medium">Log In</button>
                            <button onClick={onSignUpClick} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all text-sm">
                                Sign Up
                            </button>
                        </>
                    )}
                     <button onClick={toggleThemeMode} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 focus:outline-none focus:ring-2 focus:ring-primary">
                        {themeMode === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                    </button>
                 </div>
            </nav>

            {/* ... Mobile menu with similar Link replacements ... */}
            <div className="md:hidden flex items-center">
                 <button onClick={toggleThemeMode} className="p-2 mr-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20">
                    {themeMode === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20">
                    <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-surface dark:bg-surface-dark rounded-theme shadow-lg border border-accent dark:border-accent-dark z-20">
                    <nav className="flex flex-col p-2">
                        <MobileNavLink to="/howtoplay">How to Play</MobileNavLink>
                        <MobileNavLink to="/schedule">Schedule</MobileNavLink>
                        <MobileNavLink to="/scores">Scores</MobileNavLink>
                        <MobileNavLink to="/stats">Stats</MobileNavLink>
                        <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                        
                        {isLoggedIn ? (
                            <>
                                <MobileNavLink to="/leaderboard">Leaderboard</MobileNavLink>
                                <MobileNavLink to="/leagues">Leagues</MobileNavLink>
                                <MobileNavLink to="/dashboard">Dashboard</MobileNavLink>
                                <button onClick={() => { onViewOwnProfile(); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">Profile</button>
                                {isAdmin && <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="text-red-500 font-bold p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 w-full block">Admin</Link>}
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">Logout</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { onLoginClick(); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">Log In</button>
                                <button onClick={() => { onSignUpClick(); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">Sign Up</button>
                            </>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Header;