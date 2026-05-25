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

  it('cleans up escaped brackets from markdown', () => {
    const cells = parseTableRow('| options | Options | string\\[] | - |  |');
    expect(cells[2]).toBe('string[]');
  });

  it('cleans up escaped angle brackets from markdown', () => {
    const cells = parseTableRow('| render | Render | (item: T) \\<ReactNode> | - |  |');
    expect(cells[2]).toBe('(item: T) <ReactNode>');
  });

  it('cleans up multiple escape types in one cell', () => {
    const cells = parseTableRow('| items | Items | \\[ItemType\\[]](#itemtype) | - |  |');
    expect(cells[2]).toBe('[ItemType[]](#itemtype)');
  });

  it('handles escaped brackets in default values', () => {
    const cells = parseTableRow('| defaultValue | Default | string\\[] | \\[] |  |');
    expect(cells[2]).toBe('string[]');
    expect(cells[3]).toBe('[]');
  });

  it('decodes HTML entities in type values', () => {
    const cells = parseTableRow('| render | Render | React.ReactElement&lt;InputProps> | - |  |');
    expect(cells[2]).toBe('React.ReactElement<InputProps>');
  });

  it('decodes HTML entities in default values', () => {
    const cells = parseTableRow('| icon | Icon | ReactNode | &lt;Input /&gt; |  |');
    expect(cells[3]).toBe('<Input />');
  });

  it('decodes &amp; entity', () => {
    const cells = parseTableRow('| key | Key | string &amp; number | - |  |');
    expect(cells[2]).toBe('string & number');
  });

  it('handles mixed HTML entities and escaped brackets', () => {
    const cells = parseTableRow('| items | Items | Array&lt;{key: string}&gt;\\[] | - |  |');
    expect(cells[2]).toBe('Array<{key: string}>[]');
  });
});
