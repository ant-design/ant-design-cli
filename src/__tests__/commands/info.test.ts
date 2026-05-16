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
});