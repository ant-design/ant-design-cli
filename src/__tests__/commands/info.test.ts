import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('info', () => {
  it('should show component info', async () => {
    const out = await run('info', 'Button');
    expect(out).toContain('Button');
    expect(out).toContain('type');
    expect(out).toContain('disabled');
  });

  it('should show component info as JSON', async () => {
    const out = await run('info', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Button');
    expect(data.props.length).toBeGreaterThan(0);
  });

  it('should show detailed component info', async () => {
    const out = await run('info', 'Button', '--detail');
    expect(out).toContain('When to use');
    expect(out).toContain('Description');
  });

  it('should show info as markdown', async () => {
    const out = await run('info', 'Button', '--format', 'markdown');
    expect(out).toContain('Button');
    expect(out).toContain('type');
  });

  it('should support --lang zh for info', async () => {
    const out = await run('info', 'Button', '--lang', 'zh');
    expect(out).toContain('按钮用于开始一个即时操作');
  });

  it('should show "使用场景" label with --lang zh --detail', async () => {
    const out = await run('info', 'Button', '--detail', '--lang', 'zh');
    expect(out).toContain('使用场景');
  });

  it('should show "通用属性" label with --lang zh', async () => {
    const out = await run('info', 'Button', '--lang', 'zh');
    expect(out).toContain('通用属性');
  });

  it('should suggest correct name for typos', async () => {
    const result = await runCLI('info', 'Btn');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Did you mean 'Button'");
  });

  it('should handle unknown component', async () => {
    const result = await runCLI('info', 'NonExistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should show related components in detailed format', async () => {
    const out = await run('info', 'Button', '--detail', '--format', 'json');
    const data = JSON.parse(out);
    if (data.related && data.related.length > 0) {
      expect(Array.isArray(data.related)).toBe(true);
    }
  });

  it('should show markdown format for detailed info', async () => {
    const out = await run('info', 'Button', '--detail', '--format', 'markdown');
    expect(out).toContain('Button');
    expect(out).toContain('|');
  });

  it('should include subComponentProps in concise JSON output', async () => {
    const out = await run('info', 'Alert', '--version', '5.30.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.subComponentProps).toBeDefined();
    expect(Object.keys(data.subComponentProps).length).toBeGreaterThan(0);
    const firstSub = Object.values(data.subComponentProps)[0] as unknown[];
    expect(Array.isArray(firstSub)).toBe(true);
  });

  it('should print sub-component sections in text output', async () => {
    const out = await run('info', 'Alert', '--version', '5.30.0');
    expect(out).toContain('Alert.ErrorBoundary');
  });

  it('should print sub-component sections in markdown output', async () => {
    const out = await run('info', 'Alert', '--version', '5.30.0', '--format', 'markdown');
    expect(out).toContain('Alert.ErrorBoundary');
    expect(out).toContain('|');
  });

  it('should print sub-component sections in detail text output', async () => {
    const out = await run('info', 'Alert', '--version', '5.30.0', '--detail');
    expect(out).toContain('Alert.ErrorBoundary');
    expect(out).toContain('Description');
  });

  it('should include subComponentProps in detailed JSON output', async () => {
    const out = await run('info', 'Alert', '--version', '5.30.0', '--detail', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.subComponentProps).toBeDefined();
  });
});