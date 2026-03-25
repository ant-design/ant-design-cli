import { describe, it, expect } from 'vitest';
import { queryChangelog, diffChangelog } from '../../commands/changelog.js';
import type { CLIError } from '../../types.js';

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

  it('returns error when v1 > v2', () => {
    const result = diffChangelog({ v1: '5.22.0', v2: '5.20.0' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.code).toBe('INVALID_ARGUMENT');
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
});
