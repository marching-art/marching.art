import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';
import NotificationsIcon from '../ui/NotificationsIcon';
import { useUserStore } from '../../store/userStore';

const Header = ({
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

    // Enhanced NavLink component with authentication check for schedule
    const NavLink = ({ to, children, requiresAuth = false, onClick = null }) => {
        if (requiresAuth && !isLoggedIn) {
            return (
                <button 
                    onClick={onClick || onLoginClick}
                    className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors flex items-center gap-1"
                >
                    {children}
                    <Icon path="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" 
                          className="w-4 h-4 opacity-60" />
                </button>
            );
        }
        
        return (
            <Link to={to} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors">
                {children}
            </Link>
        );
    };

    // Enhanced MobileNavLink component with authentication check
    const MobileNavLink = ({ to, children, requiresAuth = false, onClick = null }) => {
        if (requiresAuth && !isLoggedIn) {
            return (
                <button 
                    onClick={() => {
                        setIsMobileMenuOpen(false);
                        if (onClick) {
                            onClick();
                        } else {
                            onLoginClick();
                        }
                    }}
                    className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full flex items-center justify-between"
                >
                    <span>{children}</span>
                    <Icon path="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" 
                          className="w-4 h-4 opacity-60" />
                </button>
            );
        }
        
        return (
            <Link 
                to={to} 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full block"
            >
                {children}
            </Link>
        );
    };

    // Handle schedule click with custom messaging
    const handleScheduleClick = () => {
        if (!isLoggedIn) {
            // You could show a toast or modal here explaining why they need to sign up
            onSignUpClick();
        }
    };

    return (
        <header className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark p-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-8 w-8" />
                <span className="text-xl sm:text-2xl font-semibold text-text-primary dark:text-text-primary-dark tracking-tight">
                    marching<span className="text-primary dark:text-primary-dark font-bold">.art</span>
                </span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
                <div className="flex items-center space-x-6">
                    <NavLink to="/howtoplay">How to Play</NavLink>
                    <NavLink to="/schedule" requiresAuth={true} onClick={handleScheduleClick}>
                        Schedule
                    </NavLink>
                    <NavLink to="/scores">Scores</NavLink>
                    {isLoggedIn && (
                        <>
                            <NavLink to="/stats">Stats</NavLink>
                            <NavLink to="/leaderboard">Leaderboard</NavLink>
                            <NavLink to="/leagues">Leagues</NavLink>
                            <NavLink to="/dashboard">Dashboard</NavLink>
                        </>
                    )}
                </div>

                <div className="flex items-center space-x-4">
                    {isLoggedIn ? (
                        <>
                            {/* Notifications */}
                            <NotificationsIcon />
                            
                            {/* Theme Toggle */}
                            <button onClick={toggleThemeMode} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors">
                                {themeMode === 'light' ? 
                                    <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" className="w-5 h-5" /> : 
                                    <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" className="w-5 h-5" />
                                }
                            </button>
                            
                            {/* User Menu Dropdown */}
                            <div className="relative">
                                <button onClick={onViewOwnProfile} className="flex items-center space-x-2 p-2 rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors">
                                    <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center font-semibold text-sm">
                                        {loggedInProfile?.displayName?.[0]?.toUpperCase() || loggedInProfile?.username?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
                                </button>
                                
                                {/* Quick User Info */}
                                <div className="absolute right-0 top-full mt-2 w-64 bg-surface dark:bg-surface-dark rounded-theme shadow-lg border border-accent dark:border-accent-dark z-20 p-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
                                    <div className="text-sm">
                                        <div className="font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                                            {loggedInProfile?.displayName || loggedInProfile?.username || 'User'}
                                        </div>
                                        <div className="text-text-secondary dark:text-text-secondary-dark mb-3">
                                            {loggedInProfile?.email || 'Member'}
                                        </div>
                                        <div className="space-y-2">
                                            <button onClick={onViewOwnProfile} className="w-full text-left px-3 py-2 rounded hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors">
                                                View Profile
                                            </button>
                                            {isAdmin && (
                                                <Link to="/admin" className="block w-full text-left px-3 py-2 rounded hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors">
                                                    Admin Panel
                                                </Link>
                                            )}
                                            <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors">
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Theme Toggle for non-logged in users */}
                            <button onClick={toggleThemeMode} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors">
                                {themeMode === 'light' ? 
                                    <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" className="w-5 h-5" /> : 
                                    <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" className="w-5 h-5" />
                                }
                            </button>
                            
                            {/* Authentication Buttons */}
                            <button onClick={onLoginClick} className="text-text-primary dark:text-text-primary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors">
                                Sign In
                            </button>
                            <button onClick={onSignUpClick} className="bg-primary text-on-primary px-4 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-all">
                                Start Playing
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden flex items-center">
                <button onClick={toggleThemeMode} className="p-2 mr-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20">
                    {themeMode === 'light' ? 
                        <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : 
                        <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />
                    }
                </button>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20">
                    <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-surface dark:bg-surface-dark rounded-theme shadow-lg border border-accent dark:border-accent-dark z-20">
                    <nav className="flex flex-col p-2">
                        <MobileNavLink to="/howtoplay">How to Play</MobileNavLink>
                        <MobileNavLink to="/schedule" requiresAuth={true} onClick={handleScheduleClick}>
                            Schedule
                        </MobileNavLink>
                        <MobileNavLink to="/scores">Scores</MobileNavLink>
                        
                        {!isLoggedIn && (
                            <>
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <div className="p-3 bg-primary/10 rounded-theme text-center">
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3">
                                        Sign up to access full schedule features, stats, and leagues!
                                    </p>
                                    <div className="space-y-2">
                                        <button 
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                onSignUpClick();
                                            }}
                                            className="w-full bg-primary text-on-primary py-2 rounded font-medium"
                                        >
                                            Start Playing
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                onLoginClick();
                                            }}
                                            className="w-full text-primary hover:text-primary-dark py-2 font-medium"
                                        >
                                            Sign In
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {isLoggedIn && (
                            <>
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <MobileNavLink to="/stats">Stats</MobileNavLink>
                                <MobileNavLink to="/leaderboard">Leaderboard</MobileNavLink>
                                <MobileNavLink to="/leagues">Leagues</MobileNavLink>
                                <MobileNavLink to="/dashboard">Dashboard</MobileNavLink>
                                {isAdmin && <MobileNavLink to="/admin">Admin</MobileNavLink>}
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <button onClick={onViewOwnProfile} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">
                                    Profile
                                </button>
                                <button onClick={() => { setIsMobileMenuOpen(false); onLogout(); }} className="text-red-600 dark:text-red-400 p-3 text-left rounded-theme hover:bg-red-500/10 font-semibold w-full">
                                    Sign Out
                                </button>
                            </>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Header;