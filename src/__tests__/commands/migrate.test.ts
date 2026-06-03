import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('migrate', () => {
  it('should show migration guide', async () => {
    const out = await run('migrate', '4', '5');
    expect(out).toContain('Migration Guide');
    expect(out).toContain('Select');
    expect(out).toContain('popupClassName');
  });

  it('should show migration guide in Chinese with --lang zh', async () => {
    const out = await run('migrate', '4', '5', '--lang', 'zh');
    expect(out).toContain('迁移指南');
    expect(out).toContain('合计');
  });

  it('should show migration guide as JSON', async () => {
    const out = await run('migrate', '4', '5', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.from).toBe('4');
    expect(data.to).toBe('5');
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('should show migrate --apply as agent prompt', async () => {
    const out = await run('migrate', '4', '5', '--apply', '/tmp');
    expect(out).toContain('Auto-Migration Prompt');
    expect(out).toContain('/tmp');
    expect(out).toContain('Auto-fixable Changes');
    expect(out).toContain('Manual Changes');
  });

  it('should show migrate --apply as JSON', async () => {
    const out = await run('migrate', '4', '5', '--apply', './src', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.from).toBe('4');
    expect(data.to).toBe('5');
    expect(data.targetDir).toBe('./src');
    expect(data.autoFixSteps.length).toBeGreaterThan(0);
    expect(data.manualSteps.length).toBeGreaterThan(0);
  });

  it('should show migrate --component filter', async () => {
    const out = await run('migrate', '4', '5', '--component', 'Select');
    expect(out).toContain('Select');
    expect(out).toContain('popupClassName');
    expect(out).not.toContain('BackTop');
  });

  it('should show migrate as markdown', async () => {
    const out = await run('migrate', '4', '5', '--format', 'markdown');
    expect(out).toContain('# Migration Guide');
    expect(out).toContain('## ');
    expect(out).toContain('```tsx');
  });

  it('should show migrate v5 to v6', async () => {
    const out = await run('migrate', '5', '6');
    expect(out).toContain('Button');
    expect(out).toContain('variant');
  });

  it('should handle invalid migration path', async () => {
    const result = await runCLI('migrate', '3', '6');
    expect(result.exitCode).toBe(1);
  });

  it('should show v5 to v6 migration with many steps', async () => {
    const out = await run('migrate', '5', '6', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.steps.length).toBeGreaterThan(10);
    const breaking = data.steps.filter((s: any) => s.breaking);
    const nonBreaking = data.steps.filter((s: any) => !s.breaking);
    expect(breaking.length).toBeGreaterThan(0);
    expect(nonBreaking.length).toBeGreaterThan(0);
  });

  it('should show v4 to v5 migration with 30+ steps', async () => {
    const out = await run('migrate', '4', '5', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.steps.length).toBeGreaterThanOrEqual(30);
  });

  it('should error when --component filters out everything', async () => {
    const result = await runCLI('migrate', '4', '5', '--component', 'NonExistentComponent', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });
});