// src/components/layout/Header.js - Modernized with profile dropdown and settings access
import React, { useState, useRef, useEffect } from 'react';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';
import NotificationsIcon from '../ui/NotificationsIcon';

const Header = ({
    user,
    onViewLeague,
    isLoggedIn,
    isAdmin,
    onLoginClick,
    onSignUpClick,
    onLogout,
    setPage,
    onViewOwnProfile,
    profile,
    themeMode,
    toggleThemeMode,
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const profileButtonRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && 
                !dropdownRef.current.contains(event.target) &&
                !profileButtonRef.current?.contains(event.target)) {
                setIsProfileDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const NavButton = ({ page, children }) => (
        <button 
            onClick={() => setPage(page)} 
            className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors"
        >
            {children}
        </button>
    );

    const MobileNavButton = ({ page, children }) => (
        <button 
            onClick={() => { setPage(page); setIsMobileMenuOpen(false); }} 
            className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full"
        >
            {children}
        </button>
    );

    const ProfileDropdown = () => (
        <div 
            ref={dropdownRef}
            className="absolute top-full right-0 mt-2 w-64 bg-surface dark:bg-surface-dark rounded-theme shadow-xl border border-accent dark:border-accent-dark z-50 py-2"
        >
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-accent dark:border-accent-dark">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                        {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-primary dark:text-text-primary-dark truncate">
                            {profile?.username || 'User'}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark truncate">
                            {user?.email}
                        </p>
                        {!user?.emailVerified && (
                            <span className="inline-flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded text-xs mt-1">
                                <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-3 h-3" />
                                Email Unverified
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="py-2">
                <button
                    onClick={() => {
                        onViewOwnProfile();
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" className="w-4 h-4" />
                    View Profile
                </button>

                <button
                    onClick={() => {
                        setPage('settings');
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.128c-.326-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.240.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-4 h-4" />
                    Account Settings
                </button>

                {isAdmin && (
                    <button
                        onClick={() => {
                            setPage('admin');
                            setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <Icon path="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" className="w-4 h-4" />
                        Admin Panel
                    </button>
                )}
            </div>

            {/* Theme Toggle */}
            <div className="border-t border-accent dark:border-accent-dark py-2">
                <button
                    onClick={() => {
                        toggleThemeMode();
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon path={themeMode === 'light' ? 
                        "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" : 
                        "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z"
                    } className="w-4 h-4" />
                    {themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
            </div>

            {/* Logout */}
            <div className="border-t border-accent dark:border-accent-dark py-2">
                <button
                    onClick={() => {
                        onLogout();
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );

    return (
        <header className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark p-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
            <div onClick={() => setPage('home')} className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-8 w-8" />
                <span className="text-xl sm:text-2xl font-semibold text-text-primary dark:text-text-primary-dark tracking-tight">
                    marching<span className="text-primary dark:text-primary-dark font-bold">.art</span>
                </span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
                <div className="flex items-center space-x-6">
                    <NavButton page="howtoplay">How to Play</NavButton>
                    <NavButton page="schedule">Schedule</NavButton>
                    <NavButton page="scores">Scores</NavButton>
                    <NavButton page="stats">Stats</NavButton>
                    {isLoggedIn && (
                        <>
                            <NavButton page="leaderboard">Leaderboard</NavButton>
                            <NavButton page="leagues">Leagues</NavButton>
                            <NavButton page="dashboard">Dashboard</NavButton>
                        </>
                    )}
                </div>

                <div className="flex items-center space-x-4">
                    {isLoggedIn ? (
                        <>
                            <NotificationsIcon user={user} setPage={setPage} onViewLeague={onViewLeague} />
                            
                            {/* Profile Dropdown */}
                            <div className="relative">
                                <button
                                    ref={profileButtonRef}
                                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                    className="flex items-center gap-2 p-2 rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                >
                                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        {profile?.username?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className={`w-4 h-4 text-text-secondary dark:text-text-secondary-dark transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isProfileDropdownOpen && <ProfileDropdown />}
                            </div>
                        </>
                    ) : (
                        <>
                            <button onClick={onLoginClick} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors font-medium">
                                Log In
                            </button>
                            <button onClick={onSignUpClick} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all text-sm">
                                Sign Up
                            </button>
                            <button onClick={toggleThemeMode} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 focus:outline-none focus:ring-2 focus:ring-primary">
                                <Icon path={themeMode === 'light' ? 
                                    "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" : 
                                    "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z"
                                } className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
                {!isLoggedIn && (
                    <button onClick={toggleThemeMode} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20">
                        <Icon path={themeMode === 'light' ? 
                            "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" : 
                            "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z"
                        } className="w-5 h-5" />
                    </button>
                )}
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20">
                    <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="absolute top-full left-0 right-0 bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark shadow-lg md:hidden">
                    <nav className="flex flex-col p-4 space-y-2">
                        <MobileNavButton page="howtoplay">How to Play</MobileNavButton>
                        <MobileNavButton page="schedule">Schedule</MobileNavButton>
                        <MobileNavButton page="scores">Scores</MobileNavButton>
                        <MobileNavButton page="stats">Stats</MobileNavButton>
                        
                        {isLoggedIn ? (
                            <>
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <MobileNavButton page="leaderboard">Leaderboard</MobileNavButton>
                                <MobileNavButton page="leagues">Leagues</MobileNavButton>
                                <MobileNavButton page="dashboard">Dashboard</MobileNavButton>
                                <button onClick={() => { onViewOwnProfile(); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">
                                    Profile
                                </button>
                                <button onClick={() => { setPage('settings'); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">
                                    Settings
                                </button>
                                {isAdmin && (
                                    <button onClick={() => { setPage('admin'); setIsMobileMenuOpen(false); }} className="text-red-500 font-bold p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 w-full">
                                        Admin Panel
                                    </button>
                                )}
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <button onClick={toggleThemeMode} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full flex items-center gap-2">
                                    <Icon path={themeMode === 'light' ? 
                                        "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" : 
                                        "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z"
                                    } className="w-4 h-4" />
                                    {themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}
                                </button>
                                <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-text-secondary dark:text-text-secondary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <button onClick={() => { onLoginClick(); setIsMobileMenuOpen(false); }} className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full">
                                    Log In
                                </button>
                                <button onClick={() => { onSignUpClick(); setIsMobileMenuOpen(false); }} className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-3 rounded-theme transition-all w-full text-left">
                                    Sign Up
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