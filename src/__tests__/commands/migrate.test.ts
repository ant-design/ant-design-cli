import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { run, runCLI } from '../helper.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '__fixtures_migrate_tmp__');

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, 'App.tsx'), `
import { Button, Select, Form } from 'antd';
const App = () => (
  <Form>
    <Select dropdownClassName="old" />
    <Button type="primary">OK</Button>
  </Form>
);
`);
  writeFileSync(join(FIXTURE_DIR, 'Other.tsx'), `
import { Input } from 'antd';
const Other = () => <Input />;
`);
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

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

  describe('--apply with antd components', () => {
    it('should filter steps to only used components', async () => {
      const out = await run('migrate', '5', '6', '--apply', FIXTURE_DIR);
      expect(out).toContain('Detected antd components:');
      expect(out).toContain('Button');
      expect(out).toContain('Select');
      expect(out).toContain('Form');
      // DatePicker is not imported, should not appear as a step
      expect(out).not.toContain('DatePicker:');
      expect(out).not.toContain('Drawer:');
    });

    it('should list affected files for pattern-matched steps', async () => {
      const out = await run('migrate', '5', '6', '--apply', FIXTURE_DIR);
      // Button type="primary" pattern should match App.tsx
      expect(out).toContain('App.tsx');
      expect(out).toContain('Affected files:');
    });

    it('should list component files as fallback when no pattern match', async () => {
      const out = await run('migrate', '5', '6', '--apply', FIXTURE_DIR);
      expect(out).toContain('Files using this component:');
    });

    it('should include scan results in JSON format', async () => {
      const out = await run('migrate', '5', '6', '--apply', FIXTURE_DIR, '--format', 'json');
      const data = JSON.parse(out);
      expect(data.scan.fileCount).toBe(2);
      expect(data.scan.components).toHaveProperty('Button');
      expect(data.scan.components).toHaveProperty('Select');
      expect(data.scan.components).not.toHaveProperty('DatePicker');
    });

    it('should include affectedFiles in JSON steps', async () => {
      const out = await run('migrate', '5', '6', '--apply', FIXTURE_DIR, '--format', 'json');
      const data = JSON.parse(out);
      const buttonStep = data.autoFixSteps.find((s: any) => s.component === 'Button');
      expect(buttonStep).toBeDefined();
      expect(buttonStep.affectedFiles.length).toBeGreaterThan(0);
      expect(buttonStep.affectedFiles.some((f: string) => f.includes('App.tsx'))).toBe(true);
    });

    it('should work with --component filter combined with --apply', async () => {
      const out = await run('migrate', '5', '6', '--apply', FIXTURE_DIR, '--component', 'Button');
      expect(out).toContain('Button');
      expect(out).not.toContain('Select:');
      expect(out).not.toContain('Form:');
      // Global steps should still be excluded when --component is used
      expect(out).not.toContain('Global:');
    });
  });
});