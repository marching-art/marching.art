// src/components/auth/AvatarUpload.js - Avatar upload component with image optimization
import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const AvatarUpload = ({ currentAvatar, onAvatarUpdate, size = 'large' }) => {
    const { uploadAvatar, deleteAvatar, loading } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    const sizeClasses = {
        small: 'w-12 h-12',
        medium: 'w-20 h-20',
        large: 'w-32 h-32',
        xlarge: 'w-48 h-48'
    };

    // Image compression function
    const compressImage = (file, maxWidth = 400, quality = 0.8) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                const newWidth = img.width * ratio;
                const newHeight = img.height * ratio;

                // Set canvas dimensions
                canvas.width = newWidth;
                canvas.height = newHeight;

                // Draw and compress
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    };

    // Validate file
    const validateFile = (file) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const maxSize = 10 * 1024 * 1024; // 10MB before compression

        if (!validTypes.includes(file.type)) {
            throw new Error('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
        }

        if (file.size > maxSize) {
            throw new Error('Image must be smaller than 10MB');
        }

        return true;
    };

    // Handle file selection
    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Validate file
            validateFile(file);

            // Create preview
            const previewUrl = URL.createObjectURL(file);
            setPreviewUrl(previewUrl);

            setIsUploading(true);

            // Compress image
            const compressedFile = await compressImage(file);
            
            // Create a new File object with compressed data
            const compressedFileObj = new File([compressedFile], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });

            // Upload to Firebase
            const downloadUrl = await uploadAvatar(compressedFileObj);
            
            // Update parent component
            onAvatarUpdate?.(downloadUrl);
            
            // Clean up preview
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            
            toast.success('Avatar updated successfully!');

        } catch (error) {
            console.error('Avatar upload error:', error);
            toast.error(error.message || 'Failed to upload avatar');
            
            // Clean up preview on error
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }
        } finally {
            setIsUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle avatar deletion
    const handleDeleteAvatar = async () => {
        if (!currentAvatar) return;

        try {
            setIsUploading(true);
            await deleteAvatar();
            onAvatarUpdate?.(null);
            toast.success('Avatar removed successfully!');
        } catch (error) {
            console.error('Avatar deletion error:', error);
            toast.error(error.message || 'Failed to remove avatar');
        } finally {
            setIsUploading(false);
        }
    };

    // Generate avatar placeholder with initials
    const getAvatarPlaceholder = (username, displayName) => {
        const name = displayName || username || 'User';
        const initials = name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        
        // Generate a consistent color based on the name
        const colors = [
            'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
            'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
        ];
        
        const colorIndex = name.charCodeAt(0) % colors.length;
        
        return (
            <div className={`${sizeClasses[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold ${
                size === 'small' ? 'text-xs' :
                size === 'medium' ? 'text-sm' :
                size === 'large' ? 'text-lg' :
                'text-2xl'
            }`}>
                {initials}
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Avatar Display */}
            <div className="relative group">
                <div className={`${sizeClasses[size]} rounded-full overflow-hidden border-4 border-accent/20 dark:border-accent-dark/20 bg-surface dark:bg-surface-dark`}>
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                        />
                    ) : currentAvatar ? (
                        <img
                            src={currentAvatar}
                            alt="User avatar"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Fallback to placeholder if image fails to load
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : (
                        getAvatarPlaceholder('User', 'U')
                    )}
                    
                    {/* Fallback placeholder (hidden by default) */}
                    {currentAvatar && (
                        <div className="hidden w-full h-full">
                            {getAvatarPlaceholder('User', 'U')}
                        </div>
                    )}
                </div>

                {/* Loading overlay */}
                {isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Icon 
                            path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" 
                            className="w-6 h-6 text-white animate-spin" 
                        />
                    </div>
                )}

                {/* Edit button overlay */}
                {size !== 'small' && !isUploading && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-primary hover:bg-primary/90 text-on-primary p-2 rounded-full transition-all transform scale-90 group-hover:scale-100"
                            disabled={loading}
                        >
                            <Icon 
                                path="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" 
                                className="w-4 h-4" 
                            />
                        </button>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {size !== 'small' && (
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || loading}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary rounded-lg transition-all flex items-center gap-2"
                    >
                        <Icon 
                            path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" 
                            className="w-4 h-4" 
                        />
                        Upload Photo
                    </button>

                    {currentAvatar && (
                        <button
                            onClick={handleDeleteAvatar}
                            disabled={isUploading || loading}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2"
                        >
                            <Icon 
                                path="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" 
                                className="w-4 h-4" 
                            />
                            Remove
                        </button>
                    )}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Upload guidelines */}
            {size === 'large' && (
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark text-center max-w-xs">
                    Recommended: Square image, at least 400x400px. 
                    Max 10MB. JPEG, PNG, WebP, or GIF.
                </p>
            )}
        </div>
    );
};

export default AvatarUpload;