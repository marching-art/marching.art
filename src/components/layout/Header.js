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
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Enhanced NavLink component - Schedule only shows for authenticated users
    const NavLink = ({ to, children, requiresAuth = false, onClick = null }) => {
        // Don't render schedule link if not authenticated
        if (requiresAuth && !isLoggedIn) {
            return null;
        }
        
        return (
            <Link to={to} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors">
                {children}
            </Link>
        );
    };

    // Enhanced MobileNavLink component
    const MobileNavLink = ({ to, children, requiresAuth = false, onClick = null }) => {
        // Don't render schedule link if not authenticated
        if (requiresAuth && !isLoggedIn) {
            return null;
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

    const handleUserMenuClick = () => {
        setIsUserMenuOpen(!isUserMenuOpen);
    };

    const handleLogout = () => {
        setIsUserMenuOpen(false);
        onLogout();
    };

    const handleViewProfile = () => {
        setIsUserMenuOpen(false);
        onViewOwnProfile();
    };

    const handleUserSettings = () => {
        setIsUserMenuOpen(false);
        navigate('/settings');
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
                    <NavLink to="/scores">Scores</NavLink>
                    {isLoggedIn && (
                        <>
                            <NavLink to="/schedule" requiresAuth={true}>Schedule</NavLink>
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
                            <button 
                                onClick={toggleThemeMode} 
                                className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                title={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} mode`}
                            >
                                {themeMode === 'light' ? (
                                    <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" className="w-5 h-5" />
                                ) : (
                                    <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" className="w-5 h-5" />
                                )}
                            </button>
                            
                            {/* User Menu */}
                            <div className="relative">
                                <button
                                    onClick={handleUserMenuClick}
                                    className="flex items-center space-x-2 p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                >
                                    <div className="w-8 h-8 bg-primary dark:bg-primary-dark rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-bold">
                                            {(loggedInProfile?.username || loggedInProfile?.displayName || 'U')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className="w-4 h-4" />
                                </button>
                                
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme shadow-lg z-50">
                                        <div className="py-2">
                                            <div className="px-4 py-2 border-b border-accent dark:border-accent-dark">
                                                <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                                    {loggedInProfile?.username || loggedInProfile?.displayName || 'User'}
                                                </p>
                                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                    {user?.email}
                                                </p>
                                            </div>
                                            
                                            <button
                                                onClick={handleViewProfile}
                                                className="w-full text-left px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors flex items-center gap-2"
                                            >
                                                <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" className="w-4 h-4" />
                                                View Profile
                                            </button>
                                            
                                            <button
                                                onClick={handleUserSettings}
                                                className="w-full text-left px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors flex items-center gap-2"
                                            >
                                                <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" className="w-4 h-4" />
                                                Account Settings
                                            </button>
                                            
                                            {isAdmin && (
                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        navigate('/admin');
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors flex items-center gap-2"
                                                >
                                                    <Icon path="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" className="w-4 h-4" />
                                                    Admin Panel
                                                </button>
                                            )}
                                            
                                            <div className="border-t border-accent dark:border-accent-dark mt-2 pt-2">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors flex items-center gap-2"
                                                >
                                                    <Icon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" className="w-4 h-4" />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center space-x-4">
                            {/* Theme Toggle for non-authenticated users */}
                            <button 
                                onClick={toggleThemeMode} 
                                className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                title={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} mode`}
                            >
                                {themeMode === 'light' ? (
                                    <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" className="w-5 h-5" />
                                ) : (
                                    <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" className="w-5 h-5" />
                                )}
                            </button>
                            
                            <button onClick={onLoginClick} className="bg-transparent border border-primary dark:border-primary-dark text-primary dark:text-primary-dark font-bold py-2 px-4 rounded-theme hover:bg-primary dark:hover:bg-primary-dark hover:text-white dark:hover:text-white transition-colors">
                                Login
                            </button>
                            <button onClick={onSignUpClick} className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-4 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors">
                                Sign Up
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Mobile Hamburger */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-text-primary dark:text-text-primary-dark">
                <Icon path={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"} className="w-6 h-6" />
            </button>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="fixed right-0 top-0 h-full w-64 bg-surface dark:bg-surface-dark border-l border-accent dark:border-accent-dark p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Mobile Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-accent dark:border-accent-dark">
                            <span className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Menu</span>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-text-primary dark:text-text-primary-dark">
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Mobile Navigation Links */}
                        <div className="space-y-2">
                            <MobileNavLink to="/howtoplay">How to Play</MobileNavLink>
                            <MobileNavLink to="/scores">Scores</MobileNavLink>
                            {isLoggedIn && (
                                <>
                                    <MobileNavLink to="/schedule" requiresAuth={true}>Schedule</MobileNavLink>
                                    <MobileNavLink to="/stats">Stats</MobileNavLink>
                                    <MobileNavLink to="/leaderboard">Leaderboard</MobileNavLink>
                                    <MobileNavLink to="/leagues">Leagues</MobileNavLink>
                                    <MobileNavLink to="/dashboard">Dashboard</MobileNavLink>
                                </>
                            )}
                        </div>

                        {/* Mobile User Section */}
                        <div className="border-t border-accent dark:border-accent-dark pt-4">
                            {isLoggedIn ? (
                                <div className="space-y-2">
                                    <div className="px-3 py-2 bg-accent dark:bg-accent-dark/20 rounded-theme">
                                        <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                            {loggedInProfile?.username || loggedInProfile?.displayName || 'User'}
                                        </p>
                                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                            {user?.email}
                                        </p>
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            handleViewProfile();
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 rounded-theme transition-colors"
                                    >
                                        View Profile
                                    </button>
                                    
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            handleUserSettings();
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 rounded-theme transition-colors"
                                    >
                                        Account Settings
                                    </button>
                                    
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                navigate('/admin');
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 rounded-theme transition-colors"
                                        >
                                            Admin Panel
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            handleLogout();
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-accent dark:hover:bg-accent-dark/20 rounded-theme transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            onLoginClick();
                                        }}
                                        className="w-full bg-transparent border border-primary dark:border-primary-dark text-primary dark:text-primary-dark font-bold py-2 px-4 rounded-theme hover:bg-primary dark:hover:bg-primary-dark hover:text-white dark:hover:text-white transition-colors"
                                    >
                                        Login
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            onSignUpClick();
                                        }}
                                        className="w-full bg-primary dark:bg-primary-dark text-white font-bold py-2 px-4 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors"
                                    >
                                        Sign Up
                                    </button>
                                </div>
                            )}
                            
                            {/* Theme toggle for mobile */}
                            <div className="pt-4 border-t border-accent dark:border-accent-dark mt-4">
                                <button 
                                    onClick={toggleThemeMode} 
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 rounded-theme transition-colors"
                                >
                                    <span>Switch to {themeMode === 'light' ? 'Dark' : 'Light'} Mode</span>
                                    {themeMode === 'light' ? (
                                        <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" className="w-5 h-5" />
                                    ) : (
                                        <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;