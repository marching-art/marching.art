// CorpsRegistrationModal - Modal for registering a new corps
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import Portal from '../Portal';

const CLASSES = [
  {
    id: 'world',
    name: 'World Class',
    description: '10,000 XP or 5,000 CC',
    color: 'bg-gold-500'
  },
  {
    id: 'open',
    name: 'Open Class',
    description: '5,000 XP or 2,500 CC',
    color: 'bg-purple-500'
  },
  {
    id: 'aClass',
    name: 'A Class',
    description: '3,000 XP or 1,000 CC',
    color: 'bg-blue-500'
  },
  {
    id: 'soundSport',
    name: 'SoundSport',
    description: 'Always available',
    color: 'bg-green-500'
  }
];

const CorpsRegistrationModal = ({ onClose, onSubmit, unlockedClasses, defaultClass }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    showConcept: '',
    class: defaultClass || 'soundSport'
  });

  const classes = CLASSES.map(cls => ({
    ...cls,
    unlocked: cls.id === 'soundSport' || unlockedClasses.includes(cls.id)
  }));

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
            <h2 className="text-3xl font-display font-bold text-gradient mb-6">
              Register Your Corps
            </h2>

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

              {/* Class Selection */}
              <div>
                <label className="label">Competition Class</label>
                <div className="grid grid-cols-2 gap-3">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      className={`
                        relative p-4 rounded-lg border-2 transition-all duration-300
                        ${formData.class === cls.id
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-cream-500/20 hover:border-cream-500/40'
                        }
                        ${!cls.unlocked ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      onClick={() => cls.unlocked && setFormData({ ...formData, class: cls.id })}
                      disabled={!cls.unlocked}
                    >
                      {!cls.unlocked && (
                        <div className="absolute top-2 right-2">
                          <Lock className="w-4 h-4 text-cream-500/40" />
                        </div>
                      )}
                      {cls.unlocked && formData.class === cls.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-gold-500" />
                        </div>
                      )}
                      <div className={`w-2 h-2 ${cls.color} rounded-full mb-2`} />
                      <p className="font-semibold text-cream-100">{cls.name}</p>
                      <p className="text-xs text-cream-500/60 mt-1">{cls.description}</p>
                    </button>
                  ))}
                </div>
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
                  Register Corps
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default CorpsRegistrationModal;
