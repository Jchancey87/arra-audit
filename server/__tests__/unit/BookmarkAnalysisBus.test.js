/**
 * Tests for BookmarkAnalysisBus + SSE handler.
 *
 * Strategy: hit the in-memory bus directly (no HTTP) to verify the
 * publish/subscribe contract, then test the SSE handler in isolation
 * with a mock res/req to confirm the wire format (event/data lines,
 * heartbeat, cleanup on close).
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  bookmarkAnalysisBus,
  BookmarkAnalysisBus,
  buildBookmarkAnalysisSseHandler,
} from '../../services/BookmarkAnalysisBus.js';

const flush = () => new Promise((r) => setImmediate(r));

describe('BookmarkAnalysisBus', () => {
  test('publish + subscribe delivers events scoped by auditId', () => {
    const bus = new BookmarkAnalysisBus();
    const a1 = jest.fn();
    const a2 = jest.fn();
    const u1 = bus.subscribe('audit-1', a1);
    const u2 = bus.subscribe('audit-2', a2);

    bus.publish('audit-1', 'b1', { status: 'pending' });
    bus.publish('audit-2', 'b9', { status: 'success' });

    expect(a1).toHaveBeenCalledTimes(1);
    expect(a1).toHaveBeenCalledWith({ auditId: 'audit-1', bookmarkId: 'b1', analysis: { status: 'pending' } });
    expect(a2).toHaveBeenCalledTimes(1);
    expect(a2).toHaveBeenCalledWith({ auditId: 'audit-2', bookmarkId: 'b9', analysis: { status: 'success' } });

    u1();
    u2();
    bus.publish('audit-1', 'b2', { status: 'success' });
    expect(a1).toHaveBeenCalledTimes(1);
    expect(a2).toHaveBeenCalledTimes(1);
  });

  test('snapshot returns the current map of bookmarkId → analysis', () => {
    const bus = new BookmarkAnalysisBus();
    bus.publish('a', 'b1', { status: 'success' });
    bus.publish('a', 'b2', { status: 'pending' });
    bus.publish('other', 'x', { status: 'error' });

    const snap = bus.snapshot('a');
    expect(snap).toEqual({
      b1: { status: 'success' },
      b2: { status: 'pending' },
    });
  });

  test('snapshot returns {} for unknown audits', () => {
    const bus = new BookmarkAnalysisBus();
    expect(bus.snapshot('nope')).toEqual({});
  });

  test('publish ignores missing ids', () => {
    const bus = new BookmarkAnalysisBus();
    bus.publish('', 'b1', { status: 'pending' });
    bus.publish('a', '', { status: 'pending' });
    bus.publish('a', null, { status: 'pending' });
    expect(bus.size()).toBe(0);
  });

  test('clear removes a single audit or all', () => {
    const bus = new BookmarkAnalysisBus();
    bus.publish('a', 'b1', { status: 'pending' });
    bus.publish('b', 'b1', { status: 'pending' });
    bus.clear('a');
    expect(bus.size()).toBe(1);
    bus.clear();
    expect(bus.size()).toBe(0);
  });

  test('subscriber receives updated analysis if same bookmarkId is re-published', () => {
    const bus = new BookmarkAnalysisBus();
    const handler = jest.fn();
    bus.subscribe('a', handler);
    bus.publish('a', 'b1', { status: 'pending' });
    bus.publish('a', 'b1', { status: 'running' });
    bus.publish('a', 'b1', { status: 'success' });
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls.map((c) => c[0].analysis.status)).toEqual(['pending', 'running', 'success']);
  });
});

describe('buildBookmarkAnalysisSseHandler', () => {
  let auditRepository;
  let handler;
  let req;
  let res;
  let written;
  let ended;

  beforeEach(() => {
    auditRepository = { findById: jest.fn() };
    handler = buildBookmarkAnalysisSseHandler({ auditRepository });
    written = [];
    ended = false;
    const reqListeners = {};
    req = {
      params: { id: 'audit-42' },
      on: (event, cb) => { reqListeners[event] = cb; },
      _triggerClose: () => reqListeners.close?.(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk) => { written.push(chunk); return true; }),
      end: jest.fn(() => { ended = true; }),
    };
  });

  afterEach(() => {
    // Always close the stream to clear the heartbeat interval; otherwise
    // the test process keeps a timer alive and jest hangs at exit.
    if (req && !ended) req._triggerClose();
  });

  test('returns 400 when audit id is missing', async () => {
    req.params = {};
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when audit is not found', async () => {
    auditRepository.findById.mockResolvedValue(null);
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('streams the snapshot then keeps the connection open', async () => {
    auditRepository.findById.mockResolvedValue({ _id: 'audit-42' });
    bookmarkAnalysisBus.clear('audit-42');
    bookmarkAnalysisBus.publish('audit-42', 'b1', { status: 'pending' });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    }));
    expect(res.flushHeaders).toHaveBeenCalled();

    const text = written.join('');
    expect(text).toMatch(/event: snapshot\n/);
    expect(text).toMatch(/"auditId":"audit-42"/);
    expect(text).toMatch(/"b1":\{"status":"pending"\}/);
    expect(ended).toBe(false);
  });

  test('subsequent publish delivers a bookmark-update event', async () => {
    auditRepository.findById.mockResolvedValue({ _id: 'audit-42' });
    bookmarkAnalysisBus.clear('audit-42');
    await handler(req, res);
    written.length = 0;

    bookmarkAnalysisBus.publish('audit-42', 'b9', { status: 'success' });
    await flush();

    const text = written.join('');
    expect(text).toMatch(/event: bookmark-update\n/);
    expect(text).toMatch(/"bookmarkId":"b9"/);
    expect(text).toMatch(/"status":"success"/);
  });

  test('subscribers only receive events for their auditId', async () => {
    auditRepository.findById.mockResolvedValue({ _id: 'audit-42' });
    bookmarkAnalysisBus.clear('audit-42');
    bookmarkAnalysisBus.clear('audit-other');
    await handler(req, res);
    written.length = 0;

    bookmarkAnalysisBus.publish('audit-other', 'b9', { status: 'success' });
    bookmarkAnalysisBus.publish('audit-42', 'b1', { status: 'running' });
    await flush();

    const text = written.join('');
    expect(text).toMatch(/event: bookmark-update\n/);
    expect(text).toMatch(/"b1"/);
    expect(text).not.toMatch(/"b9"/);
  });

  test('cleanup on req close stops further events and ends the response', async () => {
    auditRepository.findById.mockResolvedValue({ _id: 'audit-42' });
    bookmarkAnalysisBus.clear('audit-42');
    await handler(req, res);
    req._triggerClose();
    written.length = 0;

    bookmarkAnalysisBus.publish('audit-42', 'b1', { status: 'success' });
    await flush();

    expect(written).toEqual([]);
    expect(ended).toBe(true);
  });
});
