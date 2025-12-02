// =============================================================================
// CARD COMPONENT TESTS
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Trophy } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';

describe('Card', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with default variant', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-charcoal-800');
    });

    it('renders with glass variant', () => {
      const { container } = render(<Card variant="glass">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('glass');
    });

    it('renders with glass-dark variant', () => {
      const { container } = render(<Card variant="glass-dark">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('glass-dark');
    });

    it('renders with premium variant', () => {
      const { container } = render(<Card variant="premium">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-gradient-to-br');
    });

    it('renders with outlined variant', () => {
      const { container } = render(<Card variant="outlined">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-transparent');
      expect(card).toHaveClass('border-cream-800');
    });
  });

  describe('padding', () => {
    it('applies no padding', () => {
      const { container } = render(<Card padding="none">Content</Card>);
      expect(container.firstChild).toHaveClass('p-0');
    });

    it('applies small padding', () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      expect(container.firstChild).toHaveClass('p-4');
    });

    it('applies medium padding (default)', () => {
      const { container } = render(<Card>Content</Card>);
      expect(container.firstChild).toHaveClass('p-6');
    });

    it('applies large padding', () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      expect(container.firstChild).toHaveClass('p-8');
    });
  });

  describe('interactions', () => {
    it('applies hoverable class', () => {
      const { container } = render(<Card hoverable>Content</Card>);
      expect(container.firstChild).toHaveClass('cursor-pointer');
      expect(container.firstChild).toHaveClass('hover:shadow-xl');
    });

    it('applies pressable class', () => {
      const { container } = render(<Card pressable>Content</Card>);
      expect(container.firstChild).toHaveClass('cursor-pointer');
    });

    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Card onClick={handleClick}>Clickable</Card>);
      fireEvent.click(screen.getByText('Clickable'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom className', () => {
    it('accepts and applies custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

describe('CardHeader', () => {
  it('renders title correctly', () => {
    render(<CardHeader title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Title');
  });

  it('renders subtitle when provided', () => {
    render(<CardHeader title="Title" subtitle="Subtitle text" />);
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<CardHeader title="Title" />);
    // Should only have the title element
    const subtitleElement = container.querySelector('.text-cream-500\\/70');
    expect(subtitleElement).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<CardHeader title="Title" icon={<Trophy data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <CardHeader
        title="Title"
        action={<button data-testid="action-btn">Action</button>}
      />
    );
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CardHeader title="Title" className="custom-header" />
    );
    expect(container.firstChild).toHaveClass('custom-header');
  });
});

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content goes here</CardContent>);
    expect(screen.getByText('Content goes here')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CardContent className="custom-content">Content</CardContent>
    );
    expect(container.firstChild).toHaveClass('custom-content');
  });
});

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('has border top styling', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveClass('border-t');
    expect(container.firstChild).toHaveClass('mt-4');
    expect(container.firstChild).toHaveClass('pt-4');
  });

  it('applies custom className', () => {
    const { container } = render(
      <CardFooter className="custom-footer">Footer</CardFooter>
    );
    expect(container.firstChild).toHaveClass('custom-footer');
  });
});

describe('Card composition', () => {
  it('renders full card with all sub-components', () => {
    render(
      <Card>
        <CardHeader
          title="Card Title"
          subtitle="Card subtitle"
          icon={<Trophy data-testid="card-icon" />}
          action={<button>Edit</button>}
        />
        <CardContent>
          <p>This is the card content.</p>
        </CardContent>
        <CardFooter>
          <button>Save</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('card-icon')).toBeInTheDocument();
    expect(screen.getByText('This is the card content.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
