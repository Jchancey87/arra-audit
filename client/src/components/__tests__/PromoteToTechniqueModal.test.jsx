import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PromoteToTechniqueModal from '../PromoteToTechniqueModal.jsx';

const sampleSong = { _id: 'song-1', title: 'Cosmic Drift', artist: 'Lone Architect' };

describe('PromoteToTechniqueModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PromoteToTechniqueModal
        isOpen={false}
        onClose={() => {}}
        sentence="The kick punches through."
        song={sampleSong}
        onPromote={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('pre-fills description with the sentence and shows the song context', () => {
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={() => {}}
        sentence="A short slap-back delay and a high-pass filter shape the vocal."
        song={sampleSong}
        initialLens="texture"
        onPromote={() => {}}
      />
    );
    const desc = screen.getByTestId('promote-description');
    expect(desc.value).toContain('slap-back delay');
    expect(screen.getByText(/Cosmic Drift/)).toBeInTheDocument();
    expect(screen.getByText(/Lone Architect/)).toBeInTheDocument();
  });

  it('marks the guessed lens as active by default', () => {
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={() => {}}
        sentence="The kick and snare lock into a tight groove."
        song={sampleSong}
        initialLens="rhythm"
        lensSource="heuristic"
        onPromote={() => {}}
      />
    );
    const rhythmBtn = screen.getByTestId('promote-lens-rhythm');
    expect(rhythmBtn.style.background).toBe('rgb(249, 115, 22)');
    expect(screen.getByText('(guessed)')).toBeInTheDocument();
  });

  it('switches the active lens when another button is clicked', () => {
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={() => {}}
        sentence="Some text."
        song={sampleSong}
        initialLens="rhythm"
        onPromote={() => {}}
      />
    );
    const harmonyBtn = screen.getByTestId('promote-lens-harmony');
    fireEvent.click(harmonyBtn);
    expect(harmonyBtn.style.background).toBe('rgb(139, 92, 246)');
  });

  it('calls onPromote with the form data and closes on success', async () => {
    const onPromote = vi.fn().mockResolvedValue({ _id: 'tech-1' });
    const onClose = vi.fn();
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={onClose}
        sentence="A long reverb tail shapes the texture of the outro."
        song={sampleSong}
        initialLens="texture"
        onPromote={onPromote}
      />
    );

    fireEvent.change(screen.getByTestId('promote-tags'), { target: { value: 'reverb, outro' } });
    fireEvent.change(screen.getByTestId('promote-confidence'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('promote-submit'));

    await waitFor(() => expect(onPromote).toHaveBeenCalled());
    expect(onPromote).toHaveBeenCalledWith({
      description: 'A long reverb tail shapes the texture of the outro.',
      lens: 'texture',
      confidence: 4,
      tags: ['reverb', 'outro'],
      notes: undefined,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows an error when onPromote rejects and keeps the modal open', async () => {
    const onPromote = vi.fn().mockRejectedValue(new Error('Boom'));
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={() => {}}
        sentence="Some text."
        song={sampleSong}
        onPromote={onPromote}
      />
    );
    fireEvent.click(screen.getByTestId('promote-submit'));
    await waitFor(() => expect(screen.getByTestId('promote-error')).toHaveTextContent('Boom'));
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={onClose}
        sentence="Some text."
        song={sampleSong}
        onPromote={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={onClose}
        sentence="Some text."
        song={sampleSong}
        onPromote={() => {}}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a validation error when the description is empty', async () => {
    const onPromote = vi.fn();
    render(
      <PromoteToTechniqueModal
        isOpen={true}
        onClose={() => {}}
        sentence="Some text."
        song={sampleSong}
        onPromote={onPromote}
      />
    );
    fireEvent.change(screen.getByTestId('promote-description'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('promote-submit'));
    expect(onPromote).not.toHaveBeenCalled();
    expect(await screen.findByTestId('promote-error')).toHaveTextContent(/required/i);
  });
});
