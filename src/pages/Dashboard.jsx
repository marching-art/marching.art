import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import CorpsManager from '../components/dashboard/CorpsManager';
import CorpsRegistrationModal from '../components/CorpsRegistrationModal';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// This is the view for users *without* a corps
const RegisterCorps = ({ onRegisterClick }) => (
  <Card className="max-w-md">
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Welcome, Director!</h2>
      <p className="text-text-secondary mb-4">
        You don't have an active corps yet. Register one to get started.
      </p>
      <Button variant="primary" icon={Plus} onClick={onRegisterClick}>
        Register a New Corps
      </Button>
    </div>
  </Card>
);

// This is the main Dashboard Page
const Dashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { loggedInProfile, isLoadingAuth } = useAuth();

  // Task 2.2: Fetch game-settings/season doc
  const [seasonDoc, loadingSeason] = useDocument(doc(db, 'game-settings', 'season'));

  const renderLoading = () => (
    <div className="flex items-center text-text-secondary">
      <Loader2 className="animate-spin w-5 h-5 mr-2" />
      Loading your dashboard...
    </div>
  );

  const renderSeasonInfo = () => (
    <div className="mb-4 p-3 bg-surface rounded-md max-w-md">
      <p className="font-bold text-sm text-primary">
        {loadingSeason ? 'Loading season...' : `Season: ${seasonDoc?.data()?.name}`}
      </p>
      <p className="text-xs text-text-secondary uppercase">
        {loadingSeason ? '...' : `Status: ${seasonDoc?.data()?.status}`}
      </p>
    </div>
  );

  const renderCorpsView = () => {
    // Check for the *specific* corps class from your plan
    const activeCorps = loggedInProfile?.corps?.soundSport; 

    if (activeCorps) {
      // Task 2.5: User has a corps, show the manager
      return <CorpsManager />;
    } else {
      // Task 2.3: User needs to register
      return <RegisterCorps onRegisterClick={() => setIsModalOpen(true)} />;
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">My Corps Dashboard</h1>
      
      {renderSeasonInfo()}
      
      {isLoadingAuth ? renderLoading() : renderCorpsView()}

      {/* The registration modal is only mounted when needed */}
      {isModalOpen && (
        <CorpsRegistrationModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default Dashboard;