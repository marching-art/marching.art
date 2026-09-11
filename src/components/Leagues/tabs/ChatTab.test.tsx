// The league chat's visible contract: the empty state seeds the composer, the
// thread groups runs and marks where the viewer left off, reactions render as
// pressable chips, the mention picker inserts a handle, and Enter sends.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// The tab reaches the API only through the props it is given; the hook module
// it shares types with would otherwise boot Firebase on import.
vi.mock('../../../api/leagues', () => ({
  subscribeToChat: vi.fn(() => () => {}),
  getOlderChatMessages: vi.fn(),
  postChatMessage: vi.fn(),
  toggleChatReaction: vi.fn(),
  reportChatMessage: vi.fn(),
  deleteChatMessage: vi.fn(),
}));

import ChatTab from './ChatTab';
import type { ChatListMessage } from '../../../hooks/useLeagueChat';

const members = {
  me: { displayName: 'Chris', username: 'crohn' },
  owner: {
    displayName: 'Sam Owner',
    username: 'sam',
    corps: { worldClass: { corpsName: 'Blue Stars' } },
  },
  other: { displayName: 'Blue Devil', username: 'blue_devil' },
};

const league = { id: 'league-1', name: 'The League', creatorId: 'owner', commissioners: [] };

const message = (
  id: string,
  userId: string,
  iso: string,
  extra: Partial<ChatListMessage> = {}
): ChatListMessage =>
  ({ id, userId, message: `msg ${id}`, createdAt: new Date(iso), ...extra }) as ChatListMessage;

function renderTab(props: Partial<React.ComponentProps<typeof ChatTab>> = {}) {
  const handlers = {
    onSend: vi.fn().mockResolvedValue(true),
    onRetry: vi.fn(),
    onDiscard: vi.fn(),
    onReact: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onReport: vi.fn().mockResolvedValue('Reported.'),
  };
  const utils = render(
    <ChatTab
      league={league}
      messages={[]}
      userProfile={{ uid: 'me' }}
      memberProfiles={members}
      {...handlers}
      {...props}
    />
  );
  return { ...utils, ...handlers };
}

describe('ChatTab', () => {
  it('seeds the composer from an empty-state prompt', () => {
    renderTab();
    expect(screen.getByText("It's quiet in here")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Say hi to the league/ }));
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Say hi to the league');
  });

  it('groups a run under one header and draws the New line at the read marker', () => {
    renderTab({
      readAt: Date.parse('2026-09-08T10:02:30'),
      messages: [
        message('a', 'owner', '2026-09-08T10:00:00'),
        message('b', 'owner', '2026-09-08T10:02:00'),
        message('c', 'other', '2026-09-08T10:03:00'),
      ],
    });
    const log = screen.getByRole('log', { name: 'League chat' });
    // Owner's name once for the run, with the commissioner badge and corps.
    expect(within(log).getAllByText('Sam Owner')).toHaveLength(1);
    expect(within(log).getByText('Commish')).toBeInTheDocument();
    expect(within(log).getByText('Blue Stars')).toBeInTheDocument();
    // The New separator sits before the first unread message from someone else.
    const separator = within(log).getByRole('separator', { name: 'New messages' });
    expect(separator.compareDocumentPosition(within(log).getByText('msg b'))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    );
    expect(separator.compareDocumentPosition(within(log).getByText('msg c'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    // The viewer's own messages never count as unread, so no line for them.
    expect(within(log).queryAllByRole('separator', { name: 'New messages' })).toHaveLength(1);
  });

  it('renders reactions as pressable chips and toggles on tap', () => {
    const { onReact } = renderTab({
      messages: [
        message('a', 'other', '2026-09-08T10:00:00', {
          reactions: { '🔥': ['me', 'owner'], '👀': ['owner'] },
        }),
      ],
    });
    const fire = screen.getByRole('button', { name: /🔥 2/ });
    expect(fire).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /👀 1/ })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(fire);
    expect(onReact).toHaveBeenCalledWith('a', '🔥');
  });

  it('quotes the original on a reply and highlights a mention of the viewer', () => {
    renderTab({
      messages: [
        message('a', 'other', '2026-09-08T10:00:00', { message: 'hey @crohn nice week' }),
        message('b', 'me', '2026-09-08T10:01:00', {
          replyTo: { id: 'a', userId: 'other', message: 'hey @crohn nice week' },
        }),
      ],
    });
    expect(screen.getByText('@crohn')).toHaveClass('text-brand');
    expect(
      screen.getByRole('button', { name: /Jump to the message from Blue Devil/ })
    ).toBeInTheDocument();
  });

  it('offers members from @ and inserts the handle, then sends on Enter', async () => {
    const { onSend } = renderTab({ messages: [message('a', 'other', '2026-09-08T10:00:00')] });
    const box = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;

    fireEvent.change(box, { target: { value: 'gg @b' } });
    box.setSelectionRange(5, 5);
    fireEvent.keyUp(box, { key: 'b' });
    const option = await screen.findByRole('option');
    expect(option).toHaveTextContent('Blue Devil');
    fireEvent.click(within(option).getByRole('button'));
    expect(box.value).toBe('gg @blue_devil ');

    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('gg @blue_devil ', null);
    expect(box.value).toBe('');
  });

  it('starts a reply from the action sheet and sends it against the original', async () => {
    const { onSend } = renderTab({ messages: [message('a', 'other', '2026-09-08T10:00:00')] });
    fireEvent.click(screen.getByRole('button', { name: "Actions for Blue Devil's message" }));
    // The hover bar's Reply exists in the DOM too (CSS-hidden); the sheet's is last.
    const replyButtons = await screen.findAllByRole('button', { name: 'Reply' });
    fireEvent.click(replyButtons[replyButtons.length - 1]);
    expect(screen.getByText('Replying to')).toBeInTheDocument();

    const box = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(box, { target: { value: 'agreed' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('agreed', 'a');
  });
});
