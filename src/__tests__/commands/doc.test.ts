import { describe, it, expect } from 'vitest';
import { getComponentDoc } from '../../commands/doc.js';
import type { CLIError } from '../../types.js';

describe('getComponentDoc', () => {
  it('returns doc for a valid component', () => {
    const result = getComponentDoc('Button', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(typeof result.doc).toBe('string');
      expect(result.doc.length).toBeGreaterThan(0);
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getComponentDoc('NonExistent', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns Chinese doc when lang is zh', () => {
    const result = getComponentDoc('Button', { lang: 'zh', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(typeof result.doc).toBe('string');
    }
  });
});
