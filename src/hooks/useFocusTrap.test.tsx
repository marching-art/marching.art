// =============================================================================
// FOCUS TRAP HOOK TESTS
// =============================================================================

import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

// Minimal dialog fixture: three focusable elements inside the trapped
// container, mirroring the Portal + role="dialog" pattern the app's modals use.
const TrapDialog = ({ active = true }: { active?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, active);
  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      <button>First</button>
      <input aria-label="Middle" />
      <button>Last</button>
    </div>
  );
};

describe('useFocusTrap', () => {
  describe('initial focus', () => {
    it('moves focus to the first focusable element in the container', async () => {
      render(<TrapDialog />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    });

    it('does not steal focus from an element already inside the container', async () => {
      const AutoFocusDialog = () => {
        const containerRef = useRef<HTMLDivElement>(null);
        useFocusTrap(containerRef);
        return (
          <div ref={containerRef} role="dialog">
            <button>First</button>
            <input aria-label="Name" autoFocus />
          </div>
        );
      };
      render(<AutoFocusDialog />);
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus());
      // Give the deferred focus a tick to (not) fire
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });

    it('does not move focus when inactive', async () => {
      render(
        <div>
          <button>Outside</button>
          <TrapDialog active={false} />
        </div>
      );
      screen.getByRole('button', { name: 'Outside' }).focus();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
    });
  });

  describe('tab cycling', () => {
    it('wraps Tab from the last element to the first', async () => {
      render(<TrapDialog />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
      screen.getByRole('button', { name: 'Last' }).focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    });

    it('wraps Shift+Tab from the first element to the last', async () => {
      render(<TrapDialog />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    });

    it('leaves mid-container tabbing to the browser default', async () => {
      render(<TrapDialog />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
      // Tab from the first (non-boundary) element: the hook must not
      // preventDefault or re-focus anything.
      const event = fireEvent.keyDown(document, { key: 'Tab' });
      expect(event).toBe(true); // not defaultPrevented
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    });

    it('does not intercept Tab when inactive', async () => {
      render(
        <div>
          <button>Outside</button>
          <TrapDialog active={false} />
        </div>
      );
      screen.getByRole('button', { name: 'Last' }).focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(screen.getByRole('button', { name: 'First' })).not.toHaveFocus();
    });
  });

  describe('focus restore', () => {
    it('restores focus to the previously focused element on unmount', async () => {
      render(<button>Opener</button>);
      const opener = screen.getByRole('button', { name: 'Opener' });
      opener.focus();

      const { unmount } = render(<TrapDialog />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());

      unmount();
      expect(opener).toHaveFocus();
    });

    it('restores focus when the trap deactivates', async () => {
      const Harness = ({ active }: { active: boolean }) => (
        <div>
          <button>Opener</button>
          <TrapDialog active={active} />
        </div>
      );
      const { rerender } = render(<Harness active={false} />);
      const opener = screen.getByRole('button', { name: 'Opener' });
      opener.focus();

      rerender(<Harness active={true} />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());

      rerender(<Harness active={false} />);
      expect(opener).toHaveFocus();
    });
  });
});
