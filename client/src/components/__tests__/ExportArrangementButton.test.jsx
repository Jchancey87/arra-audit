import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../utils/arrangementExport.js', async () => {
  const actual = await vi.importActual('../../utils/arrangementExport.js');
  return {
    ...actual,
    exportArrangementAsImage: vi.fn().mockResolvedValue({ blob: new Blob(['x'], { type: 'image/png' }), canvas: {}, filename: 'test.png' }),
  };
});

import ExportArrangementButton from '../ExportArrangementButton.jsx';
import { exportArrangementAsImage } from '../../utils/arrangementExport.js';
import { BackendProvider } from '../../context/BackendContext.jsx';

const noopBackend = { subscribeBookmarkAnalysis: vi.fn() };

const wrapper = (backend = noopBackend) => ({ children }) => (
  <BackendProvider adapter={backend}>{children}</BackendProvider>
);

const sampleData = {
  sections: [{ id: 's1', type: 'verse', name: 'V1', startTime: 0, duration: 30 }],
  tracks: [{ id: 't1', name: 'Drums', color: '#ff0000', blocks: [{ id: 'b1', startTime: 0, duration: 8 }] }],
  song: { title: 'Test Song', artist: 'Test Artist', durationSeconds: 60 },
  bpm: 120,
  timeSignature: '4/4',
  viewMode: 'seconds',
};

describe('ExportArrangementButton', () => {
  beforeEach(() => {
    // jsdom has no canvas.toBlob; stub it to a fake blob.
    if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.toBlob) {
      HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(['x'], { type: 'image/png' })); };
    }
    // jsdom doesn't implement URL.createObjectURL — polyfill it.
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:mock';
      URL.revokeObjectURL = () => {};
    }
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a single button when no content exists', () => {
    render(<ExportArrangementButton sections={[]} tracks={[]} song={{}} />, { wrapper: wrapper() });
    const btn = screen.getByTestId('export-arrangement-button');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('is enabled when there is at least one block or track', () => {
    render(<ExportArrangementButton {...sampleData} />, { wrapper: wrapper() });
    const btn = screen.getByTestId('export-arrangement-button');
    expect(btn).not.toBeDisabled();
  });

  it('is disabled in readOnly mode', () => {
    render(<ExportArrangementButton {...sampleData} readOnly />, { wrapper: wrapper() });
    expect(screen.getByTestId('export-arrangement-button')).toBeDisabled();
  });

  it('opens a menu with image + pdf options on click', () => {
    render(<ExportArrangementButton {...sampleData} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByTestId('export-arrangement-button'));
    expect(screen.getByTestId('export-arrangement-menu')).toBeInTheDocument();
    expect(screen.getByTestId('export-arrangement-image')).toBeInTheDocument();
    expect(screen.getByTestId('export-arrangement-pdf')).toBeInTheDocument();
  });

  it('closes the menu when clicking outside', () => {
    render(
      <div>
        <ExportArrangementButton {...sampleData} />
        <div data-testid="outside">outside</div>
      </div>,
      { wrapper: wrapper() }
    );
    fireEvent.click(screen.getByTestId('export-arrangement-button'));
    expect(screen.getByTestId('export-arrangement-menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('export-arrangement-menu')).not.toBeInTheDocument();
  });

  it('closes the menu on Escape', () => {
    render(<ExportArrangementButton {...sampleData} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByTestId('export-arrangement-button'));
    expect(screen.getByTestId('export-arrangement-menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('export-arrangement-menu')).not.toBeInTheDocument();
  });

  it('triggers an image download when clicking "Export as image"', async () => {
    exportArrangementAsImage.mockClear();
    render(<ExportArrangementButton {...sampleData} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByTestId('export-arrangement-button'));
    fireEvent.click(screen.getByTestId('export-arrangement-image'));
    await waitFor(() => expect(exportArrangementAsImage).toHaveBeenCalled());
    const call = exportArrangementAsImage.mock.calls[0][0];
    expect(call.sections).toEqual(sampleData.sections);
    expect(call.tracks).toEqual(sampleData.tracks);
  });

  it('shows an inline error when image export throws', async () => {
    exportArrangementAsImage.mockRejectedValueOnce(new Error('boom'));
    render(<ExportArrangementButton {...sampleData} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByTestId('export-arrangement-button'));
    fireEvent.click(screen.getByTestId('export-arrangement-image'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/boom/));
  });

  it('closes the menu after a successful image export', async () => {
    render(<ExportArrangementButton {...sampleData} />, { wrapper: wrapper() });
    fireEvent.click(screen.getByTestId('export-arrangement-button'));
    expect(screen.getByTestId('export-arrangement-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('export-arrangement-image'));
    await waitFor(() => expect(screen.queryByTestId('export-arrangement-menu')).not.toBeInTheDocument());
  });
});
