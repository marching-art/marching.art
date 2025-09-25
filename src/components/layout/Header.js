// src/components/layout/Header.js - Complete fixed version
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
    currentPage
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

    // Ensure all props are functions to prevent "d is not a function" errors
    const safeSetPage = typeof setPage === 'function' ? setPage : () => console.warn('setPage not provided');
    const safeOnLoginClick = typeof onLoginClick === 'function' ? onLoginClick : () => console.warn('onLoginClick not provided');
    const safeOnSignUpClick = typeof onSignUpClick === 'function' ? onSignUpClick : () => console.warn('onSignUpClick not provided');
    const safeOnLogout = typeof onLogout === 'function' ? onLogout : () => console.warn('onLogout not provided');
    const safeOnViewOwnProfile = typeof onViewOwnProfile === 'function' ? onViewOwnProfile : () => console.warn('onViewOwnProfile not provided');
    const safeToggleThemeMode = typeof toggleThemeMode === 'function' ? toggleThemeMode : () => console.warn('toggleThemeMode not provided');

    const NavButton = ({ page, children }) => (
        <button 
            onClick={() => safeSetPage(page)} 
            className={`text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors ${
                currentPage === page ? 'text-primary dark:text-primary-dark font-semibold' : ''
            }`}
        >
            {children}
        </button>
    );

    const MobileNavButton = ({ page, children }) => (
        <button 
            onClick={() => { 
                safeSetPage(page); 
                setIsMobileMenuOpen(false); 
            }} 
            className={`text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors w-full ${
                currentPage === page ? 'bg-accent dark:bg-accent-dark/20 font-semibold' : ''
            }`}
        >
            {children}
        </button>
    );

    const ProfileDropdown = () => (
        <div ref={dropdownRef} className="absolute right-0 top-full mt-2 w-64 bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme shadow-theme z-50">
            {/* Profile Info */}
            <div className="p-4 border-b border-accent dark:border-accent-dark">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                        {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                        <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                            {profile?.username || 'User'}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Fantasy Director • Level {profile?.level || 1}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="py-2">
                <button
                    onClick={() => {
                        safeOnViewOwnProfile();
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon name="user" className="w-4 h-4" />
                    View Profile
                </button>
                
                <button
                    onClick={() => {
                        safeSetPage('settings');
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon name="settings" className="w-4 h-4" />
                    Settings
                </button>

                {isAdmin && (
                    <button
                        onClick={() => {
                            safeSetPage('admin');
                            setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <Icon name="shield" className="w-4 h-4" />
                        Admin Panel
                    </button>
                )}

                {/* Theme Toggle */}
                <button
                    onClick={() => {
                        safeToggleThemeMode();
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon name={themeMode === 'light' ? 'moon' : 'sun'} className="w-4 h-4" />
                    {themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
            </div>

            {/* Logout */}
            <div className="border-t border-accent dark:border-accent-dark py-2">
                <button
                    onClick={() => {
                        safeOnLogout();
                        setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                >
                    <Icon name="log-out" className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );

    return (
        <header className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark p-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
            {/* Logo */}
            <div onClick={() => safeSetPage('home')} className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-8 w-8" />
                <span className="text-xl sm:text-2xl font-semibold text-text-primary dark:text-text-primary-dark tracking-tight">
                    marching<span className="text-primary dark:text-primary-dark font-bold">.art</span>
                </span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
                <div className="flex items-center space-x-6">
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
                        <div className="relative">
                            {/* Notifications */}
                            <NotificationsIcon 
                                userId={user?.uid} 
                                className="mr-4" 
                            />

                            {/* Profile Button */}
                            <button
                                ref={profileButtonRef}
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                className="flex items-center gap-2 p-2 rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                            >
                                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <Icon name="chevron-down" className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
                            </button>

                            {/* Profile Dropdown */}
                            {isProfileDropdownOpen && <ProfileDropdown />}
                        </div>
                    ) : (
                        <div className="flex items-center space-x-3">
                            {/* Theme Toggle for non-logged-in users */}
                            <button 
                                onClick={safeToggleThemeMode} 
                                className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                            >
                                <Icon name={themeMode === 'light' ? 'moon' : 'sun'} className="w-5 h-5" />
                            </button>
                            
                            <button 
                                onClick={safeOnLoginClick} 
                                className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-colors"
                            >
                                Log In
                            </button>
                            
                            <button 
                                onClick={safeOnSignUpClick} 
                                className="bg-primary hover:bg-primary/90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all"
                            >
                                Sign Up
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
                {!isLoggedIn && (
                    <button 
                        onClick={safeToggleThemeMode} 
                        className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20"
                    >
                        <Icon name={themeMode === 'light' ? 'moon' : 'sun'} className="w-5 h-5" />
                    </button>
                )}
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                    className="p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20"
                >
                    <Icon name="menu" className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="absolute top-full left-0 right-0 bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark shadow-lg md:hidden">
                    <nav className="flex flex-col p-4 space-y-2">
                        <MobileNavButton page="schedule">Schedule</MobileNavButton>
                        <MobileNavButton page="scores">Scores</MobileNavButton>
                        <MobileNavButton page="stats">Stats</MobileNavButton>
                        
                        {isLoggedIn ? (
                            <>
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <MobileNavButton page="leaderboard">Leaderboard</MobileNavButton>
                                <MobileNavButton page="leagues">Leagues</MobileNavButton>
                                <MobileNavButton page="dashboard">Dashboard</MobileNavButton>
                                
                                <button 
                                    onClick={() => { 
                                        safeOnViewOwnProfile(); 
                                        setIsMobileMenuOpen(false); 
                                    }} 
                                    className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full"
                                >
                                    Profile
                                </button>
                                
                                <button 
                                    onClick={() => { 
                                        safeSetPage('settings'); 
                                        setIsMobileMenuOpen(false); 
                                    }} 
                                    className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full"
                                >
                                    Settings
                                </button>
                                
                                {isAdmin && (
                                    <button 
                                        onClick={() => { 
                                            safeSetPage('admin'); 
                                            setIsMobileMenuOpen(false); 
                                        }} 
                                        className="text-red-500 font-bold p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 w-full"
                                    >
                                        Admin Panel
                                    </button>
                                )}
                                
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                
                                <button 
                                    onClick={safeToggleThemeMode} 
                                    className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full flex items-center gap-2"
                                >
                                    <Icon name={themeMode === 'light' ? 'moon' : 'sun'} className="w-4 h-4" />
                                    {themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}
                                </button>
                                
                                <button 
                                    onClick={() => { 
                                        safeOnLogout(); 
                                        setIsMobileMenuOpen(false); 
                                    }} 
                                    className="text-text-secondary dark:text-text-secondary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="border-t border-accent dark:border-accent-dark my-2"></div>
                                <button 
                                    onClick={() => { 
                                        safeOnLoginClick(); 
                                        setIsMobileMenuOpen(false); 
                                    }} 
                                    className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 font-semibold w-full"
                                >
                                    Log In
                                </button>
                                <button 
                                    onClick={() => { 
                                        safeOnSignUpClick(); 
                                        setIsMobileMenuOpen(false); 
                                    }} 
                                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-3 rounded-theme transition-all w-full text-left"
                                >
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