// =============================================================================
// BRAND LOGO COMPONENT - Official Marching.art Drill Logo
// =============================================================================
// The 9-dot field grid with sweeping drill path represents the core of
// marching arts: precision, pattern, and the art of movement.

import React from 'react';

const BrandLogo = ({ className = "w-16 h-16", color = "text-gold-500" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-5 -5 65 65"
    className={`${className} ${color}`}
  >
    <g>
      {/* The 9 Dots (Field Grid) - Using Current Color for Fill */}
      <circle cx="0" cy="0" r="4" className="fill-current opacity-80"/>
      <circle cx="25" cy="0" r="4" className="fill-current opacity-80"/>
      <circle cx="50" cy="0" r="4" className="fill-current opacity-80"/>
      <circle cx="0" cy="25" r="4" className="fill-current opacity-80"/>
      <circle cx="25" cy="25" r="4" className="fill-current opacity-80"/>
      <circle cx="50" cy="25" r="4" className="fill-current opacity-80"/>
      <circle cx="0" cy="50" r="4" className="fill-current opacity-80"/>
      <circle cx="25" cy="50" r="4" className="fill-current opacity-80"/>
      <circle cx="50" cy="50" r="4" className="fill-current opacity-80"/>

      {/* The Drill Path - Using Current Color for Stroke */}
      <path
        d="M 0 0 Q 50 0, 50 50"
        className="stroke-current"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

export default BrandLogo;
