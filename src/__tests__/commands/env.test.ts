import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  collectEnvinfo,
  collectDependencies,
  scanEcosystem,
  collectBuildTools,
  formatText,
  formatMarkdown,
  type EnvResult,
  type EnvinfoData,
} from '../../commands/env.js';

// Mock envinfo module
vi.mock('envinfo', () => ({
  default: {
    run: vi.fn(async () => JSON.stringify({
      System: {
        OS: 'macOS 15.3',
        CPU: '(10) arm64 Apple M1 Pro',
        Memory: '500 MB / 16 GB',
        Shell: { version: '5.9', path: '/bin/zsh' },
      },
      Binaries: {
        Node: { version: '20.11.0', path: '/usr/local/bin/node' },
        npm: { version: '10.2.0', path: '/usr/local/bin/npm' },
      },
      Browsers: {
        Chrome: '131.0.6778.86',
        Firefox: null,
        Safari: { version: '18.0' },
      },
    })),
  },
}));

// Mock child_process.execFileSync
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => 'https://registry.npmjs.org/\n'),
}));

describe('collectEnvinfo', () => {
  let envinfoResult: EnvinfoData;

  beforeAll(async () => {
    envinfoResult = await collectEnvinfo('/tmp/test-cwd');
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('returns an object with System category', () => {
    expect(envinfoResult).toHaveProperty('System');
    expect(typeof envinfoResult.System).toBe('object');
  });

  it('returns Binaries with Node version', () => {
    expect(envinfoResult).toHaveProperty('Binaries');
    expect(envinfoResult.Binaries).toHaveProperty('Node');
    // Node is an object with version property
    expect((envinfoResult.Binaries.Node as { version: string }).version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('detects at least one browser on macOS', () => {
    expect(envinfoResult).toHaveProperty('Browsers');
    const browsers = envinfoResult.Browsers || {};
    expect(Object.keys(browsers).length).toBeGreaterThan(0);
  });

  it('preserves object structure for Shell', () => {
    expect(envinfoResult.System.Shell).toHaveProperty('version');
    expect(envinfoResult.System.Shell).toHaveProperty('path');
  });

  it('adds Registry to Binaries', () => {
    expect(envinfoResult.Binaries).toHaveProperty('Registry');
    expect(envinfoResult.Binaries.Registry).toBe('https://registry.npmjs.org/');
  });
});

describe('collectDependencies', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'antd-env-deps-'));
    mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ name: 'antd', version: '5.22.0' }));
    mkdirSync(join(tempDir, 'node_modules', 'react'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'react', 'package.json'), JSON.stringify({ name: 'react', version: '18.3.1' }));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads installed versions', () => {
    const result = collectDependencies(tempDir);
    expect(result.antd).toBe('5.22.0');
    expect(result.react).toBe('18.3.1');
  });

  it('returns null for missing packages', () => {
    const result = collectDependencies(tempDir);
    expect(result.dayjs).toBeNull();
    expect(result['@ant-design/cssinjs']).toBeNull();
  });
});

describe('scanEcosystem', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'antd-env-eco-'));
    // @ant-design scoped packages
    mkdirSync(join(tempDir, 'node_modules', '@ant-design', 'pro-components'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', '@ant-design', 'pro-components', 'package.json'), JSON.stringify({ name: '@ant-design/pro-components', version: '2.8.1' }));
    // Core dep — should be excluded
    mkdirSync(join(tempDir, 'node_modules', '@ant-design', 'cssinjs'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', '@ant-design', 'cssinjs', 'package.json'), JSON.stringify({ name: '@ant-design/cssinjs', version: '1.22.1' }));
    mkdirSync(join(tempDir, 'node_modules', '@ant-design', 'icons'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', '@ant-design', 'icons', 'package.json'), JSON.stringify({ name: '@ant-design/icons', version: '5.5.2' }));
    // rc-* packages
    mkdirSync(join(tempDir, 'node_modules', 'rc-field-form'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'rc-field-form', 'package.json'), JSON.stringify({ name: 'rc-field-form', version: '2.7.0' }));
    mkdirSync(join(tempDir, 'node_modules', 'rc-table'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'rc-table', 'package.json'), JSON.stringify({ name: 'rc-table', version: '7.49.0' }));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans @ant-design/* packages excluding core deps', () => {
    const result = scanEcosystem(tempDir);
    expect(result['@ant-design/pro-components']).toBe('2.8.1');
    expect(result['@ant-design/cssinjs']).toBeUndefined();
    expect(result['@ant-design/icons']).toBeUndefined();
  });

  it('scans rc-* packages', () => {
    const result = scanEcosystem(tempDir);
    expect(result['rc-field-form']).toBe('2.7.0');
    expect(result['rc-table']).toBe('7.49.0');
  });

  it('returns empty for non-existent directory', () => {
    const result = scanEcosystem('/tmp/non-existent-dir-xyz');
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('collectBuildTools', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'antd-env-build-'));
    mkdirSync(join(tempDir, 'node_modules', 'typescript'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'typescript', 'package.json'), JSON.stringify({ name: 'typescript', version: '5.6.3' }));
    mkdirSync(join(tempDir, 'node_modules', 'vite'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'vite', 'package.json'), JSON.stringify({ name: 'vite', version: '6.0.0' }));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects installed build tools', () => {
    const result = collectBuildTools(tempDir);
    expect(result.typescript).toBe('5.6.3');
    expect(result.vite).toBe('6.0.0');
  });

  it('omits uninstalled tools', () => {
    const result = collectBuildTools(tempDir);
    expect(result.webpack).toBeUndefined();
    expect(result.umi).toBeUndefined();
  });
});

describe('formatText', () => {
  const data: EnvResult = {
    envinfo: {
      System: { OS: 'macOS 15.3', CPU: '(10) arm64 Apple M1 Pro', Memory: '500 MB / 16 GB', Shell: { version: '5.9', path: '/bin/zsh' } },
      Binaries: { Node: { version: '20.11.0', path: '/usr/local/bin/node' }, pnpm: '9.1.0', Registry: 'https://registry.npmjs.org/' },
      Browsers: { Chrome: '131.0.6778.86', Firefox: null },
    },
    dependencies: { antd: '5.22.0', react: '18.3.1', 'react-dom': '18.3.1', dayjs: null, '@ant-design/cssinjs': null, '@ant-design/icons': null },
    ecosystem: { '@ant-design/pro-components': '2.8.1' },
    buildTools: { typescript: '5.6.3' },
  };

  it('starts with Environment header', () => {
    const text = formatText(data);
    expect(text).toMatch(/^Environment/);
  });

  it('contains System and Binaries sections', () => {
    const text = formatText(data);
    expect(text).toContain('System:');
    expect(text).toContain('Binaries:');
  });

  it('contains antd-specific sections', () => {
    const text = formatText(data);
    expect(text).toContain('Dependencies:');
    expect(text).toContain('Ecosystem:');
    expect(text).toContain('Build Tools:');
  });

  it('shows Not found for null deps', () => {
    const text = formatText(data);
    expect(text).toContain('Not found');
  });

  it('hides null values in envinfo sections', () => {
    const text = formatText(data);
    expect(text).toContain('Chrome');
    expect(text).not.toContain('Firefox');
  });

  it('extracts version from object values', () => {
    const text = formatText(data);
    expect(text).toContain('5.9'); // Shell version
    expect(text).toContain('20.11.0'); // Node version
  });

  it('skips empty sections', () => {
    const empty: EnvResult = {
      envinfo: {
        System: { OS: 'test' },
        Binaries: { Node: '20.0.0' },
      },
      dependencies: { antd: null, react: null, 'react-dom': null, dayjs: null, '@ant-design/cssinjs': null, '@ant-design/icons': null },
      ecosystem: {},
      buildTools: {},
    };
    const text = formatText(empty);
    expect(text).not.toContain('Ecosystem:');
    expect(text).not.toContain('Build Tools:');
  });
});

describe('formatMarkdown', () => {
  const data: EnvResult = {
    envinfo: {
      System: { OS: 'macOS 15.3' },
      Binaries: { Node: { version: '20.11.0', path: '/usr/local/bin/node' } },
      Browsers: { Chrome: '131.0.6778.86' },
    },
    dependencies: { antd: '5.22.0', react: null, 'react-dom': null, dayjs: null, '@ant-design/cssinjs': null, '@ant-design/icons': null },
    ecosystem: { '@ant-design/pro-components': '2.8.1' },
    buildTools: { typescript: '5.6.3' },
  };

  it('starts with ## Environment', () => {
    const md = formatMarkdown(data);
    expect(md).toMatch(/^## Environment/);
  });

  it('contains markdown tables', () => {
    const md = formatMarkdown(data);
    expect(md).toContain('| Item | Version |');
    expect(md).toContain('| Package | Version |');
  });

  it('contains section headers', () => {
    const md = formatMarkdown(data);
    expect(md).toContain('### System');
    expect(md).toContain('### Binaries');
    expect(md).toContain('### Dependencies');
  });

  it('shows Not found for null values', () => {
    const md = formatMarkdown(data);
    expect(md).toContain('Not found');
  });
});