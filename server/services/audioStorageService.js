/**
 * IAudioStorageService — port for persisting song audio files on disk and
 * serving them back via a public URL.
 *
 * Two operations:
 *   - moveIntoStore(songId, sourcePath)   — promote a file (e.g. yt-dlp's
 *                                          download at /tmp) into the songs
 *                                          upload directory. Returns the
 *                                          publicUrl + absolute file path.
 *   - remove(songId)                       — best-effort unlink on delete.
 *   - getLocalPath(songId)                 — absolute path the analysis
 *                                          service can read.
 *
 * Adapters:
 *   - FilesystemAudioStorageAdapter (production + dev)
 *   - InMemoryAudioStorageAdapter    (tests; tracks blobs in memory)
 */
import fs from 'fs';
import path from 'path';

class IAudioStorageService {
  // eslint-disable-next-line no-unused-vars
  async moveIntoStore(songId, sourcePath, { mimeType } = {}) {
    throw new Error('IAudioStorageService.moveIntoStore not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async remove(songId) {
    throw new Error('IAudioStorageService.remove not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  getLocalPath(songId) {
    throw new Error('IAudioStorageService.getLocalPath not implemented');
  }

  buildPublicUrl(songId, extension) {
    throw new Error('IAudioStorageService.buildPublicUrl not implemented');
  }
}

function _guessMimeType(ext) {
  const map = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
    opus: 'audio/ogg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  };
  return map[(ext || '').toLowerCase()] || 'audio/mpeg';
}

/**
 * Filesystem-backed adapter. Audio lives at:
 *   {repoRoot}/uploads/songs/{songId}.{ext}
 * and is served at:
 *   /uploads/songs/{songId}.{ext}
 * (via the existing express.static('/uploads', ...) middleware in server.js)
 */
export class FilesystemAudioStorageAdapter extends IAudioStorageService {
  constructor({ uploadsRoot }) {
    super();
    if (!uploadsRoot) throw new Error('FilesystemAudioStorageAdapter requires { uploadsRoot }');
    this.uploadsRoot = uploadsRoot;
    this.songsDir = path.join(uploadsRoot, 'songs');
    fs.mkdirSync(this.songsDir, { recursive: true });
  }

  buildPublicUrl(songId, extension = 'mp3') {
    return `/uploads/songs/${songId}.${String(extension).replace(/^\./, '')}`;
  }

  _resolve(songId, extension = 'mp3') {
    const ext = String(extension).replace(/^\./, '');
    return {
      filename: `${songId}.${ext}`,
      filePath: path.join(this.songsDir, `${songId}.${ext}`),
      publicUrl: this.buildPublicUrl(songId, ext),
    };
  }

  async moveIntoStore(songId, sourcePath, { mimeType, extension } = {}) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source audio file not found: ${sourcePath}`);
    }
    const ext = extension || path.extname(sourcePath).replace(/^\./, '') || 'mp3';
    const { filePath, publicUrl } = this._resolve(songId, ext);
    // Defensive: the songs dir can be removed at runtime (e.g. an operator
    // chown'ing a root-owned dir created by a prior misconfigured pm2
    // daemon) and our in-memory this.songsDir path won't re-materialize
    // until the process restarts. The constructor's mkdirSync only ran
    // once at boot, so guard every copy with an idempotent mkdir. Cost is
    // a single syscall on a path that almost always already exists.
    await fs.promises.mkdir(this.songsDir, { recursive: true });
    // Copy so the original (e.g. /tmp yt-dlp download) can be cleaned up.
    await fs.promises.copyFile(sourcePath, filePath);
    const size = (await fs.promises.stat(filePath)).size;
    return {
      localAudioPath: filePath,
      publicUrl,
      audioSizeBytes: size,
      audioMimeType: mimeType || _guessMimeType(ext),
    };
  }

  async remove(songId) {
    if (!fs.existsSync(this.songsDir)) return false;
    const entries = await fs.promises.readdir(this.songsDir);
    let removedAny = false;
    for (const entry of entries) {
      if (entry.startsWith(`${songId}.`)) {
        try {
          await fs.promises.unlink(path.join(this.songsDir, entry));
          removedAny = true;
        } catch (_) { /* swallow — file already gone */ }
      }
    }
    return removedAny;
  }

  getLocalPath(_songId) {
    return null;
  }
}
