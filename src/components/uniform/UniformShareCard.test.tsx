import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import UniformShareCard from './UniformShareCard';
import { getUniformPreset } from '../../data/uniformCatalog';
import { FIGURE_SKIN_TONES } from '../../data/uniformRenderTheme';

describe('UniformShareCard', () => {
  const preset = getUniformPreset('classic-cadet')!;
  const design = {
    schema: 2 as const,
    name: 'Finals Look',
    colorway: preset.colorway,
    figure: preset.figure,
  };

  it('renders the formation, identity panel, and code stamp', () => {
    const { container, getByText } = render(
      <UniformShareCard
        design={design}
        corpsName="Ashline Cadets"
        classLabel="World Class"
        code="MA-7K3F-Q2"
      />
    );
    expect(getByText('Ashline Cadets')).toBeTruthy();
    expect(getByText('WORLD CLASS')).toBeTruthy();
    expect(getByText('MA-7K3F-Q2')).toBeTruthy();
    // a mixed-tone ensemble: more than one distinct skin tone renders
    const tones = FIGURE_SKIN_TONES.filter(
      (t) => container.querySelectorAll(`path[fill="${t}"]`).length > 0
    );
    expect(tones.length).toBeGreaterThan(1);
  });

  it('omits the code stamp when no code is passed', () => {
    const { queryByText } = render(
      <UniformShareCard design={design} corpsName="Ashline Cadets" classLabel="World Class" />
    );
    expect(queryByText('UNIFORM CODE')).toBeNull();
  });
});
