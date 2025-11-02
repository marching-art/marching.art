import React, { useState } from 'react';

/**
 * ModernSidebar - Figma-style sidebar navigation
 * Collapsible on desktop, bottom nav on mobile
 */
const ModernSidebar = ({ 
    currentPage, 
    onNavigate, 
    user, 
    profile, 
    onLogout,
    onLogin 
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠', auth: true },
        { id: 'scores', label: 'Scores', icon: '📊', auth: false },
        { id: 'schedule', label: 'Schedule', icon: '📅', auth: false },
        { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', auth: true },
        { id: 'leagues', label: 'Leagues', icon: '👥', auth: true },
    ];

    const userItems = [
        { id: 'profile', label: 'Profile', icon: '👤', auth: true },
        { id: 'howtoplay', label: 'How to Play', icon: '❓', auth: false },
    ];

    const NavButton = ({ item, isActive }) => {
        if (item.auth && !user) return null;

        return (
            <button
                onClick={() => onNavigate(item.id)}
                className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all group relative
                    ${isActive 
                        ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400 font-semibold' 
                        : 'text-gray-400 hover:text-white hover:bg-slate-800'
                    }
                    ${isCollapsed ? 'justify-center' : ''}
                `}
            >
                {/* Active Indicator */}
                {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-500 to-purple-600 rounded-r-full"></span>
                )}
                
                {/* Icon */}
                <span className="text-xl">{item.icon}</span>
                
                {/* Label */}
                {!isCollapsed && (
                    <span className="flex-1 text-left text-sm">{item.label}</span>
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                    <span className="absolute left-full ml-2 px-3 py-1 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {item.label}
                    </span>
                )}
            </button>
        );
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className={`
                hidden md:flex flex-col
                ${isCollapsed ? 'w-20' : 'w-64'}
                bg-slate-900 border-r border-slate-800
                transition-all duration-300
                relative
            `}>
                {/* Logo */}
                <div className={`
                    p-6 border-b border-slate-800 flex items-center
                    ${isCollapsed ? 'justify-center' : 'justify-between'}
                `}>
                    {!isCollapsed ? (
                        <>
                            <div>
                                <div className="text-xl font-bold text-gradient">
                                    marching.art
                                </div>
                                {user && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        {profile?.username || 'User'}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-2xl">🎺</span>
                    )}
                </div>

                {/* Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-xs text-gray-400 hover:text-white hover:bg-slate-700 transition-all z-10"
                >
                    {isCollapsed ? '→' : '←'}
                </button>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {navItems.map(item => (
                        <NavButton 
                            key={item.id} 
                            item={item} 
                            isActive={currentPage === item.id} 
                        />
                    ))}
                    
                    <div className="divider my-4"></div>
                    
                    {userItems.map(item => (
                        <NavButton 
                            key={item.id} 
                            item={item} 
                            isActive={currentPage === item.id} 
                        />
                    ))}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-slate-800">
                    {user ? (
                        <>
                            {!isCollapsed && (
                                <div className="mb-3 p-3 bg-slate-800/50 rounded-lg">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                            {profile?.username?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm truncate">
                                                {profile?.username || 'User'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                View Profile
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={onLogout}
                                className="w-full btn-ghost text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                                {isCollapsed ? '🚪' : 'Logout'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onLogin}
                            className="w-full btn-primary text-sm"
                        >
                            {isCollapsed ? '🔐' : 'Login'}
                        </button>
                    )}
                </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 z-50 pb-safe">
                <div className="flex items-center justify-around p-2">
                    {navItems.slice(0, 4).map(item => {
                        if (item.auth && !user) return null;
                        const isActive = currentPage === item.id;
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`
                                    flex flex-col items-center gap-1 px-4 py-2 rounded-lg
                                    transition-all min-w-[60px]
                                    ${isActive 
                                        ? 'text-purple-400' 
                                        : 'text-gray-500 active:scale-95'
                                    }
                                `}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="text-xs font-medium">{item.label}</span>
                                {isActive && (
                                    <span className="w-1 h-1 rounded-full bg-purple-500"></span>
                                )}
                            </button>
                        );
                    })}
                    
                    {/* More Menu */}
                    <button
                        onClick={() => onNavigate('profile')}
                        className={`
                            flex flex-col items-center gap-1 px-4 py-2 rounded-lg
                            transition-all min-w-[60px]
                            ${['profile', 'leagues', 'howtoplay'].includes(currentPage)
                                ? 'text-purple-400' 
                                : 'text-gray-500 active:scale-95'
                            }
                        `}
                    >
                        <span className="text-xl">⋯</span>
                        <span className="text-xs font-medium">More</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

export default ModernSidebar;
