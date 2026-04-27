import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Portal from '../Portal';
import { renameCorps } from '../../api/functions';
import { getCorpsClassName } from '../../utils/corps';
import toast from 'react-hot-toast';

const RenameDuplicateCorpsModal = ({ duplicates, onResolved }) => {
  // Resolve one duplicate at a time so we can re-validate uniqueness on each
  // submit; the server is the source of truth for whether the name is free.
  const [index, setIndex] = useState(0);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const current = duplicates[index];
  if (!current) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('Please enter a new corps name.');
      return;
    }
    if (trimmed.toLowerCase() === current.corpsName.toLowerCase()) {
      toast.error('The new name must be different from the current name.');
      return;
    }

    setSubmitting(true);
    try {
      await renameCorps({ corpsClass: current.corpsClass, newName: trimmed });
      toast.success(`Renamed to "${trimmed}"`);

      const next = index + 1;
      if (next >= duplicates.length) {
        await onResolved();
      } else {
        setIndex(next);
        setNewName('');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to rename corps. Please try a different name.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-duplicate-title"
      >
        <div className="w-full max-w-md bg-[#1a1a1a] border border-red-500/50 rounded-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/30 bg-red-950/40">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2
              id="rename-duplicate-title"
              className="text-xs font-bold uppercase tracking-wider text-red-300"
            >
              Action Required: Rename Duplicate Corps
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-300 leading-relaxed">
                Your corps <span className="font-bold text-white">"{current.corpsName}"</span>{' '}
                in <span className="font-bold text-white">{getCorpsClassName(current.corpsClass)}</span>{' '}
                shares a name with another director's corps and must be renamed before you
                can take any other corps action.
              </p>

              {current.conflictsWith && (
                <div className="text-xs text-gray-500 bg-[#0a0a0a] border border-[#333] rounded-sm p-3">
                  Conflict: another director already has{' '}
                  <span className="text-gray-300">"{current.conflictsWith.winnerCorpsName}"</span>{' '}
                  in {getCorpsClassName(current.conflictsWith.winnerCorpsClass)}.
                </div>
              )}

              {duplicates.length > 1 && (
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  {index + 1} of {duplicates.length}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  New Corps Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  maxLength={50}
                  disabled={submitting}
                  placeholder="Enter a unique name"
                  className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-60"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[#333] bg-[#0f0f0f] flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                className="px-4 h-9 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:cursor-not-allowed rounded-sm text-xs font-bold uppercase tracking-wider text-white"
              >
                {submitting ? 'Renaming…' : 'Rename Corps'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default RenameDuplicateCorpsModal;
