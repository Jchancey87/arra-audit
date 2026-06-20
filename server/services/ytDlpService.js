// YtDlpService — extract a direct audio stream URL for a YouTube video so
// the client can play it via <audio> when the IFrame embed is blocked
// (error codes 101/150). This unblocks the A/B compare master clock in
// restricted regions.
//
// The actual yt-dlp subprocess is environment-specific; this service
// provides a swappable adapter so the dev/CI environment can mock it via
// YtDlpMockAdapter while production uses YtDlpSubprocessAdapter.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TIMEOUT_MS = 12_000;
const ALLOWED_FORMATS = new Set(['bestaudio', 'bestaudio[ext=m4a]', 'bestaudio[ext=webm]']);

/**
 * IYtDlpService port — extract an audio stream URL for a YouTube id.
 *   extractAudioUrl({ youtubeId, format? }) → { url, expiresAt? }
 */
export class IYtDlpService {
  async extractAudioUrl(_opts) { throw new Error('Not implemented'); }
  async isAvailable() { return false; }
}

/**
 * YtDlpMockAdapter — deterministic stub for tests / dev.
 * Returns a fake /uploads/fake-audio-<id>.m4a URL the static middleware can
 * serve. Marks isAvailable() based on the constructor flag.
 */
export class YtDlpMockAdapter extends IYtDlpService {
  constructor({ available = true } = {}) {
    super();
    this.available = available;
  }
  async isAvailable() { return this.available; }
  async extractAudioUrl({ youtubeId, format = 'bestaudio' }) {
    if (!this.available) {
      const err = new Error('yt-dlp is not available in this environment');
      err.status = 503;
      throw err;
    }
    if (!youtubeId) {
      const err = new Error('youtubeId is required');
      err.status = 400;
      throw err;
    }
    if (!ALLOWED_FORMATS.has(format)) {
      const err = new Error(`Unsupported format: ${format}`);
      err.status = 400;
      throw err;
    }
    return {
      url: `/uploads/fake-audio-${youtubeId}.m4a`,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * YtDlpSubprocessAdapter — production adapter. Spawns the yt-dlp binary as a
 * child process and parses the JSON output for the chosen format. Resolves
 * the sys.executable-relative binary so PM2's python venv is honored.
 */
export class YtDlpSubprocessAdapter extends IYtDlpService {
  constructor({ binaryPath, timeoutMs = DEFAULT_TIMEOUT_MS, logger = console } = {}) {
    super();
    this.binaryPath = binaryPath || path.join(path.dirname(process.execPath), 'yt-dlp');
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  async isAvailable() {
    return new Promise((resolve) => {
      try {
        const proc = spawn(this.binaryPath, ['--version']);
        let ok = false;
        proc.on('error', () => resolve(false));
        proc.on('exit', (code) => resolve(code === 0 && (ok = true)));
        // If we got the version string, resolve true early.
        proc.stdout.on('data', () => { if (!ok) resolve(true); });
      } catch (_) {
        resolve(false);
      }
    });
  }

  async extractAudioUrl({ youtubeId, format = 'bestaudio' }) {
    if (!youtubeId) {
      const err = new Error('youtubeId is required');
      err.status = 400;
      throw err;
    }
    if (!ALLOWED_FORMATS.has(format)) {
      const err = new Error(`Unsupported format: ${format}`);
      err.status = 400;
      throw err;
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const err = new Error('yt-dlp timed out');
        err.status = 504;
        reject(err);
      }, this.timeoutMs);

      let stdout = '';
      let stderr = '';
      const proc = spawn(this.binaryPath, [
        '-f', format,
        '--no-playlist',
        '--no-warnings',
        '-g',
        `https://www.youtube.com/watch?v=${youtubeId}`,
      ]);

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      proc.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const wrapped = new Error(`yt-dlp failed to start: ${err.message}`);
        wrapped.status = 503;
        reject(wrapped);
      });
      proc.on('exit', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          this.logger.warn?.(`[yt-dlp] exit ${code}: ${stderr.slice(0, 500)}`);
          const err = new Error(`yt-dlp exited with code ${code}`);
          err.status = 502;
          reject(err);
          return;
        }
        const url = stdout.trim().split('\n').pop();
        if (!url) {
          const err = new Error('yt-dlp returned no URL');
          err.status = 502;
          reject(err);
          return;
        }
        resolve({
          url,
          // YouTube direct media URLs typically live ~6h before sig rotation
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        });
      });
    });
  }
}

export const __test__ = { ALLOWED_FORMATS, DEFAULT_TIMEOUT_MS };
