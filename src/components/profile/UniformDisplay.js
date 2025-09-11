import React from 'react';

// --- SVG Components for different uniform parts ---

const Skin = ({ color }) => (
    <g id="skin">
        <path d="M100,50 Q90,40 80,50 L80,60 Q90,70 100,60 Z" fill={color} />
        <path d="M100,90 v40 h-10 v-40" fill={color} />
        <path d="M120,90 v40 h-10 v-40" fill={color} />
    </g>
);

const Headwear = ({ style, primaryColor, secondaryColor, plumeColor }) => {
    const styles = {
        shako: (
            <g id="shako">
                <path d="M85,30 h30 v20 h-30 Z" fill={primaryColor} />
                <path d="M82,50 h36 v5 h-36 Z" fill={secondaryColor} />
                <path d="M98,5 a1 1 0 0 0 0 25 a1 1 0 0 0 0-25" fill={plumeColor} />
            </g>
        ),
        aussie: (
            <g id="aussie">
                <path d="M70,45 Q100,25 130,45 L115,50 L85,50 Z" fill={primaryColor} />
                <path d="M70,45 Q75,50 85,50" fill={secondaryColor} />
                 <path d="M98,20 a1 1 0 0 0 0 25 a1 1 0 0 0 0-25" fill={plumeColor} />
            </g>
        ),
        helmet: (
             <g id="helmet">
                <path d="M80,30 Q100,20 120,30 v15 h-40 Z" fill={primaryColor} />
                <path d="M98,5 a1 1 0 0 0 0 25 a1 1 0 0 0 0-25" fill={plumeColor} />
            </g>
        ),
        none: null
    };
    return styles[style] || null;
};

const Jacket = ({ style, primaryColor, secondaryColor }) => {
     const styles = {
        traditional: <path d="M85,70 v50 h30 v-50 a15 10 0 0 0 -30 0" fill={primaryColor} />,
        cadet: <path d="M85,70 v30 h30 v-30 a15 10 0 0 0 -30 0" fill={primaryColor} />,
        asymmetrical: (
            <>
                <path d="M85,70 v50 h30 v-50 a15 10 0 0 0 -30 0" fill={primaryColor} />
                <path d="M100,70 L115,120 L115,70 Z" fill={secondaryColor} />
            </>
        )
    };
    return <g id="jacket-style">{styles[style]}</g> || null;
};

const JacketAccessory = ({ style, primaryColor, secondaryColor }) => {
    const styles = {
        sash: <path d="M85,70 L115,110 L110, 115 L80,75 Z" fill={primaryColor} />,
        baldric: <path d="M115,70 L85,110 L90, 115 L120,75 Z" fill={primaryColor} />,
        sequins: (
            <>
                <circle cx="95" cy="80" r="1.5" fill={secondaryColor} />
                <circle cx="105" cy="80" r="1.5" fill={secondaryColor} />
                <circle cx="95" cy="95" r="1.5" fill={secondaryColor} />
                <circle cx="105" cy="95" r="1.5" fill={secondaryColor} />
            </>
        ),
        none: null
    };
    return <g id="jacket-accessory">{styles[style]}</g> || null;
};


const Pants = ({ style, primaryColor, secondaryColor }) => {
     const styles = {
        standard: <path d="M85,120 v60 h30 v-60 Z" fill={primaryColor} />,
        stripe: (
            <>
                <path d="M85,120 v60 h30 v-60 Z" fill={primaryColor} />
                <path d="M98,120 v60 h4 v-60 Z" fill={secondaryColor} />
            </>
        )
    };
     return <g id="pants">{styles[style]}</g> || null;
};

const Shoes = ({ style, primaryColor }) => {
    const styles = {
        standard: <path d="M85,180 v10 h30 v-10 Z" fill={primaryColor} />
    };
    return <g id="shoes">{styles[style]}</g> || null;
}


const UniformDisplay = ({ uniform }) => {
    // Default uniform if none is provided
    const displayUniform = uniform || {
        skinTone: '#C68642',
        headwearStyle: 'shako',
        headwearColor1: '#1a202c',
        headwearColor2: '#4a5568',
        plumeColor: '#FFFFFF',
        jacketStyle: 'traditional',
        jacketColor1: '#d53f8c',
        jacketColor2: '#805ad5',
        jacketAccessory: 'sash',
        jacketAccessoryColor1: '#f6e05e',
        jacketAccessoryColor2: '#f6e05e',
        pantsStyle: 'standard',
        pantsColor1: '#1a202c',
        pantsColor2: '#4a5568',
        shoesStyle: 'standard',
        shoesColor1: '#FFFFFF'
    };

    return (
        <div className="w-48 h-80 bg-brand-surface dark:bg-brand-surface-dark rounded-md flex items-center justify-center p-2 relative flex-shrink-0 border-2 border-brand-accent dark:border-brand-accent-dark">
            <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Base Body */}
                <Skin color={displayUniform.skinTone} />

                {/* Clothing Layers */}
                <Pants 
                    style={displayUniform.pantsStyle}
                    primaryColor={displayUniform.pantsColor1}
                    secondaryColor={displayUniform.pantsColor2}
                />
                 <Shoes 
                    style={displayUniform.shoesStyle}
                    primaryColor={displayUniform.shoesColor1}
                />
                <Jacket 
                    style={displayUniform.jacketStyle}
                    primaryColor={displayUniform.jacketColor1}
                    secondaryColor={displayUniform.jacketColor2}
                />
                <JacketAccessory
                    style={displayUniform.jacketAccessory}
                    primaryColor={displayUniform.jacketAccessoryColor1}
                    secondaryColor={displayUniform.jacketAccessoryColor2}
                />
                <Headwear 
                    style={displayUniform.headwearStyle}
                    primaryColor={displayUniform.headwearColor1}
                    secondaryColor={displayUniform.headwearColor2}
                    plumeColor={displayUniform.plumeColor}
                />
            </svg>
        </div>
    );
};
export default UniformDisplay;
