// Contextual push opt-in for the nightly score drop — offered ONCE, at the
// moment of maximum intent (the player just registered for a show; scores
// for it land at a known time), never on page load. Only fires when the
// browser has never been asked (permission 'default') and we haven't offered
// before. Extracted from ShowRegistrationModal so the offer logic has one
// home if other registration surfaces (e.g. the season-setup wizard) want it.

import React from 'react';
import toast from 'react-hot-toast';
import { auth } from '../../api';
import { isPushSupported, promptAndEnablePush } from '../../api/pushNotifications';

const PROMPT_KEY = 'ma_scoreDropPushOffered';

/**
 * Offer the score-drop push once, via an actionable toast.
 * @param {Object|null} seasonData - game-settings/season doc (for the drop-time label)
 */
export function maybeOfferScoreDropPush(seasonData) {
  try {
    if (!isPushSupported() || Notification.permission !== 'default') return;
    if (localStorage.getItem(PROMPT_KEY)) return;
    localStorage.setItem(PROMPT_KEY, new Date().toISOString());

    const dropLabel =
      seasonData?.status === 'off-season' ? '9:00 PM ET' : 'overnight (~2:00 AM ET)';
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <span className="text-sm">
            Scores drop at {dropLabel}. Want a heads-up when your recap is in?
          </span>
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-interactive text-white"
              onClick={async () => {
                toast.dismiss(t.id);
                const uid = auth.currentUser?.uid;
                if (!uid) return;
                const ok = await promptAndEnablePush(uid);
                if (ok) toast.success("You're on the list — see you at the drop.");
              }}
            >
              Notify me
            </button>
            <button
              className="flex-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-line text-muted"
              onClick={() => toast.dismiss(t.id)}
            >
              Not now
            </button>
          </div>
        </div>
      ),
      { duration: 15000, icon: '🎺' }
    );
  } catch {
    // Opt-in is best-effort; never let it interfere with registration.
  }
}

export default maybeOfferScoreDropPush;
