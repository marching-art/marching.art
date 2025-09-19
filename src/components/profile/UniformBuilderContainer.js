import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import UniformBuilder from './UniformBuilder';
import UniformDisplay from './UniformDisplay';

const UniformBuilderContainer = ({ 
    isOpen, 
    onClose, 
    initialUniform = null, 
    onSaveSuccess = null 
}) => {
    const { user } = useUserStore();
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Default uniform structure
    const defaultUniform = {
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
    };

    const currentUniform = initialUniform || defaultUniform;

    const handleSaveUniform = async (newUniform) => {
        if (!user?.uid) {
            setError('You must be logged in to save your uniform.');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            await updateDoc(profileRef, { uniform: newUniform });
            
            // Call the success callback if provided
            if (onSaveSuccess) {
                onSaveSuccess(newUniform);
            }
            
            onClose();
        } catch (error) {
            console.error('Error saving uniform:', error);
            setError('Failed to save uniform. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <UniformBuilder
            uniform={currentUniform}
            onSave={handleSaveUniform}
            onCancel={handleCancel}
            UniformDisplayComponent={UniformDisplay}
            isSaving={isSaving}
            error={error}
        />
    );
};

export default UniformBuilderContainer;