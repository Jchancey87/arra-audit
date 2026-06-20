import { describe, it, expect, beforeEach } from 'vitest';
import { recordLinkOpen, getLinkOpenStats } from '../shareAnalytics.js';

const STORAGE_KEY = 'arra.shareLinkLog.v1';

describe('shareAnalytics', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  });

  it('records a link-open event and surfaces it in getLinkOpenStats', () => {
    recordLinkOpen({ auditId: 'audit-1', bookmarkId: 'bm-1', source: 'bookmark-card' });
    recordLinkOpen({ auditId: 'audit-1', bookmarkId: null, source: 'deep-link' });
    recordLinkOpen({ auditId: 'audit-2', bookmarkId: 'bm-9', source: 'bookmark-card' });

    const stats = getLinkOpenStats();
    expect(stats.totalOpens).toBe(3);
    expect(stats.perAudit['audit-1']).toBe(2);
    expect(stats.perAudit['audit-2']).toBe(1);
    expect(stats.perSource['bookmark-card']).toBe(2);
    expect(stats.perSource['deep-link']).toBe(1);
  });

  it('truncates the source label to 64 chars', () => {
    const long = 'x'.repeat(200);
    recordLinkOpen({ auditId: 'a', bookmarkId: null, source: long });
    const stats = getLinkOpenStats();
    expect(stats.perSource['x'.repeat(64)]).toBe(1);
  });

  it('ignores events with no auditId', () => {
    recordLinkOpen({ auditId: null, bookmarkId: null, source: 'noop' });
    const stats = getLinkOpenStats();
    expect(stats.totalOpens).toBe(0);
  });

  it('survives corrupt localStorage data', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, 'not-json-{');
    }
    const stats = getLinkOpenStats();
    expect(stats.totalOpens).toBe(0);
  });
});
