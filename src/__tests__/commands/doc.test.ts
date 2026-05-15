import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('doc', () => {
  it('should show full doc for a component', async () => {
    const out = await run('doc', 'Button');
    expect(out).toContain('Button');
    expect(out).toContain('API');
  });

  it('should show doc as JSON', async () => {
    const out = await run('doc', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Button');
    expect(typeof data.doc).toBe('string');
    expect(data.doc.length).toBeGreaterThan(0);
  });

  it('should show doc in Chinese', async () => {
    const out = await run('doc', 'Button', '--lang', 'zh');
    expect(out).toContain('按钮');
  });

  it('should handle doc not found for unknown component', async () => {
    const result = await runCLI('doc', 'NonExistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should suggest correct name for doc typo', async () => {
    const result = await runCLI('doc', 'Btn');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Did you mean 'Button'");
  });
});