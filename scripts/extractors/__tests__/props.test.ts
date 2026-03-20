import { describe, it, expect } from 'vitest';
import { parseTableRow } from '../props.js';

describe('parseTableRow', () => {
  it('handles normal rows', () => {
    const cells = parseTableRow('| foo | bar | baz |');
    expect(cells).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles escaped pipes in type values', () => {
    const cells = parseTableRow(
      '| color | Set color | `default` \\| `primary` \\| `danger` | `default` | 5.21.0 |',
    );
    expect(cells).toEqual([
      'color',
      'Set color',
      '`default` | `primary` | `danger`',
      '`default`',
      '5.21.0',
    ]);
  });

  it('handles multiple escaped pipes in a single cell', () => {
    const cells = parseTableRow('| type | desc | `a` \\| `b` \\| `c` | - |  |');
    expect(cells[2]).toBe('`a` | `b` | `c`');
    expect(cells[3]).toBe('-');
  });

  it('handles rows without escaped pipes (no regression)', () => {
    const cells = parseTableRow('| disabled | Whether disabled | boolean | false |  |');
    expect(cells).toEqual(['disabled', 'Whether disabled', 'boolean', 'false', '']);
  });
});
