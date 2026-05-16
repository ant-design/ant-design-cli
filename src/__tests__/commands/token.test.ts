import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('token', () => {
  it('should show component tokens', async () => {
    const out = await run('token', 'Button');
    expect(out).toContain('contentFontSize');
    expect(out).toContain('defaultBg');
  });

  it('should show token as JSON', async () => {
    const out = await run('token', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('Button');
    expect(data.tokens.length).toBeGreaterThan(0);
  });

  it('should show global tokens', async () => {
    const out = await run('token');
    expect(out).toContain('Global Design Tokens');
    expect(out).toContain('Type');
  });

  it('should handle unknown component for token', async () => {
    const result = await runCLI('token', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });

  it('should show global tokens in markdown format', async () => {
    const out = await run('token', '--format', 'markdown');
    expect(out).toContain('Global Design Tokens');
    expect(out).toContain('|');
  });

  it('should show component tokens in markdown format', async () => {
    const out = await run('token', 'Button', '--format', 'markdown');
    expect(out).toContain('Button');
    expect(out).toContain('|');
  });

  it('should support --lang zh for tokens', async () => {
    const out = await run('token', '--lang', 'zh');
    expect(out).toContain('全局');
  });

  it('should support --lang zh for component tokens', async () => {
    const out = await run('token', 'Button', '--lang', 'zh');
    expect(out).toContain('组件');
  });

  it('should error on antd v3 (tokens not supported)', async () => {
    const result = await runCLI('token', '--version', '3.26.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UNSUPPORTED_VERSION_FEATURE');
  });

  it('should error on antd v4 (tokens not supported)', async () => {
    const result = await runCLI('token', '--version', '4.24.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UNSUPPORTED_VERSION_FEATURE');
  });
});