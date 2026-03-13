import { describe, it, expect } from 'vitest';
import { createError, fuzzyMatch, ErrorCodes } from '../error.js';

describe('createError', () => {
  it('should create a standard error shape', () => {
    const err = createError(ErrorCodes.COMPONENT_NOT_FOUND, 'Not found', 'Did you mean X?');
    expect(err).toEqual({
      error: true,
      code: 'COMPONENT_NOT_FOUND',
      message: 'Not found',
      suggestion: 'Did you mean X?',
    });
  });
});

describe('fuzzyMatch', () => {
  const candidates = ['Button', 'Table', 'Select', 'Input', 'Form', 'Modal'];

  it('should match exact (case-insensitive)', () => {
    expect(fuzzyMatch('button', candidates)).toBe('Button');
    expect(fuzzyMatch('TABLE', candidates)).toBe('Table');
  });

  it('should match prefix', () => {
    expect(fuzzyMatch('Sel', candidates)).toBe('Select');
    expect(fuzzyMatch('Mod', candidates)).toBe('Modal');
  });

  it('should match contains', () => {
    expect(fuzzyMatch('put', candidates)).toBe('Input');
  });

  it('should match close typos', () => {
    expect(fuzzyMatch('Btn', candidates)).toBe('Button');
    expect(fuzzyMatch('Tabel', candidates)).toBe('Table');
  });

  it('should return undefined for no match', () => {
    expect(fuzzyMatch('zzzzz', candidates)).toBeUndefined();
  });
});
