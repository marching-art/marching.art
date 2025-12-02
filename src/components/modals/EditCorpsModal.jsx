// EditCorpsModal - Modal for editing existing corps details
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Portal from '../Portal';

const EditCorpsModal = ({ onClose, onSubmit, currentData }) => {
  const [formData, setFormData] = useState({
    name: currentData.name || '',
    location: currentData.location || '',
    showConcept: currentData.showConcept || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-display font-bold text-gradient">
                Edit Corps Details
              </h2>
              <button onClick={onClose} className="btn-ghost p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Corps Name */}
              <div>
                <label className="label">Corps Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter your corps name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={50}
                />
              </div>

              {/* Location */}
              <div>
                <label className="label">Home Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="City, State"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                  maxLength={50}
                />
              </div>

              {/* Show Concept */}
              <div>
                <label className="label">Show Concept</label>
                <textarea
                  className="textarea h-24"
                  placeholder="Describe your show concept for this season..."
                  value={formData.showConcept}
                  onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                  required
                  maxLength={500}
                />
                <p className="text-xs text-cream-500/40 mt-1">
                  {formData.showConcept.length}/500 characters
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default EditCorpsModal;
