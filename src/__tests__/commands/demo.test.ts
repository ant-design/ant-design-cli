import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('demo', () => {
  it('should list demos', async () => {
    const out = await run('demo', 'Button');
    expect(out).toContain('basic');
    expect(out).toContain('Syntactic sugar');
  });

  it('should get specific demo code', async () => {
    const out = await run('demo', 'Button', 'basic');
    expect(out).toContain('import');
    expect(out).toContain('Button');
  });

  it('should show demo as JSON', async () => {
    const out = await run('demo', 'Button', 'basic', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('Button');
    expect(data.demo).toBe('basic');
    expect(data.code).toContain('import');
  });

  it('should handle demo not found', async () => {
    const result = await runCLI('demo', 'Button', 'nonexistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should show demo list in Chinese with --lang zh', async () => {
    const out = await run('demo', 'Button', '--lang', 'zh');
    expect(out).toContain('示例：');
  });
});