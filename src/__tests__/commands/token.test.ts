import { describe, it, expect } from 'vitest';
import { getTokens } from '../../commands/token.js';
import type { CLIError } from '../../types.js';

describe('getTokens', () => {
  it('returns global tokens for v5', () => {
    const result = getTokens(undefined, { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'tokens' in result && !('component' in result)) {
      expect(Array.isArray(result.tokens)).toBe(true);
    }
  });

  it('returns component tokens for a valid component', () => {
    const result = getTokens('Button', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'component' in result) {
      expect(result.component).toBe('Button');
      expect(Array.isArray(result.tokens)).toBe(true);
    }
  });

  it('returns CLIError for v4 (unsupported)', () => {
    const result = getTokens(undefined, { lang: 'en', version: '4.24.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('UNSUPPORTED_VERSION_FEATURE');
    expect(err.message).toContain('v4');
  });

  it('returns CLIError for non-existent component', () => {
    const result = getTokens('NonExistent', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });
});
