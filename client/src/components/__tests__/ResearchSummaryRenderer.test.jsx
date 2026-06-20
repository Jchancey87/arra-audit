import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ResearchSummaryRenderer from '../ResearchSummaryRenderer.jsx';

const sampleSong = { _id: 'song-1', title: 'Cosmic Drift', artist: 'Lone Architect' };
const sampleSummary = `### Rhythm\nThe kick and snare lock into a tight groove at 90 BPM. The hi-hat shuffle is light but consistent.\n\n### Texture\nA short slap-back delay and a high-pass filter shape the vocal layer.`;

describe('ResearchSummaryRenderer', () => {
  it('renders sections and their content as before when song/onPromote are absent', () => {
    render(<ResearchSummaryRenderer summary={sampleSummary} />);
    expect(screen.getByText(/Rhythm/)).toBeInTheDocument();
    expect(screen.getByText(/Texture/)).toBeInTheDocument();
    expect(screen.getByText(/kick and snare/)).toBeInTheDocument();
    // No promote button when song/onPromote are absent
    expect(screen.queryAllByTestId('promote-sentence-button')).toHaveLength(0);
  });

  it('shows a promote button on every sentence when song + onPromote are provided', () => {
    const onPromote = vi.fn();
    render(
      <ResearchSummaryRenderer
        summary={sampleSummary}
        song={sampleSong}
        onPromote={onPromote}
      />
    );
    const buttons = screen.queryAllByTestId('promote-sentence-button');
    // 2 sentences in Rhythm section + 1 in Texture section = 3
    expect(buttons.length).toBe(3);
  });

  it('opens the modal with the right sentence when a promote button is clicked', async () => {
    const onPromote = vi.fn().mockResolvedValue({ _id: 'tech-1' });
    render(
      <ResearchSummaryRenderer
        summary={sampleSummary}
        song={sampleSong}
        onPromote={onPromote}
      />
    );
    const buttons = screen.queryAllByTestId('promote-sentence-button');
    fireEvent.click(buttons[0]);
    const desc = await screen.findByTestId('promote-description');
    expect(desc.value).toMatch(/kick and snare/);
  });

  it('calls onPromote with the form data when the user clicks Save Technique', async () => {
    const onPromote = vi.fn().mockResolvedValue({ _id: 'tech-1' });
    render(
      <ResearchSummaryRenderer
        summary={sampleSummary}
        song={sampleSong}
        onPromote={onPromote}
      />
    );
    fireEvent.click(screen.queryAllByTestId('promote-sentence-button')[0]);
    const submit = await screen.findByTestId('promote-submit');
    fireEvent.click(submit);
    await waitFor(() => expect(onPromote).toHaveBeenCalled());
    const arg = onPromote.mock.calls[0][0];
    expect(arg.description).toMatch(/kick and snare/);
    expect(arg.lens).toBe('rhythm');
    expect(arg.confidence).toBe(3);
  });

  it('returns null when summary is empty', () => {
    const { container } = render(
      <ResearchSummaryRenderer summary="" song={sampleSong} onPromote={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
