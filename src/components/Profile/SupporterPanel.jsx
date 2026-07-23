// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Supporter section of the settings modal.
//
// Non-supporters see the "buy me a coffee" pitch (the tier ladder + the BMAC
// link) and a "link my support" claim form — because the email someone pays
// BMAC with is often a PayPal address that differs from their login, so we
// can't always auto-match. Linked supporters see their tier, a wall visibility
// (anonymous) opt-out, and — for Corps Angels — a short wall message.
//
// Perks are cosmetic recognition only; Discord roles are handled natively by
// BMAC and don't appear here.

import React, { useState } from 'react';
import { Heart, ExternalLink, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { linkBmacSupport, setSupporterVisibility, setSupporterMessage } from '../../api/functions';
import { BMAC_URL, SUPPORTER_TIERS, getSupporterTier } from '../../utils/supporterTiers';

const boxClass = 'bg-surface-sunken border border-line p-3 rounded-none';

function SupporterPanel({ supporter, onRefresh }) {
  const tier = supporter?.tier ? getSupporterTier(supporter.tier) : null;
  const isFriend = supporter?.tier === 'friend';
  // supporter.until is a Firestore Timestamp for one-time supporters.
  const untilDate = supporter?.until?.toDate ? supporter.until.toDate() : null;
  const untilLabel = untilDate
    ? untilDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const [email, setEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const [anonSaving, setAnonSaving] = useState(false);
  const [message, setMessage] = useState(supporter?.message || '');
  const [msgSaving, setMsgSaving] = useState(false);

  const handleLink = async () => {
    if (!email.trim()) return;
    setLinking(true);
    try {
      const res = await linkBmacSupport({ email: email.trim() });
      const linked = getSupporterTier(res.data?.tier);
      toast.success(`Linked! You're a ${linked?.name || 'supporter'} 💛`);
      setEmail('');
      setShowLink(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't link that email.");
    } finally {
      setLinking(false);
    }
  };

  const handleToggleAnonymous = async () => {
    const next = !supporter?.anonymous;
    setAnonSaving(true);
    try {
      await setSupporterVisibility({ anonymous: next });
      toast.success(next ? 'Hidden from the wall.' : "You're on the wall!");
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't update visibility.");
    } finally {
      setAnonSaving(false);
    }
  };

  const handleSaveMessage = async () => {
    setMsgSaving(true);
    try {
      await setSupporterMessage({ message: message.trim() });
      toast.success('Wall message saved.');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't save your message.");
    } finally {
      setMsgSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header + donate link */}
      <a
        href={BMAC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3 min-h-[44px] bg-interactive/10 border border-interactive/30 text-interactive text-sm font-bold hover:bg-interactive/20 active:bg-interactive/30 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
      >
        <Heart className="w-4 h-4" />
        {tier ? 'Manage support on Buy Me a Coffee' : 'Support marching.art'}
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </a>

      {tier ? (
        // ---- Linked supporter: status + wall controls ----
        <div className={boxClass}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                {isFriend ? 'One-Time Supporter' : 'Your Membership'}
              </div>
              <div className={`text-sm font-bold ${tier.color}`}>
                {tier.coffees} {isFriend ? 'Supporter' : `${tier.name} Supporter`}
              </div>
              {isFriend && untilLabel && (
                <div className="text-[10px] text-muted mt-0.5">Active through {untilLabel}</div>
              )}
            </div>
            <Link
              to="/scores?tab=supporters"
              className="text-xs text-interactive hover:underline whitespace-nowrap"
            >
              Supporters wall →
            </Link>
          </div>

          {/* Anonymity opt-out (default: shown on the wall) */}
          <button
            type="button"
            onClick={handleToggleAnonymous}
            disabled={anonSaving}
            className="mt-3 w-full flex items-center justify-between gap-2 text-left disabled:opacity-50"
          >
            <span className="text-sm text-white">Show my name on the wall</span>
            <span
              className={`inline-flex items-center h-6 w-11 rounded-full transition-colors ${
                supporter?.anonymous ? 'bg-line' : 'bg-interactive'
              }`}
              aria-hidden
            >
              <span
                className={`h-5 w-5 bg-white rounded-full transform transition-transform ${
                  supporter?.anonymous ? 'translate-x-0.5' : 'translate-x-[22px]'
                }`}
              />
            </span>
          </button>
          <p className="text-xs text-muted mt-1">
            {supporter?.anonymous
              ? "You're counted anonymously — your name is hidden."
              : 'Your director name appears on the public Supporters wall.'}
          </p>

          {/* Corps Angel wall message */}
          {supporter.tier === 'corps_angel' && (
            <div className="mt-3 pt-3 border-t border-line">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 block">
                Wall message (Corps Angel)
              </label>
              <input
                type="text"
                value={message}
                maxLength={60}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="A short note, pinned in gold…"
                className="w-full bg-surface border border-line px-3 py-2 text-sm text-white rounded-none focus:outline-none focus:border-interactive"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted">{message.length}/60</span>
                <button
                  type="button"
                  onClick={handleSaveMessage}
                  disabled={msgSaving}
                  className="text-xs font-bold text-interactive hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  {msgSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ---- Not linked: tier ladder + claim form ----
        <div className={boxClass}>
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
            Membership Tiers
          </div>
          <ul className="space-y-1.5">
            {SUPPORTER_TIERS.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className={`font-bold ${t.color}`}>
                  {t.coffees} {t.name}
                </span>
                <span className="text-muted text-xs">${t.minAmount}/mo</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 pt-3 border-t border-line">
            {!showLink ? (
              <button
                type="button"
                onClick={() => setShowLink(true)}
                className="text-xs font-bold text-interactive hover:underline"
              >
                Already a member? Link your support →
              </button>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-muted block">
                  Enter the email you paid Buy Me a Coffee with (it may differ from your login
                  email).
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-surface border border-line px-3 py-2 text-sm text-white rounded-none focus:outline-none focus:border-interactive"
                />
                <button
                  type="button"
                  onClick={handleLink}
                  disabled={linking || !email.trim()}
                  className="w-full py-2 min-h-[40px] bg-interactive text-white text-sm font-bold hover:bg-interactive-hover disabled:opacity-50 transition-all rounded-none flex items-center justify-center gap-2"
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Link my support
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SupporterPanel;
