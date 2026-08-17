import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import stringWidth from 'string-width';
import { checkForUpdate } from '../utils/update-check.js';
import { cacheStore } from '../utils/store.js';
import * as fetchModule from '../utils/fetch.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '/home/测试/.pnpm-global/bin/antd\n'),
}));

// Replace the Conf-backed store with an in-memory shim to avoid cross-test on-disk races.
let memStore: Record<string, unknown> = {};

function mockCacheStore() {
  vi.spyOn(cacheStore, 'get').mockImplementation(((key: string) => memStore[key]) as never);
  vi.spyOn(cacheStore, 'set').mockImplementation(((key: string, value: unknown) => {
    memStore[key] = value;
  }) as never);
  vi.spyOn(cacheStore, 'delete').mockImplementation(((key: string) => {
    delete memStore[key];
  }) as never);
}

const ORIG_CI = process.env.CI;
const ORIG_NO_UPDATE = process.env.NO_UPDATE_CHECK;

function stripCI() {
  delete process.env.CI;
  delete process.env.NO_UPDATE_CHECK;
}

function restoreCI() {
  if (ORIG_CI !== undefined) process.env.CI = ORIG_CI; else delete process.env.CI;
  if (ORIG_NO_UPDATE !== undefined) process.env.NO_UPDATE_CHECK = ORIG_NO_UPDATE; else delete process.env.NO_UPDATE_CHECK;
}

describe('update-check', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    memStore = {};
    mockCacheStore();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreCI();
  });

  it('skips in CI', async () => {
    process.env.CI = '1';
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue({ version: '99.0.0' });
    await checkForUpdate();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('skips when NO_UPDATE_CHECK is set', async () => {
    stripCI();
    process.env.NO_UPDATE_CHECK = '1';
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue({ version: '99.0.0' });
    await checkForUpdate();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('prints notice when a newer version is fetched', async () => {
    stripCI();
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue({ version: '99.0.0' });
    await checkForUpdate();
    expect(fetchSpy).toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(calls).toContain('Update available');
    expect(calls).toContain('99.0.0');
    fetchSpy.mockRestore();
  });

  it('shows the active CLI path and matching install command in the update notice', async () => {
    stripCI();
    vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue({ version: '99.0.0' });

    await checkForUpdate();

    const notice = stderrSpy.mock.calls.map((call) => String(call[0])).join('');
    expect(notice).toContain('Running: /home/测试/.pnpm-global/bin/antd');
    expect(notice).toContain('pnpm add -g @ant-design/cli@latest');
    const boxLines = notice.trim().split('\n');
    expect(new Set(boxLines.map((boxLine) => stringWidth(boxLine))).size).toBe(1);
  });

  it('does not print notice when fetched version is older or equal', async () => {
    stripCI();
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue({ version: '0.0.1' });
    await checkForUpdate();
    expect(fetchSpy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('handles null fetch result gracefully (no crash, no notice)', async () => {
    stripCI();
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue(null);
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('uses cache when it is fresh and prints notice for cached newer version', async () => {
    stripCI();
    cacheStore.set('updateCache', {
      lastChecked: Date.now(),
      latestVersion: '99.0.0',
    });
    // Mock fetch to a no-op so even if cache path falls through we don't print twice
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue(null);
    await checkForUpdate();
    // Still prints because cached version is newer than current
    expect(stderrSpy).toHaveBeenCalled();
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(calls).toContain('99.0.0');
    fetchSpy.mockRestore();
  });

  it('refetches when cache is stale', async () => {
    stripCI();
    cacheStore.set('updateCache', {
      lastChecked: Date.now() - 48 * 60 * 60 * 1000,
      latestVersion: '0.0.1',
    });
    const fetchSpy = vi.spyOn(fetchModule, 'fetchFirstJson').mockResolvedValue({ version: '99.0.0' });
    await checkForUpdate();
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
