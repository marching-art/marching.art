import React, { useState } from 'react';
import Modal from './ui/Modal';
import TextInput from './ui/TextInput';
import Button from './ui/Button';

[cite_start]// This component will be used to register a new corps for a user. [cite: 30, 31]
const CorpsRegistrationModal = ({ isOpen, onClose }) => {
  const [corpsName, setCorpsName] = useState('');
  const [location, setLocation] = useState('');
  const [showConcept, setShowConcept] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!corpsName || !location || !showConcept) {
      setError('All fields are required.');
      return;
    }
    
    setIsRegistering(true);
    setError(null);
    
    try {
      [cite_start]// TODO: Call your 'registerCorps' cloud function here (Task 2.4). [cite: 32]
      // It should pass an object like:
      [cite_start]// { corpsName, location, showConcept, class: 'soundSport' } [cite: 32]
      console.log('Simulating corps registration:', { corpsName, location, showConcept });
      
      // On success:
      onClose();
      setCorpsName('');
      setLocation('');
      setShowConcept('');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-2">Register Your Corps</h2>
        <p className="text-sm text-text-secondary mb-4">
          [cite_start]Begin your legacy by founding a new SoundSport-class corps. [cite: 32]
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <TextInput
            label="Corps Name"
            value={corpsName}
            onChange={(e) => setCorpsName(e.target.value)}
            placeholder="e.g., The Midnight Vanguard"
          />
          <TextInput
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Ann Arbor, MI"
          />
          <TextInput
            label="Show Concept"
            value={showConcept}
            onChange={(e) => setShowConcept(e.target.value)}
            placeholder="e.g., Echoes of the Cosmos"
          />
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              variant="primary" 
              disabled={isRegistering}
            >
              {isRegistering ? 'Registering...' : 'Found Corps'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CorpsRegistrationModal;