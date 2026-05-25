import { describe, it, expect } from 'vitest';
import { cleanEscapes, isPipeSplit, isColumnMisaligned } from '../fix-escaped-props.js';
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

  it('decodes HTML entities', () => {
    expect(cleanEscapes('React.ReactElement&lt;InputProps>')).toBe('React.ReactElement<InputProps>');
    expect(cleanEscapes('Array&lt;ReactNode&gt;')).toBe('Array<ReactNode>');
    expect(cleanEscapes('Promise&lt;string&gt;')).toBe('Promise<string>');
    expect(cleanEscapes('&lt;Input /&gt;')).toBe('<Input />');
    expect(cleanEscapes('foo &amp; bar')).toBe('foo & bar');
  });

  it('handles mixed escapes and entities', () => {
    expect(cleanEscapes('Array\\[ReactNode&lt;T&gt;]')).toBe('Array[ReactNode<T>]');
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

describe('isColumnMisaligned', () => {
  it('detects default with pipe (union type in wrong column)', () => {
    expect(isColumnMisaligned({
      name: 'marks', type: 'object',
      default: '{ number: ReactNode } | { number: { style: CSSProperties } }',
    } as PropData)).toBe(true);
  });

  it('returns false for normal defaults', () => {
    expect(isColumnMisaligned({ name: 'disabled', type: 'boolean', default: 'false' } as PropData)).toBe(false);
  });

  it('returns false for dash defaults', () => {
    expect(isColumnMisaligned({ name: 'size', type: 'string', default: '-' } as PropData)).toBe(false);
  });

  it('returns false for backtick-wrapped defaults', () => {
    expect(isColumnMisaligned({ name: 'size', type: 'string', default: '`small`' } as PropData)).toBe(false);
  });

  it('returns false for markdown link defaults', () => {
    expect(isColumnMisaligned({
      name: 'locale', type: 'object',
      default: '[default](https://github.com/ant-design/ant-design)',
    } as PropData)).toBe(false);
  });

  it('returns false for pipe-split props (already handled separately)', () => {
    expect(isColumnMisaligned({
      name: 'align', type: 'start \\', default: 'center \\',
    } as PropData)).toBe(false);
  });
});