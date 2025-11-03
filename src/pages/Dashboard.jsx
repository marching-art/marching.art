import React, { useState } from 'react';
import { Plus, Edit, Shield, Loader2 } from 'lucide-react';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import CorpsRegistrationModal from '../components/CorpsRegistrationModal';

// --- Task 2.5: Corps Manager View ---
// This component shows *after* a corps is registered
const CorpsManager = ({ corps }) => (
  <Card className="max-w-md">
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">{corps.corpsName}</h2>
      <p className="text-text-secondary mb-1">
        <Shield className="inline-block w-4 h-4 mr-1" />
        {corps.class || 'SoundSport'} Class
      </p>
      <p className="text-text-secondary mb-4 text-sm">
        Concept: {corps.showConcept}
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
// This component shows *before* a corps is registered
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

// --- Main Dashboard Page ---
const Dashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { loggedInProfile, isLoadingAuth } = useAuth(); // Use your hook

  // --- Task 2.2: Fetch game-settings/season doc ---
  const seasonRef = doc(db, 'game-settings', 'season');
  const [seasonData, loadingSeason] = useDocumentData(seasonRef);

  // --- Helper Components for Loading/Error ---
  const renderLoading = () => (
    <div className="flex items-center text-text-secondary">
      <Loader2 className="animate-spin w-5 h-5 mr-2" />
      Loading your dashboard...
    </div>
  );

  const renderSeasonInfo = () => (
    <div className="mb-4 p-3 bg-surface rounded-md max-w-md">
      <p className="font-bold text-sm text-primary">
        {loadingSeason ? 'Loading season...' : `Season: ${seasonData?.name}`}
      </p>
      <p className="text-xs text-text-secondary uppercase">
        {loadingSeason ? '...' : `Status: ${seasonData?.status}`}
      </p>
    </div>
  );

  // --- Main Render Logic ---
  const renderCorpsView = () => {
    // Check for the *specific* corps class from your plan
    const activeCorps = loggedInProfile?.corps?.soundSport;

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
      
      {isLoadingAuth ? renderLoading() : renderCorpsView()}

      <CorpsRegistrationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;