// src/components/debug/DebugAuth.js - Updated to use userStore directly
import React from 'react';
import { useUserStore } from '../../store/userStore';

const DebugAuth = () => {
    const { user, loggedInProfile, isLoadingAuth } = useUserStore();
    
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }
    
    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            background: 'black',
            color: 'white',
            padding: '10px',
            fontSize: '12px',
            zIndex: 9999,
            borderRadius: '4px',
            fontFamily: 'monospace',
            maxWidth: '300px',
            wordBreak: 'break-all'
        }}>
            <div><strong>Auth Debug (userStore):</strong></div>
            <div>Loading: {String(isLoadingAuth)}</div>
            <div>User ID: {user?.uid || 'null'}</div>
            <div>User Email: {user?.email || 'null'}</div>
            <div>Profile: {loggedInProfile?.username || 'null'}</div>
            <div>DataNamespace: {process.env.REACT_APP_DATA_NAMESPACE || 'undefined'}</div>
            <div>Timestamp: {new Date().toLocaleTimeString()}</div>
        </div>
    );
};

export default DebugAuth;