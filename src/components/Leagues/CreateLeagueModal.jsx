// =============================================================================
// CREATE LEAGUE MODAL - DATA-TERMINAL STYLE
// =============================================================================

import React, { useState } from 'react';
import { X, Users, Lock, Trophy, Copy, Check, Share2, Link2 } from 'lucide-react';
import Portal from '../Portal';
import toast from 'react-hot-toast';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CreateLeagueModal = ({ onClose, onCreate }) => {
  // Close on Escape key
  useEscapeKey(onClose);

  const [step, setStep] = useState('create'); // 'create' | 'success'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 10,
    settings: {
      scoringFormat: 'circuit',
      finalsSize: 12,
      // No prizePool here: the pool is pure escrow, seeded and maintained
      // server-side from entry fees only (createLeague ignores client values).
      entryFee: 0,
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
    } catch {
      toast.error('Failed to copy');
    }
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/leagues?join=${createdLeague?.inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied!');
    } catch {
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
      } catch {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-create-league"
      >
        <div className="w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
          {step === 'create' ? (
            <div className="bg-surface-card border border-line rounded-none">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-interactive" />
                  <h2
                    id="modal-title-create-league"
                    className="text-xs font-bold uppercase tracking-wider text-secondary"
                  >
                    Create League
                  </h2>
                </div>
                <button onClick={onClose} className="p-1 text-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit}>
                <div className="p-4 space-y-4">
                  {/* League Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
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
                      className="w-full h-10 px-3 bg-background border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-interactive"
                    />
                  </div>

                  {/* Public/Private Toggle */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                      League Visibility
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isPublic: true })}
                        className={`p-3 border text-left transition-colors ${
                          formData.isPublic
                            ? 'border-interactive bg-interactive/10'
                            : 'border-line hover:border-line-strong'
                        }`}
                      >
                        <Users className="w-4 h-4 text-secondary mb-1" />
                        <p className="text-sm font-bold text-white">Public</p>
                        <p className="text-[10px] text-muted">Anyone can find</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isPublic: false })}
                        className={`p-3 border text-left transition-colors ${
                          !formData.isPublic
                            ? 'border-interactive bg-interactive/10'
                            : 'border-line hover:border-line-strong'
                        }`}
                      >
                        <Lock className="w-4 h-4 text-secondary mb-1" />
                        <p className="text-sm font-bold text-white">Private</p>
                        <p className="text-[10px] text-muted">Invite only</p>
                      </button>
                    </div>
                  </div>

                  {/* Entry Fee (CorpsCoin, feeds the prize pool) */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                      Entry Fee (CorpsCoin)
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 100, 250, 500, 1000].map((fee) => (
                        <button
                          key={fee}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              settings: { ...formData.settings, entryFee: fee },
                            })
                          }
                          className={`py-2 text-[10px] font-bold border transition-colors ${
                            (formData.settings.entryFee || 0) === fee
                              ? 'border-interactive bg-interactive/10 text-interactive'
                              : 'border-line text-muted hover:border-line-strong'
                          }`}
                        >
                          {fee === 0 ? 'Free' : fee.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted mt-1">
                      Every joiner (you included) pays into the prize pool — the league champion
                      takes it all at Finals. No refunds for leaving.
                    </p>
                  </div>

                  {/* Max Members */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider">
                        Max Members
                      </label>
                      <span className="text-sm font-data font-bold text-interactive">
                        {formData.maxMembers}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="20"
                      value={formData.maxMembers}
                      onChange={(e) =>
                        setFormData({ ...formData, maxMembers: parseInt(e.target.value) })
                      }
                      className="w-full h-2 bg-line rounded-none appearance-none cursor-pointer accent-interactive"
                    />
                    <div className="flex justify-between text-[10px] text-muted mt-1">
                      <span>4</span>
                      <span>12</span>
                      <span>20</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={processing}
                    className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing || !formData.name.trim()}
                    className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-50"
                  >
                    {processing ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-surface-card border border-line rounded-none">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
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

                <p className="text-sm text-muted mb-4">Share the invite code with friends</p>

                {/* League Info */}
                <div className="bg-background border border-line p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-interactive" />
                    <span className="font-bold text-white">{formData.name}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted">
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
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Invite Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-background border-2 border-dashed border-interactive/30 p-3">
                      <code className="text-xl font-data font-bold text-interactive tracking-widest">
                        {createdLeague?.inviteCode || '------'}
                      </code>
                    </div>
                    <button
                      onClick={copyInviteCode}
                      className="h-12 w-12 bg-interactive/10 border border-interactive/30 text-interactive hover:bg-interactive/20 flex items-center justify-center"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center justify-center gap-2 p-2 bg-background border border-line text-secondary hover:border-line-strong text-sm font-bold"
                  >
                    <Link2 className="w-4 h-4" />
                    Copy Link
                  </button>
                  <button
                    onClick={shareInvite}
                    className="flex items-center justify-center gap-2 p-2 bg-interactive/10 border border-interactive/30 text-interactive hover:bg-interactive/20 text-sm font-bold"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end">
                <button
                  onClick={onClose}
                  className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover"
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
