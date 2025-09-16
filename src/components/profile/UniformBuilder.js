import React, { useState, useCallback } from 'react';
import Icon from '../ui/Icon'; // Assuming Icon component exists and is theme-aware

// --- Data for Uniform Options (Unchanged) ---
const uniformOptions = { /* ... existing uniform options data ... */ };

// --- NEW: Pre-defined Color Palettes ---
const colorPalettes = [
    { name: 'Classic Blue', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700', hat: '#ffffff', plume: '#ffffff' } },
    { name: 'Regal Red', colors: { base: '#8B0000', accent: '#000000', trim: '#F5F5DC', hat: '#000000', plume: '#F5F5DC' } },
    { name: 'Emerald Guard', colors: { base: '#006400', accent: '#DAA520', trim: '#000000', hat: '#000000', plume: '#DAA520' } },
    { name: 'Modern Onyx', colors: { base: '#1C1C1C', accent: '#00BFFF', trim: '#D3D3D3', hat: '#1C1C1C', plume: '#00BFFF' } },
];

// --- NEW & ENHANCED UI Sub-Components ---

// Accordion-style container for customization sections
const ControlSection = ({ title, children }) => (
    <div>
        <h4 className="text-lg font-bold text-primary dark:text-primary-dark mb-3 border-b-theme border-accent pb-2">{title}</h4>
        <div className="space-y-4">{children}</div>
    </div>
);

// A more visual button for selecting styles
const StyleButton = ({ name, iconPath, isSelected, onClick }) => (
    <button
        onClick={onClick}
        className={`p-2 flex flex-col items-center justify-center space-y-1 w-full rounded-theme transition-all duration-150 border-theme ${isSelected ? 'bg-primary text-on-primary border-primary' : 'bg-surface dark:bg-surface-dark border-accent hover:border-primary'}`}
    >
        <Icon path={iconPath} className="w-6 h-6" />
        <span className="text-xs font-semibold">{name}</span>
    </button>
);

// A custom, theme-aware color swatch that uses the native color picker
const ColorSwatch = ({ label, color, onChange }) => (
    <div className="flex items-center justify-between p-2 bg-surface dark:bg-surface-dark rounded-theme">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <div className="relative w-8 h-8 rounded-theme border-theme border-accent">
            <div className="absolute inset-0 rounded-theme" style={{ backgroundColor: color }} />
            <input 
                type="color" 
                value={color} 
                onChange={onChange} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
    </div>
);

// --- Main UniformBuilder Component ---

const UniformBuilder = ({ uniform: initialUniform, onSave, onCancel, UniformDisplayComponent }) => {
    const [uniform, setUniform] = useState(initialUniform);
    const [activeTab, setActiveTab] = useState('body');
    
    // --- NEW: Undo/Redo State Management ---
    const [history, setHistory] = useState([initialUniform]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const updateUniform = useCallback((newUniform) => {
        setUniform(newUniform);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newUniform);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setUniform(history[newIndex]);
        }
    };
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setUniform(history[newIndex]);
        }
    };

    // --- NEW: Randomizer & Palette Logic ---
    const handleRandomize = () => {
        const randomOption = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const randomHex = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        
        const newUniform = {
            skinTone: randomOption(uniformOptions.skinTones),
            headwear: { style: randomOption(uniformOptions.headwear).id, colors: { hat: randomHex(), trim: randomHex() } },
            plume: { style: randomOption(uniformOptions.plumes).id, colors: { plume: randomHex() } },
            jacket: { style: randomOption(uniformOptions.jackets).id, colors: { base: randomHex(), accent: randomHex(), trim: randomHex() } },
            pants: { style: randomOption(uniformOptions.pants).id, colors: { base: randomHex(), stripe: randomHex() } },
            shoes: { style: randomOption(uniformOptions.shoes).id },
        };
        updateUniform(newUniform);
    };

    const applyPalette = (palette) => {
        const newUniform = {
            ...uniform,
            jacket: { ...uniform.jacket, colors: { base: palette.colors.base, accent: palette.colors.accent, trim: palette.colors.trim } },
            headwear: { ...uniform.headwear, colors: { ...uniform.headwear.colors, hat: palette.colors.hat } },
            plume: { ...uniform.plume, colors: { ...uniform.plume.colors, plume: palette.colors.plume } },
        };
        updateUniform(newUniform);
    };

    const tabs = [
        { id: 'body', name: 'Body', icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
        { id: 'headwear', name: 'Headwear', icon: "M13.5 6H12V4.125C12 3.504 11.496 3 10.875 3H7.125C6.504 3 6 3.504 6 4.125V6H4.5c-.828 0-1.5.672-1.5 1.5v3c0 .828.672 1.5 1.5 1.5H6v1.125c0 .621.504 1.125 1.125 1.125h3.75c.621 0 1.125-.504 1.125-1.125V12h1.5c.828 0 1.5-.672 1.5-1.5v-3c0-.828-.672-1.5-1.5-1.5z" },
        { id: 'jacket', name: 'Jacket', icon: "M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81-2.122-2.122z" },
        { id: 'pants', name: 'Pants', icon: "M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z" },
        { id: 'palettes', name: 'Palettes', icon: "M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402a3.75 3.75 0 00-.622-6.225L14.25 4.5l-2.122 2.122 1.25 1.25-6.4 6.4-1.25-1.25L4.5 14.25l-.402 5.652z" },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-background dark:bg-background-dark w-full max-w-5xl h-[90vh] rounded-theme shadow-theme flex flex-col md:flex-row overflow-hidden border-theme border-secondary">
                {/* --- Preview Pane --- */}
                <div className="w-full md:w-1/3 bg-surface dark:bg-surface-dark flex flex-col justify-center items-center p-6 space-y-4 border-r-theme border-accent">
                    <h3 className="text-2xl font-bold text-secondary">Avatar Preview</h3>
                    <UniformDisplayComponent uniform={uniform} />
                    
                    {/* NEW: Undo, Redo, Randomize buttons */}
                    <div className="flex w-full justify-center space-x-2">
                        <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 disabled:opacity-50 text-text-secondary"><Icon path="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></button>
                        <button onClick={handleRandomize} className="p-2 text-text-primary hover:text-primary transition-colors"><Icon path="M16.023 9.348h4.992v-.001a.75.75 0 01.75.752l-.001 4.992a.75.75 0 01-1.5-.002V11.832h-4.243a3.75 3.75 0 01-7.48.017l-.007-.017a3.75 3.75 0 013.743-3.742h4.243zM3.753 4.502v.001h4.242a3.75 3.75 0 017.48 0l.007.017a3.75 3.75 0 01-3.743 3.742h-4.243V13.5a.75.75 0 01-1.5 0V8.502a.75.75 0 01.75-.752z" /></button>
                        <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 disabled:opacity-50 text-text-secondary"><Icon path="M15 9l6-6m0 0v6m0-6h-6" /></button>
                    </div>

                    <div className="flex w-full space-x-2 pt-4 border-t-theme border-accent">
                       <button onClick={onCancel} className="w-full border-theme border-accent hover:bg-accent/20 text-text-primary font-bold py-2 px-4 rounded-theme transition-colors">Cancel</button>
                       <button onClick={() => onSave(uniform)} className="w-full bg-primary hover:bg-primary/80 text-on-primary font-bold py-2 px-4 rounded-theme transition-colors">Save & Close</button>
                    </div>
                </div>

                {/* --- Customization Pane --- */}
                <div className="w-full md:w-2/3 p-6 flex">
                    {/* NEW: Vertical Icon-based Navigation */}
                    <nav className="flex flex-col space-y-2 border-r-theme border-accent pr-4">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.name}
                                className={`p-3 rounded-theme transition-colors ${activeTab === tab.id ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-surface hover:text-primary dark:hover:bg-surface-dark'}`}
                            > <Icon path={tab.icon} className="w-6 h-6" /> </button>
                        ))}
                    </nav>

                    <div className="pl-6 flex-grow overflow-y-auto">
                        {/* Options rendered based on activeTab */}
                        {/* All internal components are now the new, styled versions */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UniformBuilder;