import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { valid, compare, satisfies } from '../version.js';

// We need to test detectVersion with mocked fs, so we use vi.mock + dynamic import
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
  };
});

import { existsSync, readFileSync } from 'node:fs';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

describe('detectVersion', () => {
  let origCwd: typeof process.cwd;

  beforeEach(() => {
    origCwd = process.cwd;
    // Reset mocks to call through by default
    mockedExistsSync.mockReset();
    mockedReadFileSync.mockReset();
  });

  afterEach(() => {
    process.cwd = origCwd;
    vi.resetModules();
  });

  async function freshDetectVersion(flag?: string) {
    // Re-import to get fresh module with our mocks
    const mod = await import('../version.js');
    return mod.detectVersion(flag);
  }

  it('should use flag version when provided', async () => {
    const { detectVersion } = await import('../version.js');
    const info = detectVersion('5.20.0');
    expect(info.version).toBe('5.20.0');
    expect(info.majorVersion).toBe('v5');
    expect(info.source).toBe('flag');
  });

  it('should map v4 correctly', async () => {
    const { detectVersion } = await import('../version.js');
    const info = detectVersion('4.24.0');
    expect(info.majorVersion).toBe('v4');
  });

  it('should map v3 correctly', async () => {
    const { detectVersion } = await import('../version.js');
    const info = detectVersion('3.26.20');
    expect(info.version).toBe('3.26.20');
    expect(info.majorVersion).toBe('v3');
    expect(info.source).toBe('flag');
  });

  it('should map v3.x to v3', async () => {
    const { detectVersion } = await import('../version.js');
    const info = detectVersion('3.0.0');
    expect(info.majorVersion).toBe('v3');
  });

  it('should fallback when no flag', async () => {
    const { detectVersion } = await import('../version.js');
    const info = detectVersion(undefined);
    expect(info.source).not.toBe('flag');
    expect(info.version).toBeTruthy();
    expect(info.majorVersion).toMatch(/^v\d+$/);
  });

  it('should detect version from node_modules/antd/package.json', async () => {
    process.cwd = () => '/fake/project';
    mockedExistsSync.mockImplementation((p: any) => {
      if (String(p) === '/fake/project/node_modules/antd/package.json') return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((p: any, _opts?: any) => {
      if (String(p) === '/fake/project/node_modules/antd/package.json') {
        return JSON.stringify({ version: '4.24.0' });
      }
      throw new Error('not found');
    });

    const info = await freshDetectVersion(undefined);
    expect(info.version).toBe('4.24.0');
    expect(info.majorVersion).toBe('v4');
    expect(info.source).toBe('node_modules');
  });

  it('should detect v3 version from node_modules/antd/package.json', async () => {
    process.cwd = () => '/fake/project-v3';
    mockedExistsSync.mockImplementation((p: any) => {
      if (String(p) === '/fake/project-v3/node_modules/antd/package.json') return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((p: any, _opts?: any) => {
      if (String(p) === '/fake/project-v3/node_modules/antd/package.json') {
        return JSON.stringify({ version: '3.26.20' });
      }
      throw new Error('not found');
    });

    const info = await freshDetectVersion(undefined);
    expect(info.version).toBe('3.26.20');
    expect(info.majorVersion).toBe('v3');
    expect(info.source).toBe('node_modules');
  });

  it('should handle node_modules parse error and fall through', async () => {
    process.cwd = () => '/fake/project';
    mockedExistsSync.mockImplementation((p: any) => {
      if (String(p) === '/fake/project/node_modules/antd/package.json') return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((p: any, _opts?: any) => {
      if (String(p) === '/fake/project/node_modules/antd/package.json') {
        return 'not valid json';
      }
      throw new Error('not found');
    });

    const info = await freshDetectVersion(undefined);
    expect(info.source).toBe('fallback');
  });

  it('should detect version from package.json dependencies', async () => {
    process.cwd = () => '/fake/project2';
    mockedExistsSync.mockImplementation((p: any) => {
      if (String(p) === '/fake/project2/package.json') return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((p: any, _opts?: any) => {
      if (String(p) === '/fake/project2/package.json') {
        return JSON.stringify({ dependencies: { antd: '^5.10.0' } });
      }
      throw new Error('not found');
    });

    const info = await freshDetectVersion(undefined);
    expect(info.version).toBe('5.10.0');
    expect(info.majorVersion).toBe('v5');
    expect(info.source).toBe('package.json');
  });

  it('should handle package.json parse error and fall to fallback', async () => {
    process.cwd = () => '/fake/project3';
    mockedExistsSync.mockImplementation((p: any) => {
      if (String(p) === '/fake/project3/package.json') return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((p: any, _opts?: any) => {
      if (String(p) === '/fake/project3/package.json') {
        return 'invalid json{{{';
      }
      throw new Error('not found');
    });

    const info = await freshDetectVersion(undefined);
    expect(info.source).toBe('fallback');
  });
});

describe('compare', () => {
  it('should return 0 for equal versions', () => {
    expect(compare('1.0.0', '1.0.0')).toBe(0);
  });
  it('should return -1 when first is less', () => {
    expect(compare('1.0.0', '2.0.0')).toBe(-1);
    expect(compare('1.0.0', '1.1.0')).toBe(-1);
    expect(compare('1.0.0', '1.0.1')).toBe(-1);
  });
  it('should return 1 when first is greater', () => {
    expect(compare('2.0.0', '1.0.0')).toBe(1);
    expect(compare('1.1.0', '1.0.0')).toBe(1);
    expect(compare('1.0.1', '1.0.0')).toBe(1);
  });
  it('should handle missing parts as zero', () => {
    expect(compare('1.0', '1.0.0')).toBe(0);
    expect(compare('1', '1.0.0')).toBe(0);
  });
});

describe('valid', () => {
  it('should return true for valid semver', () => {
    expect(valid('1.0.0')).toBe(true);
    expect(valid('5.20.3')).toBe(true);
  });
  it('should return false for invalid semver', () => {
    expect(valid('1.0')).toBe(false);
    expect(valid('abc')).toBe(false);
    expect(valid('')).toBe(false);
  });
});

describe('satisfies()', () => {
  // >= operator
  it('passes when version meets >= bound', () => {
    expect(satisfies('1.21.0', '>=1.21.0')).toBe(true);
    expect(satisfies('1.22.0', '>=1.21.0')).toBe(true);
    expect(satisfies('2.0.0', '>=1.21.0')).toBe(true);
  });
  it('fails when version is below >= bound', () => {
    expect(satisfies('1.20.9', '>=1.21.0')).toBe(false);
    expect(satisfies('0.9.0', '>=1.0.0')).toBe(false);
  });

  // > operator
  it('passes when version is strictly above > bound', () => {
    expect(satisfies('1.21.1', '>1.21.0')).toBe(true);
  });
  it('fails when version equals > bound', () => {
    expect(satisfies('1.21.0', '>1.21.0')).toBe(false);
  });

  // ^ operator (same major, >= minor.patch)
  it('passes for ^ when same major and >= bound', () => {
    expect(satisfies('1.21.0', '^1.21.0')).toBe(true);
    expect(satisfies('1.22.0', '^1.21.0')).toBe(true);
  });
  it('fails for ^ when major differs', () => {
    expect(satisfies('2.0.0', '^1.21.0')).toBe(false);
    expect(satisfies('0.21.0', '^1.21.0')).toBe(false);
  });
  it('fails for ^ when below bound within same major', () => {
    expect(satisfies('1.20.0', '^1.21.0')).toBe(false);
  });

  // ~ operator (same major+minor, >= patch)
  it('passes for ~ when same major+minor and >= patch', () => {
    expect(satisfies('1.21.0', '~1.21.0')).toBe(true);
    expect(satisfies('1.21.5', '~1.21.0')).toBe(true);
  });
  it('fails for ~ when minor differs', () => {
    expect(satisfies('1.22.0', '~1.21.0')).toBe(false);
    expect(satisfies('1.20.0', '~1.21.0')).toBe(false);
  });

  // exact version
  it('passes for exact version match', () => {
    expect(satisfies('1.21.0', '1.21.0')).toBe(true);
  });
  it('fails for exact version mismatch', () => {
    expect(satisfies('1.21.1', '1.21.0')).toBe(false);
  });

  // bare major / major.minor
  it('passes when major matches bare major range', () => {
    expect(satisfies('5.0.0', '5')).toBe(true);
    expect(satisfies('5.99.0', '5')).toBe(true);
  });
  it('fails when major differs for bare major range', () => {
    expect(satisfies('4.0.0', '5')).toBe(false);
    expect(satisfies('6.0.0', '5')).toBe(false);
  });
  it('passes when major+minor matches x.y range', () => {
    expect(satisfies('5.1.0', '5.1')).toBe(true);
    expect(satisfies('5.1.9', '5.1')).toBe(true);
  });
  it('fails when minor differs for x.y range', () => {
    expect(satisfies('5.2.0', '5.1')).toBe(false);
  });

  // fail-open for unrecognized range
  it('returns true (fail-open) for unrecognized range format', () => {
    expect(satisfies('1.0.0', '||1.x')).toBe(true);
    expect(satisfies('1.0.0', '*')).toBe(true);
  });
});
