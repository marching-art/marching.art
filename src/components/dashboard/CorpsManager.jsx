import React, { useState } from 'react';
import { Edit, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import CaptionSelectionModal from './CaptionSelectionModal';
import ShowConceptModal from './ShowConceptModal';

/**
 * Displays the main Corps Manager view.
 *
 */
const CorpsManager = () => {
  const { loggedInProfile } = useAuth();
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  
  // Get the active corps (e.g., soundSport)
  // This logic can be expanded later
  const activeCorps = loggedInProfile?.corps?.soundSport;

  if (!activeCorps) {
    // This should ideally be handled by the parent Dashboard page
    return <div>Error: No active corps found.</div>;
  }

  return (
    <>
      <Card className="max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-2">{activeCorps.corpsName}</h2>
          <p className="text-text-secondary mb-1">
            <Shield className="inline-block w-4 h-4 mr-1" />
            {activeCorps.class || 'SoundSport'} Class
          </p>
          <p className="text-text-secondary mb-4 text-sm">
            Show Concept: {activeCorps.showConcept?.primaryTheme || activeCorps.showConcept || 'Not Set'}
          </p>
          <div className="flex space-x-2">
            <Button 
              variant="primary" 
              icon={Edit} 
              onClick={() => setShowCaptionModal(true)}
            >
              Select Captions
            </Button>
            <Button 
              variant="secondary" 
              icon={Edit}
              onClick={() => setShowConceptModal(true)}
            >
              Edit Show
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Task 2.6: Caption Selection Modal */}
      <CaptionSelectionModal
        isOpen={showCaptionModal}
        onClose={() => setShowCaptionModal(false)}
        currentLineup={activeCorps.lineup || {}}
        corpsClass="soundSport"
      />
      
      {/* Task 2.8: Show Concept Modal */}
      <ShowConceptModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        currentConcept={activeCorps.showConcept || {}}
        corpsClass="soundSport"
      />
    </>
  );
};

export default CorpsManager;