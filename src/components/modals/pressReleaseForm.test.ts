import { describe, it, expect } from 'vitest';
import {
  PRESS_RELEASE_LIMITS,
  PRESS_RELEASE_AUTO_APPROVE_THRESHOLD,
  pressReleaseAutoPublishes,
  emptyPressReleaseForm,
  validatePressReleaseForm,
  isPressReleaseFormValid,
  buildPressReleasePayload,
  type PressReleaseFormState,
} from './pressReleaseForm';

const validForm = (over: Partial<PressReleaseFormState> = {}): PressReleaseFormState => ({
  headline: 'Aurora Announces 2026 Program',
  summary: 'Our new show goes public today.',
  body: 'Aurora is proud to announce our 2026 production, a bold reimagining of the night sky.',
  imageUrl: '',
  corpsClass: 'worldClass',
  ...over,
});

describe('emptyPressReleaseForm', () => {
  it('returns blank fields and carries the corps class', () => {
    const form = emptyPressReleaseForm('openClass');
    expect(form.headline).toBe('');
    expect(form.body).toBe('');
    expect(form.corpsClass).toBe('openClass');
  });
});

describe('validatePressReleaseForm', () => {
  it('accepts a well-formed release', () => {
    expect(validatePressReleaseForm(validForm())).toEqual({});
    expect(isPressReleaseFormValid(validForm())).toBe(true);
  });

  it('flags a short headline', () => {
    const errors = validatePressReleaseForm(validForm({ headline: 'Hi' }));
    expect(errors.headline).toMatch(/at least/);
    expect(isPressReleaseFormValid(validForm({ headline: 'Hi' }))).toBe(false);
  });

  it('flags an over-long headline', () => {
    const errors = validatePressReleaseForm(
      validForm({ headline: 'A'.repeat(PRESS_RELEASE_LIMITS.headlineMax + 1) })
    );
    expect(errors.headline).toMatch(/cannot exceed/);
  });

  it('flags a short body', () => {
    const errors = validatePressReleaseForm(validForm({ body: 'too short' }));
    expect(errors.body).toMatch(/at least/);
  });

  it('flags an over-long body', () => {
    const errors = validatePressReleaseForm(
      validForm({ body: 'A'.repeat(PRESS_RELEASE_LIMITS.bodyMax + 1) })
    );
    expect(errors.body).toMatch(/cannot exceed/);
  });

  it('flags an over-long summary', () => {
    const errors = validatePressReleaseForm(
      validForm({ summary: 'A'.repeat(PRESS_RELEASE_LIMITS.summaryMax + 1) })
    );
    expect(errors.summary).toMatch(/cannot exceed/);
  });

  it('accepts an http(s) image URL and rejects other schemes', () => {
    expect(
      validatePressReleaseForm(validForm({ imageUrl: 'https://cdn.example.com/a.jpg' }))
    ).toEqual({});
    expect(
      validatePressReleaseForm(validForm({ imageUrl: 'javascript:alert(1)' })).imageUrl
    ).toMatch(/valid/);
    expect(validatePressReleaseForm(validForm({ imageUrl: 'not a url' })).imageUrl).toMatch(
      /valid/
    );
  });
});

describe('pressReleaseAutoPublishes', () => {
  it('routes authors below the threshold to review', () => {
    expect(pressReleaseAutoPublishes(0)).toBe(false);
    expect(pressReleaseAutoPublishes(PRESS_RELEASE_AUTO_APPROVE_THRESHOLD - 1)).toBe(false);
    expect(pressReleaseAutoPublishes(undefined)).toBe(false);
    expect(pressReleaseAutoPublishes(null)).toBe(false);
  });

  it('lets authors at or above the threshold publish instantly', () => {
    expect(pressReleaseAutoPublishes(PRESS_RELEASE_AUTO_APPROVE_THRESHOLD)).toBe(true);
    expect(pressReleaseAutoPublishes(PRESS_RELEASE_AUTO_APPROVE_THRESHOLD + 5)).toBe(true);
  });

  it('is defensive against negative/fractional counts', () => {
    expect(pressReleaseAutoPublishes(-10)).toBe(false);
    expect(pressReleaseAutoPublishes(2.9)).toBe(false);
  });
});

describe('buildPressReleasePayload', () => {
  it('trims fields and omits blank optionals', () => {
    const payload = buildPressReleasePayload(
      validForm({ headline: '  Aurora Announces 2026  ', summary: '', imageUrl: '' })
    );
    expect(payload.headline).toBe('Aurora Announces 2026');
    expect(payload).not.toHaveProperty('summary');
    expect(payload).not.toHaveProperty('imageUrl');
    expect(payload.corpsClass).toBe('worldClass');
  });

  it('includes summary and imageUrl when present', () => {
    const payload = buildPressReleasePayload(
      validForm({ summary: '  Big news  ', imageUrl: '  https://x.test/a.png  ' })
    );
    expect(payload.summary).toBe('Big news');
    expect(payload.imageUrl).toBe('https://x.test/a.png');
  });

  it('omits corpsClass when unset', () => {
    const { corpsClass, ...rest } = validForm();
    void corpsClass;
    const payload = buildPressReleasePayload(rest as PressReleaseFormState);
    expect(payload).not.toHaveProperty('corpsClass');
  });
});
