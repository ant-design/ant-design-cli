import { describe, it, expect } from 'vitest';
import { detectVersion } from '../version.js';

describe('detectVersion', () => {
  it('should use flag version when provided', () => {
    const info = detectVersion('5.20.0');
    expect(info.version).toBe('5.20.0');
    expect(info.majorVersion).toBe('v5');
    expect(info.source).toBe('flag');
  });

  it('should map v4 correctly', () => {
    const info = detectVersion('4.24.0');
    expect(info.majorVersion).toBe('v4');
  });

  it('should fallback when no flag', () => {
    const info = detectVersion(undefined);
    expect(info.source).not.toBe('flag');
    expect(info.version).toBeTruthy();
    expect(info.majorVersion).toMatch(/^v\d+$/);
  });
});
