import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { output, formatTable } from '../formatter.js';

describe('output', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should output JSON for objects', () => {
    output({ name: 'Button' }, 'json');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ name: 'Button' }, null, 2));
  });

  it('should output JSON for arrays', () => {
    output([1, 2, 3], 'json');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify([1, 2, 3], null, 2));
  });

  it('should output text for strings', () => {
    output('hello world', 'text');
    expect(logSpy).toHaveBeenCalledWith('hello world');
  });

  it('should output text for arrays', () => {
    output(['a', 'b', 'c'], 'text');
    expect(logSpy).toHaveBeenCalledWith('a\nb\nc');
  });

  it('should output text for objects with key-value pairs', () => {
    output({ name: 'Button', type: 'component' }, 'text');
    expect(logSpy).toHaveBeenCalledWith('name: Button\ntype: component');
  });

  it('should output text for objects with array values', () => {
    output({ items: ['a', 'b'] }, 'text');
    expect(logSpy).toHaveBeenCalledWith('items:\n  a\n  b');
  });

  it('should output text for non-string primitives', () => {
    output(42, 'text');
    expect(logSpy).toHaveBeenCalledWith('42');
  });

  it('should output markdown for strings', () => {
    output('hello', 'markdown');
    expect(logSpy).toHaveBeenCalledWith('hello');
  });

  it('should output markdown for objects as json code block', () => {
    output({ name: 'Button' }, 'markdown');
    expect(logSpy).toHaveBeenCalledWith('```json\n' + JSON.stringify({ name: 'Button' }, null, 2) + '\n```');
  });

  it('should output markdown for non-string primitives', () => {
    output(42, 'markdown');
    expect(logSpy).toHaveBeenCalledWith('42');
  });

  it('should handle default format as text', () => {
    output('test', 'text');
    expect(logSpy).toHaveBeenCalledWith('test');
  });
});

describe('formatTable', () => {
  const headers = ['Name', 'Type'];
  const rows = [
    ['Button', 'component'],
    ['Input', 'component'],
  ];

  it('should format as JSON', () => {
    const result = formatTable(headers, rows, 'json');
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([
      { Name: 'Button', Type: 'component' },
      { Name: 'Input', Type: 'component' },
    ]);
  });

  it('should format as markdown table', () => {
    const result = formatTable(headers, rows, 'markdown');
    const lines = result.split('\n');
    expect(lines[0]).toBe('| Name | Type |');
    expect(lines[1]).toBe('| --- | --- |');
    expect(lines[2]).toBe('| Button | component |');
    expect(lines[3]).toBe('| Input | component |');
  });

  it('should escape pipes in markdown', () => {
    const result = formatTable(['Name'], [['a|b']], 'markdown');
    expect(result).toContain('a\\|b');
  });

  it('should format as aligned text columns', () => {
    const result = formatTable(headers, rows, 'text');
    const lines = result.split('\n');
    // Header should be padded
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Type');
    // Separator line
    expect(lines[1]).toMatch(/^-+\s+-+$/);
    // Data rows
    expect(lines[2]).toContain('Button');
    expect(lines[3]).toContain('Input');
  });

  it('should handle empty cell values in text format', () => {
    const result = formatTable(['A', 'B'], [['val', '']], 'text');
    expect(result).toContain('val');
  });
});
