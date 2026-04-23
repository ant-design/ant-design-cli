import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock our store module completely
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../store.js', () => ({
  cacheStore: {
    get: (key: string) => mockCacheGet(key),
    set: (key: string, val: any) => mockCacheSet(key, val),
  }
}));

const mockHttpsGet = vi.fn();
vi.mock('node:https', () => ({
  get: (...args: unknown[]) => mockHttpsGet(...args),
}));

// Helper to create a fake IncomingMessage-like response
function createFakeResponse(statusCode: number, body: string): EventEmitter & { statusCode: number; resume: () => void } {
  const res = new EventEmitter() as EventEmitter & { statusCode: number; resume: () => void };
  res.statusCode = statusCode;
  res.resume = vi.fn();
  // Emit data/end async
  setTimeout(() => {
    res.emit('data', Buffer.from(body));
    res.emit('end');
  }, 5);
  return res;
}

// Helper to set up mockHttpsGet to return a successful response
function setupHttpsMock(statusCode: number, body: string) {
  mockHttpsGet.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
    const res = createFakeResponse(statusCode, body);
    cb(res);
    const req = new EventEmitter();
    return req;
  });
}

describe('checkForUpdate', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockCacheGet.mockReset().mockReturnValue(undefined);
    mockCacheSet.mockReset();
    mockHttpsGet.mockReset();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Clear env vars that cause early return
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    // Restore env
    process.env.CI = savedEnv.CI;
    process.env.NO_UPDATE_CHECK = savedEnv.NO_UPDATE_CHECK;
    vi.restoreAllMocks();
  });

  it('should skip when CI is set', async () => {
    process.env.CI = 'true';
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(mockHttpsGet).not.toHaveBeenCalled();
  });

  it('should skip when NO_UPDATE_CHECK is set', async () => {
    process.env.NO_UPDATE_CHECK = '1';
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should skip when __CLI_VERSION__ is not a valid semver', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = 'development';
    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();
    expect(mockHttpsGet).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should fetch from npm when no cache exists and print update notice', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';
    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should have updated cache with fetched version
    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '2.0.0'
    });

    // Should print update notice since 1.0.0 < 2.0.0
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('1.0.0');
    expect(output).toContain('2.0.0');
    expect(output).toContain('npm i -g @ant-design/cli');
  });

  it('should not print notice when current version equals latest', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '2.0.0';
    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should not print notice when current version is newer than latest', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '3.0.0';
    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should use cached version when cache is fresh (not stale)', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockCacheGet.mockReturnValue({
      lastChecked: Date.now(), // just now = fresh
      latestVersion: '2.0.0',
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should NOT have fetched from npm since cache is fresh
    expect(mockHttpsGet).not.toHaveBeenCalled();

    // Should print update notice from cached version
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

  it('should fetch again when cache is stale', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockCacheGet.mockReturnValue({
      lastChecked: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago = stale
      latestVersion: '1.5.0',
    });

    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should have fetched
    expect(mockHttpsGet).toHaveBeenCalled();
    // Should have updated cache
    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '2.0.0'
    });
    
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('should handle npm registry returning non-200 status', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    // Non-200 response
    mockHttpsGet.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
      const res = new EventEmitter() as EventEmitter & { statusCode: number; resume: () => void };
      res.statusCode = 404;
      res.resume = vi.fn();
      cb(res);
      const req = new EventEmitter();
      return req;
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should still write cache with currentVersion as fallback
    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '1.0.0'
    });
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle https request error', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockHttpsGet.mockImplementation((_url: string, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter();
      setTimeout(() => req.emit('error', new Error('network error')), 5);
      return req;
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle https request timeout', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockHttpsGet.mockImplementation((_url: string, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter() as EventEmitter & { destroy: () => void };
      req.destroy = vi.fn();
      setTimeout(() => req.emit('timeout'), 5);
      return req;
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should use cache latestVersion as fallback when fetch returns null', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockCacheGet.mockReturnValue({
      lastChecked: Date.now() - 25 * 60 * 60 * 1000,
      latestVersion: '2.0.0',
    });

    // Fetch fails
    mockHttpsGet.mockImplementation((_url: string, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter();
      setTimeout(() => req.emit('error', new Error('fail')), 5);
      return req;
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should fallback to cached version
    expect(mockCacheSet).toHaveBeenCalledWith('updateCache', {
      lastChecked: expect.any(Number),
      latestVersion: '2.0.0'
    });

    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

});
