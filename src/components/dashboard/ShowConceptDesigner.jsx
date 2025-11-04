import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { SHOW_THEMES, MUSIC_SOURCES, DRILL_STYLES, getShowConceptTags } from '../../utils/showConceptData';
import Icon from '../ui/Icon';

const ShowConceptDesigner = ({ userId, corpsClass, initialConcept = {}, corpsData }) => {
    const [theme, setTheme] = useState(initialConcept.theme || '');
    const [musicSource, setMusicSource] = useState(initialConcept.musicSource || '');
    const [drillStyle, setDrillStyle] = useState(initialConcept.drillStyle || '');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [showTags, setShowTags] = useState([]);

    useEffect(() => {
        // Update displayed tags when selections change
        const concept = { theme, musicSource, drillStyle };
        const tags = getShowConceptTags(concept);
        setShowTags(tags);
    }, [theme, musicSource, drillStyle]);

    const handleSave = async () => {
        if (!theme || !musicSource || !drillStyle) {
            setMessage('Please select all three elements of your show concept.');
            return;
        }

        setIsSaving(true);
        setMessage('');

        try {
            const userProfileRef = doc(
                db,
                'artifacts',
                dataNamespace,
                'users',
                userId,
                'profile',
                'data'
            );

            const showConcept = {
                theme,
                musicSource,
                drillStyle,
                updatedAt: new Date()
            };

            await updateDoc(userProfileRef, {
                [`corps.${corpsClass}.showConcept`]: showConcept
            });

            setMessage('✓ Show concept saved! Synergy bonuses active.');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving show concept:', error);
            setMessage('Error saving show concept. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const isComplete = theme && musicSource && drillStyle;
    const hasChanges = theme !== initialConcept.theme || 
                       musicSource !== initialConcept.musicSource || 
                       drillStyle !== initialConcept.drillStyle;

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <div className="flex items-center gap-3 mb-4">
                <Icon name="Lightbulb" className="w-6 h-6 text-primary dark:text-primary-dark" />
                <h3 className="text-xl font-bold text-primary dark:text-primary-dark">
                    Show Concept Design
                </h3>
            </div>

            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-6">
                Design your show's artistic direction. Matching your concept with your corps selections earns synergy bonuses.
            </p>

            <div className="space-y-4 mb-6">
                {/* Theme Selection */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Primary Theme
                    </label>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                        <option value="">-- Select Theme --</option>
                        {SHOW_THEMES.map(t => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Music Source Selection */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Music Source
                    </label>
                    <select
                        value={musicSource}
                        onChange={(e) => setMusicSource(e.target.value)}
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                        <option value="">-- Select Music Source --</option>
                        {MUSIC_SOURCES.map(s => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Drill Style Selection */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Drill Style
                    </label>
                    <select
                        value={drillStyle}
                        onChange={(e) => setDrillStyle(e.target.value)}
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                        <option value="">-- Select Drill Style --</option>
                        {DRILL_STYLES.map(d => (
                            <option key={d.value} value={d.value}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Synergy Tags Display */}
            {showTags.length > 0 && (
                <div className="mb-6 p-4 bg-primary/10 dark:bg-primary-dark/10 rounded-theme border border-primary/20 dark:border-primary-dark/20">
                    <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Active Synergy Tags:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {showTags.map(tag => (
                            <span
                                key={tag}
                                className="px-3 py-1 bg-primary/20 dark:bg-primary-dark/20 text-primary dark:text-primary-dark rounded-full text-xs font-medium"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-2">
                        Corps selections matching these tags earn bonus points
                    </p>
                </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-between">
                <button
                    onClick={handleSave}
                    disabled={isSaving || !isComplete || !hasChanges}
                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-6 rounded-theme transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? 'Saving...' : hasChanges ? 'Save Show Concept' : 'Concept Saved'}
                </button>
                
                {message && (
                    <p className={`text-sm font-semibold ${
                        message.includes('✓') 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                    }`}>
                        {message}
                    </p>
                )}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-secondary/10 dark:bg-secondary-dark/10 rounded-theme border border-secondary/20 dark:border-secondary-dark/20">
                <div className="flex items-start gap-2">
                    <Icon name="Info" className="w-5 h-5 text-secondary dark:text-secondary-dark mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        <p className="font-semibold mb-1">How Synergy Works:</p>
                        <p>
                            Each historical corps has characteristic tags based on their actual performances. 
                            When your show concept tags match your selected corps' tags, you earn up to 2 bonus 
                            points per caption. Choose wisely to maximize your synergy!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShowConceptDesigner;
