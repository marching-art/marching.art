import React, { useState } from 'react';
import { Plus, Edit, Shield } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext'; // Import the useAuth hook
import CorpsRegistrationModal from '../components/CorpsRegistrationModal'; // Import the modal

// --- Task 2.5: Corps Manager View ---
const CorpsManager = ({ corps }) => (
  <Card className="max-w-md">
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">{corps.corpsName}</h2>
      <p className="text-text-secondary mb-4">
        <Shield className="inline-block w-4 h-4 mr-1" />
        {corps.class || 'SoundSport'} Class
      </p>
      <div className="flex space-x-2">
        <Button variant="primary" icon={Edit}>
          Select Captions
        </Button>
        <Button variant="secondary" icon={Edit}>
          Edit Show
        </Button>
      </div>
    </div>
  </Card>
);

// --- Task 2.3: Registration View ---
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

const Dashboard = () => {
  // --- Task 2.2: Fetch Season Data ---
  const seasonRef = doc(db, 'game-settings', 'season');
  const [seasonData, loadingSeason] = useDocumentData(seasonRef);
  
  // --- Auth & Profile Data ---
  const { profile, loading: loadingProfile } = useAuth();
  
  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isLoading = loadingSeason || loadingProfile;

  // --- Render Logic ---
  const renderSeasonInfo = () => (
    <div className="mb-4 p-3 bg-cream-dark rounded-md max-w-md">
      <p className="font-bold text-sm text-gold">
        {loadingSeason ? 'Loading season...' : `Season: ${seasonData?.name}`}
      </p>
      <p className="text-xs text-text-secondary uppercase">
        {loadingSeason ? '...' : `Status: ${seasonData?.status}`}
      </p>
    </div>
  );

  const renderCorpsView = () => {
    if (isLoading) {
      return <p className="text-text-secondary">Loading dashboard...</p>;
    }
    
    // Check for corps data (as per Task 2.5)
    const activeCorps = profile?.corps?.soundSport; // Or your default class

    if (activeCorps) {
      return <CorpsManager corps={activeCorps} />;
    } else {
      return <RegisterCorps onRegisterClick={() => setIsModalOpen(true)} />;
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">My Corps Dashboard</h1>
      
      {renderSeasonInfo()}
      {renderCorpsView()}

      <CorpsRegistrationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;