import { describe, it, expect } from 'vitest';
import { run } from '../helper.js';

describe('list', () => {
  it('should list components', async () => {
    const out = await run('list');
    expect(out).toContain('Button');
    expect(out).toContain('Table');
    expect(out).toContain('Select');
  });

  it('should list components as JSON', async () => {
    const out = await run('list', '--format', 'json');
    const data = JSON.parse(out);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('name');
  });

  it('should support --lang zh', async () => {
    const out = await run('list', '--lang', 'zh');
    expect(out).toContain('按钮');
  });

  it('should show list as markdown', async () => {
    const out = await run('list', '--format', 'markdown');
    expect(out).toContain('# antd Components');
    expect(out).toContain('**Button**');
  });
});