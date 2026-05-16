import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, fetchFirstJson } from '../utils/fetch.js';
import { findBugInfo, getBugVersions } from '../utils/bug-versions.js';
import { cacheStore } from '../utils/store.js';

describe('utils/fetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('fetchWithTimeout returns response on success', async () => {
    fetchSpy.mockResolvedValue(new Response('{"ok":1}', { status: 200 }));
    const res = await fetchWithTimeout('https://x', 1000);
    expect(res.ok).toBe(true);
  });

  it('fetchWithTimeout throws on non-ok status', async () => {
    fetchSpy.mockResolvedValue(new Response('err', { status: 500 }));
    await expect(fetchWithTimeout('https://x', 1000)).rejects.toThrow(/HTTP 500/);
  });

  it('fetchFirstJson returns first successful JSON', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('{"v":"1"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"v":"2"}', { status: 200 }));
    const result = await fetchFirstJson<{ v: string }>(['https://a', 'https://b'], 1000);
    expect(result?.v).toMatch(/[12]/);
  });

  it('fetchFirstJson returns null when all fail', async () => {
    fetchSpy.mockRejectedValue(new Error('network'));
    const result = await fetchFirstJson(['https://a', 'https://b'], 1000);
    expect(result).toBeNull();
  });
});

describe('utils/bug-versions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cacheStore.delete('bugVersionsCache');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cacheStore.delete('bugVersionsCache');
  });

  it('findBugInfo matches a version against a range', () => {
    const map = { '>=5.0.0 <5.10.0': ['https://example/issue'] };
    const result = findBugInfo('5.5.0', map);
    expect(result?.range).toBe('>=5.0.0 <5.10.0');
    expect(result?.urls).toContain('https://example/issue');
  });

  it('findBugInfo returns null when no range matches', () => {
    const map = { '>=4.0.0 <5.0.0': ['x'] };
    expect(findBugInfo('5.5.0', map)).toBeNull();
  });

  it('getBugVersions uses fresh cache', async () => {
    cacheStore.set('bugVersionsCache', {
      lastChecked: Date.now(),
      data: { '>=5.0.0': ['cached'] },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await getBugVersions();
    expect(result?.['>=5.0.0']).toEqual(['cached']);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('getBugVersions fetches when no cache, then caches', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{">=6.0.0":["url"]}', { status: 200 }),
    );
    const result = await getBugVersions();
    expect(result?.['>=6.0.0']).toEqual(['url']);
    fetchSpy.mockRestore();
  });

  it('getBugVersions falls back to stale cache on network failure', async () => {
    cacheStore.set('bugVersionsCache', {
      lastChecked: Date.now() - 24 * 60 * 60 * 1000, // 24h ago, stale
      data: { '>=5.0.0': ['stale'] },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const result = await getBugVersions();
    expect(result?.['>=5.0.0']).toEqual(['stale']);
    fetchSpy.mockRestore();
  });

  it('getBugVersions returns null when network fails and no cache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const result = await getBugVersions();
    expect(result).toBeNull();
    fetchSpy.mockRestore();
  });
});
