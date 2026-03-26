import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';

// Store mock implementations so tests can configure them
let mockHomedir = '/tmp/fake-home';
let mockExistsSync = vi.fn<(p: string) => boolean>(() => false);
let mockReadFileSync = vi.fn<(p: string, e: string) => string>(() => '');
let mockWriteFileSync = vi.fn();
let mockMkdirSync = vi.fn();
let mockHttpsGet = vi.fn();

vi.mock('node:os', () => ({
  homedir: () => mockHomedir,
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...(args as [string])),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...(args as [string, string])),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

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
    mockHomedir = '/tmp/fake-home';
    mockExistsSync = vi.fn(() => false);
    mockReadFileSync = vi.fn(() => '');
    mockWriteFileSync = vi.fn();
    mockMkdirSync = vi.fn();
    mockHttpsGet = vi.fn();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Clear env vars that cause early return
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // VITEST is set by vitest, but the code checks for it — we handle it per-test
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

    // No cache file
    mockExistsSync.mockReturnValue(false);

    // npm returns a newer version
    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should have written the cache (mkdirSync since dir doesn't exist, then writeFileSync)
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();

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

    mockExistsSync.mockReturnValue(false);
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

    mockExistsSync.mockReturnValue(false);
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

    const freshCache = {
      lastChecked: Date.now(), // just now = fresh
      latestVersion: '2.0.0',
    };

    // Cache file exists
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(freshCache));

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

    const staleCache = {
      lastChecked: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago = stale
      latestVersion: '1.5.0',
    };

    // existsSync: first call for cache read (true), second for cache write dir check
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('update-check.json')) return true;
      // For the cache dir check in writeCache
      return true;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(staleCache));

    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Should have fetched
    expect(mockHttpsGet).toHaveBeenCalled();
    // Should have updated cache
    expect(mockWriteFileSync).toHaveBeenCalled();
    // Should print update notice with fetched version (2.0.0)
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

  it('should handle npm registry returning non-200 status', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockReturnValue(false);

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

    // Should write cache with currentVersion as fallback since fetched is null
    expect(mockWriteFileSync).toHaveBeenCalled();
    // No update notice since fetched was null and no cache
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle npm registry returning invalid JSON', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockReturnValue(false);

    setupHttpsMock(200, 'not valid json!!!');

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // fetchLatestVersion returns null on parse error
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle npm registry response with no version field', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockReturnValue(false);

    setupHttpsMock(200, JSON.stringify({ name: '@ant-design/cli' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // json.version is undefined, so ?? null returns null
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle https request error', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockReturnValue(false);

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

    mockExistsSync.mockReturnValue(false);

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

  it('should handle readCache returning null on invalid JSON in cache file', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    // Cache file exists but has invalid JSON
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not json');

    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // readCache returns null on parse error, so it should fetch
    expect(mockHttpsGet).toHaveBeenCalled();
    // Should print update notice
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

  it('should handle writeCache error gracefully', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockReturnValue(false);
    // writeFileSync throws
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('permission denied');
    });

    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    // Should not throw even though writeCache fails
    await checkForUpdate();

    // Should still print update notice
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

  it('should handle readFileSync throwing (readCache catch branch)', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('update-check.json')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation(() => {
      throw new Error('read error');
    });

    setupHttpsMock(200, JSON.stringify({ version: '2.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // readCache returns null on error, triggers fetch
    expect(mockHttpsGet).toHaveBeenCalled();
  });

  it('should not print notice when latestVersion is not valid semver', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    const freshCache = {
      lastChecked: Date.now(),
      latestVersion: 'invalid-version',
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(freshCache));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // valid('invalid-version') returns false, so no notice
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should use cache latestVersion as fallback when fetch returns null', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    const staleCache = {
      lastChecked: Date.now() - 25 * 60 * 60 * 1000,
      latestVersion: '2.0.0',
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(staleCache));

    // Fetch fails (request error)
    mockHttpsGet.mockImplementation((_url: string, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter();
      setTimeout(() => req.emit('error', new Error('fail')), 5);
      return req;
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // writeCache should be called with the cached latestVersion as fallback
    const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(writtenData.latestVersion).toBe('2.0.0');

    // Should still print notice using cached version
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('2.0.0');
  });

  it('should writeCache with currentVersion when no cache and fetch fails', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    mockExistsSync.mockReturnValue(false);

    // Fetch fails
    mockHttpsGet.mockImplementation((_url: string, _opts: unknown, _cb: unknown) => {
      const req = new EventEmitter();
      setTimeout(() => req.emit('error', new Error('fail')), 5);
      return req;
    });

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // fetched is null, latestVersion is null, so fallback is currentVersion '1.0.0'
    const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(writtenData.latestVersion).toBe('1.0.0');

    // No notice since latestVersion === currentVersion
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should skip mkdirSync when cache dir already exists', async () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_CHECK;
    // @ts-expect-error -- global define
    globalThis.__CLI_VERSION__ = '1.0.0';

    // All existsSync calls return true (cache file exists, cache dir exists)
    mockExistsSync.mockReturnValue(true);

    // Fresh cache but we want to trigger writeCache — use stale cache
    const staleCache = {
      lastChecked: Date.now() - 25 * 60 * 60 * 1000,
      latestVersion: '1.0.0',
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(staleCache));

    setupHttpsMock(200, JSON.stringify({ version: '1.0.0' }));

    const { checkForUpdate } = await import('../update-check.js');
    await checkForUpdate();

    // Cache dir exists, so mkdirSync should NOT be called
    expect(mockMkdirSync).not.toHaveBeenCalled();
    // But writeFileSync should be called
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
