// src/components/profile/UniformDisplay.js
// Complete uniform display with comprehensive DCI-inspired uniform rendering
import React from 'react';

// Comprehensive headwear rendering with all styles from UniformBuilder
const Headwear = ({ style, colors }) => {
    if (style === 'none') return null;
    
    const hatColor = colors.hat || '#1a1a1a';
    const trimColor = colors.trim || '#ffffff';

    switch (style) {
        case 'shako':
            return (
                <g id="headwear-shako" filter="url(#shadow)">
                    <rect x="85" y="70" width="30" height="25" rx="15" ry="5" fill={hatColor}/>
                    <rect x="85" y="90" width="30" height="5" fill={trimColor}/>
                    <circle cx="100" cy="85" r="3" fill={trimColor}/>
                </g>
            );
        case 'aussie':
            return (
                <g id="headwear-aussie" filter="url(#shadow)">
                    <ellipse cx="100" cy="80" rx="25" ry="8" fill={hatColor}/>
                    <ellipse cx="100" cy="75" rx="20" ry="10" fill={hatColor}/>
                    <circle cx="110" cy="75" r="2" fill={trimColor}/>
                    <path d="M80,80 Q100,85 120,80" stroke={trimColor} strokeWidth="1" fill="none"/>
                </g>
            );
        case 'helmet':
            return (
                <g id="headwear-helmet" filter="url(#shadow)">
                    <ellipse cx="100" cy="80" rx="22" ry="15" fill={hatColor}/>
                    <rect x="85" y="90" width="30" height="3" fill={trimColor}/>
                    <circle cx="100" cy="75" r="2" fill={trimColor}/>
                    <path d="M85,85 Q100,80 115,85" stroke={trimColor} strokeWidth="1" fill="none"/>
                </g>
            );
        case 'busby':
            return (
                <g id="headwear-busby" filter="url(#shadow)">
                    <rect x="82" y="60" width="36" height="35" rx="5" fill={hatColor}/>
                    <rect x="82" y="85" width="36" height="3" fill={trimColor}/>
                    <circle cx="100" cy="77" r="3" fill={trimColor}/>
                    <path d="M85,70 h30 M85,75 h30" stroke={trimColor} strokeWidth="0.5"/>
                </g>
            );
        case 'beret':
            return (
                <g id="headwear-beret" filter="url(#shadow)">
                    <ellipse cx="105" cy="75" rx="20" ry="10" fill={hatColor}/>
                    <circle cx="100" cy="80" r="2" fill={trimColor}/>
                    <ellipse cx="100" cy="85" rx="18" ry="3" fill={hatColor}/>
                </g>
            );
        case 'garrison':
            return (
                <g id="headwear-garrison" filter="url(#shadow)">
                    <path d="M85,78 Q100,70 115,78 Q115,85 100,85 Q85,85 85,78" fill={hatColor}/>
                    <path d="M85,82 Q100,78 115,82" stroke={trimColor} strokeWidth="1" fill="none"/>
                    <circle cx="100" cy="80" r="1.5" fill={trimColor}/>
                </g>
            );
        case 'kepi':
            return (
                <g id="headwear-kepi" filter="url(#shadow)">
                    <ellipse cx="100" cy="75" rx="20" ry="12" fill={hatColor}/>
                    <rect x="85" y="85" width="30" height="8" rx="3" fill={hatColor}/>
                    <path d="M85,85 h30" stroke={trimColor} strokeWidth="1"/>
                    <circle cx="100" cy="75" r="2" fill={trimColor}/>
                </g>
            );
        case 'czapka':
            return (
                <g id="headwear-czapka" filter="url(#shadow)">
                    <rect x="85" y="70" width="30" height="20" rx="8" ry="3" fill={hatColor}/>
                    <rect x="85" y="85" width="30" height="5" fill={trimColor}/>
                    <rect x="95" y="65" width="10" height="8" rx="5" fill={hatColor}/>
                </g>
            );
        case 'bicorne':
            return (
                <g id="headwear-bicorne" filter="url(#shadow)">
                    <path d="M80,80 Q100,70 120,80 Q115,85 100,83 Q85,85 80,80" fill={hatColor}/>
                    <path d="M85,80 Q100,75 115,80" stroke={trimColor} strokeWidth="1" fill="none"/>
                    <circle cx="100" cy="78" r="2" fill={trimColor}/>
                </g>
            );
        case 'tricorne':
            return (
                <g id="headwear-tricorne" filter="url(#shadow)">
                    <path d="M85,75 L100,65 L115,75 L110,85 L90,85 Z" fill={hatColor}/>
                    <path d="M85,75 L100,70 L115,75" stroke={trimColor} strokeWidth="1" fill="none"/>
                    <circle cx="100" cy="75" r="2" fill={trimColor}/>
                </g>
            );
        case 'mirliton':
            return (
                <g id="headwear-mirliton" filter="url(#shadow)">
                    <path d="M85,70 Q100,60 115,70 Q120,80 100,85 Q80,80 85,70" fill={hatColor}/>
                    <path d="M115,70 Q125,65 130,75" stroke={hatColor} strokeWidth="3" fill="none"/>
                    <circle cx="100" cy="75" r="2" fill={trimColor}/>
                </g>
            );
        default:
            return null;
    }
};

// Comprehensive plume rendering with all styles
const Plume = ({ style, colors }) => {
    if (style === 'none') return null;
    
    const plumeColor = colors.plume || '#ff0000';

    switch (style) {
        case 'fountain':
            return (
                <g id="plume-fountain" filter="url(#shadow)">
                    <path d="M100,65 Q95,50 90,45 Q95,40 100,45 Q105,40 110,45 Q105,50 100,65" fill={plumeColor} opacity="0.8"/>
                    <path d="M100,65 Q98,55 96,50 Q98,48 100,50 Q102,48 104,50 Q102,55 100,65" fill={plumeColor}/>
                </g>
            );
        case 'feather':
            return (
                <g id="plume-feather" filter="url(#shadow)">
                    <path d="M100,65 Q102,50 105,40" stroke={plumeColor} strokeWidth="2" fill="none"/>
                    <path d="M100,55 Q105,50 108,48" stroke={plumeColor} strokeWidth="1" fill="none"/>
                    <path d="M100,50 Q95,45 92,43" stroke={plumeColor} strokeWidth="1" fill="none"/>
                </g>
            );
        case 'mohawk':
            return (
                <g id="plume-mohawk" filter="url(#shadow)">
                    <path d="M85,65 Q100,40 115,65" stroke={plumeColor} strokeWidth="8" fill="none"/>
                    <path d="M88,60 Q100,45 112,60" stroke={plumeColor} strokeWidth="4" fill="none"/>
                </g>
            );
        case 'hackle':
            return (
                <g id="plume-hackle" filter="url(#shadow)">
                    <path d="M95,65 Q98,50 100,45" stroke={plumeColor} strokeWidth="3" fill="none"/>
                    <path d="M100,65 Q102,50 105,45" stroke={plumeColor} strokeWidth="3" fill="none"/>
                    <path d="M105,65 Q108,50 110,45" stroke={plumeColor} strokeWidth="3" fill="none"/>
                </g>
            );
        case 'pompom':
            return (
                <g id="plume-pompom" filter="url(#shadow)">
                    <circle cx="100" cy="55" r="8" fill={plumeColor} opacity="0.8"/>
                    <circle cx="95" cy="52" r="3" fill={plumeColor}/>
                    <circle cx="105" cy="52" r="3" fill={plumeColor}/>
                    <circle cx="100" cy="48" r="3" fill={plumeColor}/>
                </g>
            );
        case 'cascade':
            return (
                <g id="plume-cascade" filter="url(#shadow)">
                    <path d="M95,65 Q92,45 88,35" stroke={plumeColor} strokeWidth="2" fill="none"/>
                    <path d="M100,65 Q98,45 95,30" stroke={plumeColor} strokeWidth="2" fill="none"/>
                    <path d="M105,65 Q108,45 112,35" stroke={plumeColor} strokeWidth="2" fill="none"/>
                    <path d="M100,60 Q105,40 110,25" stroke={plumeColor} strokeWidth="2" fill="none"/>
                </g>
            );
        case 'rooster':
            return (
                <g id="plume-rooster" filter="url(#shadow)">
                    <path d="M100,65 Q105,45 115,35" stroke={plumeColor} strokeWidth="4" fill="none"/>
                    <path d="M100,62 Q108,50 118,42" stroke={plumeColor} strokeWidth="2" fill="none"/>
                    <path d="M102,60 Q110,52 120,48" stroke={plumeColor} strokeWidth="2" fill="none"/>
                </g>
            );
        case 'ostrich':
            return (
                <g id="plume-ostrich" filter="url(#shadow)">
                    <path d="M100,65 Q90,35 85,20" stroke={plumeColor} strokeWidth="6" fill="none" opacity="0.7"/>
                    <path d="M100,65 Q110,35 115,20" stroke={plumeColor} strokeWidth="6" fill="none" opacity="0.7"/>
                    <path d="M100,65 Q100,35 100,15" stroke={plumeColor} strokeWidth="6" fill="none" opacity="0.7"/>
                </g>
            );
        case 'dyed_tips':
            return (
                <g id="plume-dyed-tips" filter="url(#shadow)">
                    <path d="M100,65 Q95,50 90,35" stroke={plumeColor} strokeWidth="3" fill="none"/>
                    <path d="M100,65 Q105,50 110,35" stroke={plumeColor} strokeWidth="3" fill="none"/>
                    <circle cx="90" cy="35" r="2" fill="#FFD700"/>
                    <circle cx="110" cy="35" r="2" fill="#FFD700"/>
                </g>
            );
        case 'panache':
            return (
                <g id="plume-panache" filter="url(#shadow)">
                    <path d="M95,65 Q85,35 75,20" stroke={plumeColor} strokeWidth="4" fill="none" opacity="0.8"/>
                    <path d="M100,65 Q100,30 100,15" stroke={plumeColor} strokeWidth="5" fill="none"/>
                    <path d="M105,65 Q115,35 125,20" stroke={plumeColor} strokeWidth="4" fill="none" opacity="0.8"/>
                </g>
            );
        case 'macaroni':
            return (
                <g id="plume-macaroni" filter="url(#shadow)">
                    <path d="M100,65 Q120,50 135,40" stroke={plumeColor} strokeWidth="5" fill="none"/>
                    <path d="M105,62 Q125,52 140,45" stroke={plumeColor} strokeWidth="3" fill="none"/>
                    <circle cx="135" cy="40" r="3" fill={plumeColor}/>
                </g>
            );
        default:
            return null;
    }
};

// Comprehensive jacket rendering with all styles
const Jacket = ({ style, colors }) => {
    const baseColor = colors.base || '#000080';
    const accentColor = colors.accent || '#ffffff';
    const trimColor = colors.trim || '#ffd700';

    switch (style) {
        case 'classic':
            return (
                <g id="jacket-classic" filter="url(#shadow)">
                    <path d="M75,130 h50 v70 l-5,5 h-40 l-5,-5 z" fill={baseColor}/>
                    <path d="M95,135 v60" stroke={accentColor} strokeWidth="2"/>
                    <path d="M105,135 v60" stroke={accentColor} strokeWidth="2"/>
                    <circle cx="90" cy="145" r="2" fill={trimColor}/>
                    <circle cx="110" cy="145" r="2" fill={trimColor}/>
                    <circle cx="90" cy="155" r="2" fill={trimColor}/>
                    <circle cx="110" cy="155" r="2" fill={trimColor}/>
                    <path d="M75,130 h50" stroke={trimColor} strokeWidth="2"/>
                </g>
            );
        case 'double_breast':
            return (
                <g id="jacket-double-breast" filter="url(#shadow)">
                    <path d="M70,135 h60 v75 l-5,5 h-50 l-5,-5 z" fill={baseColor}/>
                    <path d="M85,140 v60" stroke={accentColor} strokeWidth="2"/>
                    <path d="M115,140 v60" stroke={accentColor} strokeWidth="2"/>
                    <circle cx="90" cy="145" r="2" fill={trimColor}/>
                    <circle cx="110" cy="145" r="2" fill={trimColor}/>
                    <circle cx="90" cy="155" r="2" fill={trimColor}/>
                    <circle cx="110" cy="155" r="2" fill={trimColor}/>
                    <circle cx="90" cy="165" r="2" fill={trimColor}/>
                    <circle cx="110" cy="165" r="2" fill={trimColor}/>
                    <path d="M70,135 h60" stroke={trimColor} strokeWidth="2"/>
                </g>
            );
        case 'sash':
            return (
                <g id="jacket-sash" filter="url(#shadow)">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor}/>
                    <path d="M75,130 L125,200" stroke={accentColor} strokeWidth="12"/>
                    <path d="M75,140 h50" stroke={trimColor} strokeWidth="4"/>
                    <circle cx="75" cy="140" r="3" fill={trimColor}/>
                    <circle cx="125" cy="140" r="3" fill={trimColor}/>
                </g>
            );
        case 'cadet':
            return (
                <g id="jacket-cadet" filter="url(#shadow)">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor}/>
                    <path d="M75,130 L100,200 L125,130" stroke={accentColor} strokeWidth="8" fill="none"/>
                    <circle cx="100" cy="135" r="5" fill={trimColor}/>
                    <circle cx="85" cy="145" r="2" fill={trimColor}/>
                    <circle cx="115" cy="145" r="2" fill={trimColor}/>
                    <path d="M80,155 h40" stroke={trimColor} strokeWidth="2"/>
                </g>
            );
        case 'modern':
            return (
                <g id="jacket-modern" filter="url(#shadow)">
                    <path d="M75,130 L110,130 L125,140 v60 L75,200 z" fill={baseColor}/>
                    <path d="M85,140 L115,150" stroke={accentColor} strokeWidth="3"/>
                    <path d="M85,160 L115,170" stroke={accentColor} strokeWidth="3"/>
                    <circle cx="120" cy="145" r="3" fill={trimColor}/>
                    <path d="M75,130 L110,130 L125,140" stroke={trimColor} strokeWidth="2" fill="none"/>
                </g>
            );
        case 'napoleonic':
            return (
                <g id="jacket-napoleonic" filter="url(#shadow)">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor}/>
                    <path d="M85,135 Q100,130 115,135" stroke={accentColor} strokeWidth="4" fill="none"/>
                    <path d="M85,150 h30" stroke={accentColor} strokeWidth="3"/>
                    <circle cx="90" cy="140" r="2" fill={trimColor}/>
                    <circle cx="110" cy="140" r="2" fill={trimColor}/>
                    <path d="M95,160 h10 v20 h-10 z" fill={trimColor}/>
                </g>
            );
        case 'hussar':
            return (
                <g id="jacket-hussar" filter="url(#shadow)">
                    <path d="M75,130 h50 v55 Q100,195 75,185 z" fill={baseColor}/>
                    <path d="M80,135 Q100,130 120,135" stroke={accentColor} strokeWidth="6" fill="none"/>
                    <path d="M80,150 h40" stroke={accentColor} strokeWidth="2"/>
                    <circle cx="85" cy="140" r="2" fill={trimColor}/>
                    <circle cx="115" cy="140" r="2" fill={trimColor}/>
                </g>
            );
        case 'swiss':
            return (
                <g id="jacket-swiss" filter="url(#shadow)">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor}/>
                    <path d="M85,140 v50 M95,140 v50 M105,140 v50 M115,140 v50" stroke={accentColor} strokeWidth="2"/>
                    <path d="M80,150 h40 M80,160 h40 M80,170 h40" stroke={trimColor} strokeWidth="1"/>
                    <rect x="95" y="135" width="10" height="10" fill={trimColor}/>
                </g>
            );
        case 'zouave':
            return (
                <g id="jacket-zouave" filter="url(#shadow)">
                    <path d="M75,130 h50 v50 h-50 z" fill={baseColor}/>
                    <path d="M75,140 h50 M75,150 h50 M75,160 h50" stroke={accentColor} strokeWidth="3"/>
                    <circle cx="85" cy="135" r="2" fill={trimColor}/>
                    <circle cx="115" cy="135" r="2" fill={trimColor}/>
                    <path d="M90,170 h20 v15 h-20 z" fill={accentColor}/>
                </g>
            );
        case 'highland':
            return (
                <g id="jacket-highland" filter="url(#shadow)">
                    <path d="M75,130 h50 v65 Q100,205 75,195 z" fill={baseColor}/>
                    <path d="M80,135 Q100,125 120,135" stroke={accentColor} strokeWidth="5" fill="none"/>
                    <circle cx="90" cy="145" r="3" fill={trimColor}/>
                    <circle cx="110" cy="145" r="3" fill={trimColor}/>
                    <path d="M85,160 h30" stroke={trimColor} strokeWidth="3"/>
                </g>
            );
        case 'bandsman':
            return (
                <g id="jacket-bandsman" filter="url(#shadow)">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor}/>
                    <path d="M90,135 v60 M110,135 v60" stroke={accentColor} strokeWidth="3"/>
                    <circle cx="85" cy="145" r="2" fill={trimColor}/>
                    <circle cx="115" cy="145" r="2" fill={trimColor}/>
                    <circle cx="85" cy="165" r="2" fill={trimColor}/>
                    <circle cx="115" cy="165" r="2" fill={trimColor}/>
                    <path d="M80,180 h40" stroke={trimColor} strokeWidth="2"/>
                </g>
            );
        default:
            return (
                <g id="jacket-default">
                    <path d="M80,130 h40 v70 h-40 z" fill={baseColor}/>
                </g>
            );
    }
};

// Comprehensive pants rendering with all styles
const Pants = ({ style, colors }) => {
    const baseColor = colors.base || '#ffffff';
    const stripeColor = colors.stripe || '#000080';

    switch (style) {
        case 'plain':
            return (
                <g id="pants-plain" filter="url(#shadow)">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor}/>
                </g>
            );
        case 'stripe':
            return (
                <g id="pants-stripe" filter="url(#shadow)">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M78,200 h2 v60 h-2 z" fill={stripeColor}/>
                    <path d="M103,200 h2 v60 h-2 z" fill={stripeColor}/>
                    <path d="M118,200 h2 v60 h-2 z" fill={stripeColor}/>
                    <path d="M123,200 h2 v60 h-2 z" fill={stripeColor}/>
                </g>
            );
        case 'double_stripe':
            return (
                <g id="pants-double-stripe" filter="url(#shadow)">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M78,200 h1 v60 h-1 z" fill={stripeColor}/>
                    <path d="M81,200 h1 v60 h-1 z" fill={stripeColor}/>
                    <path d="M118,200 h1 v60 h-1 z" fill={stripeColor}/>
                    <path d="M121,200 h1 v60 h-1 z" fill={stripeColor}/>
                </g>
            );
        case 'bloused':
            return (
                <g id="pants-bloused" filter="url(#shadow)">
                    <path d="M78,210 h16 v40 Q94,255 78,250 z" fill={baseColor}/>
                    <path d="M106,210 h16 v40 Q122,255 106,250 z" fill={baseColor}/>
                    <path d="M75,250 h22 v10 h-22 z" fill={baseColor}/>
                    <path d="M103,250 h22 v10 h-22 z" fill={baseColor}/>
                </g>
            );
        case 'riding':
            return (
                <g id="pants-riding" filter="url(#shadow)">
                    <path d="M78,210 h16 v25 Q94,240 78,235 z" fill={baseColor}/>
                    <path d="M106,210 h16 v25 Q122,240 106,235 z" fill={baseColor}/>
                    <path d="M75,235 h22 v25 h-22 z" fill={baseColor}/>
                    <path d="M103,235 h22 v25 h-22 z" fill={baseColor}/>
                    <path d="M76,240 h20 M104,240 h20" stroke={stripeColor} strokeWidth="2"/>
                </g>
            );
        case 'highlander':
            return (
                <g id="pants-kilt" filter="url(#shadow)">
                    <path d="M75,200 h50 v40 Q125,245 100,245 Q75,245 75,240 z" fill={baseColor}/>
                    <path d="M80,210 v30 M85,210 v30 M90,210 v30 M95,210 v30 M105,210 v30 M110,210 v30 M115,210 v30 M120,210 v30" stroke={stripeColor} strokeWidth="1"/>
                    <path d="M75,220 h50 M75,230 h50" stroke={stripeColor} strokeWidth="1"/>
                    <path d="M85,245 h10 v15 h-10 z" fill={baseColor}/>
                    <path d="M105,245 h10 v15 h-10 z" fill={baseColor}/>
                </g>
            );
        case 'dress_blues':
            return (
                <g id="pants-dress-blues" filter="url(#shadow)">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M77,200 h3 v60 h-3 z" fill={stripeColor}/>
                    <path d="M120,200 h3 v60 h-3 z" fill={stripeColor}/>
                </g>
            );
        case 'zouave_pants':
            return (
                <g id="pants-zouave" filter="url(#shadow)">
                    <path d="M78,200 h16 v35 Q94,240 78,235 z" fill={baseColor}/>
                    <path d="M106,200 h16 v35 Q122,240 106,235 z" fill={baseColor}/>
                    <path d="M80,220 h12 M108,220 h12" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M80,230 h12 M108,230 h12" stroke={stripeColor} strokeWidth="2"/>
                </g>
            );
        default:
            return (
                <g id="pants-default">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor}/>
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor}/>
                </g>
            );
    }
};

// Comprehensive shoes rendering
const Shoes = ({ style }) => {
    switch (style) {
        case 'white':
            return (
                <g id="shoes-white" filter="url(#shadow)">
                    <ellipse cx="87" cy="265" rx="8" ry="4" fill="#FFFFFF" stroke="#CCCCCC" strokeWidth="0.5"/>
                    <ellipse cx="113" cy="265" rx="8" ry="4" fill="#FFFFFF" stroke="#CCCCCC" strokeWidth="0.5"/>
                </g>
            );
        case 'black':
            return (
                <g id="shoes-black" filter="url(#shadow)">
                    <ellipse cx="87" cy="265" rx="8" ry="4" fill="#000000"/>
                    <ellipse cx="113" cy="265" rx="8" ry="4" fill="#000000"/>
                </g>
            );
        case 'brown':
            return (
                <g id="shoes-brown" filter="url(#shadow)">
                    <ellipse cx="87" cy="265" rx="8" ry="4" fill="#8B4513"/>
                    <ellipse cx="113" cy="265" rx="8" ry="4" fill="#8B4513"/>
                </g>
            );
        case 'spats':
            return (
                <g id="shoes-spats" filter="url(#shadow)">
                    <ellipse cx="87" cy="265" rx="8" ry="4" fill="#000000"/>
                    <ellipse cx="113" cy="265" rx="8" ry="4" fill="#000000"/>
                    <ellipse cx="87" cy="258" rx="6" ry="8" fill="#FFFFFF"/>
                    <ellipse cx="113" cy="258" rx="6" ry="8" fill="#FFFFFF"/>
                </g>
            );
        case 'boots':
            return (
                <g id="shoes-boots" filter="url(#shadow)">
                    <rect x="79" y="250" width="16" height="18" rx="3" fill="#000000"/>
                    <rect x="105" y="250" width="16" height="18" rx="3" fill="#000000"/>
                    <path d="M81,255 h12 M107,255 h12" stroke="#333333" strokeWidth="0.5"/>
                </g>
            );
        default:
            return (
                <g id="shoes-default">
                    <ellipse cx="87" cy="265" rx="6" ry="4" fill="#FFFFFF"/>
                    <ellipse cx="113" cy="265" rx="6" ry="4" fill="#FFFFFF"/>
                </g>
            );
    }
};

// Comprehensive accessories rendering
const Accessories = ({ style, colors }) => {
    if (style === 'none') return null;
    
    const accessoryColor = colors.accessory || '#ffd700';

    switch (style) {
        case 'gloves':
            return (
                <g id="accessories-gloves">
                    <ellipse cx="70" cy="165" rx="6" ry="4" fill={accessoryColor}/>
                    <ellipse cx="130" cy="165" rx="6" ry="4" fill={accessoryColor}/>
                </g>
            );
        case 'belt':
            return (
                <g id="accessories-belt">
                    <path d="M75,180 h50 v4 h-50 z" fill={accessoryColor}/>
                    <rect x="98" y="178" width="4" height="8" fill={accessoryColor}/>
                </g>
            );
        case 'shoulder_cord':
            return (
                <g id="accessories-shoulder-cord">
                    <path d="M75,140 Q70,150 75,160" stroke={accessoryColor} strokeWidth="3" fill="none"/>
                    <path d="M125,140 Q130,150 125,160" stroke={accessoryColor} strokeWidth="3" fill="none"/>
                </g>
            );
        case 'aiguillettes':
            return (
                <g id="accessories-aiguillettes">
                    <path d="M80,140 Q75,145 80,150 Q75,155 80,160" stroke={accessoryColor} strokeWidth="2" fill="none"/>
                    <path d="M120,140 Q125,145 120,150 Q125,155 120,160" stroke={accessoryColor} strokeWidth="2" fill="none"/>
                    <circle cx="80" cy="140" r="1" fill={accessoryColor}/>
                    <circle cx="120" cy="140" r="1" fill={accessoryColor}/>
                </g>
            );
        case 'gorget':
            return (
                <g id="accessories-gorget">
                    <path d="M85,125 Q100,120 115,125 Q115,135 100,135 Q85,135 85,125" fill={accessoryColor}/>
                    <circle cx="100" cy="130" r="3" fill="#FFFFFF"/>
                </g>
            );
        case 'epaulettes':
            return (
                <g id="accessories-epaulettes">
                    <ellipse cx="80" cy="140" rx="8" ry="4" fill={accessoryColor}/>
                    <ellipse cx="120" cy="140" rx="8" ry="4" fill={accessoryColor}/>
                    <path d="M75,140 h10 M115,140 h10" stroke={accessoryColor} strokeWidth="1"/>
                    <path d="M78,138 v4 M82,138 v4" stroke="#FFFFFF" strokeWidth="0.5"/>
                    <path d="M118,138 v4 M122,138 v4" stroke="#FFFFFF" strokeWidth="0.5"/>
                </g>
            );
        case 'baldric':
            return (
                <g id="accessories-baldric">
                    <path d="M125,135 Q90,160 85,200" stroke={accessoryColor} strokeWidth="8" fill="none"/>
                    <circle cx="120" cy="140" r="3" fill="#FFFFFF"/>
                    <circle cx="90" cy="195" r="3" fill="#FFFFFF"/>
                </g>
            );
        case 'cross_belt':
            return (
                <g id="accessories-cross-belt">
                    <path d="M75,140 L125,190" stroke={accessoryColor} strokeWidth="6" fill="none"/>
                    <path d="M125,140 L75,190" stroke={accessoryColor} strokeWidth="6" fill="none"/>
                    <circle cx="100" cy="165" r="4" fill={accessoryColor}/>
                </g>
            );
        case 'busby_bag':
            return (
                <g id="accessories-busby-bag">
                    <path d="M115,70 Q125,65 125,75 Q125,85 115,80" fill={accessoryColor}/>
                    <path d="M115,75 h8" stroke="#FFFFFF" strokeWidth="1"/>
                </g>
            );
        case 'shako_plate':
            return (
                <g id="accessories-shako-plate">
                    <rect x="95" y="82" width="10" height="6" rx="2" fill={accessoryColor}/>
                    <circle cx="100" cy="85" r="2" fill="#FFFFFF"/>
                </g>
            );
        case 'saber':
            return (
                <g id="accessories-saber">
                    <path d="M125,180 Q135,175 140,180 Q135,185 125,190" fill={accessoryColor}/>
                    <path d="M125,185 L140,200" stroke="#C0C0C0" strokeWidth="2"/>
                </g>
            );
        default:
            return null;
    }
};

const UniformDisplay = ({ uniform, size = 'medium', onClick, showInfo = true }) => {
    // Default uniform structure to prevent errors if uniform is not properly set
    const defaultUniform = {
        name: 'Standard Uniform',
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'classic', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
        accessories: { style: 'none', colors: { accessory: '#ffd700' } }
    };
    
    // Deep merge logic to ensure all parts of the uniform have default values
    const currentUniform = { ...defaultUniform, ...(uniform || {}) };
    currentUniform.headwear = { ...defaultUniform.headwear, ...(uniform?.headwear || {}) };
    currentUniform.headwear.colors = { ...defaultUniform.headwear.colors, ...(uniform?.headwear?.colors || {}) };
    currentUniform.plume = { ...defaultUniform.plume, ...(uniform?.plume || {}) };
    currentUniform.plume.colors = { ...defaultUniform.plume.colors, ...(uniform?.plume?.colors || {}) };
    currentUniform.jacket = { ...defaultUniform.jacket, ...(uniform?.jacket || {}) };
    currentUniform.jacket.colors = { ...defaultUniform.jacket.colors, ...(uniform?.jacket?.colors || {}) };
    currentUniform.pants = { ...defaultUniform.pants, ...(uniform?.pants || {}) };
    currentUniform.pants.colors = { ...defaultUniform.pants.colors, ...(uniform?.pants?.colors || {}) };
    currentUniform.shoes = { ...defaultUniform.shoes, ...(uniform?.shoes || {}) };
    currentUniform.accessories = { ...defaultUniform.accessories, ...(uniform?.accessories || {}) };
    currentUniform.accessories.colors = { ...defaultUniform.accessories.colors, ...(uniform?.accessories?.colors || {}) };
    
    // Dynamic sizing
    const sizeClasses = {
        small: 'w-24 h-36',
        medium: 'w-48 h-80',
        large: 'w-64 h-96'
    };
    const viewBox = size === 'small' ? '0 0 150 200' : '0 0 200 300';
    const sizeClass = sizeClasses[size] || sizeClasses.medium;
    
    return (
        <div 
            className={`${sizeClass} bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-theme flex justify-center items-center p-2 relative overflow-hidden flex-shrink-0 border-2 border-accent dark:border-accent-dark shadow-xl ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
            onClick={onClick}
        >
            <svg viewBox={viewBox} className="w-full h-full">
                <defs>
                    <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{stopColor: currentUniform.skinTone, stopOpacity: 1}} />
                        <stop offset="100%" style={{stopColor: currentUniform.skinTone, stopOpacity: 0.8}} />
                    </linearGradient>
                    <filter id="shadow">
                        <dropShadow dx="1" dy="1" stdDeviation="0.5" floodColor="rgba(0,0,0,0.3)"/>
                    </filter>
                </defs>
                
                {/* Body Base with realistic proportions */}
                <g id="body">
                    <ellipse cx="100" cy="100" rx="18" ry="22" fill="url(#bodyGradient)" />
                    <rect x="92" y="118" width="16" height="20" fill={currentUniform.skinTone} rx="3" />
                    <ellipse cx="70" cy="165" rx="8" ry="6" fill={currentUniform.skinTone} />
                    <ellipse cx="130" cy="165" rx="8" ry="6" fill={currentUniform.skinTone} />
                </g>

                {/* Uniform Pieces - Render in correct order (back to front) */}
                <Shoes style={currentUniform.shoes.style} />
                <Pants style={currentUniform.pants.style} colors={currentUniform.pants.colors} />
                <Jacket style={currentUniform.jacket.style} colors={currentUniform.jacket.colors} />
                <Accessories style={currentUniform.accessories?.style || 'none'} colors={currentUniform.accessories?.colors || {}} />
                <Headwear style={currentUniform.headwear.style} colors={currentUniform.headwear.colors} />
                <Plume style={currentUniform.plume.style} colors={currentUniform.plume.colors} />
            </svg>
            
            {/* Uniform info overlay */}
            {showInfo && (
                <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs p-1 rounded text-center backdrop-blur-sm">
                    {currentUniform.name || 'Custom Uniform'}
                </div>
            )}
        </div>
    );
};

export default UniformDisplay;