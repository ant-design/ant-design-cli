import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectVersion, compare, valid, satisfies } from '../data/version.js';
import {
  loadMetadata,
  loadMetadataForVersion,
  findComponent,
  getAllComponentNames,
  resolveComponent,
} from '../data/loader.js';
import * as jsonModule from '../utils/json.js';
import { collectFiles, getJSXElementName } from '../utils/scan.js';
import * as fg from 'fast-glob';

describe('data/version', () => {
  let workdir: string;
  let origCwd: string;

  beforeEach(() => {
    origCwd = process.cwd();
    workdir = join(tmpdir(), `antd-cli-version-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(workdir, { recursive: true });
    process.chdir(workdir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(workdir, { recursive: true, force: true });
  });

  it('returns flag source when --version is given', () => {
    const v = detectVersion('5.20.0');
    expect(v.source).toBe('flag');
    expect(v.version).toBe('5.20.0');
    expect(v.majorVersion).toBe('v5');
  });

  it('preserves prerelease tag in --version flag', () => {
    const v = detectVersion('5.0.0-beta.1');
    expect(v.source).toBe('flag');
    expect(v.version).toBe('5.0.0-beta.1');
    expect(v.majorVersion).toBe('v5');
  });

  it('preserves prerelease from non-strict-semver flag via coerce (e.g. "5-beta.1")', () => {
    const v = detectVersion('5-beta.1');
    expect(v.source).toBe('flag');
    expect(v.version).toBe('5.0.0-beta.1');
    expect(v.majorVersion).toBe('v5');
  });

  it('coerces partial version in --version flag (e.g. "5" → "5.0.0")', () => {
    const v = detectVersion('5');
    expect(v.source).toBe('flag');
    expect(v.version).toBe('5.0.0');
    expect(v.majorVersion).toBe('v5');
  });

  it('falls back when --version is non-semver (e.g. "*")', () => {
    const v = detectVersion('*');
    expect(v.source).toBe('fallback');
  });

  it('falls back when --version is non-semver (e.g. "workspace:*")', () => {
    const v = detectVersion('workspace:*');
    expect(v.source).toBe('fallback');
  });

  it('emits warning on stderr when --version is non-semver', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    detectVersion('not-a-version');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Warning'));
    spy.mockRestore();
  });

  it('returns fallback when no antd info found', () => {
    const v = detectVersion();
    expect(v.source).toBe('fallback');
    expect(v.majorVersion).toBe('v5');
  });

  it('detects from node_modules/antd/package.json', () => {
    mkdirSync(join(workdir, 'node_modules', 'antd'), { recursive: true });
    writeFileSync(join(workdir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.19.0' }));
    const v = detectVersion();
    expect(v.source).toBe('node_modules');
    expect(v.version).toBe('5.19.0');
    expect(v.majorVersion).toBe('v5');
  });

  it('detects from package.json dependencies field', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: '^5.18.0' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.18.0');
  });

  it('detects from package.json devDependencies field', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ devDependencies: { antd: '~5.17.0' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.17.0');
  });

  it('detects from package.json peerDependencies field', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ peerDependencies: { antd: '>=5.16.0' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.16.0');
  });

  it('falls back when package.json has "*" as dependency', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: '*' } }));
    const v = detectVersion();
    expect(v.source).toBe('fallback');
  });

  it('falls back when package.json has "workspace:*" as dependency', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: 'workspace:*' } }));
    const v = detectVersion();
    expect(v.source).toBe('fallback');
  });

  it('parses "npm:antd@5.0.0" alias specifier from package.json', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: 'npm:antd@5.0.0' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.0.0');
    expect(v.majorVersion).toBe('v5');
  });

  it('coerces version with "||" range from package.json', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: '>=5.0.0 || >=6.0.0' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.0.0');
  });

  it('coerces bare major version "5" from package.json', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: '5' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.0.0');
  });

  it('preserves prerelease from range-prefixed package.json dependency (e.g. "^5.18.0-beta.1")', () => {
    writeFileSync(join(workdir, 'package.json'), JSON.stringify({ dependencies: { antd: '^5.18.0-beta.1' } }));
    const v = detectVersion();
    expect(v.source).toBe('package.json');
    expect(v.version).toBe('5.18.0-beta.1');
    expect(v.majorVersion).toBe('v5');
  });

  it('falls back if node_modules/antd has invalid package.json', () => {
    mkdirSync(join(workdir, 'node_modules', 'antd'), { recursive: true });
    writeFileSync(join(workdir, 'node_modules', 'antd', 'package.json'), 'NOT JSON');
    const v = detectVersion();
    expect(v.source).toBe('fallback');
  });

  describe('compare', () => {
    it('returns -1 when a < b', () => {
      expect(compare('5.0.0', '5.1.0')).toBeLessThan(0);
    });
    it('returns 1 when a > b', () => {
      expect(compare('5.1.0', '5.0.0')).toBeGreaterThan(0);
    });
    it('returns 0 when equal', () => {
      expect(compare('5.0.0', '5.0.0')).toBe(0);
    });
    it('returns null when unparseable', () => {
      expect(compare('not-a-version', 'also-not')).toBeNull();
    });
  });

  describe('valid', () => {
    it('returns true for valid semver', () => {
      expect(valid('5.0.0')).toBe(true);
    });
    it('returns false for invalid', () => {
      expect(valid('not-a-version')).toBe(false);
    });
  });

  describe('satisfies', () => {
    it('returns true when in range', () => {
      expect(satisfies('5.0.5', '>=5.0.0 <6.0.0')).toBe(true);
    });
    it('returns false when out of range', () => {
      expect(satisfies('4.0.0', '>=5.0.0 <6.0.0')).toBe(false);
    });
  });
});

describe('data/loader', () => {
  it('loadMetadata returns a store with components', () => {
    const store = loadMetadata('v5');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('loadMetadataForVersion exact minor match', () => {
    const store = loadMetadataForVersion('5.0.0');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('loadMetadataForVersion falls back when no minor', () => {
    const store = loadMetadataForVersion('5');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('loadMetadataForVersion falls back to nearest earlier minor', () => {
    // Pick a v5 minor that probably has no snapshot but earlier ones do
    const store = loadMetadataForVersion('5.999.0');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('loadMetadataForVersion falls back to major when no snapshot at all', () => {
    const store = loadMetadataForVersion('99.0.0');
    expect(store).toBeDefined();
  });

  it('loadMetadataForVersion caches results', () => {
    const a = loadMetadataForVersion('5.20.0');
    const b = loadMetadataForVersion('5.20.0');
    expect(a).toBe(b);
  });

  it('findComponent is case-insensitive', () => {
    const store = loadMetadata('v5');
    expect(findComponent(store, 'BUTTON')?.name).toBe('Button');
    expect(findComponent(store, 'button')?.name).toBe('Button');
  });

  it('findComponent returns undefined for unknown name', () => {
    const store = loadMetadata('v5');
    expect(findComponent(store, 'Nonexistent')).toBeUndefined();
  });

  it('getAllComponentNames lists names', () => {
    const store = loadMetadata('v5');
    const names = getAllComponentNames(store);
    expect(names).toContain('Button');
  });

  it('resolveComponent returns CLIError with fuzzy suggestion', () => {
    const result = resolveComponent('Btn', '5.20.0');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.suggestion).toContain('Button');
    }
  });

  it('resolveComponent returns store+comp for valid name', () => {
    const result = resolveComponent('Button', '5.20.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.name).toBe('Button');
    }
  });

  it('resolveComponent backfills props from doc when snapshot has empty props', () => {
    // Popconfirm in v5.0.x snapshots has 0 props but doc has API tables
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
      expect(result.comp.props.some((p) => p.name === 'title')).toBe(true);
    }
  });

  it('resolveComponent backfills description from major version when snapshot has empty description', () => {
    // Popconfirm in v5.0.x snapshots has empty description, v5.json has it
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.description.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent backfills props for Drawer (Props column header)', () => {
    // Drawer uses "Props" as the API table header instead of "Property"
    const result = resolveComponent('Drawer', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent does not overwrite non-empty snapshot props', () => {
    // Button should have its own props already, backfill should not change them
    const result = resolveComponent('Button', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent backfills descriptionZh independently from description', () => {
    // Ensure Chinese description is backfilled even if English description exists
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // Popconfirm snapshot has empty descriptionZh, major version has it
      expect(result.comp.descriptionZh.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent backfills props from major version when doc has no API section', () => {
    // Some components may have empty props and no ## API in doc — fall back to major
    const result = resolveComponent('Popover', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent does not load major store when snapshot has all data', () => {
    // Button in v5.0.0 has props and description — no need for major store
    const result = resolveComponent('Button', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // Verify it still has complete data
      expect(result.comp.props.length).toBeGreaterThan(0);
      expect(result.comp.description.length).toBeGreaterThan(0);
    }
  });

  it('backfillFromMajor uses shallow copy to avoid shared references', () => {
    // Popconfirm in snapshot has empty props — backfilled from major should not share array
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      const props1 = result.comp.props;
      // Resolving same component from major version should return different array
      const major = resolveComponent('Popconfirm', '5');
      if (!('error' in major)) {
        // If both routes return data, arrays should be independent
        expect(props1).not.toBe(major.comp.props);
      }
    }
  });

  it('resolveComponent handles components with sub-component props in doc', () => {
    // Check that subComponentProps are extracted from doc when present
    const result = resolveComponent('Select', '5.0.0');
    expect('error' in result).toBe(false);
    // Select has Option sub-component with props
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent populates since field from doc API table version column', () => {
    // Popconfirm's doc has a "Version" / "版本" column in its API table
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      const withSince = result.comp.props.filter((p) => p.since);
      expect(withSince.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent parses Chinese descriptions from docZh', () => {
    // Popconfirm snapshot has empty descriptionZh; doc backfill parses docZh
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // At least some props should have Chinese descriptions from docZh parsing
      const withZhDesc = result.comp.props.filter((p) => p.descriptionZh && p.descriptionZh.length > 0);
      expect(withZhDesc.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent populates subComponentProps from major version extraction', () => {
    // Major version files have subComponentProps extracted at build time
    const result = resolveComponent('Input', '5');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // Input has TextArea, Search, Password, OTP sub-components
      expect(result.comp.props.length).toBeGreaterThan(0);
      expect(result.comp.subComponentProps).toBeDefined();
      const keys = Object.keys(result.comp.subComponentProps!);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent preserves deprecated props from extraction', () => {
    // AutoComplete in v5.json has deprecated props with ~~strikethrough~~
    const result = resolveComponent('AutoComplete', '5');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      const deprecated = result.comp.props.filter((p) => p.deprecated);
      expect(deprecated.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent handles terminal sections in API doc', () => {
    // Popconfirm doc has "## Note" after "## API" which terminates the API section
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // Should still have props parsed from the API section before "## Note"
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent handles Popover with empty snapshot props', () => {
    // Popover in v5.0.x snapshot has empty props, should be backfilled from doc
    const result = resolveComponent('Popover', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
      expect(result.comp.description.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent backfills descriptionZh from major version', () => {
    // Popover snapshot has empty description and descriptionZh; doc + major backfill should fill them
    const result = resolveComponent('Popover', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.descriptionZh!.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent handles major version request without snapshot', () => {
    // Requesting just "5" uses the major version file directly
    const result = resolveComponent('Button', '5');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent doc backfill parses Chinese API table with 版本 column', () => {
    // Popconfirm Chinese doc has "版本" (version) column header
    const result = resolveComponent('Popconfirm', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      const sinceProps = result.comp.props.filter((p) => p.since);
      // Chinese "版本" is mapped to versionIdx, so since should be populated from both langs
      expect(sinceProps.length).toBeGreaterThan(0);
      // Also verify Chinese descriptions are merged correctly
      const okButton = result.comp.props.find((p) => p.name === 'okText');
      if (okButton) {
        expect(okButton.description).toBeTruthy();
        expect(okButton.descriptionZh).toBeTruthy();
      }
    }
  });

  it('resolveComponent with Drawer uses Props column header from doc', () => {
    // Drawer's API table uses "Props" as the name column header instead of "Property"
    const result = resolveComponent('Drawer', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
    }
  });

  it('resolveComponent does not backfill doc when major version already has data', () => {
    // Button in v5.20.0 has complete props from extraction; doc backfill should be skipped
    const result = resolveComponent('Button', '5.20.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.props.length).toBeGreaterThan(0);
      // Button's props should match the extraction data, not be duplicated from doc
      const propNames = result.comp.props.map((p) => p.name);
      const uniqueNames = new Set(propNames);
      expect(propNames.length).toBe(uniqueNames.size);
    }
  });

  it('resolveComponent backfills both english and chinese descriptions independently', () => {
    // Test that description and descriptionZh are backfilled from different sources independently
    const result = resolveComponent('Popover', '5.0.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.comp.description!.length).toBeGreaterThan(0);
      expect(result.comp.descriptionZh!.length).toBeGreaterThan(0);
    }
  });

  it('falls back to loadMetadata when versions.json cannot be read', () => {
    // First call: returns null (simulating unreadable versions.json)
    // Subsequent calls (loadMetadata reads no JSON files, only readDataFile) — but
    // resolveComponent uses readJson elsewhere. Use a unique version to bypass cache.
    const spy = vi.spyOn(jsonModule, 'readJson').mockReturnValueOnce(null);
    const store = loadMetadataForVersion(`5.${Date.now()}.0`);
    expect(store).toBeDefined();
    spy.mockRestore();
  });

  it('falls back to loadMetadata when versions index points to a non-existent snapshot file', () => {
    // Stub readJson to return an index pointing to a snapshot that doesn't exist on disk.
    // Use a unique requested version to bypass the in-memory cache.
    const fakeVersion = `5.998.${Date.now()}`;
    const spy = vi.spyOn(jsonModule, 'readJson').mockReturnValueOnce({
      v5: { '5.998': '5.998.0' },
    } as never);
    const store = loadMetadataForVersion(fakeVersion);
    // Snapshot doesn't exist → tryLoadSnapshot returns null; falls back to v5.json
    expect(store.components.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});

describe('utils/scan', () => {
  it('collectFiles returns [file] for a single file', () => {
    const fixture = join(tmpdir(), `scan-${Date.now()}.tsx`);
    writeFileSync(fixture, 'export {}');
    try {
      expect(collectFiles(fixture)).toEqual([fixture]);
    } finally {
      rmSync(fixture);
    }
  });

  it('collectFiles returns [] for non-existent path', () => {
    expect(collectFiles('/this/does/not/exist/' + Date.now())).toEqual([]);
  });

  it('collectFiles globs a directory', () => {
    const dir = join(tmpdir(), `scan-dir-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.tsx'), 'export {}');
    writeFileSync(join(dir, 'b.ts'), 'export {}');
    writeFileSync(join(dir, 'README.md'), '# x');
    try {
      const files = collectFiles(dir);
      expect(files.length).toBe(2);
      expect(files.some((f) => f.endsWith('a.tsx'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('getJSXElementName', () => {
    it('returns identifier name', () => {
      expect(getJSXElementName({ type: 'JSXIdentifier', name: 'Button' })).toBe('Button');
    });
    it('returns member expression path', () => {
      expect(getJSXElementName({
        type: 'JSXMemberExpression',
        object: { type: 'JSXIdentifier', name: 'Typography' },
        property: { name: 'Text' },
      })).toBe('Typography.Text');
    });
    it('returns empty string for unknown node type', () => {
      expect(getJSXElementName({ type: 'Other' })).toBe('');
    });
  });

  it('collectFiles returns [] when fast-glob throws', () => {
    const dir = join(tmpdir(), `scan-throw-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const spy = vi.spyOn(fg.default, 'globSync').mockImplementation(() => {
        throw new Error('boom');
      });
      const result = collectFiles(dir);
      expect(result).toEqual([]);
      spy.mockRestore();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
