// =============================================================================
// CREATE LEAGUE MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState } from 'react';
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
      prizePool: 1000,
    },
  });
  const [processing, setProcessing] = useState(false);
  const [createdLeague, setCreatedLeague] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const result = await onCreate(formData);
      setCreatedLeague({
        ...formData,
        inviteCode: result?.data?.inviteCode || generateInviteCode(),
        leagueId: result?.data?.leagueId,
      });
      setStep('success');
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error(error.message || 'Failed to create league');
    } finally {
      setProcessing(false);
    }
  };

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
      url: `${window.location.origin}/leagues?join=${createdLeague?.inviteCode}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        copyInviteLink();
      }
    } else {
      copyInviteLink();
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {step === 'create' ? (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#0057B8]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Create League
                  </h2>
                </div>
                <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit}>
                <div className="p-4 space-y-4">
                  {/* League Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      League Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., DCI Fantasy Champions"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      maxLength={40}
                      autoFocus
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>

                  {/* Public/Private Toggle */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      League Visibility
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isPublic: true })}
                        className={`p-3 border text-left transition-colors ${
                          formData.isPublic
                            ? 'border-[#0057B8] bg-[#0057B8]/10'
                            : 'border-[#333] hover:border-[#444]'
                        }`}
                      >
                        <Users className="w-4 h-4 text-gray-300 mb-1" />
                        <p className="text-sm font-bold text-white">Public</p>
                        <p className="text-[10px] text-gray-500">Anyone can find</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isPublic: false })}
                        className={`p-3 border text-left transition-colors ${
                          !formData.isPublic
                            ? 'border-[#0057B8] bg-[#0057B8]/10'
                            : 'border-[#333] hover:border-[#444]'
                        }`}
                      >
                        <Lock className="w-4 h-4 text-gray-300 mb-1" />
                        <p className="text-sm font-bold text-white">Private</p>
                        <p className="text-[10px] text-gray-500">Invite only</p>
                      </button>
                    </div>
                  </div>

                  {/* Max Members */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Max Members
                      </label>
                      <span className="text-sm font-data font-bold text-[#0057B8]">
                        {formData.maxMembers}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="20"
                      value={formData.maxMembers}
                      onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                      className="w-full h-2 bg-[#333] rounded-sm appearance-none cursor-pointer accent-[#0057B8]"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                      <span>4</span>
                      <span>12</span>
                      <span>20</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={processing}
                    className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing || !formData.name.trim()}
                    className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50"
                  >
                    {processing ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  League Created
                </h2>
              </div>

              {/* Body */}
              <div className="p-4 text-center">
                {/* Success Icon */}
                <div className="w-12 h-12 mx-auto mb-4 bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>

                <p className="text-sm text-gray-400 mb-4">
                  Share the invite code with friends
                </p>

                {/* League Info */}
                <div className="bg-[#0a0a0a] border border-[#333] p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-[#0057B8]" />
                    <span className="font-bold text-white">{formData.name}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
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
                    <span>{formData.maxMembers} max</span>
                  </div>
                </div>

                {/* Invite Code */}
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Invite Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#0a0a0a] border-2 border-dashed border-[#0057B8]/30 p-3">
                      <code className="text-xl font-data font-bold text-[#0057B8] tracking-widest">
                        {createdLeague?.inviteCode || '------'}
                      </code>
                    </div>
                    <button
                      onClick={copyInviteCode}
                      className="h-12 w-12 bg-[#0057B8]/10 border border-[#0057B8]/30 text-[#0057B8] hover:bg-[#0057B8]/20 flex items-center justify-center"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center justify-center gap-2 p-2 bg-[#0a0a0a] border border-[#333] text-gray-300 hover:border-[#444] text-sm font-bold"
                  >
                    <Link2 className="w-4 h-4" />
                    Copy Link
                  </button>
                  <button
                    onClick={shareInvite}
                    className="flex items-center justify-center gap-2 p-2 bg-[#0057B8]/10 border border-[#0057B8]/30 text-[#0057B8] hover:bg-[#0057B8]/20 text-sm font-bold"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end">
                <button
                  onClick={onClose}
                  className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]"
                >
                  Go to League
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default CreateLeagueModal;
