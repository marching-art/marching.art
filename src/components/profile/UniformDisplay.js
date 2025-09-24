// src/components/profile/UniformDisplay.js
// Hyper-boosted uniform display with comprehensive DCI-inspired accuracy
import React from 'react';

// Detailed jacket component with many more historical styles
const Jacket = ({ style, colors }) => {
    const baseColor = colors.base || '#000080';
    const accentColor = colors.accent || '#ffffff';
    const trimColor = colors.trim || '#ffd700';

    switch (style) {
        case 'double_breast':
            return (
                <g id="jacket-double-breast" filter="url(#shadow)">
                    <path d="M70,135 h60 v75 l-5,5 h-50 l-5,-5 z" fill={baseColor} stroke={trimColor} strokeWidth="1"/>
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
                <g id="jacket-sash">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor} />
                    <path d="M75,130 L125,200" stroke={accentColor} strokeWidth="12" />
                    <path d="M75,140 h50" stroke={trimColor} strokeWidth="4" />
                    <circle cx="75" cy="140" r="2" fill={trimColor}/>
                    <circle cx="125" cy="140" r="2" fill={trimColor}/>
                </g>
            );
        case 'cadet':
            return (
                <g id="jacket-cadet">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor} />
                    <path d="M75,130 L100,200 L125,130" stroke={accentColor} strokeWidth="12" fill="none" />
                    <circle cx="100" cy="135" r="5" fill={trimColor} />
                    <circle cx="85" cy="145" r="2" fill={trimColor}/>
                    <circle cx="115" cy="145" r="2" fill={trimColor}/>
                </g>
            );
        case 'modern':
            return (
                <g id="jacket-modern">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor} />
                    <path d="M75,130 Q 100,160 75,200" stroke={accentColor} strokeWidth="8" fill="none" />
                    <path d="M125,130 L100,200" stroke={trimColor} strokeWidth="3" fill="none" />
                    <rect x="95" y="130" width="10" height="8" fill={trimColor}/>
                </g>
            );
        case 'napoleonic':
            return (
                <g id="jacket-napoleonic" filter="url(#shadow)">
                    <path d="M70,135 h60 v75 h-60 z" fill={baseColor}/>
                    <path d="M75,140 Q100,150 125,140" stroke={accentColor} strokeWidth="6" fill="none"/>
                    <path d="M75,150 Q100,160 125,150" stroke={accentColor} strokeWidth="6" fill="none"/>
                    <path d="M75,160 Q100,170 125,160" stroke={accentColor} strokeWidth="6" fill="none"/>
                    <circle cx="85" cy="145" r="1.5" fill={trimColor}/>
                    <circle cx="115" cy="145" r="1.5" fill={trimColor}/>
                    <rect x="95" y="135" width="10" height="10" fill={trimColor}/>
                </g>
            );
        case 'hussar':
            return (
                <g id="jacket-hussar" filter="url(#shadow)">
                    <path d="M70,135 h60 v75 h-60 z" fill={baseColor}/>
                    <path d="M75,140 h50" stroke={accentColor} strokeWidth="3"/>
                    <path d="M75,145 h50" stroke={accentColor} strokeWidth="3"/>
                    <path d="M75,150 h50" stroke={accentColor} strokeWidth="3"/>
                    <path d="M75,155 h50" stroke={accentColor} strokeWidth="3"/>
                    <path d="M75,160 h50" stroke={accentColor} strokeWidth="3"/>
                    <circle cx="80" cy="142" r="1" fill={trimColor}/>
                    <circle cx="120" cy="142" r="1" fill={trimColor}/>
                    <path d="M72,135 v15 h3 v-15 z" fill={trimColor}/>
                    <path d="M125,135 v15 h3 v-15 z" fill={trimColor}/>
                </g>
            );
        case 'zouave':
            return (
                <g id="jacket-zouave" filter="url(#shadow)">
                    <path d="M75,135 h50 v50 h-50 z" fill={baseColor}/>
                    <path d="M75,135 Q100,140 125,135" stroke={accentColor} strokeWidth="4" fill="none"/>
                    <path d="M75,145 Q100,150 125,145" stroke={accentColor} strokeWidth="4" fill="none"/>
                    <path d="M75,155 Q100,160 125,155" stroke={accentColor} strokeWidth="4" fill="none"/>
                    <circle cx="90" cy="140" r="2" fill={trimColor}/>
                    <circle cx="110" cy="140" r="2" fill={trimColor}/>
                </g>
            );
        case 'highland':
            return (
                <g id="jacket-highland" filter="url(#shadow)">
                    <path d="M75,135 h50 v60 h-50 z" fill={baseColor}/>
                    <path d="M100,135 v60" stroke={accentColor} strokeWidth="6"/>
                    <path d="M85,140 h30" stroke={trimColor} strokeWidth="2"/>
                    <circle cx="80" cy="145" r="2" fill={trimColor}/>
                    <circle cx="120" cy="145" r="2" fill={trimColor}/>
                    <path d="M75,180 h50" stroke={trimColor} strokeWidth="3"/>
                </g>
            );
        case 'swiss':
            return (
                <g id="jacket-swiss" filter="url(#shadow)">
                    <path d="M75,135 h50 v75 h-50 z" fill={baseColor}/>
                    <path d="M85,140 v50 h5 v-50 z" fill={accentColor}/>
                    <path d="M110,140 v50 h5 v-50 z" fill={accentColor}/>
                    <path d="M95,145 h10 v3 h-10 z" fill={trimColor}/>
                    <path d="M95,155 h10 v3 h-10 z" fill={trimColor}/>
                    <path d="M95,165 h10 v3 h-10 z" fill={trimColor}/>
                </g>
            );
        case 'bandsman':
            return (
                <g id="jacket-bandsman" filter="url(#shadow)">
                    <path d="M75,135 h50 v75 h-50 z" fill={baseColor}/>
                    <path d="M100,135 v75" stroke={accentColor} strokeWidth="6"/>
                    <path d="M85,140 h30" stroke={trimColor} strokeWidth="2"/>
                    <path d="M85,150 h30" stroke={trimColor} strokeWidth="2"/>
                    <circle cx="90" cy="145" r="2" fill={trimColor}/>
                    <circle cx="110" cy="145" r="2" fill={trimColor}/>
                </g>
            );
        case 'classic':
        default:
            return (
                <g id="jacket-classic">
                    <path d="M75,130 h50 v70 h-50 z" fill={baseColor} />
                    <path d="M100,130 v70" stroke={accentColor} strokeWidth="4" />
                    <path d="M80,135 h3" stroke={trimColor} strokeWidth="2" />
                    <path d="M80,145 h3" stroke={trimColor} strokeWidth="2" />
                    <circle cx="85" cy="145" r="2" fill={trimColor}/>
                    <circle cx="85" cy="155" r="2" fill={trimColor}/>
                    <path d="M75,130 h50" stroke={trimColor} strokeWidth="2"/>
                </g>
            );
    }
};

// Detailed pants component with historical accuracy
const Pants = ({ style, colors }) => {
    const baseColor = colors.base || '#ffffff';
    const stripeColor = colors.stripe || '#000080';

    switch (style) {
        case 'stripe':
            return (
                <g id="pants-stripe">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor} />
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor} />
                    <path d="M82,200 v60" stroke={stripeColor} strokeWidth="4" />
                    <path d="M118,200 v60" stroke={stripeColor} strokeWidth="4" />
                </g>
            );
        case 'double_stripe':
            return (
                <g id="pants-double-stripe" filter="url(#shadow)">
                    <path d="M78,210 h16 v55 h-16 z" fill={baseColor}/>
                    <path d="M106,210 h16 v55 h-16 z" fill={baseColor}/>
                    <path d="M80,210 v55" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M82,210 v55" stroke={stripeColor} strokeWidth="1"/>
                    <path d="M120,210 v55" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M118,210 v55" stroke={stripeColor} strokeWidth="1"/>
                </g>
            );
        case 'highlander':
            return (
                <g id="pants-kilt" filter="url(#shadow)">
                    <path d="M75,210 h50 v25 L100,250 z" fill={baseColor}/>
                    <path d="M80,215 v30" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M90,215 v30" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M110,215 v30" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M120,215 v30" stroke={stripeColor} strokeWidth="2"/>
                    <path d="M78,250 h16 v15 h-16 z" fill={baseColor}/>
                    <path d="M106,250 h16 v15 h-16 z" fill={baseColor}/>
                </g>
            );
        case 'zouave':
            return (
                <g id="pants-zouave" filter="url(#shadow)">
                    <path d="M75,210 h25 v35 h-25 z" fill={baseColor}/>
                    <path d="M100,210 h25 v35 h-25 z" fill={baseColor}/>
                    <path d="M75,245 h25 v-10 a10,5 0 0,0 -25,0 z" fill={stripeColor}/>
                    <path d="M100,245 h25 v-10 a10,5 0 0,0 -25,0 z" fill={stripeColor}/>
                </g>
            );
        case 'bloused':
            return (
                <g id="pants-bloused" filter="url(#shadow)">
                    <path d="M78,210 h16 v45 h-16 z" fill={baseColor}/>
                    <path d="M106,210 h16 v45 h-16 z" fill={baseColor}/>
                    <path d="M75,255 h22 v10 h-22 z" fill={baseColor}/>
                    <path d="M103,255 h22 v10 h-22 z" fill={baseColor}/>
                </g>
            );
        case 'riding':
            return (
                <g id="pants-riding" filter="url(#shadow)">
                    <path d="M78,210 h16 v30 a8,8 0 0,1 -16,0 z" fill={baseColor}/>
                    <path d="M106,210 h16 v30 a8,8 0 0,1 -16,0 z" fill={baseColor}/>
                    <path d="M75,240 h22 v25 h-22 z" fill={baseColor}/>
                    <path d="M103,240 h22 v25 h-22 z" fill={baseColor}/>
                </g>
            );
        case 'plain':
        default:
            return (
                <g id="pants-plain">
                    <path d="M80,200 h15 v60 h-15 z" fill={baseColor} />
                    <path d="M105,200 h15 v60 h-15 z" fill={baseColor} />
                </g>
            );
    }
};

// Comprehensive headwear with many DCI-inspired styles
const Headwear = ({ style, colors }) => {
    if (style === 'none') return null;
    
    const hatColor = colors.hat || '#1a1a1a';
    const trimColor = colors.trim || '#ffffff';

    switch (style) {
        case 'aussie':
            return <path id="head-aussie" d="M80,85 a20,10 0 0,1 40,0 l-5, -10 l-30,0 z" fill={hatColor} stroke={trimColor} strokeWidth="1.5" />;
        case 'helmet':
            return <path id="head-helmet" d="M80,95 a20,20 0 0,1 40,0 v-15 a20,20 0 0,1 -40,0 z" fill={hatColor} stroke={trimColor} strokeWidth="1.5" />;
        case 'busby':
            return (
                <g id="head-busby">
                    <rect x="82" y="65" width="36" height="30" rx="5" fill={hatColor} stroke={trimColor} strokeWidth="1.5" />
                    <path d="M82,80 h36" stroke={trimColor} strokeWidth="1"/>
                </g>
            );
        case 'beret':
            return (
                <g id="head-beret" filter="url(#shadow)">
                    <ellipse cx="100" cy="80" rx="20" ry="8" fill={hatColor}/>
                    <circle cx="100" cy="80" r="2" fill={trimColor}/>
                </g>
            );
        case 'garrison':
            return (
                <g id="head-garrison" filter="url(#shadow)">
                    <path d="M85,82 h30 v8 h-30 z" fill={hatColor}/>
                    <path d="M80,90 h40 v3 h-40 z" fill={trimColor}/>
                </g>
            );
        case 'kepi':
            return (
                <g id="head-kepi" filter="url(#shadow)">
                    <path d="M85,80 h30 v15 l-15,5 l-15,-5 z" fill={hatColor}/>
                    <path d="M85,80 h30" stroke={trimColor} strokeWidth="2"/>
                    <circle cx="100" cy="87" r="2" fill={trimColor}/>
                </g>
            );
        case 'czapka':
            return (
                <g id="head-czapka" filter="url(#shadow)">
                    <path d="M85,80 h30 v10 a15,5 0 0,1 -30,0 z" fill={hatColor}/>
                    <rect x="95" y="75" width="10" height="8" fill={trimColor}/>
                </g>
            );
        case 'bicorne':
            return (
                <g id="head-bicorne" filter="url(#shadow)">
                    <path d="M85,85 a15,5 0 0,1 30,0 L115,78 L100,83 L85,78 z" fill={hatColor}/>
                    <path d="M85,85 a15,5 0 0,1 30,0" stroke={trimColor} strokeWidth="1"/>
                </g>
            );
        case 'tricorne':
            return (
                <g id="head-tricorne" filter="url(#shadow)">
                    <path d="M80,90 L100,70 L120,90 L100,85 z" fill={hatColor}/>
                    <path d="M80,90 L100,70 L120,90" stroke={trimColor} strokeWidth="1.5" fill="none"/>
                </g>
            );
        case 'mirliton':
            return (
                <g id="head-mirliton" filter="url(#shadow)">
                    <path d="M88,75 h24 v15 a12,5 0 0,1 -24,0 z" fill={hatColor}/>
                    <path d="M95,70 h10 v8 h-10 z" fill={trimColor}/>
                    <circle cx="100" cy="82" r="2" fill={trimColor}/>
                </g>
            );
        case 'shako':
        default:
            return (
                <g id="head-shako">
                    <path d="M85,75 h30 v20 h-30 z" fill={hatColor} stroke={trimColor} strokeWidth="1.5" />
                    <path d="M85,75 h30" stroke={trimColor} strokeWidth="2"/>
                    <circle cx="100" cy="85" r="3" fill={trimColor}/>
                </g>
            );
    }
};

// Comprehensive plume styles
const Plume = ({ style, colors }) => {
    if (style === 'none') return null;
    
    const plumeColor = colors.plume || '#ff0000';
    
    switch (style) {
        case 'feather':
            return (
                <g id="plume-feather" filter="url(#shadow)">
                    <path d="M100,75 C 110,50 115,40 100,30" fill="none" stroke={plumeColor} strokeWidth="4" />
                    <path d="M105,65 l5,-10 M105,60 l5,-10 M105,55 l5,-10" stroke={plumeColor} strokeWidth="1"/>
                </g>
            );
        case 'mohawk':
            return (
                <g id="plume-mohawk" filter="url(#shadow)">
                    <path d="M85,70 h30 v-10 a15,10 0 0,0 -30,0 z" fill={plumeColor} />
                    <path d="M90,65 v-5 M95,65 v-8 M100,65 v-10 M105,65 v-8 M110,65 v-5" stroke={plumeColor} strokeWidth="2"/>
                </g>
            );
        case 'hackle':
            return (
                <g id="plume-hackle" filter="url(#shadow)">
                    <path d="M95,75 v-25 M100,75 v-30 M105,75 v-25" stroke={plumeColor} strokeWidth="3"/>
                    <path d="M97,60 l6,-8 M103,55 l6,-8" stroke={plumeColor} strokeWidth="1"/>
                </g>
            );
        case 'pompom':
            return (
                <g id="plume-pompom" filter="url(#shadow)">
                    <circle cx="100" cy="65" r="8" fill={plumeColor}/>
                    <circle cx="95" cy="62" r="2" fill="rgba(255,255,255,0.3)"/>
                </g>
            );
        case 'cascade':
            return (
                <g id="plume-cascade" filter="url(#shadow)">
                    <path d="M100,75 C 85,45 90,35 80,25 M100,75 C 95,40 100,30 85,20 M100,75 C 105,40 100,30 115,20 M100,75 C 115,45 110,35 120,25" stroke={plumeColor} strokeWidth="2" fill="none"/>
                </g>
            );
        case 'rooster':
            return (
                <g id="plume-rooster" filter="url(#shadow)">
                    <path d="M100,75 C 120,50 125,40 110,30" fill="none" stroke={plumeColor} strokeWidth="5"/>
                    <path d="M100,75 C 80,50 75,40 90,30" fill="none" stroke={plumeColor} strokeWidth="5"/>
                    <path d="M100,75 v-25" stroke={plumeColor} strokeWidth="5"/>
                </g>
            );
        case 'ostrich':
            return (
                <g id="plume-ostrich" filter="url(#shadow)">
                    <path d="M100,75 Q 85,55 90,35 Q 95,15 85,5" stroke={plumeColor} strokeWidth="6" fill="none"/>
                    <path d="M100,75 Q 115,55 110,35 Q 105,15 115,5" stroke={plumeColor} strokeWidth="6" fill="none"/>
                </g>
            );
        case 'dyed_tips':
            return (
                <g id="plume-dyed-tips" filter="url(#shadow)">
                    <path d="M100,75 C 90,50 95,40 85,30 M100,75 C 110,50 105,40 115,30 M100,75 v-20" stroke={plumeColor} strokeWidth="3" fill="none"/>
                    <circle cx="85" cy="30" r="3" fill="#FFD700"/>
                    <circle cx="115" cy="30" r="3" fill="#FFD700"/>
                    <circle cx="100" cy="55" r="3" fill="#FFD700"/>
                </g>
            );
        case 'panache':
            return (
                <g id="plume-panache" filter="url(#shadow)">
                    <path d="M100,75 C 80,40 85,30 75,20 M100,75 C 90,45 95,35 85,25 M100,75 C 110,45 105,35 115,25 M100,75 C 120,40 115,30 125,20" stroke={plumeColor} strokeWidth="3" fill="none"/>
                </g>
            );
        case 'macaroni':
            return (
                <g id="plume-macaroni" filter="url(#shadow)">
                    <path d="M100,75 Q 120,60 125,35 Q 120,15 130,5" stroke={plumeColor} strokeWidth="4" fill="none"/>
                    <path d="M100,75 Q 115,50 120,30" stroke={plumeColor} strokeWidth="3" fill="none"/>
                </g>
            );
        case 'fountain':
        default:
            return (
                <g id="plume-fountain" filter="url(#shadow)">
                    <path d="M100,75 C 90,50 95,40 85,30 M100,75 C 110,50 105,40 115,30 M100,75 v-20" stroke={plumeColor} strokeWidth="3" fill="none" />
                    <path d="M100,75 C 95,45 100,35 90,25 M100,75 C 105,45 100,35 110,25" stroke={plumeColor} strokeWidth="2" fill="none"/>
                </g>
            );
    }
};

// Comprehensive shoe styles
const Shoes = ({ style }) => {
    const getShoeColor = (style) => {
        switch (style) {
            case 'white': return '#FFFFFF';
            case 'brown': return '#8B4513';
            case 'combat': return '#2F4F4F';
            case 'cavalry': return '#654321';
            case 'dress': return '#000000';
            case 'black':
            default: return '#1a1a1a';
        }
    };
    
    const color = getShoeColor(style);
    
    if (style === 'spats') {
        return (
            <g id="shoes-spats" filter="url(#shadow)">
                <path d="M78,260 h18 v15 h-18 z" fill="#1a1a1a"/>
                <path d="M104,260 h18 v15 h-18 z" fill="#1a1a1a"/>
                <path d="M78,260 h18 v8 h-18 z" fill="#FFFFFF"/>
                <path d="M104,260 h18 v8 h-18 z" fill="#FFFFFF"/>
                <circle cx="87" cy="264" r="1" fill="#000000"/>
                <circle cx="113" cy="264" r="1" fill="#000000"/>
            </g>
        );
    }
    
    if (style === 'cavalry') {
        return (
            <g id="shoes-cavalry" filter="url(#shadow)">
                <path d="M78,250 h18 v25 h-18 z" fill={color}/>
                <path d="M104,250 h18 v25 h-18 z" fill={color}/>
                <path d="M78,260 h18" stroke="#8B4513" strokeWidth="1"/>
                <path d="M104,260 h18" stroke="#8B4513" strokeWidth="1"/>
                <circle cx="87" cy="255" r="1" fill="#FFD700"/>
                <circle cx="113" cy="255" r="1" fill="#FFD700"/>
            </g>
        );
    }
    
    if (style === 'combat') {
        return (
            <g id="shoes-combat" filter="url(#shadow)">
                <path d="M78,258 h18 v17 h-18 z" fill={color}/>
                <path d="M104,258 h18 v17 h-18 z" fill={color}/>
                <path d="M78,265 h18 M78,270 h18" stroke="#666666" strokeWidth="0.5"/>
                <path d="M104,265 h18 M104,270 h18" stroke="#666666" strokeWidth="0.5"/>
            </g>
        );
    }
    
    if (style === 'hessian') {
        return (
            <g id="shoes-hessian" filter="url(#shadow)">
                <path d="M78,245 h18 v30 h-18 z" fill={color}/>
                <path d="M104,245 h18 v30 h-18 z" fill={color}/>
                <path d="M87,245 v10" stroke="#FFD700" strokeWidth="2"/>
                <path d="M113,245 v10" stroke="#FFD700" strokeWidth="2"/>
                <circle cx="87" cy="250" r="2" fill="#FFD700"/>
                <circle cx="113" cy="250" r="2" fill="#FFD700"/>
            </g>
        );
    }
    
    return (
        <g id="shoes-standard" filter="url(#shadow)">
            <path d="M80,260 h15 v10 h-15 z" fill={color} />
            <path d="M105,260 h15 v10 h-15 z" fill={color} />
        </g>
    );
};

// Accessories component for additional details
const Accessories = ({ style, colors }) => {
    if (style === 'none') return null;
    
    const accessoryColor = colors.accessory || '#FFD700';
    
    switch (style) {
        case 'gloves':
            return (
                <g id="accessories-gloves">
                    <ellipse cx="70" cy="165" rx="6" ry="4" fill="#FFFFFF"/>
                    <ellipse cx="130" cy="165" rx="6" ry="4" fill="#FFFFFF"/>
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
                    <path d="M75,140 Q 70,150 75,160" stroke={accessoryColor} strokeWidth="3" fill="none"/>
                    <path d="M125,140 Q 130,150 125,160" stroke={accessoryColor} strokeWidth="3" fill="none"/>
                </g>
            );
        case 'aiguillettes':
            return (
                <g id="accessories-aiguillettes">
                    <path d="M80,140 Q 75,145 80,150 Q 75,155 80,160" stroke={accessoryColor} strokeWidth="2" fill="none"/>
                    <path d="M120,140 Q 125,145 120,150 Q 125,155 120,160" stroke={accessoryColor} strokeWidth="2" fill="none"/>
                </g>
            );
        case 'gorget':
            return (
                <g id="accessories-gorget">
                    <path d="M85,125 Q 100,120 115,125 Q 115,135 100,135 Q 85,135 85,125" fill={accessoryColor}/>
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
                    <path d="M125,135 Q 90,160 85,200" stroke={accessoryColor} strokeWidth="8" fill="none"/>
                    <circle cx="120" cy="140" r="3" fill="#FFFFFF"/>
                    <circle cx="90" cy="195" r="3" fill="#FFFFFF"/>
                </g>
            );
        case 'shako_plate':
            return (
                <g id="accessories-shako-plate">
                    <rect x="95" y="82" width="10" height="6" rx="2" fill={accessoryColor}/>
                    <circle cx="100" cy="85" r="2" fill="#FFFFFF"/>
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

                {/* Uniform Pieces */}
                <Jacket style={currentUniform.jacket.style} colors={currentUniform.jacket.colors} />
                <Pants style={currentUniform.pants.style} colors={currentUniform.pants.colors} />
                <Shoes style={currentUniform.shoes.style} />
                <Headwear style={currentUniform.headwear.style} colors={currentUniform.headwear.colors} />
                <Plume style={currentUniform.plume.style} colors={currentUniform.plume.colors} />
                <Accessories style={currentUniform.accessories?.style || 'none'} colors={currentUniform.accessories?.colors || {}} />
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