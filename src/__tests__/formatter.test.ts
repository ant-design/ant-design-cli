import { describe, it, expect, vi, afterEach } from 'vitest';
import { output, formatTable, outputTokens } from '../output/formatter.js';

describe('formatter', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  function capture(fn: () => void): string {
    let captured = '';
    logSpy = vi.spyOn(console, 'log').mockImplementation((...a) => {
      captured += a.map(String).join(' ') + '\n';
    });
    try {
      fn();
    } finally {
      logSpy.mockRestore();
    }
    return captured.trim();
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('output()', () => {
    it('formats string as-is for text', () => {
      const out = capture(() => output('hello', 'text'));
      expect(out).toBe('hello');
    });

    it('formats array as text (joined lines)', () => {
      const out = capture(() => output(['a', 'b'], 'text'));
      expect(out).toBe('a\nb');
    });

    it('formats object as key: value pairs in text', () => {
      const out = capture(() => output({ a: 1, b: 'x' }, 'text'));
      expect(out).toContain('a: 1');
      expect(out).toContain('b: x');
    });

    it('formats object with array values across lines in text', () => {
      const out = capture(() => output({ items: ['x', 'y'] }, 'text'));
      expect(out).toContain('items:');
      expect(out).toContain('  x');
      expect(out).toContain('  y');
    });

    it('formats primitive as text', () => {
      const out = capture(() => output(42, 'text'));
      expect(out).toBe('42');
    });

    it('formats string as-is for markdown', () => {
      const out = capture(() => output('hi', 'markdown'));
      expect(out).toBe('hi');
    });

    it('formats object as fenced JSON block for markdown', () => {
      const out = capture(() => output({ a: 1 }, 'markdown'));
      expect(out).toContain('```json');
      expect(out).toContain('"a": 1');
      expect(out).toContain('```');
    });

    it('formats primitive as string for markdown', () => {
      const out = capture(() => output(42, 'markdown'));
      expect(out).toBe('42');
    });

    it('formats data as JSON for json format', () => {
      const out = capture(() => output({ a: 1 }, 'json'));
      expect(JSON.parse(out)).toEqual({ a: 1 });
    });
  });

  describe('formatTable()', () => {
    it('returns JSON array of objects when format is json', () => {
      const json = formatTable(['k', 'v'], [['a', '1'], ['b', '2']], 'json');
      const parsed = JSON.parse(json);
      expect(parsed).toEqual([{ k: 'a', v: '1' }, { k: 'b', v: '2' }]);
    });

    it('renders markdown table with pipe escaping', () => {
      const md = formatTable(['a', 'b'], [['x|y', 'z']], 'markdown');
      expect(md).toContain('| a | b |');
      expect(md).toContain('| ---');
      expect(md).toContain('x\\|y');
    });

    it('renders aligned text table', () => {
      const txt = formatTable(['name', 'val'], [['short', '1'], ['longer', '22']], 'text');
      const lines = txt.split('\n');
      expect(lines[0]).toContain('name');
      expect(lines[0]).toContain('val');
      expect(lines[1]).toMatch(/^-+/);
    });
  });

  describe('outputTokens()', () => {
    it('outputs JSON when format is json (global)', () => {
      const out = capture(() => outputTokens({ tokens: [{ name: 't', type: 'string', default: 'x', description: 'desc', descriptionZh: '说明' }] } as never, { format: 'json', lang: 'en' }));
      const data = JSON.parse(out);
      expect(data.tokens[0].name).toBe('t');
    });

    it('outputs JSON when format is json (component)', () => {
      const out = capture(() => outputTokens({ component: 'Button', tokens: [] }, { format: 'json', lang: 'en' }));
      expect(JSON.parse(out)).toEqual({ component: 'Button', tokens: [] });
    });

    it('prints empty-state message for global tokens (en)', () => {
      const out = capture(() => outputTokens({ tokens: [] }, { format: 'text', lang: 'en' }));
      expect(out).toContain('No global token data');
    });

    it('prints empty-state message for global tokens (zh)', () => {
      const out = capture(() => outputTokens({ tokens: [] }, { format: 'text', lang: 'zh' }));
      expect(out).toContain('暂无全局 Token');
    });

    it('prints empty-state message for component tokens (en)', () => {
      const out = capture(() => outputTokens({ component: 'Button', tokens: [] }, { format: 'text', lang: 'en' }));
      expect(out).toContain('No component tokens available for Button');
    });

    it('prints empty-state message for component tokens (zh)', () => {
      const out = capture(() => outputTokens({ component: 'Button', tokens: [] }, { format: 'text', lang: 'zh' }));
      expect(out).toContain('Button 组件暂无可用 Token');
    });

    it('prints global tokens table (text)', () => {
      const out = capture(() => outputTokens(
        { tokens: [{ name: 'colorPrimary', type: 'string', default: '#000', description: 'Primary color', descriptionZh: '主色' }] } as never,
        { format: 'text', lang: 'en' },
      ));
      expect(out).toContain('Global Design Tokens');
      expect(out).toContain('colorPrimary');
    });

    it('prints global tokens table in zh', () => {
      const out = capture(() => outputTokens(
        { tokens: [{ name: 'colorPrimary', type: 'string', default: '#000', description: 'Primary color', descriptionZh: '主色' }] } as never,
        { format: 'text', lang: 'zh' },
      ));
      expect(out).toContain('全局 Design Tokens');
      expect(out).toContain('主色');
    });

    it('prints component tokens table in markdown', () => {
      const out = capture(() => outputTokens(
        { component: 'Button', tokens: [{ name: 'buttonBg', type: 'string', default: '#fff', description: '', descriptionZh: '' }] } as never,
        { format: 'markdown', lang: 'en' },
      ));
      expect(out).toContain('Button Component Tokens');
      expect(out).toContain('| Token');
      expect(out).toContain('buttonBg');
    });
  });
});
