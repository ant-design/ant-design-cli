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
});