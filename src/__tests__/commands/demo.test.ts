import { describe, it, expect } from 'vitest';
import { getComponentDemo } from '../../commands/demo.js';
import type { CLIError } from '../../types.js';

describe('getComponentDemo', () => {
  it('returns demo list when no name specified', () => {
    const result = getComponentDemo('Button', { version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'demos' in result) {
      expect(result.component).toBe('Button');
      expect(Array.isArray(result.demos)).toBe(true);
      expect(result.demos.length).toBeGreaterThan(0);
      expect(result.demos[0]).toHaveProperty('name');
      expect(result.demos[0]).toHaveProperty('title');
      expect(result.demos[0]).toHaveProperty('description');
    }
  });

  it('returns specific demo with code when name specified', () => {
    // First get list to find a valid demo name
    const listResult = getComponentDemo('Button', { version: '5.20.0' });
    if (!('error' in listResult) && 'demos' in listResult && listResult.demos.length > 0) {
      const demoName = listResult.demos[0].name;
      const result = getComponentDemo('Button', { version: '5.20.0', name: demoName });
      expect('error' in result).toBe(false);
      if (!('error' in result) && 'code' in result) {
        expect(result.component).toBe('Button');
        expect(result.demo).toBe(demoName);
        expect(typeof result.code).toBe('string');
        expect(result.code.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getComponentDemo('NonExistent', { version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns CLIError for non-existent demo', () => {
    const result = getComponentDemo('Button', { version: '5.20.0', name: 'nonexistent-demo' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('DEMO_NOT_FOUND');
  });
});
