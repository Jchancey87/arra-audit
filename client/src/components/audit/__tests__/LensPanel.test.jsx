import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LensPanel from '../LensPanel';

const basePrompt = (overrides = {}) => ({
  title: 'Test prompt',
  question: 'What did you hear?',
  ...overrides,
});

const baseProps = (overrides = {}) => ({
  activeLens: 'harmony',
  onChangeLens: vi.fn(),
  song: null,
  currentTime: 145,
  responses: {},
  onResponseChange: vi.fn(),
  onPromptsSaved: vi.fn(),
  listeningFocus: '',
  customPrompts: [basePrompt(), basePrompt({ title: 'Second' })],
  ...overrides,
});

describe('LensPanel — tag current time (Phase 2.2)', () => {
  let onResponseChange;

  beforeEach(() => {
    onResponseChange = vi.fn();
  });

  it('renders a tag button on every prompt', () => {
    render(<LensPanel {...baseProps({ onResponseChange })} />);
    const tagButtons = screen.getAllByTestId('tag-time-button');
    expect(tagButtons).toHaveLength(2);
  });

  it('shows the current playback time on the tag button when untagged', () => {
    render(<LensPanel {...baseProps({ onResponseChange, currentTime: 145 })} />);
    const tagButtons = screen.getAllByTestId('tag-time-button');
    expect(tagButtons[0]).toHaveTextContent('Tag 2:25');
  });

  it('emits {text, timestampSeconds} when tag is clicked on a string response', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          currentTime: 145,
          responses: { 'lens-harmony-0': 'existing text' },
        })}
      />
    );
    const tagButtons = screen.getAllByTestId('tag-time-button');
    fireEvent.click(tagButtons[0]);
    expect(onResponseChange).toHaveBeenCalledWith('lens-harmony-0', {
      text: 'existing text',
      timestampSeconds: 145,
    });
  });

  it('emits {text, timestampSeconds} when tag is clicked on an already-tagged response (overrides)', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          currentTime: 200,
          responses: {
            'lens-harmony-0': { text: 'keep my text', timestampSeconds: 30 },
          },
        })}
      />
    );
    const tagButtons = screen.getAllByTestId('tag-time-button');
    expect(tagButtons[0]).toHaveTextContent('Tagged 0:30');
    fireEvent.click(tagButtons[0]);
    expect(onResponseChange).toHaveBeenCalledWith('lens-harmony-0', {
      text: 'keep my text',
      timestampSeconds: 200,
    });
  });

  it('clicking the clear × next to a tagged pill clears the timestamp', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          currentTime: 145,
          responses: {
            'lens-harmony-0': { text: 'hello', timestampSeconds: 60 },
          },
        })}
      />
    );
    const clearBtn = screen.getByTestId('tag-time-clear');
    fireEvent.click(clearBtn);
    expect(onResponseChange).toHaveBeenCalledWith('lens-harmony-0', {
      text: 'hello',
      timestampSeconds: null,
    });
  });

  it('preserves the timestamp when the textarea is edited', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          currentTime: 145,
          responses: {
            'lens-harmony-0': { text: 'short', timestampSeconds: 60 },
          },
        })}
      />
    );
    const textarea = screen.getAllByPlaceholderText('Type your observations…')[0];
    fireEvent.change(textarea, { target: { value: 'short but updated' } });
    expect(onResponseChange).toHaveBeenCalledWith('lens-harmony-0', {
      text: 'short but updated',
      timestampSeconds: 60,
    });
  });

  it('seeds the textarea with the legacy string value', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          responses: { 'lens-harmony-0': 'legacy plain string' },
        })}
      />
    );
    const textarea = screen.getAllByPlaceholderText('Type your observations…')[0];
    expect(textarea.value).toBe('legacy plain string');
  });

  it('seeds the textarea with the object .text', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          responses: {
            'lens-harmony-0': { text: 'object body', timestampSeconds: 12 },
          },
        })}
      />
    );
    const textarea = screen.getAllByPlaceholderText('Type your observations…')[0];
    expect(textarea.value).toBe('object body');
  });

  it('answeredCount uses extracted text length, not object identity', () => {
    render(
      <LensPanel
        {...baseProps({
          onResponseChange,
          responses: {
            'lens-harmony-0': { text: 'a longer answer that should count', timestampSeconds: 0 },
            'lens-harmony-1': { text: 'tiny', timestampSeconds: 5 },
          },
        })}
      />
    );
    expect(screen.getByText('1/2 answered')).toBeInTheDocument();
  });
});
