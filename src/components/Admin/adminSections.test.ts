import { describe, it, expect } from 'vitest';
import {
  ADMIN_SECTIONS,
  LEGACY_TAB_ALIASES,
  resolveAdminSection,
  getAdminSection,
} from './adminSections';
import { ADMIN_JOBS } from './adminJobs';

describe('resolveAdminSection', () => {
  it('defaults to home', () => {
    expect(resolveAdminSection(null)).toBe('home');
    expect(resolveAdminSection('')).toBe('home');
    expect(resolveAdminSection('nonsense')).toBe('home');
  });

  it('passes current section ids through', () => {
    for (const section of ADMIN_SECTIONS) {
      expect(resolveAdminSection(section.id)).toBe(section.id);
    }
  });

  // Admin emails already in inboxes link to these; they must keep landing
  // on the panel that now owns the work.
  it('maps every legacy tab id, including the email-only ones', () => {
    expect(resolveAdminSection('overview')).toBe('home');
    expect(resolveAdminSection('content')).toBe('newsroom');
    expect(resolveAdminSection('submissions')).toBe('newsroom');
    expect(resolveAdminSection('moderation')).toBe('moderation');
    expect(resolveAdminSection('livescores')).toBe('season');
    expect(resolveAdminSection('users')).toBe('players');
    expect(resolveAdminSection('jobs')).toBe('system');
    for (const target of Object.values(LEGACY_TAB_ALIASES)) {
      expect(getAdminSection(target).id).toBe(target);
    }
  });
});

describe('ADMIN_JOBS', () => {
  it('has unique ids, each owned by a real section', () => {
    const ids = ADMIN_JOBS.map((job) => job.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sectionIds = new Set(ADMIN_SECTIONS.map((s) => s.id));
    for (const job of ADMIN_JOBS) expect(sectionIds.has(job.domain)).toBe(true);
  });
});
