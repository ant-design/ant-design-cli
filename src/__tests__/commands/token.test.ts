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
});