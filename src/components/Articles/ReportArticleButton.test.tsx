import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { reportArticle } = vi.hoisted(() => ({ reportArticle: vi.fn() }));
// Every callable in the module resolves to the one mock — only reportArticle
// is exercised here — so no Firebase app is initialized.
vi.mock('../../api/callable', () => ({
  createCallable: () => reportArticle,
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import ReportArticleButton from './ReportArticleButton';
import { isReportableArticleId, reportableArticleNoun } from '../../api/articleSocial';

const PRESS_ID = 'live_2026-27_day_12_press_abc123';

describe('isReportableArticleId', () => {
  it('accepts director-written feed ids only', () => {
    expect(isReportableArticleId(PRESS_ID)).toBe(true);
    expect(isReportableArticleId('live_2026-27_day_3_community_sub9')).toBe(true);
    expect(isReportableArticleId('live_2026-27_day_3_dci_recap')).toBe(false);
    expect(isReportableArticleId(undefined)).toBe(false);
    expect(reportableArticleNoun(PRESS_ID)).toBe('press release');
    expect(reportableArticleNoun('s_day_3_community_x')).toBe('article');
  });
});

describe('ReportArticleButton', () => {
  beforeEach(() => reportArticle.mockReset());

  it('needs a reason, then files the report and disables itself', async () => {
    reportArticle.mockResolvedValue({
      data: { success: true, alreadyReported: false, message: 'Reported.' },
    });
    render(<ReportArticleButton articleId={PRESS_ID} headline="Big news" />);

    fireEvent.click(screen.getByRole('button', { name: 'Report press release' }));
    expect(screen.getByText('Big news')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Report' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason for report'), {
      target: { value: '  Impersonates another corps  ' },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(reportArticle).toHaveBeenCalledWith({
        articleId: PRESS_ID,
        reason: 'Impersonates another corps',
      })
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'press release reported' })).toBeDisabled()
    );
  });
});
