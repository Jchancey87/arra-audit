/**
 * CLAPSegmentAdapter — production adapter for IBookmarkAnalysisService.
 *
 * Thin HTTP wrapper around the Python FastAPI /analyze-segment endpoint.
 * The endpoint itself enforces a 2-concurrent-job GPU semaphore and
 * handles yt-dlp download-or-cache for the audio file.
 *
 * Configuration is via env:
 *   ANALYSIS_SERVICE_URL  — default http://localhost:8080
 *   ANALYSIS_API_TIMEOUT  — ms, default 90000 (1.5 min; a single CLAP
 *                           inference + librosa load + download cache
 *                           miss can take up to ~60s on the dev box)
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const DEFAULT_TIMEOUT_MS = 90000;

const buildUrl = (base, path) => {
  const u = new URL(path, base);
  return u.toString();
};

const postJson = (target, body, timeoutMs) =>
  new Promise((resolve, reject) => {
    const url = new URL(target);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body));
    const req = lib.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { chunks += chunk; });
        res.on('end', () => {
          try {
            const parsed = chunks ? JSON.parse(chunks) : null;
            if (res.statusCode >= 400) {
              const detail = parsed?.detail || chunks?.slice(0, 300) || `HTTP ${res.statusCode}`;
              return reject(new Error(`Analysis service error: ${detail}`));
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Analysis service returned non-JSON: ${e.message}`));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Analysis service timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

export class CLAPSegmentAdapter {
  constructor({
    baseUrl = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8080',
    timeoutMs = Number(process.env.ANALYSIS_API_TIMEOUT || DEFAULT_TIMEOUT_MS),
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  }

  async analyzeSegment({
    audioId,
    filePath,
    youtubeUrl,
    ytId,
    startSeconds,
    endSeconds,
    padSeconds = 5,
  }) {
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      throw new Error('startSeconds and endSeconds are required and must be numbers');
    }
    if (endSeconds <= startSeconds) {
      throw new Error('endSeconds must be greater than startSeconds');
    }
    if (!filePath && !(youtubeUrl && ytId)) {
      throw new Error('Provide filePath or (youtubeUrl + ytId)');
    }

    const body = {
      audio_id: audioId || null,
      file_path: filePath || null,
      youtube_url: youtubeUrl || null,
      yt_id: ytId || null,
      start_seconds: startSeconds,
      end_seconds: endSeconds,
      pad_seconds: padSeconds,
    };

    const result = await postJson(
      buildUrl(this.baseUrl, '/analyze-segment'),
      body,
      this.timeoutMs
    );

    if (!result || !result.analysis) {
      throw new Error('Analysis service response missing `analysis` field');
    }
    return result.analysis;
  }
}

export default CLAPSegmentAdapter;
