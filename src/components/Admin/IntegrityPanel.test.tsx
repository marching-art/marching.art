import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntegrityPanel from './IntegrityPanel';

// The panel reads admin-stats/integrity directly via the Firestore client.
// Mock the api db handle and the firestore doc/getDoc so no real client loads.
vi.mock('../../api', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn() }));
import { getDoc } from 'firebase/firestore';

const mockGetDoc = vi.mocked(getDoc);

const snap = (data: unknown) => ({ exists: () => data !== null, data: () => data }) as never;

const sampleStats = {
  totalAccounts: 120,
  withEmail: 118,
  emailClusters: [
    {
      key: 'abc123def4567890',
      size: 3,
      sample: 'ri…@gmail.com',
      members: [
        { uid: 'u1', username: 'ring1' },
        { uid: 'u2', username: 'ring2' },
        { uid: 'u3', username: 'ring3' },
      ],
    },
  ],
  signupBursts: [
    {
      startedAt: '2026-08-01T00:00:00.000Z',
      spanMs: 4 * 60 * 1000,
      size: 4,
      members: [
        { uid: 'u1', username: 'ring1' },
        { uid: 'u4', username: null },
      ],
    },
  ],
  attributeClusters: [
    {
      key: 'us:ring',
      kind: 'username-stem',
      label: 'ring#',
      size: 3,
      members: [{ uid: 'u1', username: 'ring1' }],
    },
  ],
  watchlist: [{ uid: 'u1', username: 'ring1', signals: ['email', 'signup-burst'] }],
  summary: {
    emailClusterCount: 1,
    accountsInEmailClusters: 3,
    largestEmailCluster: 3,
    signupBurstCount: 1,
    attributeClusterCount: 1,
    watchlistCount: 1,
  },
  thresholds: { burstWindowMinutes: 15, burstMinSize: 4, attrMinSize: 3 },
};

describe('IntegrityPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the watchlist, email cluster, and signup burst from the stored doc', async () => {
    mockGetDoc.mockResolvedValue(snap(sampleStats));
    render(<IntegrityPanel />);

    // Multi-signal watchlist row, showing the joined signal names.
    expect(await screen.findByText('email · signup-burst')).toBeInTheDocument();
    // The redacted email sample surfaces — never a raw address.
    expect(screen.getByText('ri…@gmail.com')).toBeInTheDocument();
    // The "signals, not verdicts" caution copy is present.
    expect(screen.getByText(/not verdicts/i)).toBeInTheDocument();
    // A member without a username falls back to a short uid.
    expect(screen.getByText('@ring2')).toBeInTheDocument();
  });

  it('prompts to run the job when no doc exists yet', async () => {
    mockGetDoc.mockResolvedValue(snap(null));
    render(<IntegrityPanel />);
    expect(await screen.findByText(/No signals yet/i)).toBeInTheDocument();
  });

  it('shows an all-clear when the doc exists but every cluster is empty', async () => {
    mockGetDoc.mockResolvedValue(
      snap({
        totalAccounts: 50,
        withEmail: 50,
        emailClusters: [],
        signupBursts: [],
        attributeClusters: [],
        watchlist: [],
        summary: {},
      })
    );
    render(<IntegrityPanel />);
    expect(await screen.findByText(/No clusters above threshold/i)).toBeInTheDocument();
  });

  it('tolerates a rejected read without throwing', async () => {
    mockGetDoc.mockRejectedValue(new Error('permission-denied'));
    render(<IntegrityPanel />);
    expect(await screen.findByText(/No signals yet/i)).toBeInTheDocument();
  });
});
