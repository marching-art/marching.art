// MoveCorpsModal - Modal for moving a corps to a different class
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, X } from 'lucide-react';
import Portal from '../Portal';

const CLASS_NAMES = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class'
};

const AVAILABLE_CLASSES = [
  { id: 'soundSport', name: 'SoundSport', level: 'Entry' },
  { id: 'aClass', name: 'A Class', level: 'Intermediate' },
  { id: 'open', name: 'Open Class', level: 'Advanced' },
  { id: 'world', name: 'World Class', level: 'Elite' }
];

const MoveCorpsModal = ({ onClose, onMove, currentClass, corpsName, unlockedClasses, existingCorps }) => {
  const [selectedClass, setSelectedClass] = useState('');

  const availableClasses = AVAILABLE_CLASSES.filter(cls =>
    cls.id !== currentClass && // Not current class
    unlockedClasses.includes(cls.id) && // User has unlocked it
    !existingCorps[cls.id] // No corps already in that class
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClass) {
      onMove(selectedClass);
    }
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
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-gradient">
                Move Corps
              </h2>
              <button onClick={onClose} className="btn-ghost p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="glass-premium rounded-xl p-4 mb-6">
              <p className="text-sm text-cream-500/60 mb-1">Moving:</p>
              <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
              <p className="text-sm text-cream-500/60 mt-1">
                From: <span className="text-cream-300">{CLASS_NAMES[currentClass]}</span>
              </p>
            </div>

            {availableClasses.length === 0 ? (
              <div className="text-center py-8">
                <Lock className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
                <p className="text-cream-500/60 mb-2">No classes available</p>
                <p className="text-sm text-cream-500/40">
                  Either you haven't unlocked other classes, or you already have a corps in each available class.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Select Target Class</label>
                  <div className="space-y-2">
                    {availableClasses.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClass(cls.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          selectedClass === cls.id
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-cream-500/20 hover:border-cream-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-cream-100">{cls.name}</p>
                            <p className="text-sm text-cream-500/60">{cls.level}</p>
                          </div>
                          {selectedClass === cls.id && (
                            <Check className="w-5 h-5 text-gold-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    <strong>Note:</strong> Moving your corps will preserve all data including lineup, shows, equipment, and staff.
                  </p>
                </div>

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
                    disabled={!selectedClass}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Move Corps
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default MoveCorpsModal;
