// src/components/debug/UserPropDebug.js - Test user prop passing
import React from 'react';
import { useAuth } from '../../context/AuthContext';

const UserPropDebug = ({ user: propsUser }) => {
    const { user: contextUser, loggedInProfile } = useAuth();
    
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }
    
    return (
        <div style={{
            position: 'fixed',
            top: '100px',
            left: '10px',
            background: 'red',
            color: 'white',
            padding: '10px',
            fontSize: '11px',
            zIndex: 9999,
            borderRadius: '4px',
            fontFamily: 'monospace',
            maxWidth: '300px',
            wordBreak: 'break-all'
        }}>
            <div><strong>User Prop Test:</strong></div>
            <div>Props User: {propsUser?.uid || 'null'}</div>
            <div>Context User: {contextUser?.uid || 'null'}</div>
            <div>Profile: {loggedInProfile?.username || 'null'}</div>
            <div>Are Equal: {String(propsUser?.uid === contextUser?.uid)}</div>
        </div>
    );
};

export default UserPropDebug;