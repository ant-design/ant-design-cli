import { describe, it, expect } from 'vitest';
import { getSemanticStructure } from '../../commands/semantic.js';
import type { CLIError } from '../../types.js';

describe('getSemanticStructure', () => {
  it('returns semantic structure for a valid component', () => {
    const result = getSemanticStructure('Button', { version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(Array.isArray(result.semanticStructure)).toBe(true);
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getSemanticStructure('NonExistent', { version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns empty structure array for component without semantic data', () => {
    const result = getSemanticStructure('Affix', { version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(Array.isArray(result.semanticStructure)).toBe(true);
    }
  });
});
