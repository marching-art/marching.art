import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Loader2 } from 'lucide-react';
// TODO: Import your 'saveShowConcept' callable function
// import { saveShowConcept } from '../../firebase/functions';

// Placeholder data - this should be fetched from Firestore
const SYNERGY_OPTIONS = {
  themes: [
    { value: 'journey', label: 'Journey/Discovery' },
    { value: 'conflict', label: 'Conflict/Resolution' },
    { value: 'abstract', label: 'Abstract/Geometric' },
    { value: 'nature', label: 'Nature/Elements' },
  ],
  music: [
    { value: 'classical', label: 'Classical' },
    { value: 'jazz', label: 'Jazz/Big Band' },
    { value: 'electronic', label: 'Electronic/Modern' },
    { value: 'soundtrack', label: 'Film Soundtrack' },
  ],
  drill: [
    { value: 'symmetrical', label: 'Symmetrical/Linear' },
    { value: 'asymmetrical', label: 'Asymmetrical/Curvilinear' },
    { value: 'follow', label: "Follow-the-Leader" },
    { value: 'scatter', label: 'Fragmented/Scatter' },
  ],
};

// Helper component for the dropdowns
const SynergySelect = ({ label, options, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-text-secondary mb-1">
      {label}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
    >
      <option value="">-- Select {label} --</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const ShowConceptModal = ({ isOpen, onClose, currentConcept, corpsClass }) => {
  const [concept, setConcept] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load current concept when modal opens
  useEffect(() => {
    if (isOpen) {
      setConcept(currentConcept || {});
    }
  }, [isOpen, currentConcept]);

  const handleChange = (field, value) => {
    setConcept(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // TODO: Call your 'saveShowConcept' function
      // It should pass an object like: { concept, corpsClass }
      console.log('Saving new concept...', { concept, corpsClass });
      // await saveShowConcept({ concept, corpsClass });
      
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save concept.');
    } finally {
      setIsSaving(false);
    }
  };

  // Per your guidelines, limit to 500 characters 
  const charLimit = 500;
  const charsRemaining = charLimit - (concept.description?.length || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Design Your Show Concept</h2>
        <div className="flex flex-col space-y-4">
          
          {/* Synergy Dropdowns */}
          <SynergySelect
            label="Primary Theme"
            options={SYNERGY_OPTIONS.themes}
            value={concept.primaryTheme || ''}
            onChange={(e) => handleChange('primaryTheme', e.target.value)}
          />
          <SynergySelect
            label="Music Source"
            options={SYNERGY_OPTIONS.music}
            value={concept.musicSource || ''}
            onChange={(e) => handleChange('musicSource', e.target.value)}
          />
          <SynergySelect
            label="Drill Style"
            options={SYNERGY_OPTIONS.drill}
            value={concept.drillStyle || ''}
            onChange={(e) => handleChange('drillStyle', e.target.value)}
          />

          {/* Show Concept Description  */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Show Concept Description
            </label>
            <textarea
              value={concept.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              rows="4"
              placeholder="Describe your show's concept..."
              maxLength={charLimit}
            />
            <p className={`text-xs text-right ${charsRemaining < 0 ? 'text-red-500' : 'text-text-secondary'}`}>
              {charsRemaining} characters remaining
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSubmit} 
              variant="primary" 
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : 'Save Concept'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ShowConceptModal;