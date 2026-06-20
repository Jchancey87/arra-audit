import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let mockBackend;
vi.mock('../../context/BackendContext', () => ({
  useBackend: () => mockBackend,
}));

import SimilarTechniquesSection from '../SimilarTechniquesSection';

const baseTech = {
  _id: 't1',
  description: 'four-on-the-floor kick with side-chain compression',
  techniqueName: 'Punchy kick',
  lens: 'rhythm',
  tags: ['909', 'compression'],
};

describe('SimilarTechniquesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a hint when the technique has no description', () => {
    mockBackend = { findSimilarTechniques: vi.fn() };
    render(
      <SimilarTechniquesSection technique={{ _id: 't', description: '', techniqueName: 'x' }} />
    );
    expect(screen.getByTestId('similar-techniques-empty')).toBeInTheDocument();
    expect(mockBackend.findSimilarTechniques).not.toHaveBeenCalled();
  });

  it('renders nothing when there is no technique', () => {
    mockBackend = { findSimilarTechniques: vi.fn() };
    const { container } = render(<SimilarTechniquesSection technique={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a loading state while the request is in flight', async () => {
    let resolve;
    mockBackend = {
      findSimilarTechniques: vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; })),
    };
    render(<SimilarTechniquesSection technique={baseTech} />);
    expect(await screen.findByTestId('similar-techniques-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('similar-techniques-none')).toBeNull();
    resolve({ target: baseTech, similar: [] });
  });

  it('renders "no matches" when the result is empty', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue({ target: baseTech, similar: [] }),
    };
    render(<SimilarTechniquesSection technique={baseTech} />);
    expect(await screen.findByTestId('similar-techniques-none')).toBeInTheDocument();
  });

  it('renders a card per similar technique and triggers onOpenSimilar on click', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue({
        target: baseTech,
        similar: [
          { technique: { _id: 't2', description: '909 kick groove', lens: 'rhythm', techniqueName: 'Groove' }, score: 0.85 },
          { technique: { _id: 't3', description: 'soft pad', lens: 'texture', techniqueName: 'Pad' }, score: 0.42 },
        ],
      }),
    };
    const onOpen = vi.fn();
    render(<SimilarTechniquesSection technique={baseTech} onOpenSimilar={onOpen} />);
    const cards = await screen.findAllByTestId('similar-technique-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Groove');
    expect(cards[0]).toHaveAttribute('data-score', '0.85');
    expect(cards[1]).toHaveTextContent('Pad');
    fireEvent.click(cards[0]);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ _id: 't2' }));
  });

  it('renders the error state with a Retry button when the request fails', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockRejectedValue(new Error('GPU OOM')),
    };
    render(<SimilarTechniquesSection technique={baseTech} />);
    expect(await screen.findByTestId('similar-techniques-error')).toBeInTheDocument();
    expect(screen.getByText(/GPU OOM/)).toBeInTheDocument();
  });

  it('Retry re-invokes the backend', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ target: baseTech, similar: [] }),
    };
    render(<SimilarTechniquesSection technique={baseTech} />);
    await screen.findByTestId('similar-techniques-error');
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(screen.getByTestId('similar-techniques-none')).toBeInTheDocument();
    });
    expect(mockBackend.findSimilarTechniques).toHaveBeenCalledTimes(2);
  });

  it('passes the techniqueId + limit to the backend', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue({ target: baseTech, similar: [] }),
    };
    render(<SimilarTechniquesSection technique={baseTech} limit={3} />);
    await waitFor(() => {
      expect(mockBackend.findSimilarTechniques).toHaveBeenCalledWith('t1', { limit: 3 });
    });
  });

  it('toggles the section on click of the header', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue({
        target: baseTech,
        similar: [{ technique: { _id: 't2', description: 'x', lens: 'rhythm', techniqueName: 'A' }, score: 0.5 }],
      }),
    };
    render(<SimilarTechniquesSection technique={baseTech} />);
    const cards = await screen.findAllByTestId('similar-technique-card');
    expect(cards).toHaveLength(1);
    fireEvent.click(screen.getByTestId('similar-techniques-toggle'));
    expect(screen.queryAllByTestId('similar-technique-card')).toHaveLength(0);
  });
});
