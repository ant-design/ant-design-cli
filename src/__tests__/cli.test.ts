import { describe, it, expect } from 'vitest';
import { run, runCLI } from './helper.js';

describe('CLI', () => {
  it('should show help', async () => {
    const out = await run('--help');
    expect(out).toContain('antd');
    expect(out).toContain('list');
    expect(out).toContain('info');
    expect(out).toContain('demo');
  });

  it('should show CLI version with -V', async () => {
    const out = await run('-V');
    expect(out).toMatch(/^\d+\.\d+\.\d+[-\w.]*$/);
  });

  it('should output error as JSON to stderr', async () => {
    const result = await runCLI('info', 'Btn', '--format', 'json');
    expect(result.stdout).toBe('');
    const data = JSON.parse(result.stderr);
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
    expect(data.suggestion).toContain('Button');
  });
});