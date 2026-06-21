/**
 * Phase 2.3 v2: bookmark analysis event bus + SSE endpoint.
 *
 * BookmarkAnalysisService writes status transitions (pending → running →
 * success/error/skipped) into the Audit document. The SSE endpoint lets
 * the AuditDetail page subscribe to those transitions in real time so
 * the "Queued / Analyzing" pill updates without a manual refresh.
 *
 * Design notes:
 *   - Transport: Redis pub/sub via `pubSubService` (see
 *     services/pubSubService.js) with an in-process EventEmitter fallback.
 *     Same-process delivery is synchronous (tests + single-instance deploys
 *     rely on this); cross-instance delivery goes through Redis so
 *     multi-process deploys work. The bus owns a per-instance snapshot
 *     cache; the transport is solely the fan-out mechanism.
 *   - One channel per `auditId` (`audit:${auditId}:bookmarks`). Clients
 *     subscribe by opening the SSE stream for the audit they're viewing.
 *     The bus broadcasts every event to every subscriber; clients filter
 *     by `bookmarkId`.
 *   - Heartbeat: every 25s the server sends a `:keep-alive` SSE comment
 *     so corporate proxies (and Node's default 2-minute idle timeout)
 *     don't silently kill the connection. The client treats a missing
 *     heartbeat as a disconnect and re-opens.
 *   - Caching: the service records each `auditId`'s last-known snapshot
 *     (Map<auditId, Map<bookmarkId, analysis>>). New subscribers get
 *     a full snapshot on connect so they don't need to call the regular
 *     /api/audits/:id route first. The snapshot is per-process — a fresh
 *     process starts with an empty snapshot and fills it as events arrive.
 */

import { PubSubService } from './pubSubService.js';

const HEARTBEAT_MS = 25_000;

const channelFor = (auditId) => `audit:${auditId}:bookmarks`;

class BookmarkAnalysisBus {
  constructor({ pubSub = null } = {}) {
    // Each bus owns its own PubSubService instance so test instances stay
    // isolated (separate local EventEmitters). In production there is a
    // single bus → a single Redis connection pair.
    this._pubSub = pubSub || new PubSubService();
    this._snapshots = new Map();
  }

  /**
   * Record a status change. Called by BookmarkAnalysisService whenever
   * a bookmark's analysis state changes (pending → running → success/error).
   * @param {string} auditId
   * @param {string} bookmarkId
   * @param {object} analysis  full analysis object (status, error, tags…)
   */
  publish(auditId, bookmarkId, analysis) {
    if (!auditId || !bookmarkId) return;
    let snap = this._snapshots.get(auditId);
    if (!snap) {
      snap = new Map();
      this._snapshots.set(auditId, snap);
    }
    snap.set(bookmarkId, analysis);
    this._pubSub.publish(channelFor(auditId), { auditId, bookmarkId, analysis });
  }

  /**
   * Initial snapshot for an audit (Map<bookmarkId, analysis>).
   * @param {string} auditId
   */
  snapshot(auditId) {
    const snap = this._snapshots.get(auditId);
    if (!snap) return {};
    const out = {};
    for (const [bid, a] of snap.entries()) out[bid] = a;
    return out;
  }

  /**
   * Subscribe to all changes for an audit. Returns an unsubscribe fn.
   * @param {string} auditId
   * @param {(payload) => void} handler
   */
  subscribe(auditId, handler) {
    return this._pubSub.subscribe(channelFor(auditId), handler);
  }

  size() {
    return this._snapshots.size;
  }

  clear(auditId) {
    if (auditId) this._snapshots.delete(auditId);
    else this._snapshots.clear();
  }

  async close() {
    await this._pubSub?.close?.();
  }
}

const globalBus = new BookmarkAnalysisBus();
export const bookmarkAnalysisBus = globalBus;

/**
 * Express handler factory: returns a route handler for SSE subscription
 * on `GET /api/audits/:id/bookmarks/events`. The handler:
 *   1. Authenticates the request (caller is responsible for req.user).
 *   2. Sends the current snapshot as `event: snapshot`.
 *   3. Streams `event: bookmark-update` for each subsequent change.
 *   4. Sends a `:keep-alive` SSE comment every 25s.
 *   5. Cleans up on req close.
 *
 * @param {{ auditRepository: { findById: Function } }} deps
 */
export const buildBookmarkAnalysisSseHandler = ({ auditRepository } = {}) => {
  if (!auditRepository) {
    throw new Error('buildBookmarkAnalysisSseHandler requires auditRepository');
  }
  return async (req, res) => {
    const { id: auditId } = req.params;
    if (!auditId) {
      res.status(400).json({ error: 'audit id required' });
      return;
    }

    // Make sure the audit exists. Auth + ownership are checked by the
    // route's auth middleware (e.g. authenticate + requireOwnership).
    const audit = await auditRepository.findById(auditId);
    if (!audit) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('snapshot', { auditId, bookmarks: globalBus.snapshot(auditId) });

    const unsubscribe = globalBus.subscribe(auditId, ({ bookmarkId, analysis }) => {
      try {
        send('bookmark-update', { bookmarkId, analysis });
      } catch {
        // socket closed mid-write
      }
    });

    const heartbeat = setInterval(() => {
      try { res.write(`:keep-alive\n\n`); } catch { /* socket dead */ }
    }, HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      try { res.end(); } catch { /* already ended */ }
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
  };
};

export { BookmarkAnalysisBus };
export default bookmarkAnalysisBus;
