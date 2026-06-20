import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let mockBackend;
vi.mock('../../context/BackendContext', () => ({
  useBackend: () => mockBackend,
}));

import BookmarkAnalysisTags from '../BookmarkAnalysisTags';

const renderWithBackend = (ui, { backend = {} } = {}) => {
  mockBackend = {
    getSong: vi.fn(),
    getAudits: vi.fn(),
    analyzeBookmark: vi.fn().mockResolvedValue({ ok: true, analysis: {} }),
    getBookmarkAnalysis: vi.fn().mockResolvedValue({ analysis: null }),
    ...backend,
  };
  return render(ui);
};

describe('BookmarkAnalysisTags', () => {
  it('renders nothing when analysis is null', () => {
    renderWithBackend(<BookmarkAnalysisTags auditId="a" bookmarkId="b" analysis={null} />);
    expect(screen.queryByTestId('bookmark-analysis-pending')).toBeNull();
    expect(screen.queryByTestId('bookmark-analysis-success')).toBeNull();
    expect(screen.queryByTestId('bookmark-analysis-error')).toBeNull();
  });

  it('renders a spinner for pending status', () => {
    renderWithBackend(
      <BookmarkAnalysisTags auditId="a" bookmarkId="b" analysis={{ status: 'pending' }} />
    );
    expect(screen.getByTestId('bookmark-analysis-pending')).toBeInTheDocument();
    expect(screen.getByText(/Queued/)).toBeInTheDocument();
  });

  it('renders a spinner for running status', () => {
    renderWithBackend(
      <BookmarkAnalysisTags auditId="a" bookmarkId="b" analysis={{ status: 'running' }} />
    );
    expect(screen.getByText(/Analyzing/)).toBeInTheDocument();
  });

  it('renders mood + timbre pills and similar-to list on success', () => {
    const analysis = {
      status: 'success',
      model: 'clap-htsat-fused',
      version: '2.3.0',
      mood_tags: [
        { tag: 'energetic', score: 0.42 },
        { tag: 'dreamy', score: 0.18 },
        { tag: 'intimate', score: 0.10 },
      ],
      timbre_tags: [
        { tag: 'warm', score: 0.35 },
        { tag: 'smooth', score: 0.20 },
        { tag: 'bright', score: 0.10 },
      ],
      similar_to: ['Daft Punk - One More Time', 'Boards of Canada - Roygbiv'],
      error: null,
    };
    renderWithBackend(
      <BookmarkAnalysisTags auditId="a" bookmarkId="b" analysis={analysis} />
    );
    expect(screen.getByTestId('bookmark-analysis-success')).toBeInTheDocument();
    const pills = screen.getAllByTestId('bookmark-analysis-pill');
    expect(pills).toHaveLength(6); // 3 mood + 3 timbre
    expect(screen.getByText(/Daft Punk/)).toBeInTheDocument();
    expect(screen.getByText(/Boards of Canada/)).toBeInTheDocument();
  });

  it('caps the pills at the top 3 of each category', () => {
    const many = (prefix) => Array.from({ length: 6 }, (_, i) => ({ tag: `${prefix}-${i}`, score: 1 / (i + 1) }));
    const analysis = {
      status: 'success',
      model: 'clap-htsat-fused',
      version: '2.3.0',
      mood_tags: many('mood'),
      timbre_tags: many('timbre'),
      similar_to: [],
    };
    renderWithBackend(
      <BookmarkAnalysisTags auditId="a" bookmarkId="b" analysis={analysis} />
    );
    const pills = screen.getAllByTestId('bookmark-analysis-pill');
    expect(pills).toHaveLength(6);
  });

  it('renders an error message and a retry button when status=error', () => {
    renderWithBackend(
      <BookmarkAnalysisTags
        auditId="a"
        bookmarkId="b"
        analysis={{ status: 'error', error: 'GPU OOM' }}
      />
    );
    expect(screen.getByTestId('bookmark-analysis-error')).toBeInTheDocument();
    expect(screen.getByText(/GPU OOM/)).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-analysis-retry')).toBeInTheDocument();
  });

  it('retry button calls analyzeBookmark and re-renders with the new analysis', async () => {
    const backend = {
      analyzeBookmark: vi.fn().mockResolvedValue({
        ok: true,
        analysis: {
          status: 'success',
          model: 'deterministic-v1',
          version: '2.3.0',
          mood_tags: [{ tag: 'dreamy', score: 0.5 }],
          timbre_tags: [{ tag: 'warm', score: 0.5 }],
          similar_to: [],
        },
      }),
    };
    renderWithBackend(
      <BookmarkAnalysisTags
        auditId="a-1"
        bookmarkId="b-1"
        analysis={{ status: 'error', error: 'first try failed' }}
      />,
      { backend }
    );
    fireEvent.click(screen.getByTestId('bookmark-analysis-retry'));
    await waitFor(() => {
      expect(backend.analyzeBookmark).toHaveBeenCalledWith('a-1', 'b-1');
    });
    await waitFor(() => {
      expect(screen.getByTestId('bookmark-analysis-success')).toBeInTheDocument();
    });
  });

  it('retry surfaces the adapter error when the call throws', async () => {
    const backend = {
      analyzeBookmark: vi.fn().mockRejectedValue(new Error('still broken')),
    };
    renderWithBackend(
      <BookmarkAnalysisTags
        auditId="a-1"
        bookmarkId="b-1"
        analysis={{ status: 'error', error: 'old' }}
      />,
      { backend }
    );
    fireEvent.click(screen.getByTestId('bookmark-analysis-retry'));
    await waitFor(() => {
      expect(screen.getByText(/still broken/)).toBeInTheDocument();
    });
  });
});
