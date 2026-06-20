import { describe, test, expect } from '@jest/globals';
import { YtDlpMockAdapter, YtDlpSubprocessAdapter, __test__ } from '../../services/ytDlpService.js';

describe('YtDlpMockAdapter', () => {
  test('reports availability based on the constructor flag', async () => {
    const on = new YtDlpMockAdapter({ available: true });
    const off = new YtDlpMockAdapter({ available: false });
    expect(await on.isAvailable()).toBe(true);
    expect(await off.isAvailable()).toBe(false);
  });

  test('extractAudioUrl returns a /uploads/ URL and an expiry', async () => {
    const svc = new YtDlpMockAdapter({ available: true });
    const out = await svc.extractAudioUrl({ youtubeId: 'dQw4w9WgXcQ' });
    expect(out.url).toBe('/uploads/fake-audio-dQw4w9WgXcQ.m4a');
    expect(out.expiresAt).toBeTruthy();
    const expiry = new Date(out.expiresAt).getTime();
    expect(expiry).toBeGreaterThan(Date.now());
  });

  test('throws 503 when adapter is disabled', async () => {
    const svc = new YtDlpMockAdapter({ available: false });
    await expect(svc.extractAudioUrl({ youtubeId: 'abc' })).rejects.toMatchObject({ status: 503 });
  });

  test('throws 400 when youtubeId is missing', async () => {
    const svc = new YtDlpMockAdapter();
    await expect(svc.extractAudioUrl({ youtubeId: '' })).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 for unsupported formats', async () => {
    const svc = new YtDlpMockAdapter();
    await expect(svc.extractAudioUrl({ youtubeId: 'abc', format: 'bestvideo' })).rejects.toMatchObject({ status: 400 });
  });

  test('whitelists the known safe audio formats', () => {
    expect(__test__.ALLOWED_FORMATS.has('bestaudio')).toBe(true);
    expect(__test__.ALLOWED_FORMATS.has('bestaudio[ext=m4a]')).toBe(true);
    expect(__test__.ALLOWED_FORMATS.has('bestaudio[ext=webm]')).toBe(true);
    expect(__test__.ALLOWED_FORMATS.has('bestvideo')).toBe(false);
  });
});

describe('YtDlpSubprocessAdapter (constructor)', () => {
  test('initializes with a default binary path under the process exec dir', () => {
    const svc = new YtDlpSubprocessAdapter({});
    expect(svc.binaryPath).toBeTruthy();
    expect(svc.timeoutMs).toBe(__test__.DEFAULT_TIMEOUT_MS);
  });

  test('honors an explicit binary path + timeout', () => {
    const svc = new YtDlpSubprocessAdapter({ binaryPath: '/opt/bin/yt-dlp', timeoutMs: 30000 });
    expect(svc.binaryPath).toBe('/opt/bin/yt-dlp');
    expect(svc.timeoutMs).toBe(30000);
  });
});
