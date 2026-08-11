import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WriterBadge from './WriterBadge';

describe('WriterBadge', () => {
  it('renders nothing below the first tier', () => {
    const { container } = render(<WriterBadge contribution={{ pressReleaseCount: 1 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the earned tier label', () => {
    render(<WriterBadge contribution={{ approvedCount: 1 }} />);
    expect(screen.getByText('Contributor')).toBeInTheDocument();
  });

  it('shows the top tier for a heavy contributor', () => {
    render(<WriterBadge contribution={{ approvedCount: 12 }} />);
    expect(screen.getByText('Staff Writer')).toBeInTheDocument();
  });

  it('renders nothing for a missing contribution', () => {
    const { container } = render(<WriterBadge contribution={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
