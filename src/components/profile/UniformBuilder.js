// src/components/profile/UniformBuilder.js
// Hyper-boosted uniform builder with comprehensive DCI-inspired options for corps
import React, { useState, useEffect } from 'react';

// Comprehensive uniform options inspired by DCI history
const uniformOptions = {
    skinTones: [
        '#f2d5b1', '#d8aa7c', '#b07e56', '#8d5524', 
        '#6a3e19', '#4a2511', '#2a150c', '#fbd4b0'
    ],
    
    headwear: [
        { id: 'none', name: 'No Headwear', era: 'Modern' },
        { id: 'shako', name: 'Traditional Shako', era: 'Classic' },
        { id: 'aussie', name: 'Aussie Slouch Hat', era: 'Vintage' },
        { id: 'helmet', name: 'Full Helmet', era: 'Modern' },
        { id: 'busby', name: 'Busby', era: 'Royal' },
        { id: 'beret', name: 'Military Beret', era: 'Contemporary' },
        { id: 'garrison', name: 'Garrison Cap', era: 'Military' },
        { id: 'kepi', name: 'Civil War Kepi', era: 'Historical' },
        { id: 'czapka', name: 'Polish Czapka', era: 'European' },
        { id: 'bicorne', name: 'Naval Bicorne', era: 'Nautical' },
        { id: 'tricorne', name: 'Colonial Tricorne', era: 'Colonial' },
        { id: 'mirliton', name: 'Hussar Mirliton', era: 'Cavalry' }
    ],
    
    plumes: [
        { id: 'none', name: 'No Plume', era: 'Modern' },
        { id: 'fountain', name: 'Classic Fountain', era: 'Traditional' },
        { id: 'feather', name: 'Single Feather', era: 'Simple' },
        { id: 'mohawk', name: 'Mohawk Style', era: 'Bold' },
        { id: 'hackle', name: 'Military Hackle', era: 'Military' },
        { id: 'pompom', name: 'French Pompom', era: 'European' },
        { id: 'cascade', name: 'Cascading Feathers', era: 'Elaborate' },
        { id: 'rooster', name: 'Rooster Tail', era: 'Dramatic' },
        { id: 'ostrich', name: 'Ostrich Plume', era: 'Elegant' },
        { id: 'dyed_tips', name: 'Multi-Color Tips', era: 'Contemporary' },
        { id: 'panache', name: 'French Panache', era: 'Flamboyant' },
        { id: 'macaroni', name: 'Macaroni Plume', era: 'Decorative' }
    ],
    
    jackets: [
        { id: 'classic', name: 'Classic Single-Breast', era: 'Traditional', description: 'Traditional military-style jacket' },
        { id: 'double_breast', name: 'Double-Breasted', era: 'Formal', description: 'Formal double-breasted military jacket' },
        { id: 'sash', name: 'Cross Sash', era: 'Ceremonial', description: 'Diagonal sash across chest' },
        { id: 'cadet', name: 'Cadet-Style', era: 'Academic', description: 'West Point inspired design' },
        { id: 'modern', name: 'Modern Asymmetrical', era: 'Contemporary', description: 'Modern asymmetrical design' },
        { id: 'napoleonic', name: 'Napoleonic', era: 'Historical', description: 'French military inspired' },
        { id: 'hussar', name: 'Hussar Dolman', era: 'European', description: 'Hungarian cavalry style' },
        { id: 'swiss', name: 'Swiss Guard', era: 'Ceremonial', description: 'Vatican Swiss Guard inspired' },
        { id: 'zouave', name: 'Zouave Jacket', era: 'Civil War', description: 'American Civil War Zouave' },
        { id: 'highland', name: 'Highland Doublet', era: 'Scottish', description: 'Scottish Highland regiment' },
        { id: 'bandsman', name: 'Bandsman Tunic', era: 'Musical', description: 'Traditional band uniform' }
    ],
    
    pants: [
        { id: 'plain', name: 'Plain Bibbers', era: 'Standard', description: 'Classic marching band bibbers' },
        { id: 'stripe', name: 'Side Stripe', era: 'Traditional', description: 'Military stripe down the side' },
        { id: 'double_stripe', name: 'Double Stripe', era: 'Formal', description: 'Dual stripes for formal look' },
        { id: 'bloused', name: 'Bloused Trousers', era: 'Military', description: 'Military bloused style' },
        { id: 'riding', name: 'Riding Breeches', era: 'Cavalry', description: 'Cavalry-style breeches' },
        { id: 'highlander', name: 'Highland Kilt', era: 'Scottish', description: 'Traditional Scottish kilt' },
        { id: 'zouave', name: 'Zouave Pants', era: 'Historical', description: 'Civil War Zouave style' }
    ],
    
    shoes: [
        { id: 'white', name: 'White Marching Shoes', era: 'Standard' },
        { id: 'black', name: 'Black Marching Shoes', era: 'Formal' },
        { id: 'brown', name: 'Brown Leather Boots', era: 'Military' },
        { id: 'combat', name: 'Combat Boots', era: 'Modern' },
        { id: 'dress', name: 'Dress Shoes', era: 'Formal' },
        { id: 'cavalry', name: 'Cavalry Boots', era: 'Historical' },
        { id: 'spats', name: 'Spats & Gaiters', era: 'Vintage' },
        { id: 'hessian', name: 'Hessian Boots', era: 'Napoleonic' }
    ],
    
    accessories: [
        { id: 'none', name: 'No Accessories', era: 'Clean' },
        { id: 'gloves', name: 'White Gloves', era: 'Formal' },
        { id: 'belt', name: 'Ceremonial Belt', era: 'Military' },
        { id: 'shoulder_cord', name: 'Shoulder Cords', era: 'Decorative' },
        { id: 'aiguillettes', name: 'Aiguillettes', era: 'Ceremonial' },
        { id: 'gorget', name: 'Officer Gorget', era: 'Historical' },
        { id: 'epaulettes', name: 'Epaulettes', era: 'Military' },
        { id: 'baldric', name: 'Baldric Sash', era: 'Ceremonial' },
        { id: 'shako_plate', name: 'Shako Plate', era: 'Traditional' }
    ]
};

const colorPalettes = {
    classic: {
        name: 'Classic DCI',
        colors: ['#000080', '#8B0000', '#006400', '#4B0082', '#FF8C00', '#228B22', '#B22222', '#FFD700']
    },
    modern: {
        name: 'Modern Corps',
        colors: ['#1E1E1E', '#2C5F2D', '#8B4513', '#191970', '#8B008B', '#FF4500', '#483D8B', '#DC143C']
    },
    vintage: {
        name: 'Vintage Military',
        colors: ['#8B4513', '#2F4F4F', '#8B0000', '#556B2F', '#4682B4', '#CD853F', '#A0522D', '#DAA520']
    },
    royal: {
        name: 'Royal Ceremonial',
        colors: ['#4B0082', '#8B0000', '#FFD700', '#DC143C', '#000080', '#B8860B', '#8A2BE2', '#CD853F']
    },
    contemporary: {
        name: 'Contemporary',
        colors: ['#2C2C2C', '#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', '#4D4DFF', '#FF4081', '#00BCD4']
    }
};

// Color picker component with palette support
const ColorPicker = ({ label, color, onChange, palette }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">{label}</label>
            <input 
                type="color" 
                value={color} 
                onChange={onChange} 
                className="w-10 h-8 rounded border-none cursor-pointer bg-transparent"
            />
        </div>
        {palette && (
            <div className="flex flex-wrap gap-1">
                {palette.colors.map((paletteColor, index) => (
                    <button
                        key={index}
                        onClick={() => onChange({ target: { value: paletteColor } })}
                        style={{ backgroundColor: paletteColor }}
                        className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                        title={paletteColor}
                    />
                ))}
            </div>
        )}
    </div>
);

// Option selector with era badges
const OptionSelector = ({ title, options, selected, onSelect, showEra = true }) => (
    <div className="space-y-3">
        <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">{title}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {options.map(option => (
                <button 
                    key={option.id}
                    onClick={() => onSelect(option.id)}
                    className={`p-3 text-sm rounded-theme text-center transition-all duration-150 ${
                        selected === option.id 
                            ? 'bg-primary text-on-primary shadow-md transform scale-105' 
                            : 'bg-surface dark:bg-surface-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark'
                    }`}
                    title={option.description}
                >
                    <div className="font-medium">{option.name}</div>
                    {showEra && option.era && (
                        <div className="text-xs opacity-75 mt-1">{option.era}</div>
                    )}
                </button>
            ))}
        </div>
    </div>
);

// Preset uniform configurations inspired by famous DCI corps
const presetUniforms = {
    'blue_devils': {
        name: 'Classic Blue',
        headwear: { style: 'shako', colors: { hat: '#000080', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ffffff' } },
        jacket: { style: 'classic', colors: { base: '#000080', accent: '#ffffff', trim: '#c0c0c0' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
        accessories: { style: 'belt', colors: { accessory: '#c0c0c0' } }
    },
    'santa_clara': {
        name: 'Vanguard Red',
        headwear: { style: 'shako', colors: { hat: '#8B0000', trim: '#FFD700' } },
        plume: { style: 'fountain', colors: { plume: '#FFD700' } },
        jacket: { style: 'classic', colors: { base: '#8B0000', accent: '#FFD700', trim: '#FFFFFF' } },
        pants: { style: 'stripe', colors: { base: '#FFFFFF', stripe: '#8B0000' } },
        shoes: { style: 'white' },
        accessories: { style: 'epaulettes', colors: { accessory: '#FFD700' } }
    },
    'phantom': {
        name: 'Phantom Regiment',
        headwear: { style: 'shako', colors: { hat: '#000000', trim: '#C0C0C0' } },
        plume: { style: 'fountain', colors: { plume: '#FF0000' } },
        jacket: { style: 'classic', colors: { base: '#000000', accent: '#C0C0C0', trim: '#FF0000' } },
        pants: { style: 'stripe', colors: { base: '#000000', stripe: '#C0C0C0' } },
        shoes: { style: 'black' },
        accessories: { style: 'shoulder_cord', colors: { accessory: '#C0C0C0' } }
    },
    'crown': {
        name: 'Carolina Crown',
        headwear: { style: 'shako', colors: { hat: '#FFD700', trim: '#000000' } },
        plume: { style: 'fountain', colors: { plume: '#000000' } },
        jacket: { style: 'modern', colors: { base: '#FFD700', accent: '#000000', trim: '#FFFFFF' } },
        pants: { style: 'plain', colors: { base: '#FFD700', stripe: '#000000' } },
        shoes: { style: 'black' },
        accessories: { style: 'belt', colors: { accessory: '#000000' } }
    },
    'cavaliers': {
        name: 'Cavaliers Green',
        headwear: { style: 'shako', colors: { hat: '#006400', trim: '#FFD700' } },
        plume: { style: 'fountain', colors: { plume: '#FFD700' } },
        jacket: { style: 'classic', colors: { base: '#006400', accent: '#FFD700', trim: '#FFFFFF' } },
        pants: { style: 'stripe', colors: { base: '#FFFFFF', stripe: '#006400' } },
        shoes: { style: 'white' },
        accessories: { style: 'gloves', colors: { accessory: '#FFFFFF' } }
    },
    'bluecoats': {
        name: 'Bluecoats',
        headwear: { style: 'shako', colors: { hat: '#4169E1', trim: '#FFD700' } },
        plume: { style: 'fountain', colors: { plume: '#FFD700' } },
        jacket: { style: 'modern', colors: { base: '#4169E1', accent: '#FFD700', trim: '#FFFFFF' } },
        pants: { style: 'stripe', colors: { base: '#FFFFFF', stripe: '#4169E1' } },
        shoes: { style: 'white' },
        accessories: { style: 'none', colors: { accessory: '#FFD700' } }
    },
    'madison_scouts': {
        name: 'Madison Scouts',
        headwear: { style: 'aussie', colors: { hat: '#8B4513', trim: '#FFD700' } },
        plume: { style: 'feather', colors: { plume: '#FF0000' } },
        jacket: { style: 'classic', colors: { base: '#8B0000', accent: '#FFFFFF', trim: '#FFD700' } },
        pants: { style: 'stripe', colors: { base: '#FFFFFF', stripe: '#8B0000' } },
        shoes: { style: 'brown' },
        accessories: { style: 'none', colors: { accessory: '#FFD700' } }
    },
    'boston_crusaders': {
        name: 'Boston Crusaders',
        headwear: { style: 'shako', colors: { hat: '#8B0000', trim: '#C0C0C0' } },
        plume: { style: 'fountain', colors: { plume: '#C0C0C0' } },
        jacket: { style: 'classic', colors: { base: '#8B0000', accent: '#C0C0C0', trim: '#000000' } },
        pants: { style: 'stripe', colors: { base: '#000000', stripe: '#8B0000' } },
        shoes: { style: 'black' },
        accessories: { style: 'shoulder_cord', colors: { accessory: '#C0C0C0' } }
    }
};

const UniformBuilder = ({ 
    uniform: initialUniform, 
    onSave, 
    onCancel, 
    UniformDisplayComponent,
    isCorpsMode = false,
    uniformSlot = 0,
    corpsName = ''
}) => {
    const [uniform, setUniform] = useState(initialUniform || {
        name: isCorpsMode ? `${corpsName} Uniform ${uniformSlot + 1}` : 'Custom Uniform',
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'classic', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
        accessories: { style: 'none', colors: { accessory: '#ffd700' } }
    });
    
    const [activeTab, setActiveTab] = useState('presets');
    const [selectedPalette, setSelectedPalette] = useState('classic');

    const handleStyleChange = (category, style) => {
        setUniform(prev => ({
            ...prev,
            [category]: { ...prev[category], style }
        }));
    };

    const handleColorChange = (category, part, color) => {
        setUniform(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                colors: {
                    ...prev[category].colors,
                    [part]: color,
                }
            }
        }));
    };

    const handlePresetSelect = (presetKey) => {
        const preset = presetUniforms[presetKey];
        setUniform(prev => ({
            ...prev,
            ...preset,
            skinTone: prev.skinTone,
            name: `${preset.name} Style`
        }));
    };

    const tabs = [
        { id: 'presets', name: 'Presets', icon: '🎨' },
        { id: 'body', name: 'Body', icon: '🧑' },
        { id: 'headwear', name: 'Headwear', icon: '🎩' },
        { id: 'jacket', name: 'Jacket', icon: '🧥' },
        { id: 'pants', name: 'Pants', icon: '👖' },
        { id: 'accessories', name: 'Extras', icon: '✨' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-surface dark:bg-surface-dark w-full max-w-7xl h-[95vh] rounded-theme shadow-theme flex flex-col lg:flex-row overflow-hidden border-theme border-accent dark:border-accent-dark">
                
                {/* Preview Panel */}
                <div className="w-full lg:w-1/3 bg-gradient-to-br from-background to-accent/10 dark:from-background-dark dark:to-accent-dark/10 flex flex-col justify-center items-center p-6 space-y-6 border-r border-accent dark:border-accent-dark">
                    <div className="text-center">
                        <h3 className="text-3xl font-bold text-primary dark:text-primary-dark mb-2">
                            {isCorpsMode ? 'Corps Uniform Designer' : 'Avatar Uniform Builder'}
                        </h3>
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            {isCorpsMode ? 'Design legendary marching band uniforms' : 'Customize your avatar'}
                        </p>
                    </div>
                    
                    <UniformDisplayComponent uniform={uniform} size="large" />
                    
                    <div className="w-full space-y-2">
                        {isCorpsMode && (
                            <input
                                type="text"
                                value={uniform.name}
                                onChange={(e) => setUniform(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full p-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-center font-semibold"
                                placeholder="Uniform Name"
                            />
                        )}
                        
                        <div className="flex space-x-2">
                            <button 
                                onClick={onCancel} 
                                className="flex-1 bg-secondary hover:opacity-90 text-on-secondary font-bold py-3 px-4 rounded-theme transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => onSave(uniform)} 
                                className="flex-1 bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-4 rounded-theme transition-colors"
                            >
                                Save Uniform
                            </button>
                        </div>
                    </div>
                </div>

                {/* Customization Panel */}
                <div className="w-full lg:w-2/3 flex flex-col overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="border-b border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark">
                        <nav className="flex overflow-x-auto">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === tab.id 
                                            ? 'border-primary text-primary dark:text-primary-dark' 
                                            : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                                    }`}
                                >
                                    <span className="mr-2">{tab.icon}</span>
                                    {tab.name}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-6">
                        {activeTab === 'presets' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h4 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                        Legendary Uniform Presets
                                    </h4>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        Start with iconic designs from DCI history
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(presetUniforms).map(([key, preset]) => (
                                        <button
                                            key={key}
                                            onClick={() => handlePresetSelect(key)}
                                            className="p-4 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all hover:scale-105 hover:shadow-lg"
                                        >
                                            <UniformDisplayComponent 
                                                uniform={{ ...preset, skinTone: uniform.skinTone }} 
                                                size="small" 
                                                showInfo={false}
                                            />
                                            <div className="mt-2 text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                                {preset.name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'body' && (
                            <div className="space-y-6">
                                <h4 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                                    Body & Skin Tone
                                </h4>
                                <div className="flex flex-wrap gap-3">
                                    {uniformOptions.skinTones.map(color => (
                                        <button 
                                            key={color}
                                            onClick={() => setUniform(prev => ({...prev, skinTone: color}))}
                                            style={{ backgroundColor: color }}
                                            className={`w-12 h-12 rounded-full border-4 transition-transform transform hover:scale-110 ${
                                                uniform.skinTone === color 
                                                    ? 'border-primary dark:border-primary-dark shadow-lg scale-110' 
                                                    : 'border-gray-300 dark:border-gray-600'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'headwear' && (
                            <div className="space-y-6">
                                <OptionSelector 
                                    title="Headwear Style" 
                                    options={uniformOptions.headwear} 
                                    selected={uniform.headwear.style} 
                                    onSelect={(style) => handleStyleChange('headwear', style)} 
                                />
                                
                                {uniform.headwear.style !== 'none' && (
                                    <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-4">
                                        <ColorPicker 
                                            label="Hat Color" 
                                            color={uniform.headwear.colors.hat} 
                                            onChange={(e) => handleColorChange('headwear', 'hat', e.target.value)}
                                            palette={colorPalettes[selectedPalette]}
                                        />
                                        <ColorPicker 
                                            label="Trim & Accents" 
                                            color={uniform.headwear.colors.trim} 
                                            onChange={(e) => handleColorChange('headwear', 'trim', e.target.value)}
                                            palette={colorPalettes[selectedPalette]}
                                        />
                                    </div>
                                )}

                                <OptionSelector 
                                    title="Plume Style" 
                                    options={uniformOptions.plumes} 
                                    selected={uniform.plume.style} 
                                    onSelect={(style) => handleStyleChange('plume', style)} 
                                />
                                
                                {uniform.plume.style !== 'none' && (
                                    <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-4">
                                        <ColorPicker 
                                            label="Plume Color" 
                                            color={uniform.plume.colors.plume} 
                                            onChange={(e) => handleColorChange('plume', 'plume', e.target.value)}
                                            palette={colorPalettes[selectedPalette]}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'jacket' && (
                            <div className="space-y-6">
                                <OptionSelector 
                                    title="Jacket Style" 
                                    options={uniformOptions.jackets} 
                                    selected={uniform.jacket.style} 
                                    onSelect={(style) => handleStyleChange('jacket', style)} 
                                />
                                
                                <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-4">
                                    <ColorPicker 
                                        label="Base Color" 
                                        color={uniform.jacket.colors.base} 
                                        onChange={(e) => handleColorChange('jacket', 'base', e.target.value)}
                                        palette={colorPalettes[selectedPalette]}
                                    />
                                    <ColorPicker 
                                        label="Accent / Sash" 
                                        color={uniform.jacket.colors.accent} 
                                        onChange={(e) => handleColorChange('jacket', 'accent', e.target.value)}
                                        palette={colorPalettes[selectedPalette]}
                                    />
                                    <ColorPicker 
                                        label="Trim / Details" 
                                        color={uniform.jacket.colors.trim} 
                                        onChange={(e) => handleColorChange('jacket', 'trim', e.target.value)}
                                        palette={colorPalettes[selectedPalette]}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'pants' && (
                            <div className="space-y-6">
                                <OptionSelector 
                                    title="Pants Style" 
                                    options={uniformOptions.pants} 
                                    selected={uniform.pants.style} 
                                    onSelect={(style) => handleStyleChange('pants', style)} 
                                />
                                
                                <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-4">
                                    <ColorPicker 
                                        label="Pants Base Color" 
                                        color={uniform.pants.colors.base} 
                                        onChange={(e) => handleColorChange('pants', 'base', e.target.value)}
                                        palette={colorPalettes[selectedPalette]}
                                    />
                                    {(uniform.pants.style === 'stripe' || uniform.pants.style === 'double_stripe' || uniform.pants.style === 'highlander') && (
                                        <ColorPicker 
                                            label="Stripe / Pattern Color" 
                                            color={uniform.pants.colors.stripe} 
                                            onChange={(e) => handleColorChange('pants', 'stripe', e.target.value)}
                                            palette={colorPalettes[selectedPalette]}
                                        />
                                    )}
                                </div>

                                <OptionSelector 
                                    title="Marching Shoes" 
                                    options={uniformOptions.shoes} 
                                    selected={uniform.shoes.style} 
                                    onSelect={(style) => handleStyleChange('shoes', style)} 
                                />
                            </div>
                        )}

                        {activeTab === 'accessories' && (
                            <div className="space-y-6">
                                <OptionSelector 
                                    title="Accessories & Details" 
                                    options={uniformOptions.accessories} 
                                    selected={uniform.accessories?.style || 'none'} 
                                    onSelect={(style) => handleStyleChange('accessories', style)} 
                                />
                                
                                {uniform.accessories?.style !== 'none' && (
                                    <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-4">
                                        <ColorPicker 
                                            label="Accessory Color" 
                                            color={uniform.accessories?.colors?.accessory || '#FFD700'} 
                                            onChange={(e) => handleColorChange('accessories', 'accessory', e.target.value)}
                                            palette={colorPalettes[selectedPalette]}
                                        />
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h5 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                                        Color Palette
                                    </h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {Object.entries(colorPalettes).map(([key, palette]) => (
                                            <button
                                                key={key}
                                                onClick={() => setSelectedPalette(key)}
                                                className={`p-3 rounded-theme border transition-all ${
                                                    selectedPalette === key
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-accent dark:border-accent-dark hover:border-primary'
                                                }`}
                                            >
                                                <div className="text-sm font-medium mb-1">{palette.name}</div>
                                                <div className="flex space-x-1">
                                                    {palette.colors.slice(0, 4).map((color, index) => (
                                                        <div 
                                                            key={index}
                                                            style={{ backgroundColor: color }}
                                                            className="w-4 h-4 rounded"
                                                        />
                                                    ))}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UniformBuilder;