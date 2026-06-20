/**
 * Phase 2.3 v2: bookmark analysis event bus + SSE endpoint.
 *
 * BookmarkAnalysisService writes status transitions (pending → running →
 * success/error/skipped) into the Audit document. The SSE endpoint lets
 * the AuditDetail page subscribe to those transitions in real time so
 * the "Queued / Analyzing" pill updates without a manual refresh.
 *
 * Design notes:
 *   - In-process EventEmitter. Multi-instance deployments would need a
 *     Redis pub/sub or similar — out of scope for a single-PM2-process
 *     app. The route + service live in the same Node process so this is
 *     sufficient.
 *   - One channel per `auditId` (clients subscribe by opening the SSE
 *     stream for the audit they're viewing). The bus broadcasts every
 *     event to every subscriber; clients filter by `bookmarkId`.
 *   - Heartbeat: every 25s the server sends a `:keep-alive` SSE comment
 *     so corporate proxies (and Node's default 2-minute idle timeout)
 *     don't silently kill the connection. The client treats a missing
 *     heartbeat as a disconnect and re-opens.
 *   - Caching: the service records each `auditId`'s last-known snapshot
 *     (Map<auditId, Map<bookmarkId, analysis>>). New subscribers get
 *     a full snapshot on connect so they don't need to call the regular
 *     /api/audits/:id route first.
 */

import { EventEmitter } from 'events';

const HEARTBEAT_MS = 25_000;

class BookmarkAnalysisBus {
  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(0);
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
    this._emitter.emit('change', { auditId, bookmarkId, analysis });
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
    const changeListener = (payload) => {
      if (payload.auditId === auditId) handler(payload);
    };
    this._emitter.on('change', changeListener);
    return () => {
      this._emitter.off('change', changeListener);
    };
  }

  size() {
    return this._snapshots.size;
  }

  clear(auditId) {
    if (auditId) this._snapshots.delete(auditId);
    else this._snapshots.clear();
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
