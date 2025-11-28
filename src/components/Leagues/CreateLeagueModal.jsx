// CreateLeagueModal - Modal for creating a new circuit league
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Lock } from 'lucide-react';
import Portal from '../Portal';

const CreateLeagueModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 20,
    settings: {
      enableStaffTrading: true,
      scoringFormat: 'circuit',
      finalsSize: 12,
      prizePool: 1000
    }
  });
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      await onCreate(formData);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-4 md:p-8">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-gradient">
                Create Circuit League
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-cream-500/10 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-cream-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              {/* League Name */}
              <div>
                <label className="label">League Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., DCI Fantasy Champions"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={50}
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea
                  className="textarea h-20"
                  placeholder="Describe your league..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={200}
                />
                <p className="text-xs text-cream-500/40 mt-1">
                  {formData.description.length}/200 characters
                </p>
              </div>

              {/* Max Members & Prize Pool */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Maximum Members</label>
                  <input
                    type="number"
                    className="input"
                    min="2"
                    max="50"
                    value={formData.maxMembers}
                    onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Prize Pool (CorpsCoin)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="100"
                    value={formData.settings.prizePool}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings, prizePool: parseInt(e.target.value) }
                    })}
                  />
                </div>
              </div>

              {/* Finals Size */}
              <div>
                <label className="label">League Finals Spots</label>
                <select
                  className="input"
                  value={formData.settings.finalsSize}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, finalsSize: parseInt(e.target.value) }
                  })}
                >
                  <option value={6}>Top 6</option>
                  <option value={8}>Top 8</option>
                  <option value={12}>Top 12 (DCI Style)</option>
                  <option value={15}>Top 15</option>
                </select>
                <p className="text-xs text-cream-500/40 mt-1">
                  Directors advancing to league finals week
                </p>
              </div>

              {/* Staff Trading */}
              <div className="flex items-center justify-between p-3 md:p-4 bg-charcoal-900/50 rounded-lg">
                <div>
                  <label className="font-semibold text-cream-100 text-sm md:text-base">Enable Staff Trading</label>
                  <p className="text-xs md:text-sm text-cream-500/60">Allow members to trade staff</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.settings.enableStaffTrading}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, enableStaffTrading: e.target.checked }
                  })}
                  className="w-5 h-5"
                />
              </div>

              {/* Public/Private */}
              <div>
                <label className="label">League Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isPublic: true })}
                    className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                      formData.isPublic
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-cream-500/20 hover:border-cream-500/40'
                    }`}
                  >
                    <Users className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2 text-cream-100" />
                    <p className="font-semibold text-cream-100 text-sm md:text-base">Public</p>
                    <p className="text-xs text-cream-500/60 mt-1">Anyone can join</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isPublic: false })}
                    className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                      !formData.isPublic
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-cream-500/20 hover:border-cream-500/40'
                    }`}
                  >
                    <Lock className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 md:mb-2 text-cream-100" />
                    <p className="font-semibold text-cream-100 text-sm md:text-base">Private</p>
                    <p className="text-xs text-cream-500/60 mt-1">Invite only</p>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 md:pt-4 sticky bottom-0 bg-charcoal-900 pb-2 md:pb-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={processing}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="btn-primary flex-1"
                >
                  {processing ? 'Creating...' : 'Create League'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default CreateLeagueModal;
