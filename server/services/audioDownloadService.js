/**
 * AudioDownloadService — owns the network call to the Python analysis
 * service to fetch a YouTube audio file. Returns the local temp path
 * the caller can hand to AudioStorageService.moveIntoStore().
 *
 * Ported out of routes/songs.js so the route handler can be unit-tested
 * with a fake implementation (the production path takes 1-4 minutes and
 * hits an external service — not something a Jest integration test
 * should block on).
 *
 * The class is constructed with `{ analysisServiceUrl, httpClient,
 * downloadTimeoutMs }`; default `httpClient` is `axios` and the default
 * URL is `process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8080'`,
 * which matches the rest of the Arra deployment.
 */
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class AudioDownloadService {
  constructor({
    analysisServiceUrl = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8080',
    httpClient = axios,
    downloadTimeoutMs = 240000,
  } = {}) {
    this.analysisServiceUrl = analysisServiceUrl;
    this.httpClient = httpClient;
    this.downloadTimeoutMs = downloadTimeoutMs;
  }

  /**
   * Ask Python to download the YouTube audio for `songId` into a fresh
   * temp directory. Returns `{ sourcePath, tempDir }`; the caller is
   * responsible for either moving the file into permanent storage or
   * cleaning up the temp dir on failure.
   *
   * Throws if Python returns no file_path, the file doesn't exist, or
   * the HTTP call fails / times out.
   */
  async downloadToTemp({ songId, youtubeUrl }) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arra-dl-'));
    let sourcePath;
    try {
      const { data } = await this.httpClient.post(
        `${this.analysisServiceUrl}/download`,
        {
          song_id: songId,
          youtube_url: youtubeUrl,
          dest_dir: tempDir,
          file_stem: songId,
        },
        { timeout: this.downloadTimeoutMs }
      );
      sourcePath = data?.file_path;
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error(
          `Python download returned no file_path: ${JSON.stringify(data)}`
        );
      }
      return { sourcePath, tempDir };
    } catch (err) {
      // Best-effort cleanup if Python returned 500 or the file never landed.
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
      throw err;
    }
  }
}

