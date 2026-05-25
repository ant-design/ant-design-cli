import { describe, it, expect } from 'vitest';
import {
  cleanEscapes,
  isPipeSplit,
  isVersion,
  isSimpleDefault,
  isStrictDefault,
  looksLikeType,
  repairPipeSplit,
} from '../fix-escaped-props.js';
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

describe('isVersion', () => {
  it('matches semver versions', () => {
    expect(isVersion('5.19.0')).toBe(true);
    expect(isVersion('4.23')).toBe(true);
    expect(isVersion('6.0.1')).toBe(true);
  });

  it('rejects non-version strings', () => {
    expect(isVersion('end')).toBe(false);
    expect(isVersion('`default`')).toBe(false);
    expect(isVersion('{ goButton: ReactNode }')).toBe(false);
    expect(isVersion('false')).toBe(false);
  });
});

describe('isSimpleDefault', () => {
  it('matches common default values', () => {
    expect(isSimpleDefault('-')).toBe(true);
    expect(isSimpleDefault('')).toBe(true);
    expect(isSimpleDefault('true')).toBe(true);
    expect(isSimpleDefault('false')).toBe(true);
    expect(isSimpleDefault('0')).toBe(true);
    expect(isSimpleDefault('10')).toBe(true);
    expect(isSimpleDefault('[]')).toBe(true);
    expect(isSimpleDefault('\\[]')).toBe(true); // escape remnant
  });

  it('matches backtick-wrapped strings', () => {
    expect(isSimpleDefault('`small`')).toBe(true);
    expect(isSimpleDefault('`default`')).toBe(true);
    expect(isSimpleDefault('`top`')).toBe(true);
  });

  it('matches plain identifiers', () => {
    expect(isSimpleDefault('div')).toBe(true);
    expect(isSimpleDefault('form')).toBe(true);
    expect(isSimpleDefault('React.Fragment')).toBe(true);
  });

  it('rejects type expressions', () => {
    expect(isSimpleDefault('{ goButton: ReactNode }')).toBe(false);
    expect(isSimpleDefault('number | string')).toBe(false);
    expect(isSimpleDefault('[SelectProps](/components/select#api)')).toBe(false);
  });
});

describe('isStrictDefault', () => {
  it('matches only unambiguous defaults', () => {
    expect(isStrictDefault('-')).toBe(true);
    expect(isStrictDefault('true')).toBe(true);
    expect(isStrictDefault('false')).toBe(true);
    expect(isStrictDefault('4.5')).toBe(true);
    expect(isStrictDefault('[]')).toBe(true);
  });

  it('rejects identifiers that could be enum values', () => {
    expect(isStrictDefault('end')).toBe(false);
    expect(isStrictDefault('div')).toBe(false);
    expect(isStrictDefault('`top`')).toBe(false);
  });
});

describe('looksLikeType', () => {
  it('detects type syntax', () => {
    expect(looksLikeType('{ goButton: ReactNode }')).toBe(true);
    expect(looksLikeType('(event: MouseEvent) => void')).toBe(true);
    expect(looksLikeType('Record<string, any>')).toBe(true);
    expect(looksLikeType('string | number')).toBe(true);
  });

  it('rejects simple values', () => {
    expect(looksLikeType('false')).toBe(false);
    expect(looksLikeType('div')).toBe(false);
    expect(looksLikeType('`small`')).toBe(false);
    expect(looksLikeType('end')).toBe(false);
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
});

describe('repairPipeSplit', () => {
  it('Pattern A: multi-fragment with all trailing backslashes', () => {
    const prop = { name: 'align', type: 'start \\', default: 'center \\', since: 'end' } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('start | center | end');
    expect(repaired.default).toBe('-');
    expect(repaired.since).toBe('');
  });

  it('Pattern A: multi-fragment with version in since', () => {
    const prop = { name: 'size', type: '`small` \\', default: '`default` \\', since: '5.20.0' } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('`small` | `default`');
    expect(repaired.default).toBe('-');
    expect(repaired.since).toBe('5.20.0');
  });

  it('Pattern B: type ends with \\, default is complex type fragment', () => {
    const prop = {
      name: 'showQuickJumper',
      type: 'boolean \\',
      default: '{ goButton: ReactNode }',
      since: 'false',
    } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('boolean | { goButton: ReactNode }');
    expect(repaired.default).toBe('false');
    expect(repaired.since).toBe('');
  });

  it('Pattern B: default is complex, since is dash (actual default)', () => {
    const prop = {
      name: 'showSizeChanger',
      type: 'boolean \\',
      default: '[SelectProps](/components/select#api)',
      since: '-',
    } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('boolean | [SelectProps](/components/select#api)');
    expect(repaired.default).toBe('-');
    expect(repaired.since).toBe('');
  });

  it('Pattern B: default is identifier, since is shifted default', () => {
    const prop = {
      name: 'component',
      type: 'ComponentType \\',
      default: 'false',
      since: 'div',
    } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('ComponentType | false');
    expect(repaired.default).toBe('div');
    expect(repaired.since).toBe('');
  });

  it('Pattern B: default and since are backtick values', () => {
    const prop = {
      name: 'direction',
      type: '`vertical` \\',
      default: '`horizontal`',
      since: '`vertical`',
    } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('`vertical` | `horizontal`');
    expect(repaired.default).toBe('`vertical`');
    expect(repaired.since).toBe('');
  });

  it('Pattern C: type ends with \\, default is dash', () => {
    const prop = {
      name: 'height',
      type: 'string \\',
      default: 'number',
      since: '-',
    } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('string | number');
    expect(repaired.default).toBe('-');
    expect(repaired.since).toBe('');
  });

  it('handles type with backtick union and default with backticks', () => {
    const prop = {
      name: 'size',
      type: '`default` \\',
      default: '`small`',
      since: '`default`',
    } as PropData;
    const repaired = repairPipeSplit(prop);
    expect(repaired.type).toBe('`default` | `small`');
    expect(repaired.default).toBe('`default`');
    expect(repaired.since).toBe('');
  });
});