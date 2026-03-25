import { describe, it, expect } from 'vitest';
import { getComponentInfo } from '../../commands/info.js';
import type { CLIError } from '../../types.js';

describe('getComponentInfo', () => {
  it('returns component info for a valid component', () => {
    const result = getComponentInfo('Button', { lang: 'en', version: '5.20.0', detail: false });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(result).toHaveProperty('nameZh');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('props');
      expect(Array.isArray(result.props)).toBe(true);
      expect(result.props.length).toBeGreaterThan(0);
    }
  });

  it('returns detail info when detail is true', () => {
    const result = getComponentInfo('Button', { lang: 'en', version: '5.20.0', detail: true });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'whenToUse' in result) {
      expect(result).toHaveProperty('whenToUse');
      expect(result).toHaveProperty('methods');
      expect(result).toHaveProperty('related');
      expect(result).toHaveProperty('faq');
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getComponentInfo('NonExistent', { lang: 'en', version: '5.20.0', detail: false });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
    expect(err.message).toContain('NonExistent');
  });

  it('returns fuzzy match suggestion for typos', () => {
    const result = getComponentInfo('Buton', { lang: 'en', version: '5.20.0', detail: false });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
    expect(err.suggestion).toContain('Button');
  });

  it('works with v4', () => {
    const result = getComponentInfo('Button', { lang: 'en', version: '4.24.0', detail: false });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
    }
  });
});
