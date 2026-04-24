import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock our store module completely
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../store.js', () => ({
  cacheStore: {
    get: (key: string) => mockCacheGet(key),
    set: (key: string, val: any) => mockCacheSet(key, val),
  }
}));

function makeFetchOk(version: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ version }),
  });
}

function makeFetchFail(status = 404) {
  return vi.fn().mockResolvedValue({ ok: false, status });
}

function makeFetchError(message = 'network error') {
  return vi.fn().mockRejectedValue(new Error(message));
}

describe('checkForUpdate', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockCacheGet.mockReset().mockReturnValue(undefined);
    mockCacheSet.mockReset();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Clear env vars that cause early return
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    process.env.CI = savedEnv.CI;
    process.env.NO_UPDATE_CHECK = savedEnv.NO_UPDATE_CHECK;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should skip when CI is set', async () => {
    process.env.CI = 'true';
    const fetchMock = makeFetchOk('2.0.0');
    vi.stubGlobal('fetch', fetchMock);
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should skip when NO_UPDATE_CHECK is set', async () => {
    process.env.NO_UPDATE_CHECK = '1';
    const fetchMock = makeFetchOk('2.0.0');
    vi.stubGlobal('fetch', fetchMock);
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should skip when __CLI_VERSION__ is not a valid semver', async () => {
    const fetchMock = makeFetchOk('2.0.0');
    vi.stubGlobal('fetch', fetchMock);
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = 'development';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should fetch and print update notice when version is outdated', async () => {
    vi.stubGlobal('fetch', makeFetchOk('2.0.0'));
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '2.0.0',
    });
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('1.0.0');
    expect(output).toContain('2.0.0');
    expect(output).toContain('npm i -g @ant-design/cli');
  });

  it('should not print notice when current version equals latest', async () => {
    vi.stubGlobal('fetch', makeFetchOk('2.0.0'));
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '2.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should not print notice when current version is newer than latest', async () => {
    vi.stubGlobal('fetch', makeFetchOk('2.0.0'));
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '3.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should use cached version when cache is fresh without fetching', async () => {
    const fetchMock = makeFetchOk('9.9.9');
    vi.stubGlobal('fetch', fetchMock);
    mockCacheGet.mockReturnValue({ lastChecked: Date.now(), latestVersion: '2.0.0' });
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(fetchMock).not.toHaveBeenCalled();
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

  it('should fetch again when cache is stale', async () => {
    const fetchMock = makeFetchOk('2.0.0');
    vi.stubGlobal('fetch', fetchMock);
    mockCacheGet.mockReturnValue({
      lastChecked: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      latestVersion: '1.5.0',
    });
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(fetchMock).toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '2.0.0',
    });
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('should not print notice when registry returns non-200', async () => {
    vi.stubGlobal('fetch', makeFetchFail(404));
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '1.0.0',
    });
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should not print notice when all fetch requests fail', async () => {
    vi.stubGlobal('fetch', makeFetchError('network error'));
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should not print notice when fetch times out (AbortError)', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should use stale cache as fallback when all fetches fail', async () => {
    vi.stubGlobal('fetch', makeFetchError('offline'));
    mockCacheGet.mockReturnValue({
      lastChecked: Date.now() - 25 * 60 * 60 * 1000,
      latestVersion: '2.0.0',
    });
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '2.0.0',
    });
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

});
