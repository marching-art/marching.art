import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
// TODO: Import your 'saveShowConcept' callable function

const ShowConceptModal = ({ isOpen, onClose, currentConcept, corpsClass }) => {
  const [concept, setConcept] = useState(currentConcept);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setConcept(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    // TODO: Call your 'saveShowConcept' function
    console.log('Saving concept...', { concept, corpsClass });
    // await saveShowConcept({ concept, corpsClass });
    setIsSaving(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Design Your Show Concept</h2>
        <div className="flex flex-col space-y-3">
          {/* Task 2.8: Render dropdowns */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Primary Theme
            </label>
            <input
              type="text"
              value={concept.primaryTheme || ''}
              onChange={(e) => handleChange('primaryTheme', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20"
              placeholder="e.g., 'Metamorphosis'"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Music Source
            </label>
            <input
              type="text"
              value={concept.musicSource || ''}
              onChange={(e) => handleChange('musicSource', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20"
              placeholder="e.g., 'Music of Philip Glass'"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Drill Style
            </label>
            <input
              type="text"
              value={concept.drillStyle || ''}
              onChange={(e) => handleChange('drillStyle', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20"
              placeholder="e.g., 'Geometric and abstract'"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} variant="primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Concept'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ShowConceptModal;