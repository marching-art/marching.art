// CreateLeagueModal - Simplified modal for creating a new circuit league
// Focused on essential fields for quick league creation
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Lock, Trophy, Copy, Check, Share2, Link2 } from 'lucide-react';
import Portal from '../Portal';
import toast from 'react-hot-toast';

const CreateLeagueModal = ({ onClose, onCreate }) => {
  const [step, setStep] = useState('create'); // 'create' | 'success'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 10,
    settings: {
      enableStaffTrading: true,
      scoringFormat: 'circuit',
      finalsSize: 12,
      prizePool: 1000
    }
  });
  const [processing, setProcessing] = useState(false);
  const [createdLeague, setCreatedLeague] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const result = await onCreate(formData);
      // Store result for success screen
      setCreatedLeague({
        ...formData,
        inviteCode: result?.data?.inviteCode || generateInviteCode(),
        leagueId: result?.data?.leagueId
      });
      setStep('success');
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error(error.message || 'Failed to create league');
    } finally {
      setProcessing(false);
    }
  };

  // Generate a fallback invite code
  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const copyInviteCode = async () => {
    const code = createdLeague?.inviteCode || '';
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/leagues?join=${createdLeague?.inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied!');
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const shareInvite = async () => {
    const shareData = {
      title: `Join ${formData.name}`,
      text: `Join my fantasy league "${formData.name}" on Marching.Art!`,
      url: `${window.location.origin}/leagues?join=${createdLeague?.inviteCode}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        copyInviteLink();
      }
    } else {
      copyInviteLink();
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
          className="w-full max-w-md my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            {step === 'create' ? (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-dark rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-gold-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-cream-100">
                        Create League
                      </h2>
                      <p className="text-xs text-cream-500/60">Start competing with friends</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-cream-500/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-cream-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* League Name */}
                  <div>
                    <label className="block text-sm font-semibold text-cream-300 mb-2">
                      League Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-xl text-cream-100 placeholder:text-cream-500/40 focus:outline-none focus:border-gold-500/50 transition-colors"
                      placeholder="e.g., DCI Fantasy Champions"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      maxLength={40}
                      autoFocus
                    />
                  </div>

                  {/* Public/Private Toggle */}
                  <div>
                    <label className="block text-sm font-semibold text-cream-300 mb-2">
                      League Visibility
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isPublic: true })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.isPublic
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-cream-500/20 hover:border-cream-500/40'
                        }`}
                      >
                        <Users className="w-5 h-5 mx-auto mb-2 text-cream-100" />
                        <p className="font-semibold text-cream-100 text-sm">Public</p>
                        <p className="text-xs text-cream-500/60 mt-1">Anyone can find & join</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isPublic: false })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          !formData.isPublic
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-cream-500/20 hover:border-cream-500/40'
                        }`}
                      >
                        <Lock className="w-5 h-5 mx-auto mb-2 text-cream-100" />
                        <p className="font-semibold text-cream-100 text-sm">Private</p>
                        <p className="text-xs text-cream-500/60 mt-1">Invite code only</p>
                      </button>
                    </div>
                  </div>

                  {/* Max Members Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-cream-300">
                        Max Members
                      </label>
                      <span className="text-lg font-data font-bold text-gold-400">
                        {formData.maxMembers}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="20"
                      value={formData.maxMembers}
                      onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                      className="w-full h-2 bg-charcoal-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
                    />
                    <div className="flex justify-between text-xs text-cream-500/40 mt-1">
                      <span>4 (small)</span>
                      <span>12 (standard)</span>
                      <span>20 (large)</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={processing}
                      className="flex-1 px-4 py-3 border border-cream-500/20 rounded-xl text-cream-400 font-display font-semibold hover:bg-cream-500/10 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing || !formData.name.trim()}
                      className="flex-1 px-4 py-3 bg-gold-500 text-charcoal-900 rounded-xl font-display font-bold hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                    >
                      {processing ? 'Creating...' : 'Create League'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-dark rounded-2xl p-6 text-center"
              >
                {/* Success Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-400" />
                </div>

                <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                  League Created!
                </h2>
                <p className="text-sm text-cream-500/60 mb-6">
                  Share the invite code with friends to start competing
                </p>

                {/* League Name */}
                <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy className="w-5 h-5 text-gold-400" />
                    <span className="font-display font-bold text-cream-100">{formData.name}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-cream-500/60">
                    {formData.isPublic ? (
                      <>
                        <Users className="w-3 h-3" />
                        <span>Public</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{formData.maxMembers} max members</span>
                  </div>
                </div>

                {/* Invite Code */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-cream-500/60 uppercase tracking-wider mb-2">
                    Invite Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-charcoal-950 border-2 border-dashed border-gold-500/30 rounded-xl p-4">
                      <code className="text-2xl font-mono font-bold text-gold-400 tracking-widest">
                        {createdLeague?.inviteCode || '------'}
                      </code>
                    </div>
                    <button
                      onClick={copyInviteCode}
                      className="p-4 bg-gold-500/20 border border-gold-500/30 rounded-xl text-gold-400 hover:bg-gold-500/30 transition-colors"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center justify-center gap-2 p-3 bg-charcoal-900/50 border border-cream-500/20 rounded-xl text-cream-300 hover:bg-charcoal-900 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Copy Link</span>
                  </button>
                  <button
                    onClick={shareInvite}
                    className="flex items-center justify-center gap-2 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-500/30 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Share</span>
                  </button>
                </div>

                {/* Done Button */}
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 bg-gold-500 text-charcoal-900 rounded-xl font-display font-bold hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                >
                  Go to League Hub
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default CreateLeagueModal;
