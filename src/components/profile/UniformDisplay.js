import React from 'react';

// This component is now responsible for rendering the SVG avatar based on the uniform object.
// Each part of the uniform is a separate component for clarity.

const Jacket = ({ style, colors }) => {
    switch (style) {
        case 'sash':
            return (
                <g id="jacket-sash">
                    <path d="M75,130 h50 v70 h-50 z" fill={colors.base} />
                    <path d="M75,130 L125,200" stroke={colors.accent} strokeWidth="12" />
                    <path d="M75,140 h50" stroke={colors.trim} strokeWidth="4" />
                </g>
            );
        case 'cadet':
            return (
                <g id="jacket-cadet">
                    <path d="M75,130 h50 v70 h-50 z" fill={colors.base} />
                    <path d="M75,130 L100,200 L125,130" stroke={colors.accent} strokeWidth="12" fill="none" />
                    <circle cx="100" cy="135" r="5" fill={colors.trim} />
                </g>
            );
        case 'modern':
             return (
                <g id="jacket-modern">
                    <path d="M75,130 h50 v70 h-50 z" fill={colors.base} />
                    <path d="M75,130 Q 100,160 75,200" stroke={colors.accent} strokeWidth="8" fill="none" />
                     <path d="M125,130 L100,200" stroke={colors.trim} strokeWidth="3" fill="none" />
                </g>
            );
        case 'classic':
        default:
            return (
                <g id="jacket-classic">
                    <path d="M75,130 h50 v70 h-50 z" fill={colors.base} />
                    <path d="M100,130 v70" stroke={colors.accent} strokeWidth="4" />
                    <path d="M80,135 h3" stroke={colors.trim} strokeWidth="2" />
                    <path d="M80,145 h3" stroke={colors.trim} strokeWidth="2" />
                </g>
            );
    }
};

const Pants = ({ style, colors }) => {
     switch (style) {
        case 'stripe':
            return (
                <g id="pants-stripe">
                    <path d="M80,200 h15 v60 h-15 z" fill={colors.base} />
                    <path d="M105,200 h15 v60 h-15 z" fill={colors.base} />
                    <path d="M82,200 v60" stroke={colors.stripe} strokeWidth="4" />
                    <path d="M118,200 v60" stroke={colors.stripe} strokeWidth="4" />
                </g>
            );
        case 'plain':
        default:
             return (
                <g id="pants-plain">
                    <path d="M80,200 h15 v60 h-15 z" fill={colors.base} />
                    <path d="M105,200 h15 v60 h-15 z" fill={colors.base} />
                </g>
            );
     }
};

const Headwear = ({ style, colors }) => {
    if (style === 'none') return null;
    switch (style) {
        case 'aussie':
             return <path id="head-aussie" d="M80,85 a20,10 0 0,1 40,0 l-5, -10 l-30,0 z" fill={colors.hat} stroke={colors.trim} strokeWidth="1.5" />;
        case 'helmet':
            return <path id="head-helmet" d="M80,95 a20,20 0 0,1 40,0 v-15 a20,20 0 0,1 -40,0 z" fill={colors.hat} stroke={colors.trim} strokeWidth="1.5" />;
        case 'busby':
            return <rect id="head-busby" x="82" y="65" width="36" height="30" rx="5" fill={colors.hat} stroke={colors.trim} strokeWidth="1.5" />;
        case 'shako':
        default:
            return <path id="head-shako" d="M85,75 h30 v20 h-30 z" fill={colors.hat} stroke={colors.trim} strokeWidth="1.5" />;
    }
};

const Plume = ({ style, colors }) => {
     if (style === 'none') return null;
     switch (style) {
        case 'feather':
            return <path id="plume-feather" d="M100,75 C 110,50 115,40 100,30" fill="none" stroke={colors.plume} strokeWidth="4" />;
        case 'mohawk':
            return <path id="plume-mohawk" d="M85,70 h30 v-10 a15,10 0 0,0 -30,0 z" fill={colors.plume} />;
        case 'fountain':
        default:
            return <path id="plume-fountain" d="M100,75 C 90,50 95,40 85,30 M100,75 C 110,50 105,40 115,30 M100,75 v-20" stroke={colors.plume} strokeWidth="3" fill="none" />;
     }
};

const Shoes = ({ style }) => {
    const color = style === 'white' ? '#FFFFFF' : '#1a1a1a';
    return (
        <g id="shoes">
            <path d="M80,260 h15 v10 h-15 z" fill={color} />
            <path d="M105,260 h15 v10 h-15 z" fill={color} />
        </g>
    );
};


const UniformDisplay = ({ uniform }) => {
    // Default uniform structure to prevent errors if profile.uniform is not set
    const defaultUniform = {
      skinTone: '#d8aa7c',
      headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
      plume: { style: 'fountain', colors: { plume: '#ff0000' } },
      jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
      pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
      shoes: { style: 'white' },
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
    
    return (
        <div className="w-48 h-80 bg-background dark:bg-background-dark rounded-theme flex justify-center items-center p-2 relative overflow-hidden flex-shrink-0 border-theme border-accent dark:border-accent-dark">
            <svg viewBox="0 0 200 300" className="w-full h-full">
                {/* Body Base */}
                <g id="body">
                    <circle cx="100" cy="100" r="15" fill={currentUniform.skinTone} />
                    <rect x="95" y="115" width="10" height="15" fill={currentUniform.skinTone} />
                    <circle cx="70" cy="165" r="5" fill={currentUniform.skinTone} />
                    <circle cx="130" cy="165" r="5" fill={currentUniform.skinTone} />
                </g>

                {/* Uniform Pieces */}
                <Jacket style={currentUniform.jacket.style} colors={currentUniform.jacket.colors} />
                <Pants style={currentUniform.pants.style} colors={currentUniform.pants.colors} />
                <Shoes style={currentUniform.shoes.style} />
                <Headwear style={currentUniform.headwear.style} colors={currentUniform.headwear.colors} />
                <Plume style={currentUniform.plume.style} colors={currentUniform.plume.colors} />
            </svg>
        </div>
    );
};
export default UniformDisplay;