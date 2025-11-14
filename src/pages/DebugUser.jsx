// Temporary debug component to see user info
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';

const DebugUser = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const adminStatus = await adminHelpers.isAdmin();
        setIsAdmin(adminStatus);

        const userClaims = await adminHelpers.getCurrentUserClaims();
        setClaims(userClaims);
      }
    };
    checkAdmin();
  }, [user]);

  if (!user) {
    return <div className="p-8">Not logged in</div>;
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">User Debug Info</h1>

      <div className="bg-gray-800 p-4 rounded">
        <h2 className="font-bold mb-2">User Info</h2>
        <div className="font-mono text-sm space-y-1">
          <div><strong>UID:</strong> {user.uid}</div>
          <div><strong>Email:</strong> {user.email}</div>
          <div><strong>Display Name:</strong> {user.displayName || 'None'}</div>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h2 className="font-bold mb-2">Admin Status</h2>
        <div className="font-mono text-sm space-y-1">
          <div><strong>Is Admin:</strong> {isAdmin ? 'YES' : 'NO'}</div>
          <div><strong>Expected Admin UID:</strong> o8vfRCOevjTKBY0k2dISlpiYiIH2</div>
          <div><strong>UIDs Match:</strong> {user.uid === 'o8vfRCOevjTKBY0k2dISlpiYiIH2' ? 'YES' : 'NO'}</div>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h2 className="font-bold mb-2">Custom Claims</h2>
        <pre className="font-mono text-sm overflow-auto">
          {claims ? JSON.stringify(claims, null, 2) : 'Loading...'}
        </pre>
      </div>

      <div className="bg-yellow-900 p-4 rounded">
        <h2 className="font-bold mb-2">Action Required</h2>
        <p className="text-sm">
          Copy your UID from above and update it in:
          <br/>- src/firebase.js (line 218)
          <br/>- firestore.rules (line 8)
        </p>
      </div>
    </div>
  );
};

export default DebugUser;
