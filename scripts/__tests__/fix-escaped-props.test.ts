import { describe, it, expect } from 'vitest';
import { cleanEscapes, isPipeSplit } from '../fix-escaped-props.js';
import type { PropData } from '../../src/types.js';

describe('cleanEscapes', () => {
  it('removes escaped brackets', () => {
    expect(cleanEscapes('string\\[]')).toBe('string[]');
    expect(cleanEscapes('\\[number, number]')).toBe('[number, number]');
    expect(cleanEscapes('{ label, value }\\[]')).toBe('{ label, value }[]');
  });

  it('removes escaped angle brackets', () => {
    expect(cleanEscapes('React.ReactElement\\<InputProps>')).toBe('React.ReactElement<InputProps>');
    expect(cleanEscapes('Record\\<string, any>')).toBe('Record<string, any>');
  });

  it('handles multiple escapes in one string', () => {
    expect(cleanEscapes('[ItemType\\[\\]](#itemtype)')).toBe('[ItemType[]](#itemtype)');
  });

  it('preserves non-escaped text', () => {
    expect(cleanEscapes('string | number')).toBe('string | number');
    expect(cleanEscapes('boolean')).toBe('boolean');
  });
});

describe('isPipeSplit', () => {
  it('detects trailing backslash in type', () => {
    expect(isPipeSplit({ name: 'align', type: 'start \\', default: '-' } as PropData)).toBe(true);
  });

  it('detects trailing backslash in default', () => {
    expect(isPipeSplit({ name: 'align', type: 'start', default: 'center \\' } as PropData)).toBe(true);
  });

  it('returns false for clean props', () => {
    expect(isPipeSplit({ name: 'disabled', type: 'boolean', default: 'false' } as PropData)).toBe(false);
  });

  it('returns false for props with clean backtick unions', () => {
    expect(isPipeSplit({ name: 'size', type: '`small` | `middle` | `large`', default: '-' } as PropData)).toBe(false);
  });
});