import { describe, it, expect, vi } from 'vitest';
import { createError, fuzzyMatch, printError, ErrorCodes } from '../error.js';

describe('printError', () => {
  it('should output JSON error to stderr, not stdout', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = createError(ErrorCodes.COMPONENT_NOT_FOUND, 'Not found');
    printError(err, 'json');
    expect(stderrSpy).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });
});

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

  it('should return undefined for empty candidates', () => {
    expect(fuzzyMatch('Button', [])).toBeUndefined();
  });

  it('should return undefined for empty input and empty candidates', () => {
    expect(fuzzyMatch('', [])).toBeUndefined();
  });
});
