// Render tests for the lineup roster. Pins the vocabulary an empty slot
// teaches, and the states a director reads it in.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ActiveLineupTable from './ActiveLineupTable';

const FULL = {
  GE1: 'Blue Devils|2014',
  GE2: 'Carolina Crown|2013',
  VP: 'Santa Clara Vanguard|2018',
  VA: 'Bluecoats|2016',
  CG: 'Cadets|2005',
  B: 'Phantom Regiment|2008',
  MA: 'Boston Crusaders|2022',
  P: 'Cavaliers|2002',
};

const renderTable = (props = {}) =>
  render(
    <ActiveLineupTable
      lineup={FULL}
      lineupScoreData={{}}
      loading={false}
      onManageLineup={() => {}}
      onSlotClick={() => {}}
      {...props}
    />
  );

describe('ActiveLineupTable', () => {
  it('names the caption on an empty slot, since that is when it matters', () => {
    // "VP" means nothing until you have read "Visual Proficiency" once.
    renderTable({ lineup: { GE1: 'Blue Devils|2014' } });
    expect(screen.getByText('Visual Proficiency')).toBeInTheDocument();
    expect(screen.getByText('Color Guard')).toBeInTheDocument();
    expect(screen.queryByText('Empty slot')).not.toBeInTheDocument();
  });

  it('gives a filled slot to the corps instead', () => {
    // A filled row already carries a corps, a year, a score, and a trend;
    // the caption name would cost a line on every one of the eight.
    renderTable();
    expect(screen.getByText('Blue Devils')).toBeInTheDocument();
    expect(screen.queryByText('Visual Proficiency')).not.toBeInTheDocument();
  });

  it('still prompts the draft on an empty slot', () => {
    renderTable({ lineup: {} });
    expect(screen.getAllByText('+ Draft player')).toHaveLength(8);
  });

  it('counts the filled slots against the eight the game requires', () => {
    renderTable({ lineup: { GE1: 'Blue Devils|2014', GE2: 'Carolina Crown|2013' } });
    expect(screen.getByText('2/8')).toBeInTheDocument();
  });

  it('opens the editor on the caption that was tapped', () => {
    const onSlotClick = vi.fn();
    renderTable({ lineup: {}, onSlotClick });
    fireEvent.click(screen.getByText('Color Guard'));
    expect(onSlotClick).toHaveBeenCalledWith('CG');
  });

  it('says so when no show is on the calendar', () => {
    renderTable({ nextShow: null });
    expect(screen.getByText(/No upcoming show selected/)).toBeInTheDocument();
  });
});
