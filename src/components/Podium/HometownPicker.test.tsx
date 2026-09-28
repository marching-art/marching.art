// Hometown picker: any real US/Canadian town, not only show cities.

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HometownPicker, { type SelectedHome } from './HometownPicker';

function Harness({
  initialQuery = '',
  onSelect,
}: {
  initialQuery?: string;
  onSelect: (home: SelectedHome | null) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<SelectedHome | null>(null);
  return (
    <HometownPicker
      query={query}
      onQueryChange={setQuery}
      selected={selected}
      onSelect={(home) => {
        setSelected(home);
        onSelect(home);
      }}
    />
  );
}

describe('HometownPicker', () => {
  it('finds and picks a small town that has never hosted a show', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Brownsburg, IN' } });
    const option = await screen.findByRole('option', { name: 'Brownsburg, IN' });
    fireEvent.mouseDown(option);
    const picked = onSelect.mock.lastCall?.[0];
    expect(picked).toMatchObject({ label: 'Brownsburg, IN', venueId: null });
    expect(input).toHaveValue('Brownsburg, IN');
  });

  it('marks show cities and supports keyboard selection', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Canton, OH' } });
    const option = await screen.findByRole('option', { name: /^Canton, OH/ });
    expect(option).toHaveTextContent('Show city');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect.mock.lastCall?.[0]).toMatchObject({ label: 'Canton, OH' });
  });

  it('adopts a prefilled legacy hometown once the towns load', async () => {
    const onSelect = vi.fn();
    render(<Harness initialQuery="Brownsburg, Indiana" onSelect={onSelect} />);
    await vi.waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: 'Brownsburg, IN' }))
    );
  });
});
