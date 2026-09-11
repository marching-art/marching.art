// ChatComposer — the league chat's input: a growing textarea, Enter to send
// (Shift+Enter for a new line; on a phone the button sends), an @mention
// picker driven by the league roster, a reply strip, a per-league draft that
// survives switching tabs, and a character budget that matches the server cap.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AtSign, CornerUpLeft, Send, X } from 'lucide-react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  filterMentionCandidates,
  findMentionQuery,
  getChatDisplayName,
  type ChatMemberMap,
} from '../../../utils/chatFormat';
import type { ChatListMessage } from '../../../hooks/useLeagueChat';

/** Text the tab wants placed in the box (an empty-state prompt, a mention). */
export interface ComposerSeed {
  text: string;
  nonce: number;
}

interface ChatComposerProps {
  leagueId?: string;
  viewerUid?: string;
  members: ChatMemberMap;
  replyingTo: ChatListMessage | null;
  seed: ComposerSeed | null;
  disabled?: boolean;
  onCancelReply: () => void;
  onSend: (text: string) => Promise<boolean> | boolean;
}

const MAX_ROWS = 6;
const COUNTER_THRESHOLD = MAX_CHAT_MESSAGE_LENGTH - 200;

const draftKey = (leagueId?: string) => `marchingart.leagueChatDraft.${leagueId ?? ''}`;

function readDraft(leagueId?: string): string {
  try {
    return globalThis.sessionStorage?.getItem(draftKey(leagueId)) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(leagueId: string | undefined, value: string): void {
  try {
    if (value) globalThis.sessionStorage?.setItem(draftKey(leagueId), value);
    else globalThis.sessionStorage?.removeItem(draftKey(leagueId));
  } catch {
    // Storage unavailable — the draft simply doesn't survive a tab switch.
  }
}

const ChatComposer = ({
  leagueId,
  viewerUid,
  members,
  replyingTo,
  seed,
  disabled = false,
  onCancelReply,
  onSend,
}: ChatComposerProps) => {
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(() => readDraft(leagueId));
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);

  const remaining = MAX_CHAT_MESSAGE_LENGTH - value.length;
  const overLimit = remaining < 0;
  const canSend = !disabled && value.trim().length > 0 && !overLimit;

  // Draft per league, restored when the tab comes back.
  useEffect(() => {
    writeDraft(leagueId, value);
  }, [leagueId, value]);

  // Grow with the text up to MAX_ROWS, then scroll inside.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = lineHeight * MAX_ROWS + 16;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value]);

  // Seeded text (an empty-state prompt, "reply" on a phone) lands in the box
  // and takes focus.
  useEffect(() => {
    if (!seed) return;
    setValue((prev) => {
      const next = prev && !prev.endsWith(' ') ? `${prev} ${seed.text}` : `${prev}${seed.text}`;
      return next;
    });
    const el = textareaRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
        setCaret(end);
      });
    }
  }, [seed]);

  // Starting a reply puts the cursor back in the box.
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const mention = useMemo(
    () => (mentionDismissed ? null : findMentionQuery(value, caret)),
    [value, caret, mentionDismissed]
  );
  const candidates = useMemo(
    () => (mention ? filterMentionCandidates(members, mention.query, viewerUid) : []),
    [mention, members, viewerUid]
  );
  const showMentions = Boolean(mention) && candidates.length > 0;

  useEffect(() => {
    setMentionIndex(0);
  }, [mention?.query, candidates.length]);

  const syncCaret = () => {
    const el = textareaRef.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
    setMentionDismissed(false);
  };

  const insertMention = useCallback(
    (handle: string) => {
      if (!mention) return;
      const before = value.slice(0, mention.start);
      const after = value.slice(mention.end);
      const inserted = `@${handle} `;
      const next = `${before}${inserted}${after}`;
      setValue(next);
      const el = textareaRef.current;
      const position = before.length + inserted.length;
      // Caret state moves now so the picker closes with this render; the DOM
      // selection follows once React has written the new value.
      setCaret(position);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(position, position);
      });
    },
    [mention, value]
  );

  const submit = useCallback(async () => {
    if (!canSend) return;
    const text = value;
    setValue('');
    writeDraft(leagueId, '');
    setCaret(0);
    const ok = await onSend(text);
    // The hook keeps a failed message in the list with Retry; the box is free
    // for the next thought either way.
    if (!ok && textareaRef.current) textareaRef.current.focus();
  }, [canSend, value, leagueId, onSend]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionIndex((i) => (i + 1) % candidates.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(candidates[mentionIndex].handle);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionDismissed(true);
        return;
      }
    }
    if (event.key === 'Escape' && replyingTo) {
      event.preventDefault();
      onCancelReply();
      return;
    }
    // Desktop: Enter sends, Shift+Enter breaks a line. Phones get a newline
    // from Enter and send with the button, like every messenger they use.
    if (event.key === 'Enter' && !event.shiftKey && !isMobile && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const replyName = replyingTo ? getChatDisplayName(replyingTo.userId, members) : '';

  return (
    <div className="relative">
      {/* @mention picker, anchored above the box */}
      {showMentions && (
        <ul
          role="listbox"
          aria-label="Mention a member"
          className="absolute bottom-full left-0 mb-1 w-64 max-w-full bg-surface-raised border border-line-strong z-20 py-1"
        >
          {candidates.map((candidate, index) => (
            <li key={candidate.uid} role="option" aria-selected={index === mentionIndex}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(candidate.handle)}
                onMouseEnter={() => setMentionIndex(index)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                  index === mentionIndex ? 'bg-interactive/15 text-white' : 'text-secondary'
                }`}
              >
                <AtSign className="w-3.5 h-3.5 text-interactive flex-shrink-0" />
                <span className="font-semibold truncate">{candidate.name}</span>
                {candidate.handle.toLowerCase() !== candidate.name.toLowerCase() && (
                  <span className="text-[11px] text-muted truncate">@{candidate.handle}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Reply strip */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-1 bg-surface-sunken border-l-2 border-interactive text-xs">
          <CornerUpLeft className="w-3.5 h-3.5 text-interactive flex-shrink-0" />
          <span className="text-muted flex-shrink-0">Replying to</span>
          <span className="font-semibold text-white truncate">{replyName}</span>
          <span className="text-muted truncate hidden sm:inline">— {replyingTo.message}</span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="ml-auto p-1.5 -m-1 text-muted hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        className={`flex items-end gap-2 bg-surface-sunken border ${
          overLimit ? 'border-red-500/60' : 'border-line focus-within:border-interactive/60'
        } transition-colors`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setCaret(event.target.selectionStart ?? event.target.value.length);
            setMentionDismissed(false);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          placeholder={replyingTo ? 'Write your reply…' : 'Message the league…  @ to mention'}
          aria-label="Message"
          rows={1}
          disabled={disabled}
          enterKeyHint={isMobile ? 'enter' : 'send'}
          className="flex-1 min-h-[44px] max-h-40 resize-none bg-transparent px-3 py-3 text-sm leading-5 text-white placeholder:text-muted focus:outline-none disabled:opacity-50"
        />
        {value.length >= COUNTER_THRESHOLD && (
          <span
            aria-live="polite"
            className={`pb-3 pr-1 text-[10px] tabular-nums ${overLimit ? 'text-red-400' : 'text-muted'}`}
          >
            {remaining}
          </span>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send message"
          className="m-1 min-w-[40px] min-h-[36px] px-3 bg-interactive hover:bg-interactive-hover disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors press-feedback"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {!isMobile && (
        <p className="mt-1 text-[10px] text-muted">
          <kbd className="font-sans">Enter</kbd> to send ·{' '}
          <kbd className="font-sans">Shift+Enter</kbd> for a new line
        </p>
      )}
    </div>
  );
};

export default ChatComposer;
