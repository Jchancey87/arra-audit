import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PageFallback from '../PageFallback.jsx';

describe('PageFallback', () => {
  it('renders a loading state with a status role and a label', () => {
    render(<PageFallback />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/loading/i);
  });

  it('does not throw when rendered without props', () => {
    expect(() => render(<PageFallback />)).not.toThrow();
  });
});
