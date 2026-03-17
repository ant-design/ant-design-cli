import { describe, it, expect } from 'vitest';
import { detectVersion, satisfies } from '../version.js';

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
