import { describe, it, expect, vi } from 'vitest';
import { fuzzyMatch, createError, printError, ErrorCodes } from '../output/error.js';

describe('output/error', () => {
  describe('fuzzyMatch', () => {
    it('returns undefined for empty candidates', () => {
      expect(fuzzyMatch('foo', [])).toBeUndefined();
    });

    it('returns exact case-insensitive match', () => {
      expect(fuzzyMatch('BUTTON', ['Button', 'Input'])).toBe('Button');
    });

    it('returns prefix match when no exact match', () => {
      expect(fuzzyMatch('But', ['Banner', 'Button', 'Input'])).toBe('Button');
    });

    it('returns contains match when no prefix match', () => {
      expect(fuzzyMatch('utto', ['Banner', 'Button', 'Input'])).toBe('Button');
    });

    it('returns Levenshtein match for typos', () => {
      expect(fuzzyMatch('Btn', ['Banner', 'Button', 'Input'])).toBe('Button');
    });

    it('returns undefined when no candidate is close enough', () => {
      expect(fuzzyMatch('xyz', ['Banner', 'Button', 'Input'])).toBeUndefined();
    });

    it('prefers same-first-letter candidate when distance ties', () => {
      // Both 'Drar' (same first letter as 'Drag') and 'Frag' are dist=1 from 'Drag'.
      // The same-first-letter tiebreak should pick 'Drar'.
      const result = fuzzyMatch('Drag', ['Frag', 'Drar']);
      expect(result).toBe('Drar');
    });
  });

  describe('createError', () => {
    it('produces a CLIError object', () => {
      const err = createError(ErrorCodes.INVALID_ARGUMENT, 'msg', 'tip');
      expect(err).toEqual({ error: true, code: 'INVALID_ARGUMENT', message: 'msg', suggestion: 'tip' });
    });

    it('omits suggestion if not provided', () => {
      const err = createError(ErrorCodes.INVALID_ARGUMENT, 'msg');
      expect(err.suggestion).toBeUndefined();
    });
  });

  describe('printError', () => {
    it('writes JSON to stderr when format is json', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        printError(createError(ErrorCodes.INVALID_ARGUMENT, 'm'), 'json');
        expect(errSpy).toHaveBeenCalled();
        const arg = errSpy.mock.calls[0][0];
        const data = JSON.parse(arg as string);
        expect(data.code).toBe('INVALID_ARGUMENT');
      } finally {
        errSpy.mockRestore();
      }
    });

    it('writes Error: ... and Suggestion: lines to stderr for text format', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        printError(createError(ErrorCodes.INVALID_ARGUMENT, 'msg', 'tip'), 'text');
        const calls = errSpy.mock.calls.map((c) => String(c[0])).join('\n');
        expect(calls).toContain('Error: msg');
        expect(calls).toContain('Suggestion: tip');
      } finally {
        errSpy.mockRestore();
      }
    });
  });
});
