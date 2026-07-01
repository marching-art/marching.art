// =============================================================================
// BUTTON COMPONENT TESTS
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Plus, ArrowRight } from 'lucide-react';
import { Button, IconButton } from './Button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('renders each supported variant with its label', () => {
      for (const variant of ['primary', 'secondary', 'ghost'] as const) {
        const { unmount } = render(<Button variant={variant}>{variant}</Button>);
        expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
        unmount();
      }
    });

    it('applies visually distinct styling per variant', () => {
      const classFor = (variant: 'primary' | 'secondary' | 'ghost') => {
        const { getByRole, unmount } = render(<Button variant={variant}>x</Button>);
        const className = getByRole('button').className;
        unmount();
        return className;
      };
      const primary = classFor('primary');
      const secondary = classFor('secondary');
      const ghost = classFor('ghost');
      expect(primary).not.toEqual(secondary);
      expect(secondary).not.toEqual(ghost);
      expect(primary).not.toEqual(ghost);
    });
  });

  describe('sizes', () => {
    it('renders with small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3');
      expect(button).toHaveClass('py-2');
    });

    it('renders with medium size (default)', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-5');
      expect(button).toHaveClass('py-3');
    });

    it('renders with large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-8');
      expect(button).toHaveClass('py-4');
    });
  });

  describe('icons', () => {
    it('renders with left icon', () => {
      render(<Button leftIcon={Plus}>Add Item</Button>);
      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      render(<Button rightIcon={ArrowRight}>Continue</Button>);
      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with both icons', () => {
      render(
        <Button leftIcon={Plus} rightIcon={ArrowRight}>
          Both Icons
        </Button>
      );
      const button = screen.getByRole('button');
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(2);
    });
  });

  describe('states', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Should show spinner instead of left icon
      expect(button.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('is disabled when isDisabled is true', () => {
      render(<Button isDisabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('is disabled when loading', () => {
      render(<Button isLoading>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('does not show right icon when loading', () => {
      render(
        <Button isLoading rightIcon={ArrowRight}>
          Loading
        </Button>
      );
      const button = screen.getByRole('button');
      // Only spinner should be visible, not the right icon
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(1);
      expect(svgs[0]).toHaveClass('animate-spin');
    });
  });

  describe('full width', () => {
    it('applies full width class when fullWidth is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      expect(screen.getByRole('button')).toHaveClass('w-full');
    });

    it('does not apply full width by default', () => {
      render(<Button>Normal</Button>);
      expect(screen.getByRole('button')).not.toHaveClass('w-full');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button isDisabled onClick={handleClick}>
          Disabled
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(
        <Button isLoading onClick={handleClick}>
          Loading
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('custom className', () => {
    it('accepts and applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });
});

describe('IconButton', () => {
  it('renders with icon and aria-label', () => {
    render(<IconButton icon={Plus} aria-label="Add item" />);
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
  });

  it('applies distinct sizing per size prop', () => {
    const { getByRole, rerender } = render(<IconButton icon={Plus} aria-label="Add" size="sm" />);
    const small = getByRole('button').className;
    rerender(<IconButton icon={Plus} aria-label="Add" size="lg" />);
    const large = getByRole('button').className;
    expect(small).not.toEqual(large);
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<IconButton icon={Plus} aria-label="Add" onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards the variant through to the underlying Button', () => {
    const { getByRole, rerender } = render(
      <IconButton icon={Plus} aria-label="Add" variant="primary" />
    );
    const primary = getByRole('button').className;
    rerender(<IconButton icon={Plus} aria-label="Add" variant="secondary" />);
    const secondary = getByRole('button').className;
    expect(primary).not.toEqual(secondary);
  });
});
