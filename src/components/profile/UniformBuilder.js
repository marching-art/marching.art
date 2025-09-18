import React, { useState } from 'react';

// --- Data for Uniform Options ---
const uniformOptions = {
    skinTones: ['#f2d5b1', '#d8aa7c', '#b07e56', '#8d5524', '#6a3e19', '#4a2511', '#2a150c'],
    headwear: [
        { id: 'none', name: 'None' },
        { id: 'shako', name: 'Shako' },
        { id: 'aussie', name: 'Aussie Slouch' },
        { id: 'helmet', name: 'Full Helmet' },
        { id: 'busby', name: 'Busby' },
    ],
    plumes: [
        { id: 'none', name: 'None' },
        { id: 'fountain', name: 'Fountain' },
        { id: 'feather', name: 'Single Feather' },
        { id: 'mohawk', name: 'Mohawk' },
    ],
    jackets: [
        { id: 'classic', name: 'Classic Single-Breast' },
        { id: 'sash', name: 'Cross Sash' },
        { id: 'cadet', name: 'Cadet-Style' },
        { id: 'modern', name: 'Modern Asymmetrical' },
    ],
    pants: [
        { id: 'plain', name: 'Plain Bibbers' },
        { id: 'stripe', name: 'Side Stripe' },
    ],
    shoes: [
        { id: 'white', name: 'White Marching Shoes' },
        { id: 'black', name: 'Black Marching Shoes' },
    ],
};

const ColorPicker = ({ label, color, onChange }) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">{label}</label>
        <input 
            type="color" 
            value={color} 
            onChange={onChange} 
            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
        />
    </div>
);

const OptionSelector = ({ title, options, selected, onSelect }) => (
    <div>
        <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">{title}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {options.map(option => (
                <button 
                    key={option.id}
                    onClick={() => onSelect(option.id)}
                    className={`p-2 text-sm rounded-theme text-center transition-all duration-150 ${selected === option.id ? 'bg-primary text-on-primary shadow-md' : 'bg-surface dark:bg-surface-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark'}`}
                >
                    {option.name}
                </button>
            ))}
        </div>
    </div>
);


const UniformBuilder = ({ uniform: initialUniform, onSave, onCancel, UniformDisplayComponent }) => {
    const [uniform, setUniform] = useState(initialUniform);
    const [activeTab, setActiveTab] = useState('body');

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

    const tabs = [
        { id: 'body', name: 'Body' },
        { id: 'headwear', name: 'Headwear' },
        { id: 'jacket', name: 'Jacket' },
        { id: 'pants', name: 'Pants & Shoes' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-surface dark:bg-surface-dark w-full max-w-4xl h-[90vh] rounded-theme shadow-theme flex flex-col md:flex-row overflow-hidden border-theme border-accent dark:border-accent-dark">
                {/* Preview Pane */}
                <div className="w-full md:w-1/3 bg-background dark:bg-background-dark flex flex-col justify-center items-center p-6 space-y-4 border-r-theme border-accent dark:border-accent-dark">
                    <h3 className="text-2xl font-bold text-primary dark:text-primary-dark">Avatar Preview</h3>
                    <UniformDisplayComponent uniform={uniform} />
                    <div className="flex w-full space-x-2 pt-4">
                       <button onClick={onCancel} className="w-full bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme transition-colors">
                           Cancel
                       </button>
                       <button onClick={() => onSave(uniform)} className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-colors">
                           Save & Close
                       </button>
                    </div>
                </div>

                {/* Customization Pane */}
                <div className="w-full md:w-2/3 p-6 flex flex-col overflow-y-auto">
                    <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Uniform Builder</h2>
                    
                    {/* Tabs */}
                    <div className="border-b border-accent dark:border-accent-dark mb-4">
                        <nav className="-mb-px flex space-x-6">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-lg ${activeTab === tab.id ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark' : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'}`}
                                >
                                    {tab.name}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Options based on tab */}
                    <div className="space-y-6">
                        {activeTab === 'body' && (
                            <div>
                                <h4 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">Skin Tone</h4>
                                <div className="flex flex-wrap gap-2">
                                    {uniformOptions.skinTones.map(color => (
                                        <button 
                                            key={color}
                                            onClick={() => setUniform(prev => ({...prev, skinTone: color}))}
                                            style={{ backgroundColor: color }}
                                            className={`w-10 h-10 rounded-full transition-transform transform hover:scale-110 ${uniform.skinTone === color ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-surface-dark dark:ring-primary-dark' : ''}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'headwear' && (
                            <>
                                <OptionSelector title="Headwear Style" options={uniformOptions.headwear} selected={uniform.headwear.style} onSelect={(style) => handleStyleChange('headwear', style)} />
                                {uniform.headwear.style !== 'none' && (
                                    <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-3">
                                       <ColorPicker label="Hat Color" color={uniform.headwear.colors.hat} onChange={(e) => handleColorChange('headwear', 'hat', e.target.value)} />
                                       <ColorPicker label="Accent" color={uniform.headwear.colors.trim} onChange={(e) => handleColorChange('headwear', 'trim', e.target.value)} />
                                    </div>
                                )}
                                <OptionSelector title="Plume Style" options={uniformOptions.plumes} selected={uniform.plume.style} onSelect={(style) => handleStyleChange('plume', style)} />
                                {uniform.plume.style !== 'none' && (
                                     <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-3">
                                        <ColorPicker label="Plume Color" color={uniform.plume.colors.plume} onChange={(e) => handleColorChange('plume', 'plume', e.target.value)} />
                                     </div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'jacket' && (
                             <>
                                <OptionSelector title="Jacket Style" options={uniformOptions.jackets} selected={uniform.jacket.style} onSelect={(style) => handleStyleChange('jacket', style)} />
                                <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-3">
                                    <ColorPicker label="Jacket Base" color={uniform.jacket.colors.base} onChange={(e) => handleColorChange('jacket', 'base', e.target.value)} />
                                    <ColorPicker label="Accent / Sash" color={uniform.jacket.colors.accent} onChange={(e) => handleColorChange('jacket', 'accent', e.target.value)} />
                                    <ColorPicker label="Trim / Details" color={uniform.jacket.colors.trim} onChange={(e) => handleColorChange('jacket', 'trim', e.target.value)} />
                                </div>
                             </>
                        )}

                        {activeTab === 'pants' && (
                            <>
                               <OptionSelector title="Pants Style" options={uniformOptions.pants} selected={uniform.pants.style} onSelect={(style) => handleStyleChange('pants', style)} />
                               <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-3">
                                    <ColorPicker label="Pants Color" color={uniform.pants.colors.base} onChange={(e) => handleColorChange('pants', 'base', e.target.value)} />
                                    {uniform.pants.style === 'stripe' && (
                                        <ColorPicker label="Stripe Color" color={uniform.pants.colors.stripe} onChange={(e) => handleColorChange('pants', 'stripe', e.target.value)} />
                                    )}
                               </div>
                               <OptionSelector title="Shoes" options={uniformOptions.shoes} selected={uniform.shoes.style} onSelect={(style) => handleStyleChange('shoes', style)} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UniformBuilder;