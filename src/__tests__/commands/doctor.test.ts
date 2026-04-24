import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerDoctorCommand } from '../../commands/doctor.js';

// Mock getBugVersions so doctor tests don't make real network requests.
// findBugInfo is kept real so compound range matching is exercised.
const mockGetBugVersions = vi.fn<() => Promise<Record<string, string[]> | null>>();
vi.mock('../../utils/bug-versions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/bug-versions.js')>();
  return { ...actual, getBugVersions: () => mockGetBugVersions() };
});

function makeTmpDir(): string {
  const dir = join(tmpdir(), `doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writePkg(dir: string, pkg: Record<string, any>): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
}

function setupProject(
  tmpDir: string,
  opts: {
    antdVersion?: string;
    antdPeerDeps?: Record<string, string>;
    reactVersion?: string;
    cssinjsVersion?: string;
    iconsVersion?: string;
    projectPkg?: Record<string, any>;
    babelrc?: string;
    babelConfigJson?: string;
    lessTheme?: boolean;
    duplicateAntd?: { parentPkg: string; version: string }[];
    duplicateDayjs?: { parentPkg: string; version: string }[];
    duplicateCssinjs?: { parentPkg: string; version: string }[];
    dayjsVersion?: string;
    ecosystemPackages?: Array<{
      name: string;
      version: string;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    }>;
  } = {},
): void {
  const nm = join(tmpDir, 'node_modules');
  mkdirSync(nm, { recursive: true });

  // Project package.json
  if (opts.projectPkg) {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(opts.projectPkg));
  }

  // antd
  if (opts.antdVersion) {
    const antdPkg: Record<string, any> = { name: 'antd', version: opts.antdVersion };
    if (opts.antdPeerDeps) antdPkg.peerDependencies = opts.antdPeerDeps;
    writePkg(join(nm, 'antd'), antdPkg);
  }

  // react
  if (opts.reactVersion) {
    writePkg(join(nm, 'react'), { name: 'react', version: opts.reactVersion });
  }

  // @ant-design/cssinjs
  if (opts.cssinjsVersion) {
    writePkg(join(nm, '@ant-design', 'cssinjs'), { name: '@ant-design/cssinjs', version: opts.cssinjsVersion });
  }

  // @ant-design/icons
  if (opts.iconsVersion) {
    writePkg(join(nm, '@ant-design', 'icons'), { name: '@ant-design/icons', version: opts.iconsVersion });
  }

  // dayjs at top level
  if (opts.dayjsVersion) {
    writePkg(join(nm, 'dayjs'), { name: 'dayjs', version: opts.dayjsVersion });
  }

  // Duplicate antd in nested node_modules
  if (opts.duplicateAntd) {
    for (const dup of opts.duplicateAntd) {
      const nestedDir = join(nm, dup.parentPkg, 'node_modules', 'antd');
      writePkg(nestedDir, { name: 'antd', version: dup.version });
      // Also ensure the parent package dir exists
      writePkg(join(nm, dup.parentPkg), { name: dup.parentPkg, version: '1.0.0' });
    }
  }

  // Duplicate dayjs in nested node_modules
  if (opts.duplicateDayjs) {
    for (const dup of opts.duplicateDayjs) {
      const nestedDir = join(nm, dup.parentPkg, 'node_modules', 'dayjs');
      writePkg(nestedDir, { name: 'dayjs', version: dup.version });
      // Ensure parent exists
      if (!opts.duplicateAntd?.some((d) => d.parentPkg === dup.parentPkg)) {
        writePkg(join(nm, dup.parentPkg), { name: dup.parentPkg, version: '1.0.0' });
      }
    }
  }

  // Duplicate cssinjs in nested node_modules
  if (opts.duplicateCssinjs) {
    for (const dup of opts.duplicateCssinjs) {
      const nestedDir = join(nm, dup.parentPkg, 'node_modules', '@ant-design', 'cssinjs');
      writePkg(nestedDir, { name: '@ant-design/cssinjs', version: dup.version });
      if (!opts.duplicateAntd?.some((d) => d.parentPkg === dup.parentPkg)) {
        writePkg(join(nm, dup.parentPkg), { name: dup.parentPkg, version: '1.0.0' });
      }
    }
  }

  // Babel config files
  if (opts.babelrc) {
    writeFileSync(join(tmpDir, '.babelrc'), opts.babelrc);
  }
  if (opts.babelConfigJson) {
    writeFileSync(join(tmpDir, 'babel.config.json'), opts.babelConfigJson);
  }

  // Less theme file
  if (opts.lessTheme) {
    mkdirSync(join(tmpDir, 'theme'), { recursive: true });
    writeFileSync(join(tmpDir, 'theme', 'antd.less'), JSON.stringify({ '@primary-color': '#1890ff' }));
  }

  // Ecosystem packages under @ant-design scope
  if (opts.ecosystemPackages) {
    for (const eco of opts.ecosystemPackages) {
      const shortName = eco.name.replace('@ant-design/', '');
      const pkgData: Record<string, any> = { name: eco.name, version: eco.version };
      if (eco.peerDependencies) pkgData.peerDependencies = eco.peerDependencies;
      if (eco.peerDependenciesMeta) pkgData.peerDependenciesMeta = eco.peerDependenciesMeta;
      writePkg(join(nm, '@ant-design', shortName), pkgData);
    }
  }
}

async function runDoctor(tmpDir: string, format: string = 'text'): Promise<string[]> {
  const program = new Command();
  program.option('--format <format>', '', format);
  program.option('--lang <lang>', '', 'en');
  program.option('--version <version>', '');
  registerDoctorCommand(program);

  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  try {
    await program.parseAsync(['doctor'], { from: 'user' });
    return logSpy.mock.calls.map((args) => args.map(String).join(' '));
  } finally {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
  }
}

async function runDoctorJson(tmpDir: string): Promise<{ checks: any[]; summary: any }> {
  const lines = await runDoctor(tmpDir, 'json');
  // JSON output is a single console.log call
  return JSON.parse(lines[0]);
}

describe('doctor command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    // Default: network unavailable — no bug-version check so existing tests are unaffected
    mockGetBugVersions.mockResolvedValue(null);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('antd-installed check', () => {
    it('should fail when antd is not installed', async () => {
      setupProject(tmpDir, { reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('not installed');
      expect(check.suggestion).toContain('npm install antd');
    });

    it('should pass when antd is installed and has no known bugs', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('5.12.0');
    });

    it('should fail when installed antd version has known bugs', async () => {
      setupProject(tmpDir, { antdVersion: '5.0.4', reactVersion: '18.2.0' });
      mockGetBugVersions.mockResolvedValue({
        '5.0.4': ['https://github.com/ant-design/ant-design/issues/39284'],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(check.status).toBe('fail');
      expect(check.severity).toBe('error');
      expect(check.message).toContain('5.0.4');
      expect(check.message).toContain('known');
      expect(check.suggestion).toContain('https://github.com/ant-design/ant-design/issues/39284');
    });

    it('should include the affected range when version matches a compound range', async () => {
      setupProject(tmpDir, { antdVersion: '5.2.5', reactVersion: '18.2.0' });
      mockGetBugVersions.mockResolvedValue({
        '>= 5.2.3 <= 5.3.0': ['https://github.com/ant-design/ant-design/pull/40719'],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('>= 5.2.3 <= 5.3.0');
    });

    it('should pass when installed version is not in the bug list', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      mockGetBugVersions.mockResolvedValue({
        '5.0.4': ['https://github.com/ant-design/ant-design/issues/39284'],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(check.status).toBe('pass');
    });

    it('should pass when bug version data is unavailable (network failure)', async () => {
      setupProject(tmpDir, { antdVersion: '5.0.4', reactVersion: '18.2.0' });
      mockGetBugVersions.mockResolvedValue(null);
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('5.0.4');
    });
  });

  describe('react-compat check', () => {
    it('should pass when React 18 is used with antd v5', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'react-compat');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('compatible');
    });

    it('should fail when React <18 is used with antd v5', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '17.0.2' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'react-compat');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('may not be compatible');
      expect(check.suggestion).toContain('React 18+');
    });

    it('should warn when react is not installed', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'react-compat');
      expect(check.status).toBe('warn');
    });

    it('should warn when antd is not installed', async () => {
      setupProject(tmpDir, { reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'react-compat');
      expect(check.status).toBe('warn');
    });

    it('should pass when React 16 is used with antd v4', async () => {
      setupProject(tmpDir, { antdVersion: '4.24.0', reactVersion: '16.14.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'react-compat');
      expect(check.status).toBe('pass');
    });
  });

  describe('duplicate-install check', () => {
    it('should pass when only one antd installation exists', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'duplicate-install');
      expect(check.status).toBe('pass');
    });

    it('should fail when multiple antd installations exist', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        duplicateAntd: [{ parentPkg: 'some-lib', version: '4.24.0' }],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'duplicate-install');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('2 antd installations');
      expect(check.suggestion).toContain('npm dedupe');
    });
  });

  describe('dayjs-duplicate check', () => {
    it('should pass with no duplicate dayjs', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0', dayjsVersion: '1.11.10' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'dayjs-duplicate');
      expect(check.status).toBe('pass');
    });

    it('should fail with duplicate dayjs installations', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        dayjsVersion: '1.11.10',
        duplicateDayjs: [{ parentPkg: 'some-lib', version: '1.10.0' }],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'dayjs-duplicate');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('2 dayjs installations');
    });
  });

  describe('cssinjs-duplicate check', () => {
    it('should pass with no duplicate cssinjs', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0', cssinjsVersion: '1.20.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs-duplicate');
      expect(check.status).toBe('pass');
    });

    it('should fail with duplicate cssinjs installations', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        cssinjsVersion: '1.20.0',
        duplicateCssinjs: [{ parentPkg: 'some-lib', version: '1.15.0' }],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs-duplicate');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('2 @ant-design/cssinjs installations');
    });
  });

  describe('cssinjs-compat check', () => {
    it('should pass when no cssinjs peer dependency is required', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs-compat');
      expect(check.status).toBe('pass');
    });

    it('should warn when cssinjs is required but not installed', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        antdPeerDeps: { '@ant-design/cssinjs': '>=1.18.0' },
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs-compat');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('not installed');
    });

    it('should fail when cssinjs version does not satisfy range', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        antdPeerDeps: { '@ant-design/cssinjs': '>=1.18.0' },
        cssinjsVersion: '1.10.0',
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs-compat');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('not compatible');
    });

    it('should pass when cssinjs version satisfies range', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        antdPeerDeps: { '@ant-design/cssinjs': '>=1.18.0' },
        cssinjsVersion: '1.20.0',
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs-compat');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('compatible');
    });
  });

  describe('icons-compat check', () => {
    it('should pass when no icons peer dependency declared', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'icons-compat');
      expect(check.status).toBe('pass');
    });

    it('should pass when icons is not installed (optional)', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        antdPeerDeps: { '@ant-design/icons': '>=5.0.0' },
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'icons-compat');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('not installed');
    });

    it('should warn when icons version does not satisfy range', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        antdPeerDeps: { '@ant-design/icons': '>=5.0.0' },
        iconsVersion: '4.8.0',
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'icons-compat');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('may not be compatible');
    });

    it('should pass when icons version satisfies range', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        antdPeerDeps: { '@ant-design/icons': '>=5.0.0' },
        iconsVersion: '5.3.0',
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'icons-compat');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('compatible');
    });
  });

  describe('theme-config check', () => {
    it('should pass with no theme issues in v5', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'theme-config');
      expect(check.status).toBe('pass');
    });

    it('should warn when Less theme file exists in v5 project', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0', lessTheme: true });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'theme-config');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('Less-based theme');
      expect(check.suggestion).toContain('theme tokens');
    });

    it('should warn when project package.json has theme field in v5', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        projectPkg: { name: 'my-app', theme: { '@primary-color': '#1890ff' } },
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'theme-config');
      expect(check.status).toBe('warn');
    });

    it('should pass with Less theme in v4 project', async () => {
      setupProject(tmpDir, { antdVersion: '4.24.0', reactVersion: '16.14.0', lessTheme: true });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'theme-config');
      expect(check.status).toBe('pass');
    });
  });

  describe('babel-plugin check', () => {
    it('should pass when no babel-plugin-import is configured', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'babel-plugin');
      expect(check.status).toBe('pass');
    });

    it('should warn when .babelrc has babel-plugin-import with antd v5', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        babelrc: JSON.stringify({
          plugins: [['babel-plugin-import', { libraryName: 'antd' }]],
        }),
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'babel-plugin');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('babel-plugin-import');
      expect(check.suggestion).toContain('tree-shaking');
    });

    it('should warn when babel.config.json has babel-plugin-import with antd v5', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        babelConfigJson: JSON.stringify({
          plugins: [['babel-plugin-import', { libraryName: 'antd' }]],
        }),
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'babel-plugin');
      expect(check.status).toBe('warn');
    });

    it('should warn when package.json babel config has babel-plugin-import with v5', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        projectPkg: {
          name: 'my-app',
          babel: { plugins: [['babel-plugin-import', { libraryName: 'antd' }]] },
        },
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'babel-plugin');
      expect(check.status).toBe('warn');
    });

    it('should pass when babel-plugin-import is used with antd v4', async () => {
      setupProject(tmpDir, {
        antdVersion: '4.24.0',
        reactVersion: '16.14.0',
        babelrc: JSON.stringify({
          plugins: [['babel-plugin-import', { libraryName: 'antd' }]],
        }),
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'babel-plugin');
      expect(check.status).toBe('pass');
    });
  });

  describe('cssinjs check', () => {
    it('should warn when cssinjs is not installed', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('SSR');
    });

    it('should pass when cssinjs is installed', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0', cssinjsVersion: '1.20.0' });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'cssinjs');
      expect(check.status).toBe('pass');
    });
  });

  describe('ecosystem-compat checks', () => {
    it('should pass when ecosystem package peer deps are satisfied', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        ecosystemPackages: [
          {
            name: '@ant-design/pro-components',
            version: '2.6.0',
            peerDependencies: { antd: '>=5.0.0', react: '>=18.0.0' },
          },
        ],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
      expect(check.status).toBe('pass');
      expect(check.message).toContain('satisfies all peerDependencies');
    });

    it('should fail when ecosystem package peer dep version mismatch', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        ecosystemPackages: [
          {
            name: '@ant-design/pro-components',
            version: '2.6.0',
            peerDependencies: { antd: '>=6.0.0', react: '>=18.0.0' },
          },
        ],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('peerDep issues');
      expect(check.message).toContain('antd');
    });

    it('should warn when ecosystem package peer dep is not installed', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        ecosystemPackages: [
          {
            name: '@ant-design/pro-layout',
            version: '7.0.0',
            peerDependencies: { 'some-missing-pkg': '>=1.0.0' },
          },
        ],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'ecosystem-compat:pro-layout');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('not installed');
    });

    it('should fail with both missing and incompatible peer deps', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        ecosystemPackages: [
          {
            name: '@ant-design/pro-table',
            version: '3.0.0',
            peerDependencies: {
              antd: '>=6.0.0',        // installed but wrong version
              'missing-dep': '>=1.0.0', // not installed
            },
          },
        ],
      });
      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'ecosystem-compat:pro-table');
      // failures take priority over warnings, so status is 'fail'
      expect(check.status).toBe('fail');
      expect(check.message).toContain('antd');
      expect(check.message).toContain('missing-dep');
    });

    it('should skip ecosystem packages with no peerDependencies', async () => {
      // Package with no peerDeps is not included in the ecosystem scan
      const nm = join(tmpDir, 'node_modules');
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      // Write a package with no peerDependencies
      writePkg(join(nm, '@ant-design', 'colors'), { name: '@ant-design/colors', version: '7.0.0' });

      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'ecosystem-compat:colors');
      expect(check).toBeUndefined();
    });

    it('should skip dot-prefixed entries in @ant-design scope', async () => {
      const nm = join(tmpDir, 'node_modules');
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      mkdirSync(join(nm, '@ant-design', '.cache'), { recursive: true });
      writeFileSync(join(nm, '@ant-design', '.cache', 'package.json'), JSON.stringify({
        name: '.cache', version: '1.0.0', peerDependencies: { antd: '>=99.0.0' },
      }));

      const result = await runDoctorJson(tmpDir);
      const check = result.checks.find((c: any) => c.name === 'ecosystem-compat:.cache');
      expect(check).toBeUndefined();
    });
  });

  describe('output format', () => {
    it('should produce valid JSON output with checks and summary', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0', cssinjsVersion: '1.20.0' });
      const result = await runDoctorJson(tmpDir);
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.summary).toHaveProperty('pass');
      expect(result.summary).toHaveProperty('warn');
      expect(result.summary).toHaveProperty('fail');
      expect(typeof result.summary.pass).toBe('number');
      expect(typeof result.summary.warn).toBe('number');
      expect(typeof result.summary.fail).toBe('number');
    });

    it('should include all 10 base checks in JSON output', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0', cssinjsVersion: '1.20.0' });
      const result = await runDoctorJson(tmpDir);
      const checkNames = result.checks.map((c: any) => c.name);
      expect(checkNames).toContain('antd-installed');
      expect(checkNames).toContain('react-compat');
      expect(checkNames).toContain('duplicate-install');
      expect(checkNames).toContain('dayjs-duplicate');
      expect(checkNames).toContain('cssinjs-duplicate');
      expect(checkNames).toContain('cssinjs-compat');
      expect(checkNames).toContain('icons-compat');
      expect(checkNames).toContain('theme-config');
      expect(checkNames).toContain('babel-plugin');
      expect(checkNames).toContain('cssinjs');
    });

    it('should include check icons in text output', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' });
      const lines = await runDoctor(tmpDir, 'text');
      const allText = lines.join('\n');
      expect(allText).toContain('antd Doctor');
      // Should have pass icon for antd-installed
      expect(allText).toMatch(/✓.*antd-installed/);
      // Summary line: may have "1 error" or "2 errors", "1 warning" or "2 warnings", "N passed"
      expect(allText).toMatch(/^Summary: /m);
      expect(allText).toMatch(/\d+ passed/);
    });

    it('should show fail icon for failing checks in text output', async () => {
      setupProject(tmpDir, { reactVersion: '18.2.0' }); // no antd
      const lines = await runDoctor(tmpDir, 'text');
      const allText = lines.join('\n');
      expect(allText).toMatch(/✗.*antd-installed/);
    });

    it('should show warn icon for warning checks in text output', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '18.2.0' }); // no cssinjs
      const lines = await runDoctor(tmpDir, 'text');
      const allText = lines.join('\n');
      expect(allText).toMatch(/⚠.*cssinjs/);
    });

    it('should show suggestions in text output', async () => {
      setupProject(tmpDir, { reactVersion: '18.2.0' }); // no antd
      const lines = await runDoctor(tmpDir, 'text');
      const allText = lines.join('\n');
      expect(allText).toContain('npm install antd');
    });

    it('should render multi-line suggestions with continuation indent', async () => {
      setupProject(tmpDir, { antdVersion: '5.0.4', reactVersion: '18.2.0' });
      mockGetBugVersions.mockResolvedValue({
        '5.0.4': [
          'https://github.com/ant-design/ant-design/issues/39284',
          'https://github.com/ant-design/ant-design/issues/39285',
        ],
      });
      const lines = await runDoctor(tmpDir, 'text');
      const allText = lines.join('\n');
      // First line of suggestion rendered with → prefix
      expect(allText).toMatch(/→ Related issues:/);
      // Continuation lines rendered with plain indent (no →)
      expect(allText).toMatch(/  · https:\/\/github\.com\/ant-design\/ant-design\/issues\/39284/);
      expect(allText).toMatch(/  · https:\/\/github\.com\/ant-design\/ant-design\/issues\/39285/);
    });

    it('should produce correct summary counts', async () => {
      setupProject(tmpDir, { antdVersion: '5.12.0', reactVersion: '17.0.2' }); // react fail, cssinjs warn
      const result = await runDoctorJson(tmpDir);
      expect(result.summary.fail).toBeGreaterThanOrEqual(1);
      expect(result.summary.warn).toBeGreaterThanOrEqual(1);
      expect(result.summary.pass + result.summary.warn + result.summary.fail).toBe(result.checks.length);
    });
  });

  describe('empty project (no node_modules)', () => {
    it('should handle project with no node_modules gracefully', async () => {
      // tmpDir with nothing in it
      const result = await runDoctorJson(tmpDir);
      expect(result.checks).toBeDefined();
      expect(result.checks.length).toBeGreaterThanOrEqual(10);
      const antdCheck = result.checks.find((c: any) => c.name === 'antd-installed');
      expect(antdCheck.status).toBe('fail');
    });
  });

  describe('healthy v5 project', () => {
    it('should have all checks pass for a properly configured v5 project', async () => {
      setupProject(tmpDir, {
        antdVersion: '5.12.0',
        reactVersion: '18.2.0',
        cssinjsVersion: '1.20.0',
        iconsVersion: '5.3.0',
        dayjsVersion: '1.11.10',
        antdPeerDeps: {
          '@ant-design/cssinjs': '>=1.18.0',
          '@ant-design/icons': '>=5.0.0',
        },
      });
      const result = await runDoctorJson(tmpDir);
      expect(result.summary.fail).toBe(0);
      expect(result.summary.warn).toBe(0);
      expect(result.summary.pass).toBe(result.checks.length);
    });
  });


});
