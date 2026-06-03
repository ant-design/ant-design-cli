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
    expect(out).toContain('| Component | Name (zh) | Description | Since |');
    expect(out).toContain('Button');
  });

  it('should show empty message when no components for an unknown major', async () => {
    const out = await run('list', '--version', '999.0.0');
    expect(out).toContain('No component data available');
  });

  it('should show empty message in Chinese with --lang zh for unknown version', async () => {
    const out = await run('list', '--version', '999.0.0', '--lang', 'zh');
    expect(out).toContain('没有可用的组件数据');
  });

  it('should show Chinese headers with --lang zh in text format', async () => {
    const out = await run('list', '--lang', 'zh');
    expect(out).toContain('组件');
    expect(out).toContain('描述');
    expect(out).toContain('版本');
  });

  it('should output empty JSON array when no components', async () => {
    const out = await run('list', '--version', '999.0.0', '--format', 'json');
    expect(JSON.parse(out)).toEqual([]);
  });
});