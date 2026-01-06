// =============================================================================
// MODAL COMPONENT TESTS
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Trophy } from 'lucide-react';
import { Modal, ConfirmModal } from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    // Create portal root
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'portal-root');
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    // Clean up portal root
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
    // Reset body overflow
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('renders children when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <Modal isOpen={false} onClose={() => {}}>
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Title">
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Title" subtitle="Subtitle text">
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Title" icon={<Trophy data-testid="modal-icon" />}>
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByTestId('modal-icon')).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} footer={<button>Submit</button>}>
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('renders close button by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Title">
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Title" showCloseButton={false}>
          <p>Content</p>
        </Modal>
      );
      expect(screen.queryByRole('button', { name: /close modal/i })).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies small size class', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          <p>Content</p>
        </Modal>
      );
      // Modal renders via portal to document.body
      expect(document.body.querySelector('.max-w-sm')).toBeInTheDocument();
    });

    it('applies medium size by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      // Modal renders via portal to document.body
      expect(document.body.querySelector('.max-w-md')).toBeInTheDocument();
    });

    it('applies large size class', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          <p>Content</p>
        </Modal>
      );
      // Modal renders via portal to document.body
      expect(document.body.querySelector('.max-w-2xl')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Title">
          <p>Content</p>
        </Modal>
      );
      fireEvent.click(screen.getByRole('button', { name: /close modal/i }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked by default', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Modal>
      );
      // Click on the overlay (the dialog backdrop)
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on overlay click when closeOnOverlayClick is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnOverlayClick={false}>
          <p>Content</p>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close when clicking inside modal content', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <button>Inside button</button>
        </Modal>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Inside button' }));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('calls onClose on Escape key by default', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape when closeOnEscape is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
          <p>Content</p>
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('body overflow', () => {
    it('hides body overflow when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body overflow when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('accessibility', () => {
    it('has correct aria attributes', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Accessible Modal">
          <p>Content</p>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });
  });
});

describe('ConfirmModal', () => {
  beforeEach(() => {
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'portal-root');
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('renders title and message', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm Action"
          message="Are you sure you want to proceed?"
        />
      );
      expect(screen.getByRole('heading', { name: 'Confirm Action' })).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('renders default button texts', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm"
          message="Message"
        />
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('renders custom button texts', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete Item"
          message="This cannot be undone."
          confirmText="Delete"
          cancelText="Keep"
        />
      );
      expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Processing"
          message="Please wait..."
          isLoading={true}
        />
      );
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('calls onClose when cancel is clicked', () => {
      const handleClose = vi.fn();
      render(
        <ConfirmModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={() => {}}
          title="Confirm"
          message="Message"
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when confirm is clicked', () => {
      const handleConfirm = vi.fn();
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={handleConfirm}
          title="Confirm"
          message="Message"
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when loading', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm"
          message="Message"
          isLoading={true}
        />
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    });
  });

  describe('variants', () => {
    it('renders danger variant with red button', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete"
          message="Are you sure?"
          variant="danger"
        />
      );
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('bg-red-600');
    });

    it('renders default variant with gold button', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm"
          message="Proceed?"
          variant="default"
        />
      );
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('bg-gradient-gold');
    });
  });
});
