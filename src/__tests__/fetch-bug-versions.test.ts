import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, fetchFirstJson } from '../utils/fetch.js';
import { findBugInfo } from '../utils/bug-versions.js';

describe('utils/fetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Safe default: reject all real network calls to prevent accidental
    // HTTP requests during tests (per CLAUDE.md Testing Safety rules).
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network calls not allowed in tests'));
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
});
