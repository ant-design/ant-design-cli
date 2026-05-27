import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inferPackageManagerFromPath, detectPackageManager, UPGRADE_COMMANDS } from '../../utils/detect-pm.js';
import type { PackageManager } from '../../utils/detect-pm.js';
import * as childProcess from 'node:child_process';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(childProcess.execFileSync);

describe('inferPackageManagerFromPath', () => {
  it('detects utoo from .utoo path', () => {
    expect(inferPackageManagerFromPath('/home/user/.utoo/global/bin/antd')).toBe('utoo');
  });

  it('detects utoo from utoo/global path', () => {
    expect(inferPackageManagerFromPath('/home/user/utoo/global/bin/antd')).toBe('utoo');
  });

  it('detects cnpm from .cnpm path', () => {
    expect(inferPackageManagerFromPath('/home/user/.cnpm/global/bin/antd')).toBe('cnpm');
  });

  it('detects cnpm from cnpm/global path', () => {
    expect(inferPackageManagerFromPath('/home/user/cnpm/global/bin/antd')).toBe('cnpm');
  });

  it('detects yarn from yarn/global path', () => {
    expect(inferPackageManagerFromPath('/home/user/.yarn/global/bin/antd')).toBe('yarn');
  });

  it('detects pnpm from .pnpm-global path', () => {
    expect(inferPackageManagerFromPath('/home/user/.pnpm-global/bin/antd')).toBe('pnpm');
  });

  it('detects pnpm from pnpm/global path', () => {
    expect(inferPackageManagerFromPath('/home/user/pnpm/global/bin/antd')).toBe('pnpm');
  });

  it('detects bun from .bun path', () => {
    expect(inferPackageManagerFromPath('/home/user/.bun/install/global/bin/antd')).toBe('bun');
  });

  it('detects bun from bun/install/global path', () => {
    expect(inferPackageManagerFromPath('/home/user/bun/install/global/bin/antd')).toBe('bun');
  });

  it('falls back to npm for nvm path', () => {
    expect(inferPackageManagerFromPath('/home/user/.nvm/versions/node/v20/bin/antd')).toBe('npm');
  });

  it('falls back to npm for default node path', () => {
    expect(inferPackageManagerFromPath('/usr/local/bin/antd')).toBe('npm');
  });

  it('falls back to npm for .npm-global path', () => {
    expect(inferPackageManagerFromPath('/home/user/.npm-global/bin/antd')).toBe('npm');
  });

  it('falls back to npm for lib/node_modules path', () => {
    expect(inferPackageManagerFromPath('/usr/lib/node_modules/@ant-design/cli/bin/antd')).toBe('npm');
  });

  it('handles Windows-style backslash paths', () => {
    expect(inferPackageManagerFromPath('C:\\Users\\user\\.yarn\\global\\bin\\antd')).toBe('yarn');
  });

  it('handles Windows-style backslash paths for pnpm', () => {
    expect(inferPackageManagerFromPath('C:\\Users\\user\\AppData\\Local\\.pnpm-global\\antd')).toBe('pnpm');
  });

  it('prioritizes utoo over npm for ambiguous path', () => {
    expect(inferPackageManagerFromPath('/home/user/.utoo/global/node_modules/.npm/bin/antd')).toBe('utoo');
  });

  it('prioritizes cnpm over npm for ambiguous path', () => {
    expect(inferPackageManagerFromPath('/home/user/.cnpm/global/node_modules/.bin/antd')).toBe('cnpm');
  });
});

describe('UPGRADE_COMMANDS', () => {
  it('has all 6 package managers', () => {
    const pms: PackageManager[] = ['npm', 'yarn', 'pnpm', 'bun', 'cnpm', 'utoo'];
    for (const pm of pms) {
      expect(UPGRADE_COMMANDS[pm]).toBeDefined();
      expect(UPGRADE_COMMANDS[pm].cmd).toBeTruthy();
      expect(UPGRADE_COMMANDS[pm].args).toContain('@ant-design/cli@latest');
    }
  });

  it('npm uses install -g', () => {
    expect(UPGRADE_COMMANDS.npm.cmd).toBe('npm');
    expect(UPGRADE_COMMANDS.npm.args).toEqual(['install', '-g', '@ant-design/cli@latest']);
  });

  it('yarn uses global add', () => {
    expect(UPGRADE_COMMANDS.yarn.cmd).toBe('yarn');
    expect(UPGRADE_COMMANDS.yarn.args).toEqual(['global', 'add', '@ant-design/cli@latest']);
  });

  it('pnpm uses add -g', () => {
    expect(UPGRADE_COMMANDS.pnpm.cmd).toBe('pnpm');
    expect(UPGRADE_COMMANDS.pnpm.args).toEqual(['add', '-g', '@ant-design/cli@latest']);
  });

  it('bun uses add -g', () => {
    expect(UPGRADE_COMMANDS.bun.cmd).toBe('bun');
    expect(UPGRADE_COMMANDS.bun.args).toEqual(['add', '-g', '@ant-design/cli@latest']);
  });

  it('cnpm uses install -g', () => {
    expect(UPGRADE_COMMANDS.cnpm.cmd).toBe('cnpm');
    expect(UPGRADE_COMMANDS.cnpm.args).toEqual(['install', '-g', '@ant-design/cli@latest']);
  });

  it('utoo uses ut install -g', () => {
    expect(UPGRADE_COMMANDS.utoo.cmd).toBe('ut');
    expect(UPGRADE_COMMANDS.utoo.args).toEqual(['install', '-g', '@ant-design/cli@latest']);
  });
});

describe('detectPackageManager', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore platform descriptor
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    vi.restoreAllMocks();
  });

  function mockPlatform(platform: string) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  it('returns npm when which returns an npm-style path (Unix)', () => {
    mockPlatform('darwin');
    mockExecFileSync.mockReturnValue('/usr/local/bin/antd\n');
    expect(detectPackageManager()).toBe('npm');
    expect(mockExecFileSync).toHaveBeenCalledWith('which', ['antd'], expect.any(Object));
  });

  it('returns yarn when which returns a yarn/global path', () => {
    mockPlatform('linux');
    mockExecFileSync.mockReturnValue('/home/user/.yarn/global/bin/antd\n');
    expect(detectPackageManager()).toBe('yarn');
  });

  it('returns pnpm when which returns a .pnpm-global path', () => {
    mockPlatform('darwin');
    mockExecFileSync.mockReturnValue('/home/user/.pnpm-global/bin/antd\n');
    expect(detectPackageManager()).toBe('pnpm');
  });

  it('returns bun when which returns a .bun path', () => {
    mockPlatform('linux');
    mockExecFileSync.mockReturnValue('/home/user/.bun/install/global/bin/antd\n');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns cnpm when which returns a .cnpm path', () => {
    mockPlatform('darwin');
    mockExecFileSync.mockReturnValue('/home/user/.cnpm/global/bin/antd\n');
    expect(detectPackageManager()).toBe('cnpm');
  });

  it('returns utoo when which returns a .utoo path', () => {
    mockPlatform('linux');
    mockExecFileSync.mockReturnValue('/home/user/.utoo/global/bin/antd\n');
    expect(detectPackageManager()).toBe('utoo');
  });

  it('uses "where" on Windows', () => {
    mockPlatform('win32');
    mockExecFileSync.mockReturnValue('C:\\Users\\user\\.yarn\\global\\bin\\antd.cmd\r\n');
    expect(detectPackageManager()).toBe('yarn');
    expect(mockExecFileSync).toHaveBeenCalledWith('where', ['antd'], expect.any(Object));
  });

  it('returns null when which/where fails (binary not in PATH)', () => {
    mockPlatform('darwin');
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(detectPackageManager()).toBe(null);
  });

  it('returns null when which/where returns empty string', () => {
    mockPlatform('darwin');
    mockExecFileSync.mockReturnValue('   \n');
    expect(detectPackageManager()).toBe(null);
  });

  it('takes the first line when which returns multiple matches', () => {
    mockPlatform('darwin');
    mockExecFileSync.mockReturnValue('/home/user/.pnpm-global/bin/antd\n/usr/local/bin/antd\n');
    expect(detectPackageManager()).toBe('pnpm');
  });
});