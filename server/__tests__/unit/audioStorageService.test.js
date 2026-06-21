import fs from 'fs';
import os from 'os';
import path from 'path';
import { FilesystemAudioStorageAdapter } from '../../services/audioStorageService.js';

describe('FilesystemAudioStorageAdapter', () => {
  let tmpRoot;
  let sourceFile;
  let adapter;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arra-storage-test-'));
    sourceFile = path.join(tmpRoot, 'source.mp3');
    fs.writeFileSync(sourceFile, Buffer.from('fake-mp3-bytes'));
    adapter = new FilesystemAudioStorageAdapter({ uploadsRoot: tmpRoot });
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  });

  test('moveIntoStore creates the songs dir if missing (regression: 2026-06-21 rmdir ENOENT)', async () => {
    // Simulate the exact runtime scenario: the songs dir was removed
    // (e.g. an operator rmdir'd a root-owned dir created by a prior
    // misconfigured pm2 daemon, then chowned the parent). The
    // constructor's mkdirSync only ran once at boot, so the adapter's
    // in-memory songsDir path no longer exists on disk. moveIntoStore
    // must defensively mkdir before copyFile, otherwise copyFile throws
    // ENOENT and the audio re-download fails.
    expect(fs.existsSync(adapter.songsDir)).toBe(true);
    fs.rmdirSync(adapter.songsDir);
    expect(fs.existsSync(adapter.songsDir)).toBe(false);

    const result = await adapter.moveIntoStore('song-x', sourceFile, { extension: 'mp3' });

    expect(result.publicUrl).toBe('/uploads/songs/song-x.mp3');
    expect(fs.existsSync(path.join(adapter.songsDir, 'song-x.mp3'))).toBe(true);
  });

  test('moveIntoStore is idempotent when songs dir already exists', async () => {
    // The defensive mkdir must not throw if the dir is already there.
    await adapter.moveIntoStore('song-y', sourceFile, { extension: 'mp3' });
    await adapter.moveIntoStore('song-z', sourceFile, { extension: 'mp3' });
    expect(fs.existsSync(path.join(adapter.songsDir, 'song-y.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(adapter.songsDir, 'song-z.mp3'))).toBe(true);
  });

  test('moveIntoStore throws when source file is missing', async () => {
    await expect(
      adapter.moveIntoStore('song-missing', '/nonexistent/path.mp3', { extension: 'mp3' })
    ).rejects.toThrow(/Source audio file not found/);
  });
});
