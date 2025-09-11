import React, { useState, useEffect } from 'react';
import UniformDisplay from './UniformDisplay'; // Correctly import UniformDisplay

// --- Helper Components ---

const ColorPicker = ({ label, color, onChange }) => (
    <div className="flex items-center justify-between">
        <label className="text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark">{label}</label>
        <input type="color" value={color} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded border border-gray-300" />
    </div>
);

const OptionSelector = ({ options, selected, onSelect }) => (
    <div className="grid grid-cols-3 gap-2">
        {options.map(option => (
            <button
                key={option.id}
                onClick={() => onSelect(option.id)}
                className={`p-2 rounded-md text-center text-sm transition-all ${selected === option.id ? 'bg-brand-secondary text-white ring-2 ring-brand-primary' : 'bg-brand-surface-alt dark:bg-brand-surface-alt-dark hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
                {option.name}
            </button>
        ))}
    </div>
);


// --- Main UniformBuilder Component ---

const UniformBuilder = ({ uniform, onSave, onCancel }) => {
    const [localUniform, setLocalUniform] = useState(uniform || {});
    const [activeTab, setActiveTab] = useState('skin');

    useEffect(() => {
        setLocalUniform(uniform || {
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
        });
    }, [uniform]);

    const handleFieldChange = (field, value) => {
        setLocalUniform(prev => ({ ...prev, [field]: value }));
    };
    
    const tabs = ['Skin', 'Headwear', 'Jacket Style', 'Jacket Acc.', 'Pants', 'Shoes'];
    
    // --- Configuration for Options ---
    const skinTones = [
        { id: '#F9E4D6', name: 'Tone 1' }, { id: '#E0A37E', name: 'Tone 2' }, { id: '#C68642', name: 'Tone 3' },
        { id: '#8D5524', name: 'Tone 4' }, { id: '#5E381E', name: 'Tone 5' }, { id: '#3C2317', name: 'Tone 6' },
    ];
    const headwearStyles = [{ id: 'shako', name: 'Shako' }, { id: 'aussie', name: 'Aussie' }, { id: 'helmet', name: 'Helmet' }, { id: 'none', name: 'None' }];
    const jacketStyles = [{ id: 'traditional', name: 'Traditional' }, { id: 'cadet', name: 'Cadet' }, { id: 'asymmetrical', name: 'Asymmetric' }];
    const jacketAccessories = [{ id: 'none', name: 'None' }, { id: 'sash', name: 'Sash' }, { id: 'baldric', name: 'Baldric' }, { id: 'sequins', name: 'Sequins' }];
    const pantsStyles = [{ id: 'standard', name: 'Standard' }, { id: 'stripe', name: 'Stripe' }];
    const shoesStyles = [{ id: 'standard', name: 'Standard' }];

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'skin':
                return <OptionSelector options={skinTones} selected={localUniform.skinTone} onSelect={(val) => handleFieldChange('skinTone', val)} />;
            case 'headwear':
                return (
                    <div className="space-y-4">
                        <h4 className="font-semibold">Style</h4>
                        <OptionSelector options={headwearStyles} selected={localUniform.headwearStyle} onSelect={(val) => handleFieldChange('headwearStyle', val)} />
                        <h4 className="font-semibold">Colors</h4>
                        <ColorPicker label="Primary" color={localUniform.headwearColor1} onChange={(val) => handleFieldChange('headwearColor1', val)} />
                        <ColorPicker label="Accent" color={localUniform.headwearColor2} onChange={(val) => handleFieldChange('headwearColor2', val)} />
                        <ColorPicker label="Plume" color={localUniform.plumeColor} onChange={(val) => handleFieldChange('plumeColor', val)} />
                    </div>
                );
            case 'jacket style':
                return (
                    <div className="space-y-4">
                        <h4 className="font-semibold">Cut</h4>
                        <OptionSelector options={jacketStyles} selected={localUniform.jacketStyle} onSelect={(val) => handleFieldChange('jacketStyle', val)} />
                        <h4 className="font-semibold">Colors</h4>
                        <ColorPicker label="Primary" color={localUniform.jacketColor1} onChange={(val) => handleFieldChange('jacketColor1', val)} />
                        <ColorPicker label="Accent" color={localUniform.jacketColor2} onChange={(val) => handleFieldChange('jacketColor2', val)} />
                    </div>
                );
            case 'jacket acc.':
                return (
                     <div className="space-y-4">
                        <h4 className="font-semibold">Accessory</h4>
                        <OptionSelector options={jacketAccessories} selected={localUniform.jacketAccessory} onSelect={(val) => handleFieldChange('jacketAccessory', val)} />
                        <h4 className="font-semibold">Colors</h4>
                        <ColorPicker label="Primary" color={localUniform.jacketAccessoryColor1} onChange={(val) => handleFieldChange('jacketAccessoryColor1', val)} />
                        <ColorPicker label="Accent" color={localUniform.jacketAccessoryColor2} onChange={(val) => handleFieldChange('jacketAccessoryColor2', val)} />
                    </div>
                );
            case 'pants':
                 return (
                    <div className="space-y-4">
                        <h4 className="font-semibold">Style</h4>
                        <OptionSelector options={pantsStyles} selected={localUniform.pantsStyle} onSelect={(val) => handleFieldChange('pantsStyle', val)} />
                        <h4 className="font-semibold">Colors</h4>
                        <ColorPicker label="Primary" color={localUniform.pantsColor1} onChange={(val) => handleFieldChange('pantsColor1', val)} />
                        <ColorPicker label="Stripe" color={localUniform.pantsColor2} onChange={(val) => handleFieldChange('pantsColor2', val)} />
                    </div>
                );
            case 'shoes':
                return (
                    <div className="space-y-4">
                        <h4 className="font-semibold">Style</h4>
                        <OptionSelector options={shoesStyles} selected={localUniform.shoesStyle} onSelect={(val) => handleFieldChange('shoesStyle', val)} />
                        <h4 className="font-semibold">Color</h4>
                        <ColorPicker label="Primary" color={localUniform.shoesColor1} onChange={(val) => handleFieldChange('shoesColor1', val)} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-brand-surface dark:bg-brand-surface-dark rounded-xl shadow-2xl w-full max-w-lg border-2 border-brand-secondary">
                <div className="p-4 border-b border-brand-accent dark:border-brand-accent-dark">
                    <h2 className="text-xl font-bold text-brand-primary dark:text-brand-secondary-dark">Uniform Builder</h2>
                </div>

                <div className="p-4 flex flex-col md:flex-row gap-4">
                    {/* --- Live Preview --- */}
                    <div className="w-full md:w-1/3 flex-shrink-0">
                         <UniformDisplay uniform={localUniform} />
                    </div>
                    
                    {/* --- Customization Panel --- */}
                    <div className="flex-grow bg-brand-background dark:bg-brand-background-dark p-3 rounded-lg">
                        <div className="flex border-b-2 border-brand-accent dark:border-brand-accent-dark mb-3">
                            {tabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab.toLowerCase())}
                                    className={`py-2 px-3 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === tab.toLowerCase() ? 'border-b-2 border-brand-secondary text-brand-primary dark:text-brand-secondary-dark' : 'text-brand-text-secondary dark:text-brand-text-secondary-dark hover:text-brand-text-primary dark:hover:text-brand-text-primary-dark'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-3">
                           {renderActiveTab()}
                        </div>
                    </div>
                </div>

                <div className="p-4 flex justify-end gap-3 bg-brand-surface-alt dark:bg-brand-surface-alt-dark rounded-b-xl">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-brand-text-primary dark:text-brand-text-primary-dark font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-all">Cancel</button>
                    <button onClick={() => onSave(localUniform)} className="px-6 py-2 rounded-md bg-brand-primary text-white font-bold hover:bg-brand-primary-dark transition-all shadow-lg">Save</button>
                </div>
            </div>
        </div>
    );
};
export default UniformBuilder;

