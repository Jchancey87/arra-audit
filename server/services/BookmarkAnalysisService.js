/**
 * BookmarkAnalysisService — owns the per-bookmark CLAP analysis pipeline.
 *
 * Phase 2.3: Bookmarks are tagged with the playback moment they refer to
 * (timestampSeconds). Running CLAP on the ±5s window around that moment
 * surfaces a short list of timbre + mood tags plus a "similar to" set
 * of canonical reference tracks. We surface those on the bookmark card
 * so the user can see *why* the moment caught their ear and discover
 * other tracks that share the same vibe.
 *
 * Concurrency model:
 *   - The Python service has its own GPU semaphore (default 2) so even
 *     if many requests arrive at once, only 2 CLAP inferences run.
 *   - This service adds a second layer of queueing on the Node side so
 *     we don't pile up unbounded promises when many bookmarks are
 *     added in a burst (e.g. import). It tracks in-flight jobs and
 *     skips enqueueing if the queue is full.
 *
 * Storage shape (bookmark.analysis, see models/Audit.js):
 *   {
 *     status:       'pending' | 'running' | 'success' | 'error' | 'skipped',
 *     model:        'clap-htsat-fused' | 'deterministic-v1',
 *     version:      '2.3.0',
 *     mood_tags:    [{tag, score}],
 *     timbre_tags:  [{tag, score}],
 *     similar_to:   ['Artist - Track', ...],
 *     error:        string | null,
 *     computedAt:   Date | null,
 *   }
 */

const DEFAULT_PAD_SECONDS = 5;
const DEFAULT_QUEUE_LIMIT = 32;
const MAX_BACKGROUND_JOBS = 8;

const initialAnalysis = (overrides = {}) => ({
  status: 'pending',
  model: null,
  version: null,
  mood_tags: [],
  timbre_tags: [],
  similar_to: [],
  error: null,
  computedAt: null,
  ...overrides,
});

export class BookmarkAnalysisService {
  constructor({
    adapter,
    auditRepository,
    songRepository,
    padSeconds = DEFAULT_PAD_SECONDS,
    queueLimit = DEFAULT_QUEUE_LIMIT,
  } = {}) {
    if (!adapter) throw new Error('BookmarkAnalysisService requires an adapter');
    if (!auditRepository) throw new Error('BookmarkAnalysisService requires an auditRepository');
    this.adapter = adapter;
    this.auditRepository = auditRepository;
    this.songRepository = songRepository || null;
    this.padSeconds = padSeconds;
    this.queueLimit = queueLimit;
    this.queue = [];
    this.inFlight = 0;
    this.processing = false;
  }

  // ── Queue + concurrency control ─────────────────────────────────────────

  size() {
    return this.queue.length;
  }

  isFull() {
    return this.inFlight + this.queue.length >= this.queueLimit;
  }

  inFlightCount() {
    return this.inFlight;
  }

  enqueue({ auditId, bookmarkId, startSeconds, endSeconds, audioId, filePath, youtubeUrl, ytId, padSeconds }) {
    if (this.isFull()) {
      return { accepted: false, reason: 'queue-full' };
    }
    this.queue.push({
      auditId,
      bookmarkId,
      startSeconds,
      endSeconds,
      audioId,
      filePath,
      youtubeUrl,
      ytId,
      padSeconds: Number.isFinite(padSeconds) ? padSeconds : this.padSeconds,
      enqueuedAt: Date.now(),
    });
    // Best-effort: mark bookmark as pending immediately so the UI can
    // surface the "analyzing" state on the next audit fetch.
    this._setBookmarkAnalysis(auditId, bookmarkId, initialAnalysis({ status: 'pending' })).catch(() => {});
    this._drain();
    return { accepted: true, queueSize: this.queue.length };
  }

  async _drain() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0 && this.inFlight < MAX_BACKGROUND_JOBS) {
        const job = this.queue.shift();
        this.inFlight += 1;
        this._runJob(job).finally(() => {
          this.inFlight -= 1;
          // If the queue still has work, schedule the next drain on the
          // next microtask so we don't recurse too deep.
          if (this.queue.length > 0) {
            Promise.resolve().then(() => this._drain());
          }
        });
      }
    } finally {
      this.processing = false;
    }
  }

  async _runJob(job) {
    const { auditId, bookmarkId } = job;
    // Resolve audioId from the song document if not supplied
    let resolved = { ...job };
    try {
      if (!resolved.audioId && !resolved.filePath) {
        const audio = await this._resolveAudio(job);
        resolved = { ...resolved, ...audio };
      }
    } catch (err) {
      await this._setBookmarkAnalysis(auditId, bookmarkId, {
        status: 'error',
        error: `Audio resolution failed: ${err.message}`,
      }).catch(() => {});
      return;
    }

    await this._setBookmarkAnalysis(auditId, bookmarkId, {
      status: 'running',
    }).catch(() => {});

    try {
      const analysis = await this.adapter.analyzeSegment({
        audioId: resolved.audioId,
        filePath: resolved.filePath,
        youtubeUrl: resolved.youtubeUrl,
        ytId: resolved.ytId,
        startSeconds: resolved.startSeconds,
        endSeconds: resolved.endSeconds,
        padSeconds: resolved.padSeconds,
      });
      await this._setBookmarkAnalysis(auditId, bookmarkId, {
        status: 'success',
        model: analysis.model || null,
        version: analysis.version || null,
        mood_tags: analysis.mood_tags || [],
        timbre_tags: analysis.timbre_tags || [],
        similar_to: analysis.similar_to || [],
        error: null,
        computedAt: new Date(),
      });
    } catch (err) {
      await this._setBookmarkAnalysis(auditId, bookmarkId, {
        status: 'error',
        error: err.message || 'Bookmark analysis failed',
      }).catch(() => {});
    }
  }

  async _resolveAudio(job) {
    if (job.filePath) return { filePath: job.filePath };
    if (!this.songRepository) {
      throw new Error('Cannot resolve audio without songRepository');
    }
    const audit = await this.auditRepository.findById(job.auditId);
    if (!audit) throw new Error('Audit not found');
    const songId = audit.songId?._id || audit.songId;
    if (!songId) throw new Error('Audit has no songId');
    const song = await this.songRepository.findById(songId);
    if (!song) throw new Error('Song not found');
    return {
      audioId: song.sourceId || song.youtubeId,
      youtubeUrl: song.originalUrl || song.youtubeUrl,
      ytId: song.sourceId || song.youtubeId,
    };
  }

  async _setBookmarkAnalysis(auditId, bookmarkId, patch) {
    const audit = await this.auditRepository.findById(auditId);
    if (!audit) return false;
    const bookmarks = (audit.bookmarks || []).map((b) => {
      const id = b._id?.toString() ?? b.id;
      if (id !== bookmarkId) return b;
      const merged = { ...(b.analysis || {}), ...patch };
      return { ...b, analysis: merged };
    });
    await this.auditRepository.updateById(auditId, { bookmarks, updatedAt: new Date() });
    return true;
  }
}

export default BookmarkAnalysisService;
export { initialAnalysis, MAX_BACKGROUND_JOBS, DEFAULT_QUEUE_LIMIT };
