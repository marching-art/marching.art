// src/components/profile/UniformManager.js
// Manages up to 4 uniforms per corps with comprehensive uniform builder integration
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';
import UniformBuilder from './UniformBuilder';
import UniformDisplay from './UniformDisplay';
import Icon from '../ui/Icon';

const UniformManager = ({ 
    userId, 
    corpsClass, 
    corpsData, 
    onClose 
}) => {
    const [uniforms, setUniforms] = useState([null, null, null, null]);
    const [activeUniformSlot, setActiveUniformSlot] = useState(null);
    const [isBuildingUniform, setIsBuildingUniform] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const corpsClassConfig = CORPS_CLASSES[corpsClass];
    const corpsName = corpsData?.corpsName || `${corpsClassConfig?.name || 'Corps'}`;

    useEffect(() => {
        const loadUniforms = async () => {
            try {
                const profileRef = doc(db, `artifacts/${dataNamespace}/users/${userId}/profile/data`);
                const profileSnap = await getDoc(profileRef);
                
                if (profileSnap.exists()) {
                    const profileData = profileSnap.data();
                    const corpsUniforms = profileData.corps?.[corpsClass]?.uniforms || {};
                    
                    const loadedUniforms = [null, null, null, null];
                    Object.keys(corpsUniforms).forEach(slotKey => {
                        const slotIndex = parseInt(slotKey);
                        if (slotIndex >= 0 && slotIndex < 4) {
                            loadedUniforms[slotIndex] = corpsUniforms[slotKey];
                        }
                    });
                    
                    setUniforms(loadedUniforms);
                }
            } catch (error) {
                console.error('Error loading uniforms:', error);
            }
            setIsLoading(false);
        };

        loadUniforms();
    }, [userId, corpsClass]);

    const handleCreateUniform = (slotIndex) => {
        setActiveUniformSlot(slotIndex);
        setIsBuildingUniform(true);
    };

    const handleEditUniform = (slotIndex) => {
        setActiveUniformSlot(slotIndex);
        setIsBuildingUniform(true);
    };

    const handleSaveUniform = async (uniform) => {
        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${userId}/profile/data`);
            
            // Update the specific uniform slot
            await updateDoc(profileRef, {
                [`corps.${corpsClass}.uniforms.${activeUniformSlot}`]: {
                    ...uniform,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });

            // Update local state
            const updatedUniforms = [...uniforms];
            updatedUniforms[activeUniformSlot] = uniform;
            setUniforms(updatedUniforms);
            
            setIsBuildingUniform(false);
            setActiveUniformSlot(null);
        } catch (error) {
            console.error('Error saving uniform:', error);
        }
    };

    const handleDeleteUniform = async (slotIndex) => {
        if (!window.confirm('Are you sure you want to delete this uniform? This action cannot be undone.')) {
            return;
        }

        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${userId}/profile/data`);
            
            // Remove the uniform from the database
            await updateDoc(profileRef, {
                [`corps.${corpsClass}.uniforms.${slotIndex}`]: null
            });

            // Update local state
            const updatedUniforms = [...uniforms];
            updatedUniforms[slotIndex] = null;
            setUniforms(updatedUniforms);
        } catch (error) {
            console.error('Error deleting uniform:', error);
        }
    };

    const handleDuplicateUniform = (slotIndex) => {
        const sourceUniform = uniforms[slotIndex];
        if (!sourceUniform) return;

        // Find the next empty slot
        const emptySlotIndex = uniforms.findIndex(uniform => uniform === null);
        if (emptySlotIndex === -1) {
            alert('All uniform slots are full. Please delete a uniform first.');
            return;
        }

        const duplicatedUniform = {
            ...sourceUniform,
            name: `${sourceUniform.name} (Copy)`,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        setActiveUniformSlot(emptySlotIndex);
        setIsBuildingUniform(true);
    };

    const getUniformSlotStatus = (slotIndex) => {
        const uniform = uniforms[slotIndex];
        if (!uniform) return 'empty';
        return 'filled';
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
                <div className="bg-surface dark:bg-surface-dark rounded-theme p-8 border border-accent dark:border-accent-dark">
                    <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="text-text-primary dark:text-text-primary-dark">Loading uniforms...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Uniform Builder Modal */}
            {isBuildingUniform && (
                <UniformBuilder
                    uniform={uniforms[activeUniformSlot]}
                    onSave={handleSaveUniform}
                    onCancel={() => {
                        setIsBuildingUniform(false);
                        setActiveUniformSlot(null);
                    }}
                    UniformDisplayComponent={UniformDisplay}
                    isCorpsMode={true}
                    uniformSlot={activeUniformSlot}
                    corpsName={corpsName}
                />
            )}

            {/* Main Manager Interface */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-40 p-4">
                <div className="bg-surface dark:bg-surface-dark w-full max-w-6xl h-[90vh] rounded-theme shadow-theme overflow-hidden border border-accent dark:border-accent-dark">
                    
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary-dark/10 dark:to-accent-dark/10 p-6 border-b border-accent dark:border-accent-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                    {corpsName} Uniform Collection
                                </h2>
                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    Design up to 4 unique uniforms for your {corpsClassConfig?.name} corps
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark p-2 rounded-full hover:bg-accent/20 dark:hover:bg-accent-dark/20 transition-colors"
                                aria-label="Close"
                            >
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Progress bar showing used slots */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                                <span>Uniform Slots</span>
                                <span>{uniforms.filter(u => u !== null).length} / 4</span>
                            </div>
                            <div className="w-full bg-background dark:bg-background-dark rounded-full h-2">
                                <div 
                                    className="bg-primary dark:bg-primary-dark h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(uniforms.filter(u => u !== null).length / 4) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Uniform Grid */}
                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                            {uniforms.map((uniform, index) => (
                                <UniformSlotCard
                                    key={index}
                                    slotIndex={index}
                                    uniform={uniform}
                                    status={getUniformSlotStatus(index)}
                                    onCreateUniform={() => handleCreateUniform(index)}
                                    onEditUniform={() => handleEditUniform(index)}
                                    onDeleteUniform={() => handleDeleteUniform(index)}
                                    onDuplicateUniform={() => handleDuplicateUniform(index)}
                                    corpsName={corpsName}
                                />
                            ))}
                        </div>

                        {/* Tips Section */}
                        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-theme border border-blue-200 dark:border-blue-800">
                            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3">
                                💡 Uniform Design Tips
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
                                <div>
                                    <strong>Historical Accuracy:</strong> Use era-appropriate styles for authentic looks
                                </div>
                                <div>
                                    <strong>Color Coordination:</strong> Try the preset palettes for professional combinations
                                </div>
                                <div>
                                    <strong>Multiple Looks:</strong> Create variations for different performances or seasons
                                </div>
                                <div>
                                    <strong>DCI Inspiration:</strong> Study legendary corps uniforms in the presets section
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// Individual uniform slot card component
const UniformSlotCard = ({ 
    slotIndex, 
    uniform, 
    status, 
    onCreateUniform, 
    onEditUniform, 
    onDeleteUniform, 
    onDuplicateUniform,
    corpsName 
}) => {
    if (status === 'empty') {
        return (
            <div className="bg-background dark:bg-background-dark rounded-theme border-2 border-dashed border-accent dark:border-accent-dark p-6 text-center hover:border-primary dark:hover:border-primary-dark transition-colors">
                <div className="py-8">
                    <div className="text-6xl mb-4">👕</div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Uniform Slot {slotIndex + 1}
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                        Create a new uniform design
                    </p>
                    <button
                        onClick={onCreateUniform}
                        className="bg-primary hover:opacity-90 text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
                    >
                        <Icon path="M12 4v16m8-8H4" className="w-4 h-4 inline mr-2" />
                        Create Uniform
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark shadow-md hover:shadow-lg transition-shadow overflow-hidden">
            {/* Uniform Preview */}
            <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-accent dark:border-accent-dark">
                <div className="flex justify-center">
                    <UniformDisplay uniform={uniform} size="medium" showInfo={false} />
                </div>
            </div>

            {/* Uniform Info */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark truncate">
                            {uniform.name}
                        </h3>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Slot {slotIndex + 1} • {corpsName}
                        </p>
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark text-right">
                        {uniform.updatedAt && (
                            <div>Updated {new Date(uniform.updatedAt.seconds * 1000).toLocaleDateString()}</div>
                        )}
                    </div>
                </div>

                {/* Uniform Details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary dark:text-text-secondary-dark mb-4">
                    <div>
                        <strong>Headwear:</strong> {uniform.headwear?.style || 'None'}
                    </div>
                    <div>
                        <strong>Jacket:</strong> {uniform.jacket?.style || 'Classic'}
                    </div>
                    <div>
                        <strong>Pants:</strong> {uniform.pants?.style || 'Plain'}
                    </div>
                    <div>
                        <strong>Shoes:</strong> {uniform.shoes?.style || 'White'}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                    <button
                        onClick={onEditUniform}
                        className="flex-1 bg-primary hover:opacity-90 text-on-primary text-sm py-2 px-3 rounded-theme font-medium transition-colors"
                    >
                        <Icon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" className="w-4 h-4 inline mr-1" />
                        Edit
                    </button>
                    <button
                        onClick={onDuplicateUniform}
                        className="bg-secondary hover:opacity-90 text-on-secondary text-sm py-2 px-3 rounded-theme font-medium transition-colors"
                        title="Duplicate this uniform"
                    >
                        <Icon path="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDeleteUniform}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded-theme font-medium transition-colors"
                        title="Delete this uniform"
                    >
                        <Icon path="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UniformManager;