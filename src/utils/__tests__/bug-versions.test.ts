import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findBugInfo } from '../bug-versions.js';
import type { BugVersionsMap } from '../bug-versions.js';

// Mock store so getBugVersions tests don't touch the filesystem
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../store.js', () => ({
  cacheStore: {
    get: (key: string) => mockCacheGet(key),
    set: (key: string, val: unknown) => mockCacheSet(key, val),
  },
}));

const mockHttpsGet = vi.fn();
vi.mock('node:https', () => ({
  get: (...args: unknown[]) => mockHttpsGet(...args),
}));

// ─── findBugInfo ────────────────────────────────────────────────────────────

const FIXTURE: BugVersionsMap = {
  '3.9.3': ['https://github.com/ant-design/ant-design/commit/abc'],
  '>= 3.10.0 <=3.10.9': ['https://github.com/ant-design/ant-design/commit/def'],
  '>= 4.21.6 < 4.22.0': ['https://github.com/ant-design/ant-design/pull/36682'],
  '>= 4.22.2 <= 4.22.5': [
    'https://github.com/ant-design/ant-design/issues/36932',
    'https://github.com/ant-design/ant-design/pull/36800',
  ],
  '5.0.4': ['https://github.com/ant-design/ant-design/issues/39284'],
  '>= 5.2.3 <= 5.3.0': ['https://github.com/ant-design/ant-design/pull/40719'],
  '>= 5.28.1 <= 5.29.0': ['https://github.com/ant-design/ant-design/issues/55755'],
  '6.3.0': ['https://github.com/ant-design/ant-design/pull/56946'],
};

describe('findBugInfo()', () => {
  it('returns null for a safe version', () => {
    expect(findBugInfo('5.20.0', FIXTURE)).toBeNull();
    expect(findBugInfo('4.24.0', FIXTURE)).toBeNull();
    expect(findBugInfo('6.1.0', FIXTURE)).toBeNull();
  });

  it('matches exact version key', () => {
    const hit = findBugInfo('3.9.3', FIXTURE);
    expect(hit).not.toBeNull();
    expect(hit!.range).toBe('3.9.3');
    expect(hit!.urls).toHaveLength(1);
  });

  it('matches version inside >= <= compound range (inclusive bounds)', () => {
    expect(findBugInfo('3.10.0', FIXTURE)?.range).toBe('>= 3.10.0 <=3.10.9');
    expect(findBugInfo('3.10.5', FIXTURE)?.range).toBe('>= 3.10.0 <=3.10.9');
    expect(findBugInfo('3.10.9', FIXTURE)?.range).toBe('>= 3.10.0 <=3.10.9');
  });

  it('does not match version outside >= <= compound range', () => {
    expect(findBugInfo('3.9.9', FIXTURE)).toBeNull();
    expect(findBugInfo('3.11.0', FIXTURE)).toBeNull();
  });

  it('matches version inside >= < compound range (exclusive upper)', () => {
    expect(findBugInfo('4.21.6', FIXTURE)?.range).toBe('>= 4.21.6 < 4.22.0');
    expect(findBugInfo('4.21.9', FIXTURE)?.range).toBe('>= 4.21.6 < 4.22.0');
  });

  it('does not match exclusive upper bound of >= < range', () => {
    expect(findBugInfo('4.22.0', FIXTURE)).toBeNull();
  });

  it('returns all urls for the matched range', () => {
    const hit = findBugInfo('4.22.3', FIXTURE);
    expect(hit!.urls).toHaveLength(2);
    expect(hit!.urls[0]).toContain('issues/36932');
  });

  it('matches exact version 5.0.4', () => {
    expect(findBugInfo('5.0.4', FIXTURE)?.range).toBe('5.0.4');
  });

  it('matches 5.x compound range', () => {
    expect(findBugInfo('5.2.3', FIXTURE)?.range).toBe('>= 5.2.3 <= 5.3.0');
    expect(findBugInfo('5.3.0', FIXTURE)?.range).toBe('>= 5.2.3 <= 5.3.0');
    expect(findBugInfo('5.2.2', FIXTURE)).toBeNull();
    expect(findBugInfo('5.3.1', FIXTURE)).toBeNull();
  });

  it('matches 5.28-5.29 compound range', () => {
    expect(findBugInfo('5.28.1', FIXTURE)?.range).toBe('>= 5.28.1 <= 5.29.0');
    expect(findBugInfo('5.29.0', FIXTURE)?.range).toBe('>= 5.28.1 <= 5.29.0');
    expect(findBugInfo('5.29.1', FIXTURE)).toBeNull();
  });

  it('matches exact version 6.3.0', () => {
    expect(findBugInfo('6.3.0', FIXTURE)?.range).toBe('6.3.0');
    expect(findBugInfo('6.3.1', FIXTURE)).toBeNull();
  });

  it('returns null for empty bugVersions map', () => {
    expect(findBugInfo('5.0.4', {})).toBeNull();
  });
});

// ─── getBugVersions ─────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import { getBugVersions } from '../bug-versions.js';

const SAMPLE_DATA: BugVersionsMap = { '5.0.4': ['https://github.com/example'] };

function setupHttpsMock(body: string, statusCode = 200) {
  mockHttpsGet.mockImplementation((_url: unknown, _opts: unknown, cb: (res: unknown) => void) => {
    const res = new EventEmitter() as EventEmitter & { statusCode: number; resume: () => void };
    res.statusCode = statusCode;
    res.resume = vi.fn();
    setTimeout(() => {
      res.emit('data', Buffer.from(body));
      res.emit('end');
    }, 5);
    cb(res);
    return new EventEmitter();
  });
}

describe('getBugVersions()', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCacheGet.mockReset().mockReturnValue(undefined);
    mockCacheSet.mockReset();
    mockHttpsGet.mockReset();
  });

  it('returns fetched data and writes cache when no cache exists', async () => {
    setupHttpsMock(JSON.stringify(SAMPLE_DATA));
    const result = await getBugVersions();
    expect(result).toEqual(SAMPLE_DATA);
    expect(mockCacheSet).toHaveBeenCalledWith('bugVersionsCache', {
      lastChecked: expect.any(Number),
      data: SAMPLE_DATA,
    });
  });

  it('returns fresh cache without fetching', async () => {
    mockCacheGet.mockReturnValue({
      lastChecked: Date.now(),
      data: SAMPLE_DATA,
    });
    const result = await getBugVersions();
    expect(result).toEqual(SAMPLE_DATA);
    expect(mockHttpsGet).not.toHaveBeenCalled();
  });

  it('fetches again when cache is stale (> 6h)', async () => {
    const staleData: BugVersionsMap = { '4.0.0': ['https://stale'] };
    mockCacheGet.mockReturnValue({
      lastChecked: Date.now() - 7 * 60 * 60 * 1000, // 7 hours ago
      data: staleData,
    });
    const freshData: BugVersionsMap = { '5.0.4': ['https://fresh'] };
    setupHttpsMock(JSON.stringify(freshData));
    const result = await getBugVersions();
    expect(result).toEqual(freshData);
    expect(mockHttpsGet).toHaveBeenCalled();
  });

  it('falls back to stale cache when all fetches fail', async () => {
    const staleData: BugVersionsMap = { '5.0.4': ['https://stale'] };
    mockCacheGet.mockReturnValue({
      lastChecked: Date.now() - 7 * 60 * 60 * 1000,
      data: staleData,
    });
    mockHttpsGet.mockImplementation((_url: unknown, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter();
      setTimeout(() => req.emit('error', new Error('offline')), 5);
      return req;
    });
    const result = await getBugVersions();
    expect(result).toEqual(staleData);
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('returns null when no cache and all fetches fail', async () => {
    mockHttpsGet.mockImplementation((_url: unknown, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter();
      setTimeout(() => req.emit('error', new Error('offline')), 5);
      return req;
    });
    const result = await getBugVersions();
    expect(result).toBeNull();
  });
});
