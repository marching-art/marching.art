// YouTubeIcon - Official YouTube branding compliant icon
// Uses official YouTube icon from brand resources with correct aspect ratio
// https://www.youtube.com/howyoutubeworks/resources/brand-resources/
// Icon specifications: https://developers.google.com/youtube/terms/branding-guidelines
// Minimum size: 100px HEIGHT per official YouTube brand guidelines (Policy III.F.2a-b)
// "To ensure our logos are always legible, their height should never be smaller than: Digital: 100px"

import React from 'react';

// Minimum HEIGHT required by YouTube branding guidelines for digital use
const MIN_YOUTUBE_ICON_HEIGHT = 100;

// Official YouTube "play button" icon with correct 159:110 aspect ratio
const YouTubeIcon = ({ className = '', height: requestedHeight = 100 }) => {
  // Enforce minimum height for YouTube branding compliance (100px per brand guidelines)
  const height = Math.max(requestedHeight, MIN_YOUTUBE_ICON_HEIGHT);
  // Maintain official aspect ratio (width:height = 159:110 ≈ 1.445:1)
  const width = Math.round(height * 1.445);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 159 110"
      className={className}
      aria-label="YouTube"
      role="img"
    >
      {/* Red rounded rectangle - official YouTube shape */}
      <path
        d="M154 17.5c-1.82-6.73-7.07-12-13.8-13.8C128.4 0 79.5 0 79.5 0S30.6 0 18.8 3.7c-6.73 1.8-12 7.07-13.8 13.8C1.3 29.3 1.3 55 1.3 55s0 25.7 3.7 37.5c1.8 6.73 7.07 12 13.8 13.8 11.8 3.7 60.7 3.7 60.7 3.7s48.9 0 60.7-3.7c6.73-1.8 12-7.07 13.8-13.8 3.7-11.8 3.7-37.5 3.7-37.5s0-25.7-3.7-37.5z"
        fill="#FF0000"
      />
      {/* White play triangle - centered */}
      <path
        d="M64 79.5L105 55 64 30.5v49z"
        fill="#FFFFFF"
      />
    </svg>
  );
};

export default YouTubeIcon;
