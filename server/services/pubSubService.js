/**
 * PubSubService — Redis pub/sub with in-process EventEmitter fallback.
 *
 * Why two transports? In single-instance deploys (and the test suite) we
 * don't need Redis — a local EventEmitter is enough and is synchronous.
 * In multi-instance deploys we need Redis pub/sub so an event published
 * in instance A reaches SSE subscribers on instance B. This service
 * auto-detects: if `ioredis` is installed AND a Redis server is reachable,
 * it bridges events through Redis; otherwise it falls back to a local
 * EventEmitter and the app still works (just no cross-process delivery).
 *
 * Contract:
 *   publish(channel, message)            synchronous, fire-and-forget
 *   subscribe(channel, handler) → unsub  returns an unsubscribe fn
 *   unsubscribe(channel, handler)
 *   close()                              async, idempotent
 *
 * Delivery semantics:
 *   - Same-process subscribers ALWAYS receive the event synchronously via
 *     the local EventEmitter (this is what the existing tests rely on).
 *   - When Redis is connected, publish() also pushes the message to Redis
 *     so other processes receive it asynchronously. A `fromPid` envelope
 *     tag prevents double-delivery to the publishing process (Redis echoes
 *     a published message back to all subscribers, including the publisher's
 *     own subscription connection).
 *   - When Redis is NOT connected (not installed, server down, connect
 *     timeout), only the local EventEmitter is used. The app degrades
 *     gracefully — no exceptions thrown on publish/subscribe.
 *
 * Two Redis connections are used because Redis mandates it: a client in
 * subscribe mode cannot publish.
 */

import { EventEmitter } from 'events';

const DEFAULT_REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const CONNECT_TIMEOUT_MS = 2000;

/**
 * Resolve when the ioredis client emits 'ready', or reject on error/timeout.
 * Leaves the client's own error listener intact for reconnect handling.
 */
function waitForReady(client, timeoutMs = CONNECT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (client.status === 'ready') return resolve();
    let settled = false;
    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onError = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      client.off('ready', onReady);
      client.off('error', onError);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`redis connect timeout (${timeoutMs}ms)`));
    }, timeoutMs);
    client.on('ready', onReady);
    client.on('error', onError);
  });
}

class PubSubService {
  constructor({
    redisUrl = DEFAULT_REDIS_URL,
    redisFactory = null,
    enableRedis = true,
    logger = console,
  } = {}) {
    this._redisUrl = redisUrl;
    this._redisFactory = redisFactory;
    this._logger = logger;
    // Auto-disable in jest workers so tests never attempt a real Redis
    // connection (kept the suite deterministic + fast). Production callers
    // can override with PUBSUB_DISABLE_REDIS=1.
    const inJest = typeof process !== 'undefined' && process.env && !!process.env.JEST_WORKER_ID;
    const envDisabled = typeof process !== 'undefined' && process.env && process.env.PUBSUB_DISABLE_REDIS === '1';
    this._enableRedis = enableRedis && !inJest && !envDisabled;
    this._pub = null;
    this._sub = null;
    this._ready = false;
    this._local = new EventEmitter();
    this._local.setMaxListeners(0);
    // channel -> Set<handler> so we know when to UNSUBSCRIBE from Redis.
    this._channelHandlers = new Map();
    this._initPromise = this._init().catch((err) => {
      this._logger.warn?.('[PubSub] Redis unavailable — using in-process fallback:', err?.message || err);
    });
  }

  async _init() {
    if (!this._enableRedis) return;
    let Redis;
    try {
      // Dynamic import so the dep is optional at runtime. If ioredis is
      // not installed we stay in fallback mode rather than crashing.
      ({ default: Redis } = await import('ioredis'));
    } catch {
      return;
    }
    const factory = this._redisFactory || (() => new Redis(this._redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    }));
    let pub;
    let sub;
    try {
      pub = factory();
      sub = factory();
      await Promise.all([waitForReady(pub), waitForReady(sub)]);
      sub.on('message', (channel, raw) => {
        let envelope;
        try { envelope = JSON.parse(raw); } catch { return; }
        // Skip our own echo — the publishing process already delivered
        // locally and synchronously. Cross-process delivery only.
        if (envelope?.fromPid === process.pid) return;
        this._local.emit(channel, envelope?.payload);
      });
      this._pub = pub;
      this._sub = sub;
      this._ready = true;
      this._logger.log?.('[PubSub] Redis connected — cross-instance events enabled');
    } catch (err) {
      // Tear down any half-open clients so they don't keep retrying forever.
      try { await pub?.quit(); } catch { /* ignore */ }
      try { await sub?.quit(); } catch { /* ignore */ }
      throw err;
    }
  }

  /**
   * Synchronous publish. Emits locally first (same-process subscribers
   * get the event immediately), then fire-and-forget to Redis for
   * cross-process delivery. Never throws.
   */
  publish(channel, message) {
    this._local.emit(channel, message);
    if (this._pub) {
      try {
        this._pub.publish(
          channel,
          JSON.stringify({ fromPid: process.pid, payload: message })
        ).catch(() => { /* swallow — pub/sub is best-effort */ });
      } catch { /* never let pub break the caller */ }
    }
  }

  /**
   * Subscribe to a channel. Returns an unsubscribe function. The handler
   * receives the message object. Delivery is synchronous for same-process
   * publishes, async (via Redis) for cross-process.
   */
  subscribe(channel, handler) {
    this._local.on(channel, handler);
    let set = this._channelHandlers.get(channel);
    if (!set) {
      set = new Set();
      this._channelHandlers.set(channel, set);
    }
    set.add(handler);
    if (this._sub && this._ready) {
      this._sub.subscribe(channel).catch(() => { /* will retry on reconnect */ });
    }
    return () => this.unsubscribe(channel, handler);
  }

  unsubscribe(channel, handler) {
    this._local.off(channel, handler);
    const set = this._channelHandlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this._channelHandlers.delete(channel);
      if (this._sub && this._ready) {
        this._sub.unsubscribe(channel).catch(() => { /* ignore */ });
      }
    }
  }

  get ready() { return this._ready; }

  /**
   * Wait for the background init (Redis connect attempt) to settle.
   * Lets callers await fallback determination at startup if desired.
   */
  async readySettled() { await this._initPromise; return this._ready; }

  async close() {
    try { await this._pub?.quit(); } catch { /* ignore */ }
    try { await this._sub?.quit(); } catch { /* ignore */ }
    this._pub = null;
    this._sub = null;
    this._ready = false;
    this._local.removeAllListeners();
    this._channelHandlers.clear();
  }
}

const singleton = new PubSubService();
export { PubSubService,   };
