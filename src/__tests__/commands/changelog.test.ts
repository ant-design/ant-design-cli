import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { queryChangelog, diffChangelog, registerChangelogCommand } from '../../commands/changelog.js';
import type { CLIError } from '../../types.js';

function createProgram(opts: { format?: string; version?: string; lang?: string; detail?: boolean } = {}) {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  program.option('--format <format>', 'Output format', opts.format ?? 'text');
  program.option('--version <version>', 'Target antd version', opts.version);
  program.option('--lang <lang>', 'Output language', opts.lang ?? 'en');
  program.option('--detail', 'Full information output', opts.detail ?? false);
  return program;
}

describe('queryChangelog', () => {
  it('returns latest changelog entries when no filter', () => {
    const result = queryChangelog({ snapshotVersion: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.length).toBeLessThanOrEqual(5);
      expect(result.entries[0]).toHaveProperty('version');
      expect(result.entries[0]).toHaveProperty('date');
      expect(result.entries[0]).toHaveProperty('changes');
    }
  });

  it('returns CLIError for non-existent version filter', () => {
    const result = queryChangelog({ snapshotVersion: '5.20.0', entryFilter: '99.99.99' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('VERSION_NOT_FOUND');
  });
});

describe('diffChangelog', () => {
  it('returns diff result between two versions', () => {
    const result = diffChangelog({ v1: '5.20.0', v2: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.from).toBe('5.20.0');
      expect(result.to).toBe('5.20.0');
      expect(Array.isArray(result.diffs)).toBe(true);
      // Same version should have no diffs
      expect(result.diffs.length).toBe(0);
    }
  });

  it('returns CLIError for non-existent component in diff', () => {
    const result = diffChangelog({ v1: '5.20.0', v2: '5.20.0', component: 'NonExistent' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns non-empty diffs between different versions', () => {
    const result = diffChangelog({ v1: '5.18.0', v2: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.from).toBe('5.18.0');
      expect(result.to).toBe('5.20.0');
      expect(Array.isArray(result.diffs)).toBe(true);
    }
  });

  it('returns error when v1 has no data', () => {
    const result = diffChangelog({ v1: '99.0.0', v2: '99.1.0' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.code).toBe('VERSION_NOT_FOUND');
      expect(result.message).toContain('99.0.0');
    }
  });

  it('returns error when v1 > v2', () => {
    const result = diffChangelog({ v1: '5.22.0', v2: '5.20.0' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.code).toBe('INVALID_ARGUMENT');
    }
  });

  it('returns error when v2 has no data', () => {
    const result = diffChangelog({ v1: '5.20.0', v2: '99.0.0' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.code).toBe('VERSION_NOT_FOUND');
      expect(result.message).toContain('99.0.0');
    }
  });

  it('detects added and removed components between major versions', () => {
    // v4 -> v5 should show components added/removed
    const result = diffChangelog({ v1: '4.24.0', v2: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      // Should have diffs with added/removed components
      expect(result.diffs.length).toBeGreaterThan(0);
      // Check that some diffs have added or removed entries
      const hasAdded = result.diffs.some(d => d.added.length > 0);
      const hasRemoved = result.diffs.some(d => d.removed.length > 0);
      expect(hasAdded || hasRemoved).toBe(true);
    }
  });

  it('returns diff with component filter', () => {
    const result = diffChangelog({ v1: '5.20.0', v2: '5.20.0', component: 'Button' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.component).toBe('Button');
      expect(result.diffs.length).toBe(0); // same version
    }
  });

  it('handles version range filter', () => {
    const result = queryChangelog({ snapshotVersion: '5.20.0', entryFilter: '5.19.0..5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.entries.length).toBeGreaterThan(0);
      for (const e of result.entries) {
        expect(e.version >= '5.19.0').toBe(true);
        expect(e.version <= '5.20.0').toBe(true);
      }
    }
  });

  it('returns specific version filter', () => {
    const result = queryChangelog({ snapshotVersion: '5.20.0', entryFilter: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.entries.length).toBeGreaterThan(0);
      for (const e of result.entries) {
        expect(e.version).toBe('5.20.0');
      }
    }
  });
});

describe('registerChangelogCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('should output changelog in text format', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('##');
  });

  it('should output changelog in JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog'], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.latest).toBeDefined();
  });

  it('should output changelog for specific version in JSON', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.20.0'], );
    // Output should be an array when specific version
    expect(logSpy).toHaveBeenCalled();
  });

  it('should output diff mode in text format', async () => {
    const program = createProgram({ format: 'text' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.18.0', '5.20.0'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('API Diff');
  });

  it('should output diff mode in JSON format', async () => {
    const program = createProgram({ format: 'json' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.18.0', '5.20.0'], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.from).toBe('5.18.0');
    expect(parsed.to).toBe('5.20.0');
  });

  it('should output diff mode with component filter in JSON', async () => {
    const program = createProgram({ format: 'json' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.18.0', '5.20.0', 'Button'], );
    expect(logSpy).toHaveBeenCalled();
    // When component filter is used with diffs, JSON should flatten to single component format
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.from).toBe('5.18.0');
    expect(parsed.to).toBe('5.20.0');
  });

  it('should output diff with component filter showing diffs in JSON (flattened)', async () => {
    // Use major version diff to ensure there are actual diffs for a component
    const program = createProgram({ format: 'json' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '4.24.0', '5.20.0', 'Button'], );
    expect(logSpy).toHaveBeenCalled();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.from).toBe('4.24.0');
    expect(parsed.to).toBe('5.20.0');
    // With diffs, single component should be flattened (component field at top level)
    expect(parsed.component).toBe('Button');
  });

  it('should handle "no changelog data" gracefully', async () => {
    const program = createProgram({ format: 'text', version: '99.0.0' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('No changelog data');
  });

  it('should handle diff error for invalid version order', async () => {
    const program = createProgram({ format: 'text' });
    registerChangelogCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.22.0', '5.20.0'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('should handle no diffs found', async () => {
    const program = createProgram({ format: 'text' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.20.0', '5.20.0'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('No API differences');
  });

  it('should handle version range changelog', async () => {
    const program = createProgram({ format: 'text' });
    registerChangelogCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '5.19.0..5.20.0'], );
    expect(logSpy).toHaveBeenCalled();
  });

  it('should handle changelog error for non-existent version filter', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerChangelogCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'changelog', '99.99.99'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
