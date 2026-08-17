import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PressReleaseModal from './PressReleaseModal';

const aurora = { corpsClass: 'worldClass' as const, corpsName: 'Aurora' };

describe('PressReleaseModal', () => {
  it('renders the instant-publish framing and composer fields', () => {
    render(<PressReleaseModal ownedCorps={[aurora]} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Post a Press Release')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Headline/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Announcement/)).toBeInTheDocument();
    // Single corps renders as a static byline, not a dropdown.
    expect(screen.getByText('Aurora')).toBeInTheDocument();
  });

  it('publishes a valid release with the trimmed payload', () => {
    const onSubmit = vi.fn();
    render(<PressReleaseModal ownedCorps={[aurora]} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Headline/), {
      target: { value: 'Aurora unveils its 2026 production' },
    });
    fireEvent.change(screen.getByLabelText(/Announcement/), {
      target: {
        value:
          'Aurora is proud to reveal a bold new program for the 2026 season, inspired by the night sky.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.headline).toBe('Aurora unveils its 2026 production');
    expect(payload.corpsClass).toBe('worldClass');
  });

  it('blocks publishing an invalid release and surfaces the error', () => {
    const onSubmit = vi.fn();
    render(<PressReleaseModal ownedCorps={[aurora]} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Headline must be at least/i)).toBeInTheDocument();
  });

  it('lets a director with multiple corps choose which one issues the release', () => {
    const onSubmit = vi.fn();
    render(
      <PressReleaseModal
        ownedCorps={[aurora, { corpsClass: 'aClass', corpsName: 'Aurora Cadets' }]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Issued by/), { target: { value: 'aClass' } });
    fireEvent.change(screen.getByLabelText(/Headline/), {
      target: { value: 'Aurora Cadets announce a home show' },
    });
    fireEvent.change(screen.getByLabelText(/Announcement/), {
      target: { value: 'The Cadets will host their first home show of the season next month.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish/i }));

    expect(onSubmit.mock.calls[0][0].corpsClass).toBe('aClass');
  });

  it('lets a Podium-only director issue a release from their Podium corps', () => {
    const onSubmit = vi.fn();
    render(
      <PressReleaseModal
        ownedCorps={[{ corpsClass: 'podiumClass', corpsName: 'Canton Regiment' }]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    // The Podium corps is the sole issuer — no register-first prompt.
    expect(screen.queryByText(/Register a corps first/i)).not.toBeInTheDocument();
    expect(screen.getByText('Canton Regiment')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Headline/), {
      target: { value: 'Canton Regiment reveals its 2026 program' },
    });
    fireEvent.change(screen.getByLabelText(/Announcement/), {
      target: {
        value: 'The Regiment is thrilled to announce a bold new show for the coming season.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].corpsClass).toBe('podiumClass');
  });

  it('prompts a director with no corps to register first and disables publishing', () => {
    render(<PressReleaseModal ownedCorps={[]} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Register a corps first/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish/i })).toBeDisabled();
  });
});
