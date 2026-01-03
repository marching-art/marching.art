// =============================================================================
// TEAM AVATAR COMPONENT
// =============================================================================
// Displays a circular badge with team initial or custom logo
// Uses brand yellow/gold accent color for the fallback initial badge

import React from 'react';

export interface TeamAvatarProps {
  /** Team/Corps name - used to extract initial */
  name?: string | null;
  /** Custom logo URL */
  logoUrl?: string | null;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Optional className for additional styling */
  className?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export const TeamAvatar: React.FC<TeamAvatarProps> = ({
  name,
  logoUrl,
  size = 'sm',
  className = '',
}) => {
  // Get the first letter of the name, defaulting to "?" if no name
  const initial = name?.trim()?.[0]?.toUpperCase() || '?';

  const sizeClass = sizeClasses[size];

  // If we have a custom logo, display it
  if (logoUrl) {
    return (
      <div
        className={`${sizeClass} rounded-sm overflow-hidden bg-[#333] flex-shrink-0 ${className}`}
      >
        <img
          src={logoUrl}
          alt={name || 'Team logo'}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: stylized circular badge with initial
  return (
    <div
      className={`
        ${sizeClass}
        rounded-sm flex-shrink-0
        bg-gradient-to-br from-yellow-500/30 to-yellow-600/20
        border border-yellow-500/40
        flex items-center justify-center
        font-bold text-yellow-400
        ${className}
      `}
      title={name || undefined}
    >
      {initial}
    </div>
  );
};

export default TeamAvatar;
