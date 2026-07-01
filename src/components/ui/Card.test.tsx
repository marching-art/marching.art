// =============================================================================
// CARD COMPONENT TESTS
// =============================================================================
// These tests assert the component's contract (rendering, semantics, behavior)
// rather than exact Tailwind utility classes, so they survive restyling.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Trophy } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';

describe('Card', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('accepts a custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('interactions', () => {
    it('is a plain container by default (no button semantics)', () => {
      render(<Card>Content</Card>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Card onClick={handleClick}>Clickable</Card>);
      fireEvent.click(screen.getByText('Clickable'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('exposes button semantics and is keyboard-activatable when pressable', () => {
      const handleClick = vi.fn();
      render(
        <Card pressable onClick={handleClick}>
          Press me
        </Card>
      );
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });
});

describe('CardTitle', () => {
  it('renders as a level-3 heading', () => {
    render(<CardTitle>Stats</CardTitle>);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Stats');
  });

  it('accepts a custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('custom-title');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('renders an action slot', () => {
    render(
      <CardHeader action={<button data-testid="action-btn">Action</button>}>
        Title
      </CardHeader>
    );
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('accepts a custom className', () => {
    const { container } = render(<CardHeader className="custom-header">Title</CardHeader>);
    expect(container.firstChild).toHaveClass('custom-header');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content goes here</CardContent>);
    expect(screen.getByText('Content goes here')).toBeInTheDocument();
  });

  it('accepts a custom className', () => {
    const { container } = render(<CardContent className="custom-content">Content</CardContent>);
    expect(container.firstChild).toHaveClass('custom-content');
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('accepts a custom className', () => {
    const { container } = render(<CardFooter className="custom-footer">Footer</CardFooter>);
    expect(container.firstChild).toHaveClass('custom-footer');
  });
});

describe('Card composition', () => {
  it('renders a full card with header, title, icon, body, and footer', () => {
    render(
      <Card>
        <CardHeader action={<button>Edit</button>}>
          <Trophy data-testid="card-icon" />
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the card content.</p>
        </CardContent>
        <CardFooter>
          <button>Save</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
    expect(screen.getByTestId('card-icon')).toBeInTheDocument();
    expect(screen.getByText('This is the card content.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('supports the compound Card.Header / Card.Title / Card.Body / Card.Footer API', () => {
    render(
      <Card>
        <Card.Header>
          <Card.Title>Compound</Card.Title>
        </Card.Header>
        <Card.Body>Body</Card.Body>
        <Card.Footer>Footer</Card.Footer>
      </Card>
    );
    expect(screen.getByRole('heading', { name: 'Compound' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
