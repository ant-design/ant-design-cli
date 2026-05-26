import { describe, it, expect } from 'vitest';
import { inferPackageManagerFromPath, UPGRADE_COMMANDS } from '../../utils/detect-pm.js';
import type { PackageManager } from '../../utils/detect-pm.js';

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