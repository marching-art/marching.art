// components/ui/Icon.js
// Universal SVG Icon Component for Enhanced Fantasy Drum Corps Game
// Supports Heroicons v2 paths and custom styling

import React from 'react';

const Icon = ({ 
  path, 
  className = 'w-6 h-6', 
  size,
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 1.5,
  ...props 
}) => {
  // Handle size prop for convenience
  const finalClassName = size ? `w-${size} h-${size}` : className;
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={fill}
      viewBox="0 0 24 24"
      strokeWidth={strokeWidth}
      stroke={stroke}
      className={finalClassName}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={path}
      />
    </svg>
  );
};

export default Icon;