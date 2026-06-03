import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('semantic', () => {
  it('should show semantic structure', async () => {
    const out = await run('semantic', 'Drawer');
    expect(out).toContain('header');
    expect(out).toContain('body');
    expect(out).toContain('classNames');
  });

  it('should show semantic as JSON', async () => {
    const out = await run('semantic', 'Drawer', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Drawer');
    expect(data.semanticStructure.length).toBeGreaterThan(0);
  });

  it('should handle unknown component for semantic', async () => {
    const result = await runCLI('semantic', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });

  it('should error on antd v4 (semantic not supported)', async () => {
    const result = await runCLI('semantic', 'Button', '--version', '4.24.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UNSUPPORTED_VERSION_FEATURE');
  });

  it('should error on antd v3 (semantic not supported)', async () => {
    const result = await runCLI('semantic', 'Button', '--version', '3.26.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('UNSUPPORTED_VERSION_FEATURE');
  });

  it('should print empty-state message when component has no semantic structure', async () => {
    const out = await run('semantic', 'Affix', '--version', '5.30.0');
    expect(out).toContain('No semantic structure data available for Affix');
  });

  it('should show semantic as markdown table', async () => {
    const out = await run('semantic', 'Drawer', '--format', 'markdown');
    expect(out).toContain('## Drawer Semantic Structure');
    expect(out).toContain('| Key | Description |');
    expect(out).toContain('mask');
    expect(out).toContain('```tsx');
    expect(out).toContain('classNames');
  });

  it('should show semantic as markdown table in Chinese', async () => {
    const out = await run('semantic', 'Drawer', '--format', 'markdown', '--lang', 'zh');
    expect(out).toContain('## Drawer 语义结构');
    expect(out).toContain('| 键名 | 描述 |');
    expect(out).toContain('**用法:**');
  });

  it('should show semantic structure in Chinese with --lang zh', async () => {
    const out = await run('semantic', 'Drawer', '--lang', 'zh');
    expect(out).toContain('语义结构');
    expect(out).toContain('用法');
  });

  it('should print empty-state message in Chinese with --lang zh', async () => {
    const out = await run('semantic', 'Affix', '--version', '5.30.0', '--lang', 'zh');
    expect(out).toContain('没有可用的语义结构数据');
  });
});