// ChatMessageRow — one message in the league thread, Discord-style: an avatar,
// name and time on the first message of a sender's run, then bare lines that
// reveal their time on hover. Carries the reply quote, reaction chips, a hover
// action bar on desktop, and a long-press that opens the action sheet on touch.

import React, { useEffect, useRef, useState } from 'react';
import {
  CornerUpLeft,
  Crown,
  Flag,
  Loader2,
  MoreHorizontal,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { isPendingMessage, type ChatListMessage } from '../../../hooks/useLeagueChat';
import {
  CHAT_REACTIONS,
  avatarHue,
  avatarInitials,
  formatClock,
  formatFullStamp,
  getChatCorpsName,
  getChatDisplayName,
  getMentionHandle,
  mentionsViewer,
  orderedReactions,
  tokenizeMessage,
  type ChatMemberMap,
} from '../../../utils/chatFormat';

export interface ChatMessageRowProps {
  message: ChatListMessage;
  startsRun: boolean;
  isUnread: boolean;
  viewerUid?: string;
  members: ChatMemberMap;
  /** Owner uid and co-commissioner uids, for the badge. */
  ownerUid?: string;
  commissionerUids: string[];
  canDelete: boolean;
  /** Briefly emphasised after a "jump to" from a reply quote. */
  highlighted: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatListMessage) => void;
  onDelete: (message: ChatListMessage) => void;
  onReport: (message: ChatListMessage) => void;
  /** Opens the full action sheet (long-press on touch, keyboard on desktop). */
  onOpenActions: (message: ChatListMessage) => void;
  onJumpTo: (messageId: string) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}

const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP_PX = 10;

export const ChatAvatar = ({
  uid,
  name,
  size = 'md',
}: {
  uid: string;
  name: string;
  size?: 'sm' | 'md';
}) => (
  <div
    aria-hidden="true"
    className={`${size === 'md' ? 'w-9 h-9 text-xs' : 'w-6 h-6 text-[10px]'} flex-shrink-0 flex items-center justify-center font-bold text-white select-none`}
    style={{ backgroundColor: `hsl(${avatarHue(uid)} 45% 32%)` }}
  >
    {avatarInitials(name)}
  </div>
);

const ChatMessageRow = ({
  message,
  startsRun,
  isUnread,
  viewerUid,
  members,
  ownerUid,
  commissionerUids,
  canDelete,
  highlighted,
  onReact,
  onReply,
  onDelete,
  onReport,
  onOpenActions,
  onJumpTo,
  onRetry,
  onDiscard,
}: ChatMessageRowProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const pressed = useRef(false);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const isOwn = message.userId === viewerUid;
  const pending = isPendingMessage(message) ? message : null;
  const name = getChatDisplayName(message.userId, members);
  const corpsName = getChatCorpsName(message.userId, members);
  const isOwnerMsg = message.userId === ownerUid;
  const isCommishMsg = !isOwnerMsg && commissionerUids.includes(message.userId);
  const mentioned = !isOwn && mentionsViewer(message.message, viewerUid, members);
  const viewerHandle = viewerUid ? getMentionHandle(viewerUid, members)?.toLowerCase() : null;
  const reactions = orderedReactions(message.reactions);

  // Close the reaction picker on an outside tap or Escape.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const clearPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch' || pending) return;
    pressed.current = false;
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      pressed.current = true;
      onOpenActions(message);
    }, LONG_PRESS_MS);
  };

  // A finger never holds perfectly still; only a real drag cancels the press.
  const handlePointerMove = (event: React.PointerEvent) => {
    const origin = pressOrigin.current;
    if (!origin || !pressTimer.current) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > LONG_PRESS_SLOP_PX) {
      clearPress();
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    // A long press on iOS fires contextmenu; the sheet already opened.
    if (pressed.current) event.preventDefault();
  };

  const react = (emoji: string) => {
    setPickerOpen(false);
    onReact(message.id, emoji);
  };

  const tokens = tokenizeMessage(message.message);
  const quoted = message.replyTo;
  const quotedName = quoted ? getChatDisplayName(quoted.userId, members) : '';

  return (
    <div
      data-message-id={message.id}
      onPointerDown={handlePointerDown}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerMove={handlePointerMove}
      onContextMenu={handleContextMenu}
      className={`group relative flex gap-3 px-3 sm:px-4 py-0.5 transition-colors ${
        startsRun ? 'mt-3' : ''
      } ${
        highlighted
          ? 'bg-interactive/15'
          : mentioned
            ? 'bg-brand/[0.06] border-l-2 border-brand'
            : isUnread
              ? 'bg-white/[0.02]'
              : ''
      } hover:bg-white/[0.035] ${pending?.status === 'failed' ? 'opacity-90' : ''} ${
        pending?.status === 'sending' ? 'opacity-70' : ''
      }`}
    >
      {/* Gutter: avatar on a run start, the time on hover otherwise */}
      <div className="w-9 flex-shrink-0 flex justify-center pt-0.5">
        {startsRun ? (
          <ChatAvatar uid={message.userId} name={name} />
        ) : (
          <span
            className="hidden sm:block opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[10px] text-muted tabular-nums leading-5"
            aria-hidden="true"
          >
            {formatClock(message.createdAt)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pb-0.5">
        {startsRun && (
          <div className="flex items-baseline gap-2 flex-wrap leading-tight mb-0.5">
            <span
              className={`text-sm font-bold ${isOwn ? 'text-interactive' : isOwnerMsg || isCommishMsg ? 'text-brand' : 'text-white'}`}
            >
              {name}
            </span>
            {(isOwnerMsg || isCommishMsg) && (
              <span className="inline-flex items-center gap-0.5 px-1 py-px bg-brand/10 border border-brand/30 text-brand text-[9px] font-bold uppercase tracking-wider">
                <Crown className="w-2.5 h-2.5" />
                {isOwnerMsg ? 'Commish' : 'Co-Commish'}
              </span>
            )}
            {corpsName && (
              <span className="text-[11px] text-muted truncate max-w-[40%]">{corpsName}</span>
            )}
            <time
              className="text-[10px] text-muted tabular-nums"
              title={formatFullStamp(message.createdAt)}
            >
              {formatClock(message.createdAt)}
            </time>
          </div>
        )}

        {quoted && (
          <button
            type="button"
            onClick={() => onJumpTo(quoted.id)}
            className="mb-1 flex items-start gap-1.5 max-w-full text-left pl-2 border-l-2 border-line-strong hover:border-interactive text-xs group/quote"
            aria-label={`Jump to the message from ${quotedName} this replies to`}
          >
            <CornerUpLeft className="w-3 h-3 mt-0.5 text-muted flex-shrink-0" />
            <span className="min-w-0">
              <span className="font-semibold text-secondary group-hover/quote:text-white">
                {quotedName}
              </span>{' '}
              <span className="text-muted line-clamp-2 break-words">{quoted.message}</span>
            </span>
          </button>
        )}

        <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">
          {tokens.map((token, index) => {
            if (token.type === 'link') {
              return (
                <a
                  key={index}
                  href={token.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-interactive underline underline-offset-2 break-all"
                >
                  {token.value}
                </a>
              );
            }
            if (token.type === 'mention') {
              const isViewer = viewerHandle !== null && token.handle.toLowerCase() === viewerHandle;
              return (
                <span
                  key={index}
                  className={`px-1 -mx-px font-semibold ${
                    isViewer ? 'bg-brand/20 text-brand' : 'bg-interactive/15 text-interactive'
                  }`}
                >
                  {token.value}
                </span>
              );
            }
            return <React.Fragment key={index}>{token.value}</React.Fragment>;
          })}
        </p>

        {pending && (
          <div className="mt-0.5 flex items-center gap-2 text-[10px]">
            {pending.status === 'sending' ? (
              <span className="text-muted flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending…
              </span>
            ) : (
              <>
                <span className="text-red-400">{pending.error || "Didn't send."}</span>
                <button
                  type="button"
                  onClick={() => onRetry(message.id)}
                  className="font-bold uppercase tracking-wider text-interactive hover:underline"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => onDiscard(message.id)}
                  className="font-bold uppercase tracking-wider text-muted hover:text-white"
                >
                  Discard
                </button>
              </>
            )}
          </div>
        )}

        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {reactions.map(({ emoji, uids }) => {
              const mine = viewerUid ? uids.includes(viewerUid) : false;
              const who = uids.map((uid) => getChatDisplayName(uid, members)).join(', ');
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  aria-pressed={mine}
                  title={who}
                  aria-label={`${emoji} ${uids.length}, reacted by ${who}`}
                  className={`inline-flex items-center gap-1 h-7 px-2 text-xs border transition-colors press-feedback ${
                    mine
                      ? 'bg-interactive/15 border-interactive/60 text-white'
                      : 'bg-surface-raised border-line text-secondary hover:border-line-strong'
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span className="tabular-nums font-semibold">{uids.length}</span>
                </button>
              );
            })}
            {!pending && (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                aria-label="Add reaction"
                className="inline-flex items-center justify-center h-7 w-7 border border-dashed border-line text-muted hover:text-white hover:border-line-strong"
              >
                <SmilePlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Keyboard access to every action; visible only when focused. */}
      {!pending && (
        <button
          type="button"
          onClick={() => onOpenActions(message)}
          aria-label={`Actions for ${name}'s message`}
          className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-0 focus:z-10 focus:px-2 focus:py-1 focus:bg-surface-raised focus:border focus:border-interactive focus:text-xs focus:text-white"
        >
          Actions
        </button>
      )}

      {/* Hover action bar (pointer devices) */}
      {!pending && (
        <div
          ref={pickerRef}
          className={`absolute -top-3 right-3 z-10 items-center bg-surface-raised border border-line-strong ${
            pickerOpen ? 'hidden sm:flex' : 'hidden sm:group-hover:flex'
          }`}
        >
          {pickerOpen ? (
            <div role="group" aria-label="Pick a reaction" className="flex items-center">
              {CHAT_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  aria-label={`React ${emoji}`}
                  className="w-9 h-8 text-base hover:bg-white/10 press-feedback"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <>
              {CHAT_REACTIONS.slice(0, 3).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  aria-label={`React ${emoji}`}
                  className="w-8 h-8 text-sm hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-label="More reactions"
                className="w-8 h-8 flex items-center justify-center text-muted hover:text-white hover:bg-white/10"
              >
                <SmilePlus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onReply(message)}
                aria-label="Reply"
                className="w-8 h-8 flex items-center justify-center text-muted hover:text-white hover:bg-white/10"
              >
                <CornerUpLeft className="w-4 h-4" />
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(message)}
                  aria-label="Delete message"
                  className="w-8 h-8 flex items-center justify-center text-muted hover:text-red-400 hover:bg-white/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                !isOwn && (
                  <button
                    type="button"
                    onClick={() => onReport(message)}
                    aria-label="Report message"
                    className="w-8 h-8 flex items-center justify-center text-muted hover:text-red-400 hover:bg-white/10"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => onOpenActions(message)}
                aria-label="More actions"
                className="w-8 h-8 flex items-center justify-center text-muted hover:text-white hover:bg-white/10"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMessageRow;
