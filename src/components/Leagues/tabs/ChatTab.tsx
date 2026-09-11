// ChatTab — the league's conversation.
//
// A single threaded column (avatar + name on the first message of a run,
// bare lines after), day separators, a "new messages" line at the viewer's
// read marker, reactions and replies, and a composer that lives here rather
// than in the parent so sending always happens where the message lands.
//
// Scroll rules: stay pinned to the bottom while the viewer is there; if they
// have scrolled up to read, new arrivals count into a "jump to latest" pill
// instead of yanking them down; loading older history keeps the message under
// their thumb exactly where it was.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { ArrowDown, CornerUpLeft, Copy, Flag, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal, Modal } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { isPendingMessage, type ChatListMessage } from '../../../hooks/useLeagueChat';
import {
  CHAT_REACTIONS,
  buildChatRows,
  formatDayLabel,
  getChatDisplayName,
  getMentionHandle,
  type ChatMemberMap,
} from '../../../utils/chatFormat';
import { listCommissioners } from '../../../utils/leaguePermissions';
import ChatComposer, { type ComposerSeed } from './ChatComposer';
import ChatMessageRow, { ChatAvatar } from './ChatMessageRow';

interface ChatTabProps {
  league?: { id?: string; name?: string; creatorId?: string; commissioners?: string[] } | null;
  messages: ChatListMessage[];
  userProfile?: { uid?: string } | null;
  memberProfiles?: ChatMemberMap;
  isCommissioner?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  /** The viewer's read marker; frozen on mount to place the unread line. */
  readAt?: number;
  onLoadOlder?: () => void;
  onMarkRead?: () => void;
  onSend: (text: string, replyTo?: string | null) => Promise<boolean>;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReport: (messageId: string, reason: string) => Promise<string>;
}

const BOTTOM_THRESHOLD_PX = 80;

const EMPTY_PROMPTS = [
  { emoji: '👋', text: 'Say hi to the league' },
  { emoji: '🔥', text: 'Call your shot for this week' },
  { emoji: '🏆', text: "Who's taking the title?" },
];

const ChatTab = ({
  league,
  messages,
  userProfile,
  memberProfiles = {},
  isCommissioner = false,
  hasMore = false,
  isLoadingMore = false,
  readAt = 0,
  onLoadOlder,
  onMarkRead,
  onSend,
  onRetry,
  onDiscard,
  onReact,
  onDelete,
  onReport,
}: ChatTabProps) => {
  const viewerUid = userProfile?.uid;
  const listRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const highlightTimer = useRef<number | null>(null);

  // The read marker as it stood when the tab opened. markRead advances the
  // live one as messages arrive; this one keeps the "new" line in place.
  const [unreadSince] = useState(readAt);
  const [newBelow, setNewBelow] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatListMessage | null>(null);
  const [seed, setSeed] = useState<ComposerSeed | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatListMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatListMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reporting, setReporting] = useState<ChatListMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const commissionerUids = useMemo(() => listCommissioners(league), [league]);
  const rows = useMemo(
    () => buildChatRows(messages, { unreadSince, viewerUid }),
    [messages, unreadSince, viewerUid]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = listRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior });
    else el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < BOTTOM_THRESHOLD_PX;
    atBottomRef.current = atBottom;
    if (atBottom) {
      setNewBelow(0);
      setShowJump(false);
      onMarkRead?.();
    } else {
      setShowJump(distance > el.clientHeight * 0.75);
    }
  }, [onMarkRead]);

  // Position the list as messages change: first paint, appends, prepends.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const count = messages.length;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[count - 1]?.id ?? null;
    const prevCount = prevCountRef.current;

    if (count > 0 && prevCount === 0) {
      // First paint: open on the unread line when there is one, else the end.
      const unreadEl = el.querySelector<HTMLElement>('[data-unread-line]');
      if (unreadEl && unreadSince > 0) {
        // Scroll the list itself, not every ancestor scrollIntoView can reach.
        el.scrollTop = Math.max(0, unreadEl.offsetTop - el.clientHeight / 2);
        handleScroll();
      } else {
        scrollToBottom();
        atBottomRef.current = true;
        onMarkRead?.();
      }
    } else if (
      count > prevCount &&
      firstId !== prevFirstIdRef.current &&
      lastId === prevLastIdRef.current
    ) {
      // Older history was prepended: keep the viewport on the same message.
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    } else if (lastId !== prevLastIdRef.current && count > 0) {
      const last = messages[count - 1];
      const ownJustSent = last.userId === viewerUid && isPendingMessage(last);
      if (atBottomRef.current || ownJustSent) {
        scrollToBottom(prevCount === 0 ? 'auto' : 'smooth');
        onMarkRead?.();
      } else {
        setNewBelow((n) => n + Math.max(1, count - prevCount));
        setShowJump(true);
      }
    }

    prevCountRef.current = count;
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages, viewerUid, unreadSince, scrollToBottom, handleScroll, onMarkRead]);

  // Reaching the top loads more, so a reader scrolling back never hits a wall.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isLoadingMore && messages.length > 0) {
          prevScrollHeightRef.current = root.scrollHeight;
          onLoadOlder?.();
        }
      },
      { root, rootMargin: '200px 0px 0px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadOlder, messages.length]);

  // Coming back to the tab (or the app) while at the bottom counts as reading.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && atBottomRef.current) onMarkRead?.();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [onMarkRead]);

  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    },
    []
  );

  const jumpTo = useCallback((messageId: string) => {
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(messageId)
        : messageId.replace(/["\\]/g, '\\$&');
    const el = listRef.current?.querySelector<HTMLElement>(`[data-message-id="${escaped}"]`);
    if (!el) {
      toast('That message is further back — scroll up to load earlier history.', { icon: '↑' });
      return;
    }
    const list = listRef.current;
    if (list) {
      const top = Math.max(0, el.offsetTop - (list.clientHeight - el.offsetHeight) / 2);
      if (typeof list.scrollTo === 'function') list.scrollTo({ top, behavior: 'smooth' });
      else list.scrollTop = top;
    }
    setHighlightedId(messageId);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightedId(null), 1600);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const replyId = replyingTo && !isPendingMessage(replyingTo) ? replyingTo.id : null;
      setReplyingTo(null);
      atBottomRef.current = true;
      return onSend(text, replyId);
    },
    [onSend, replyingTo]
  );

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      setActionsFor(null);
      onReact(messageId, emoji).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Couldn't react");
      });
    },
    [onReact]
  );

  const startReply = (message: ChatListMessage) => {
    setActionsFor(null);
    setReplyingTo(message);
  };

  const mentionAuthor = (message: ChatListMessage) => {
    setActionsFor(null);
    const handle = getMentionHandle(message.userId, memberProfiles);
    if (handle) setSeed({ text: `@${handle} `, nonce: Date.now() });
  };

  const copyText = async (message: ChatListMessage) => {
    setActionsFor(null);
    try {
      await navigator.clipboard.writeText(message.message);
      toast.success('Copied');
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await onDelete(deleting.id);
      toast.success('Message deleted');
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete message');
    } finally {
      setIsDeleting(false);
    }
  };

  const submitReport = async () => {
    if (!reporting || reportReason.trim().length < 5) return;
    setIsReporting(true);
    try {
      const result = await onReport(reporting.id, reportReason.trim());
      toast.success(result || 'Reported');
      setReporting(null);
      setReportReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to report');
    } finally {
      setIsReporting(false);
    }
  };

  const canDeleteMessage = (message: ChatListMessage) =>
    !isPendingMessage(message) && (message.userId === viewerUid || isCommissioner);

  const actionName = actionsFor ? getChatDisplayName(actionsFor.userId, memberProfiles) : '';

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 min-h-0 flex flex-col"
    >
      {/* Thread */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-label="League chat"
          className="absolute inset-0 overflow-y-auto overscroll-contain pb-3"
        >
          <div ref={topSentinelRef} aria-hidden="true" />

          {messages.length > 0 && (
            <div className="flex justify-center pt-4 pb-1">
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => {
                    if (listRef.current) prevScrollHeightRef.current = listRef.current.scrollHeight;
                    onLoadOlder?.();
                  }}
                  disabled={isLoadingMore}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted border border-line hover:border-line-strong hover:text-white disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isLoadingMore ? 'Loading…' : 'Load earlier messages'}
                </button>
              ) : (
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  The beginning of {league?.name ? `${league.name}'s` : 'the'} chat
                </p>
              )}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
              <div className="w-12 h-12 bg-interactive/10 border border-interactive/30 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-interactive" />
              </div>
              <p className="text-sm font-bold text-white">It's quiet in here</p>
              <p className="text-xs text-muted mt-1 max-w-xs">
                Every member of the league sees this thread. Mention someone with @ and they get a
                nudge.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EMPTY_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.text}
                    type="button"
                    onClick={() => setSeed({ text: prompt.text, nonce: Date.now() })}
                    className="px-3 py-2 min-h-touch bg-surface-raised border border-line hover:border-line-strong text-xs text-secondary hover:text-white transition-colors press-feedback"
                  >
                    <span aria-hidden="true" className="mr-1.5">
                      {prompt.emoji}
                    </span>
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            rows.map((row) => {
              if (row.kind === 'day') {
                return (
                  <div
                    key={row.key}
                    className="sticky top-0 z-[5] flex items-center gap-3 px-4 py-2 bg-background/95"
                  >
                    <div className="flex-1 h-px bg-line" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {formatDayLabel(row.date)}
                    </span>
                    <div className="flex-1 h-px bg-line" />
                  </div>
                );
              }
              if (row.kind === 'unread') {
                return (
                  <div
                    key={row.key}
                    data-unread-line=""
                    className="flex items-center gap-3 px-4 mt-3"
                    role="separator"
                    aria-label="New messages"
                  >
                    <div className="flex-1 h-px bg-brand/60" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                      New
                    </span>
                  </div>
                );
              }
              return (
                <ChatMessageRow
                  key={row.key}
                  message={row.message}
                  startsRun={row.startsRun}
                  isUnread={row.isUnread}
                  viewerUid={viewerUid}
                  members={memberProfiles}
                  ownerUid={league?.creatorId}
                  commissionerUids={commissionerUids}
                  canDelete={canDeleteMessage(row.message)}
                  highlighted={highlightedId === row.message.id}
                  onReact={handleReact}
                  onReply={startReply}
                  onDelete={setDeleting}
                  onReport={setReporting}
                  onOpenActions={setActionsFor}
                  onJumpTo={jumpTo}
                  onRetry={onRetry}
                  onDiscard={onDiscard}
                />
              );
            })
          )}
        </div>

        {/* Jump to latest */}
        {(showJump || newBelow > 0) && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom('smooth');
              setNewBelow(0);
              setShowJump(false);
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-interactive text-white text-xs font-bold border border-interactive press-feedback"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {newBelow > 0
              ? `${newBelow} new message${newBelow === 1 ? '' : 's'}`
              : 'Jump to latest'}
          </button>
        )}
      </div>

      {/* Composer. pb-14 clears the mobile nav. */}
      <div className="flex-shrink-0 bg-surface-card border-t border-line px-3 sm:px-4 pt-2 pb-14 md:pb-2 z-20">
        <ChatComposer
          leagueId={league?.id}
          viewerUid={viewerUid}
          members={memberProfiles}
          replyingTo={replyingTo}
          seed={seed}
          onCancelReply={() => setReplyingTo(null)}
          onSend={handleSend}
        />
      </div>

      {/* Action sheet: long-press on touch, keyboard "Actions" on desktop */}
      <BottomSheet
        isOpen={Boolean(actionsFor)}
        onClose={() => setActionsFor(null)}
        snapPoints={[60]}
        showCloseButton={false}
      >
        {actionsFor && (
          <div className="px-4 pb-6 overflow-y-auto">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <ChatAvatar uid={actionsFor.userId} name={actionName} size="sm" />
              <span className="text-sm font-bold text-white truncate">{actionName}</span>
              <span className="text-xs text-muted truncate">{actionsFor.message}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-line">
              {CHAT_REACTIONS.map((emoji) => {
                const mine = Boolean(
                  viewerUid && actionsFor.reactions?.[emoji]?.includes(viewerUid)
                );
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(actionsFor.id, emoji)}
                    aria-label={`React ${emoji}`}
                    aria-pressed={mine}
                    className={`w-11 h-11 text-2xl flex items-center justify-center press-feedback ${
                      mine ? 'bg-interactive/20 border border-interactive/60' : 'hover:bg-white/10'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <div className="py-2">
              <SheetAction
                icon={CornerUpLeft}
                label="Reply"
                onClick={() => startReply(actionsFor)}
              />
              {actionsFor.userId !== viewerUid &&
                getMentionHandle(actionsFor.userId, memberProfiles) && (
                  <SheetAction
                    icon={MessageSquare}
                    label={`Mention ${actionName}`}
                    onClick={() => mentionAuthor(actionsFor)}
                  />
                )}
              <SheetAction icon={Copy} label="Copy text" onClick={() => copyText(actionsFor)} />
              {canDeleteMessage(actionsFor) && (
                <SheetAction
                  icon={Trash2}
                  label="Delete message"
                  danger
                  onClick={() => {
                    setActionsFor(null);
                    setDeleting(actionsFor);
                  }}
                />
              )}
              {actionsFor.userId !== viewerUid && (
                <SheetAction
                  icon={Flag}
                  label="Report to admins"
                  danger
                  onClick={() => {
                    setActionsFor(null);
                    setReporting(actionsFor);
                  }}
                />
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmModal
        isOpen={Boolean(deleting)}
        onClose={() => (isDeleting ? undefined : setDeleting(null))}
        onConfirm={() => void confirmDelete()}
        title="Delete message"
        message={
          deleting && deleting.userId !== viewerUid
            ? `Remove this message from ${getChatDisplayName(deleting.userId, memberProfiles)}? The league will see that a commissioner removed a message.`
            : 'Delete this message for everyone? This cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      <Modal
        isOpen={Boolean(reporting)}
        onClose={() => {
          if (isReporting) return;
          setReporting(null);
          setReportReason('');
        }}
        title="Report message"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setReporting(null);
                setReportReason('');
              }}
              disabled={isReporting}
              className="min-h-touch px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={isReporting || reportReason.trim().length < 5}
              className="min-h-touch px-4 bg-red-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-red-500 disabled:opacity-50 flex items-center gap-2"
            >
              {isReporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Report
            </button>
          </>
        }
      >
        <div className="p-4 space-y-3">
          {reporting && (
            <blockquote className="pl-3 border-l-2 border-line text-xs text-secondary line-clamp-4">
              <span className="font-bold text-white">
                {getChatDisplayName(reporting.userId, memberProfiles)}:
              </span>{' '}
              {reporting.message}
            </blockquote>
          )}
          <p className="text-xs text-muted">
            Site admins review reports. The commissioner can also delete messages in this league.
          </p>
          <textarea
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="What's wrong with it? (a few words is enough)"
            aria-label="Reason for report"
            className="w-full bg-surface-sunken border border-line px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-line-strong resize-none"
          />
        </div>
      </Modal>
    </m.div>
  );
};

const SheetAction = ({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-2 py-3 min-h-touch text-sm text-left press-feedback ${
      danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white hover:bg-white/5'
    }`}
  >
    <Icon className="w-4 h-4 flex-shrink-0" />
    {label}
  </button>
);

export default ChatTab;
