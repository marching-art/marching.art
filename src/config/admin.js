// Admin configuration for drum corps game
// This file provides admin-specific constants and utilities

export const ADMIN_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MODERATOR: 'moderator'
};

export const ADMIN_PERMISSIONS = {
    MANAGE_SEASONS: 'manage_seasons',
    MANAGE_USERS: 'manage_users',
    MANAGE_LEAGUES: 'manage_leagues',
    VIEW_REPORTS: 'view_reports',
    MODERATE_CONTENT: 'moderate_content',
    SYSTEM_SETTINGS: 'system_settings'
};

export const ADMIN_ACTIONS = {
    START_SEASON: 'start_season',
    END_SEASON: 'end_season',
    PROCESS_SCORES: 'process_scores',
    UPDATE_LEADERBOARD: 'update_leaderboard',
    ARCHIVE_SEASON: 'archive_season',
    MIGRATE_DATA: 'migrate_data'
};

export const ADMIN_CONFIG = {
    MAX_REPORTS_PER_PAGE: 50,
    MAX_USERS_PER_PAGE: 100,
    SESSION_TIMEOUT: 3600000, // 1 hour
    AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_BULK_OPERATIONS: 1000
};

// Helper function to check admin permissions
export const hasPermission = (userRole, requiredPermission) => {
    const rolePermissions = {
        [ADMIN_ROLES.SUPER_ADMIN]: Object.values(ADMIN_PERMISSIONS),
        [ADMIN_ROLES.ADMIN]: [
            ADMIN_PERMISSIONS.MANAGE_SEASONS,
            ADMIN_PERMISSIONS.MANAGE_USERS,
            ADMIN_PERMISSIONS.MANAGE_LEAGUES,
            ADMIN_PERMISSIONS.VIEW_REPORTS,
            ADMIN_PERMISSIONS.MODERATE_CONTENT
        ],
        [ADMIN_ROLES.MODERATOR]: [
            ADMIN_PERMISSIONS.VIEW_REPORTS,
            ADMIN_PERMISSIONS.MODERATE_CONTENT
        ]
    };

    return rolePermissions[userRole]?.includes(requiredPermission) || false;
};

// Admin dashboard navigation items
export const ADMIN_NAV_ITEMS = [
    {
        id: 'dashboard',
        name: 'Dashboard',
        icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586l-2 2V5H5v14h7v2H4a1 1 0 01-1-1V4z',
        path: '/admin'
    },
    {
        id: 'seasons',
        name: 'Season Management',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        path: '/admin/seasons',
        permission: ADMIN_PERMISSIONS.MANAGE_SEASONS
    },
    {
        id: 'users',
        name: 'User Management',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
        path: '/admin/users',
        permission: ADMIN_PERMISSIONS.MANAGE_USERS
    },
    {
        id: 'reports',
        name: 'Reports',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        path: '/admin/reports',
        permission: ADMIN_PERMISSIONS.VIEW_REPORTS
    },
    {
        id: 'settings',
        name: 'System Settings',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
        path: '/admin/settings',
        permission: ADMIN_PERMISSIONS.SYSTEM_SETTINGS
    }
];

export default {
    ADMIN_ROLES,
    ADMIN_PERMISSIONS,
    ADMIN_ACTIONS,
    ADMIN_CONFIG,
    ADMIN_NAV_ITEMS,
    hasPermission
};