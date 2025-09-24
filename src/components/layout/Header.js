// src/components/layout/Header.js - Updated to remove "How to Play" navigation
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
            className="text-text-primary dark:text-text-primary-dark p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors w-full"
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
                    <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.128c-.326-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" className="w-4 h-4" />
                    Settings
                </button>

                {isAdmin && (
                    <button
                        onClick={() => {
                            setPage('admin');
                            setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                    >
                        <Icon path="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" className="w-4 h-4" />
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