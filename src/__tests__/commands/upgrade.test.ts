import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '../helper.js';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock child_process first (no hoisting issues since factory doesn't reference outer vars)
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

// Mock update-check module
vi.mock('../../utils/update-check.js', () => ({
  fetchLatestVersion: vi.fn(),
  checkForUpdate: vi.fn().mockResolvedValue(undefined),
}));

// Mock detect-pm module
vi.mock('../../utils/detect-pm.js', () => ({
  detectPackageManager: vi.fn(() => null),
  UPGRADE_COMMANDS: {
    npm: { cmd: 'npm', args: ['install', '-g', '@ant-design/cli@latest'] },
    yarn: { cmd: 'yarn', args: ['global', 'add', '@ant-design/cli@latest'] },
    pnpm: { cmd: 'pnpm', args: ['add', '-g', '@ant-design/cli@latest'] },
    bun: { cmd: 'bun', args: ['add', '-g', '@ant-design/cli@latest'] },
    cnpm: { cmd: 'cnpm', args: ['install', '-g', '@ant-design/cli@latest'] },
    utoo: { cmd: 'ut', args: ['install', '-g', '@ant-design/cli@latest'] },
  },
  inferPackageManagerFromPath: vi.fn(),
}));

// Mock version module so we can control compare() return value
vi.mock('../../data/version.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../data/version.js')>();
  return {
    ...original,
    compare: vi.fn(original.compare),
    valid: vi.fn(original.valid),
  };
});

// Import mocked modules after vi.mock
import { spawn, execFile } from 'node:child_process';
import { fetchLatestVersion } from '../../utils/update-check.js';
import { detectPackageManager } from '../../utils/detect-pm.js';
import { compare, valid } from '../../data/version.js';

const mockSpawn = vi.mocked(spawn);
const mockExecFile = vi.mocked(execFile);
const mockFetchLatestVersion = vi.mocked(fetchLatestVersion);
const mockDetectPackageManager = vi.mocked(detectPackageManager);
const mockCompare = vi.mocked(compare);
const mockValid = vi.mocked(valid);

function createMockChildProcess(exitCode: number): ChildProcess {
  const cp = new EventEmitter() as ChildProcess;
  process.nextTick(() => cp.emit('close', exitCode));
  return cp;
}

function createKilledChildProcess(signal: string | null): ChildProcess {
  const cp = new EventEmitter() as ChildProcess;
  process.nextTick(() => cp.emit('close', null, signal));
  return cp;
}

function createErrorChildProcess(error: Error): ChildProcess {
  const cp = new EventEmitter() as ChildProcess;
  process.nextTick(() => cp.emit('error', error));
  return cp;
}

describe('upgrade command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectPackageManager.mockReturnValue('npm');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Already up to date" when on latest version (text)', async () => {
    mockFetchLatestVersion.mockResolvedValue('6.4.3');
    mockDetectPackageManager.mockReturnValue('npm');

    const result = await runCLI('upgrade');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Already up to date');
  });

  it('shows "Already up to date" as JSON', async () => {
    mockFetchLatestVersion.mockResolvedValue('6.4.3');

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.currentVersion).toBe('6.4.3');
    expect(data.message).toContain('Already up to date');
  });

  it('shows "Already up to date" as markdown', async () => {
    mockFetchLatestVersion.mockResolvedValue('6.4.3');

    const result = await runCLI('upgrade', '--format', 'markdown');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Already up to date');
  });

  it('upgrades successfully via npm', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '99.0.0');
      return {} as never;
    });

    const result = await runCLI('upgrade');
    expect(result.stdout).toContain('Upgrading @ant-design/cli');
    expect(result.stdout).toContain('npm install -g');
    expect(result.stdout).toContain('Successfully upgraded to v99.0.0');
    expect(result.exitCode).toBe(0);
  });

  it('upgrades successfully via yarn (JSON format)', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('yarn');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '99.0.0');
      return {} as never;
    });

    const result = await runCLI('upgrade', '--format', 'json');
    const data = JSON.parse(result.stdout);
    expect(data.previousVersion).toBeDefined();
    expect(data.newVersion).toBe('99.0.0');
    expect(data.packageManager).toBe('yarn');
    expect(result.exitCode).toBe(0);
  });

  it('upgrades successfully via pnpm (markdown format)', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('pnpm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '99.0.0');
      return {} as never;
    });

    const result = await runCLI('upgrade', '--format', 'markdown');
    expect(result.stdout).toContain('Previous Version');
    expect(result.stdout).toContain('pnpm');
    expect(result.exitCode).toBe(0);
  });

  it('returns error when package manager not detected', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue(null);

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('PM_NOT_FOUND');
    expect(err.suggestion).toContain('npm install -g');
  });

  it('returns error when package manager not detected (text)', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue(null);

    const result = await runCLI('upgrade');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Could not detect');
  });

  it('returns error when upgrade command fails', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(1));

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UPGRADE_FAILED');
    expect(err.suggestion).toContain('npm install -g');
  });

  it('returns error when version unchanged after upgrade', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    // Verification shows same version
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '6.4.3');
      return {} as never;
    });

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('VERSION_UNCHANGED');
  });

  it('reports success when verification is inconclusive', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    // Verification fails
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: Error) => void)(new Error('not found'));
      return {} as never;
    });

    const result = await runCLI('upgrade');
    expect(result.stdout).toContain('Successfully upgraded to v99.0.0');
    expect(result.exitCode).toBe(0);
  });

  it('returns error when fetchLatestVersion fails', async () => {
    mockFetchLatestVersion.mockResolvedValue(null);

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('returns error when fetchLatestVersion throws', async () => {
    mockFetchLatestVersion.mockRejectedValue(new Error('network error'));

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('shows Chinese output with --lang zh', async () => {
    mockFetchLatestVersion.mockResolvedValue('6.4.3');

    const result = await runCLI('upgrade', '--lang', 'zh');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('已是最新版本');
  });

  it('shows Chinese upgrade success with --lang zh', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('pnpm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '99.0.0');
      return {} as never;
    });

    const result = await runCLI('upgrade', '--lang', 'zh');
    expect(result.stdout).toContain('正在升级');
    expect(result.stdout).toContain('成功升级到');
    expect(result.exitCode).toBe(0);
  });

  it('returns error when process is killed by signal', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createKilledChildProcess('SIGTERM'));

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UPGRADE_FAILED');
  });

  it('returns error when process killed with no signal', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createKilledChildProcess(null));

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UPGRADE_FAILED');
  });

  it('returns error when spawn emits error event', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createErrorChildProcess(new Error('ENOENT')));

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UPGRADE_FAILED');
  });

  it('returns error when latest version is invalid', async () => {
    mockFetchLatestVersion.mockResolvedValue('not-a-version');

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('returns upgrade failed error in text format', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(1));

    const result = await runCLI('upgrade');
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Upgrade command failed');
  });

  it('returns version unchanged error in text format', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '6.4.3');
      return {} as never;
    });

    const result = await runCLI('upgrade');
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('version is still');
  });

  it('returns network error in text format', async () => {
    mockFetchLatestVersion.mockRejectedValue(new Error('timeout'));

    const result = await runCLI('upgrade');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Failed to fetch');
  });

  it('shows already up to date in markdown with --lang zh', async () => {
    mockFetchLatestVersion.mockResolvedValue('6.4.3');

    const result = await runCLI('upgrade', '--format', 'markdown', '--lang', 'zh');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('已是最新版本');
    expect(result.stdout).toContain('当前版本');
  });

  it('reports inconclusive success in json format', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: Error) => void)(new Error('not found'));
      return {} as never;
    });

    const result = await runCLI('upgrade', '--format', 'json');
    const data = JSON.parse(result.stdout);
    expect(data.newVersion).toBe('99.0.0');
    expect(data.packageManager).toBe('npm');
    expect(result.exitCode).toBe(0);
  });

  it('reports inconclusive success in markdown format', async () => {
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: Error) => void)(new Error('not found'));
      return {} as never;
    });

    const result = await runCLI('upgrade', '--format', 'markdown');
    expect(result.stdout).toContain('99.0.0');
    expect(result.exitCode).toBe(0);
  });

  it('proceeds with upgrade when compare returns null (unparseable currentVersion)', async () => {
    // Simulate dev build where currentVersion is not valid semver
    mockCompare.mockReturnValue(null);
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '99.0.0');
      return {} as never;
    });

    const result = await runCLI('upgrade');
    // Should NOT show "Already up to date" — should proceed with upgrade
    expect(result.stdout).toContain('Upgrading @ant-design/cli');
    expect(result.exitCode).toBe(0);
  });

  it('proceeds with upgrade when compare returns null (JSON format)', async () => {
    mockCompare.mockReturnValue(null);
    mockFetchLatestVersion.mockResolvedValue('99.0.0');
    mockDetectPackageManager.mockReturnValue('npm');

    mockSpawn.mockReturnValue(createMockChildProcess(0));
    mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (err: null, stdout: string) => void)(null, '99.0.0');
      return {} as never;
    });

    const result = await runCLI('upgrade', '--format', 'json');
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.newVersion).toBe('99.0.0');
  });
});