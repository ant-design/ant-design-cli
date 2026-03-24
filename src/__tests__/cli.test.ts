import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CLI = join(__dirname, '..', '..', 'dist', 'index.js');

function run(...args: string[]): string {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 5000,
  }).trim();
}

function runWithStatus(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
      exitCode: err.status ?? 1,
    };
  }
}

describe('CLI e2e', () => {
  it('should show help', () => {
    const out = run('--help');
    expect(out).toContain('antd');
    expect(out).toContain('list');
    expect(out).toContain('info');
    expect(out).toContain('demo');
  });

  it('should list components', () => {
    const out = run('list');
    expect(out).toContain('Button');
    expect(out).toContain('Table');
    expect(out).toContain('Select');
  });

  it('should list components as JSON', () => {
    const out = run('list', '--format', 'json');
    const data = JSON.parse(out);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('name');
  });

  it('should show component info', () => {
    const out = run('info', 'Button');
    expect(out).toContain('Button');
    expect(out).toContain('type');
    expect(out).toContain('disabled');
  });

  it('should show component info as JSON', () => {
    const out = run('info', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Button');
    expect(data.props.length).toBeGreaterThan(0);
  });

  it('should show detailed component info', () => {
    const out = run('info', 'Button', '--detail');
    expect(out).toContain('When to use');
    expect(out).toContain('Description');
  });

  it('should list demos', () => {
    const out = run('demo', 'Button');
    expect(out).toContain('basic');
    expect(out).toContain('Syntactic sugar');
  });

  it('should get specific demo code', () => {
    const out = run('demo', 'Button', 'basic');
    expect(out).toContain('import');
    expect(out).toContain('Button');
  });

  it('should show demo as JSON', () => {
    const out = run('demo', 'Button', 'basic', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('Button');
    expect(data.demo).toBe('basic');
    expect(data.code).toContain('import');
  });

  it('should show component tokens', () => {
    const out = run('token', 'Button');
    expect(out).toContain('contentFontSize');
    expect(out).toContain('defaultBg');
  });

  it('should show semantic structure', () => {
    const out = run('semantic', 'Drawer');
    expect(out).toContain('header');
    expect(out).toContain('body');
    expect(out).toContain('classNames');
  });

  it('should suggest correct name for typos', () => {
    const result = runWithStatus('info', 'Btn');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Did you mean 'Button'");
  });

  it('should handle unknown component', () => {
    const result = runWithStatus('info', 'NonExistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });


  // ─── Doc command ────────────────────────────────────────────────────

  it('should show full doc for a component', () => {
    const out = run('doc', 'Button');
    expect(out).toContain('Button');
    expect(out).toContain('API');
  });

  it('should show doc as JSON', () => {
    const out = run('doc', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Button');
    expect(typeof data.doc).toBe('string');
    expect(data.doc.length).toBeGreaterThan(0);
  });

  it('should show doc in Chinese', () => {
    const out = run('doc', 'Button', '--lang', 'zh');
    expect(out).toContain('按钮');
  });

  it('should handle doc not found for unknown component', () => {
    const result = runWithStatus('doc', 'NonExistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should suggest correct name for doc typo', () => {
    const result = runWithStatus('doc', 'Btn');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Did you mean 'Button'");
  });

  it('should show changelog', () => {
    const out = run('changelog', '5.21.0');
    expect(out).toContain('5.21.0');
    expect(out).toContain('Segmented');
  });

  it('should show changelog range', () => {
    const out = run('changelog', '5.20.0..5.22.0');
    expect(out).toContain('5.20.0');
    expect(out).toContain('5.21.0');
    expect(out).toContain('5.22.0');
  });

  it('should show migration guide', () => {
    const out = run('migrate', '4', '5');
    expect(out).toContain('Migration Guide');
    expect(out).toContain('Select');
    expect(out).toContain('popupClassName');
  });

  it('should show migration guide as JSON', () => {
    const out = run('migrate', '4', '5', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.from).toBe('4');
    expect(data.to).toBe('5');
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('should run doctor', () => {
    const out = run('doctor');
    expect(out).toContain('antd Doctor');
    expect(out).toContain('Summary');
  });


  it('should output error as JSON to stderr', () => {
    const result = runWithStatus('info', 'Btn', '--format', 'json');
    // JSON errors go to stderr, stdout should be empty
    expect(result.stdout).toBe('');
    const data = JSON.parse(result.stderr);
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
    expect(data.suggestion).toContain('Button');
  });

  it('should show CLI version with -V', () => {
    const out = run('-V');
    expect(out).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should support --lang zh', () => {
    const out = run('list', '--lang', 'zh');
    expect(out).toContain('按钮');
  });

  it('should support --lang zh for info', () => {
    const out = run('info', 'Button', '--lang', 'zh');
    expect(out).toContain('按钮用于开始一个即时操作');
  });

  it('should show list as markdown', () => {
    const out = run('list', '--format', 'markdown');
    expect(out).toContain('# antd Components');
    expect(out).toContain('**Button**');
  });

  it('should show token as JSON', () => {
    const out = run('token', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('Button');
    expect(data.tokens.length).toBeGreaterThan(0);
  });

  it('should show semantic as JSON', () => {
    const out = run('semantic', 'Drawer', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Drawer');
    expect(data.semanticStructure.length).toBeGreaterThan(0);
  });

  it('should handle demo not found', () => {
    const result = runWithStatus('demo', 'Button', 'nonexistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should handle changelog version not found', () => {
    const result = runWithStatus('changelog', '5.99.99');
    expect(result.exitCode).toBe(1);
  });

  it('should show changelog as JSON', () => {
    const out = run('changelog', '5.21.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].version).toBe('5.21.0');
  });

  it('should show doctor as JSON', () => {
    const out = run('doctor', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.checks).toBeDefined();
    expect(data.summary).toBeDefined();
    // Verify all new check names are present
    const names = (data.checks as Array<{ name: string }>).map(c => c.name);
    expect(names).toContain('dayjs-duplicate');
    expect(names).toContain('cssinjs-duplicate');
    expect(names).toContain('cssinjs-compat');
    expect(names).toContain('icons-compat');
  });

  it('should show migrate --apply as agent prompt', () => {
    const out = run('migrate', '4', '5', '--apply', '/tmp');
    expect(out).toContain('Auto-Migration Prompt');
    expect(out).toContain('/tmp');
    expect(out).toContain('Auto-fixable Changes');
    expect(out).toContain('Manual Changes');
  });

  it('should show migrate --apply as JSON', () => {
    const out = run('migrate', '4', '5', '--apply', './src', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.from).toBe('4');
    expect(data.to).toBe('5');
    expect(data.targetDir).toBe('./src');
    expect(data.autoFixSteps.length).toBeGreaterThan(0);
    expect(data.manualSteps.length).toBeGreaterThan(0);
  });

  it('should show migrate --component filter', () => {
    const out = run('migrate', '4', '5', '--component', 'Select');
    expect(out).toContain('Select');
    expect(out).toContain('popupClassName');
    expect(out).not.toContain('BackTop');
  });

  it('should show migrate as markdown', () => {
    const out = run('migrate', '4', '5', '--format', 'markdown');
    expect(out).toContain('# Migration Guide');
    expect(out).toContain('## ');
    expect(out).toContain('```tsx');
  });

  it('should show migrate v5 to v6', () => {
    const out = run('migrate', '5', '6');
    expect(out).toContain('Button');
    expect(out).toContain('variant');
  });

  it('should handle invalid migration path', () => {
    const result = runWithStatus('migrate', '3', '6');
    expect(result.exitCode).toBe(1);
  });

  // ─── Additional edge case tests ─────────────────────────────────────────


  // Doctor edge cases
  it('should run doctor as markdown', () => {
    const out = run('doctor', '--format', 'markdown');
    expect(out).toContain('antd Doctor');
  });

  // Token edge cases
  it('should show global tokens', () => {
    const out = run('token');
    expect(out).toContain('Global Design Tokens');
    expect(out).toContain('Type');
  });

  it('should handle unknown component for token', () => {
    const result = runWithStatus('token', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });

  // Semantic edge cases
  it('should handle unknown component for semantic', () => {
    const result = runWithStatus('semantic', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });

  // Info edge cases
  it('should show info as markdown', () => {
    const out = run('info', 'Button', '--format', 'markdown');
    expect(out).toContain('Button');
    expect(out).toContain('type');
  });

  // Usage command
  it('should scan usage in current directory', () => {
    const out = run('usage', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('components');
  });

  // Lint command
  it('should lint current directory', () => {
    const out = run('lint', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('issues');
  });

  it('lint deprecated message includes replacement hint from description', () => {
    const tmpDir = join(__dirname, '__tmp_lint_deprecated__');
    const fixture = join(tmpDir, 'card-test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import { Card } from 'antd';\nconst App = () => <Card bordered={false}>x</Card>;\n`);
      const out = run('lint', fixture, '--version', '6.3.1');
      expect(out).toMatch(/bordered.*deprecated/i);
      expect(out).toMatch(/variant/i);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('changelog should error when from > to', () => {
    const result = runWithStatus('changelog', '5.5.0', '5.1.0');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('newer than');
  });

  // Changelog edge cases
  it('should show API diff between versions', () => {
    const out = run('changelog', '5.0.0', '5.24.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('from');
    expect(data).toHaveProperty('to');
  });

  // v5→v6 migration completeness
  it('should show v5 to v6 migration with many steps', () => {
    const out = run('migrate', '5', '6', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.steps.length).toBeGreaterThan(10);
    // Should include both breaking and non-breaking
    const breaking = data.steps.filter((s: any) => s.breaking);
    const nonBreaking = data.steps.filter((s: any) => !s.breaking);
    expect(breaking.length).toBeGreaterThan(0);
    expect(nonBreaking.length).toBeGreaterThan(0);
  });

  // v4→v5 migration completeness
  it('should show v4 to v5 migration with 30+ steps', () => {
    const out = run('migrate', '4', '5', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.steps.length).toBeGreaterThanOrEqual(30);
  });

  // antd bug command
  it('should preview a bug report as text', () => {
    const out = run('bug', '--title', 'Test bug');
    expect(out).toContain('Repository: ant-design/ant-design');
    expect(out).toContain('Title: Test bug');
    expect(out).toContain('--- Issue Body ---');
    expect(out).toContain('### Reproduction link');
    expect(out).toContain('To submit, re-run with --submit flag.');
  });

  it('should preview a bug report as JSON', () => {
    const out = run('bug', '--title', 'Test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design');
    expect(data.title).toBe('Test bug');
    expect(data.body).toContain('<!-- generated by @ant-design/cli');
    expect(data.url).toContain('https://github.com/ant-design/ant-design/issues/new');
  });

  it('should include provided fields in bug report', () => {
    const out = run('bug', '--title', 'Test', '--steps', 'Click button', '--expected', 'Works', '--actual', 'Crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toContain('Click button');
    expect(data.body).toContain('Works');
    expect(data.body).toContain('Crashes');
  });

  it('should preview bug report as markdown (raw body)', () => {
    const out = run('bug', '--title', 'Test', '--format', 'markdown');
    expect(out).toContain('<!-- generated by @ant-design/cli');
    expect(out).not.toContain('Repository:');
  });

  it('should error when --title is missing for bug', () => {
    const result = runWithStatus('bug', '--format', 'json');
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('TITLE_REQUIRED');
    expect(err.message).toContain('--title');
  });

  // antd bug-cli command
  it('should preview a bug-cli report as text', () => {
    const out = run('bug-cli', '--title', 'CLI test bug');
    expect(out).toContain('Repository: ant-design/ant-design-cli');
    expect(out).toContain('Title: CLI test bug');
    expect(out).toContain('### Description');
  });

  it('should preview a bug-cli report as JSON', () => {
    const out = run('bug-cli', '--title', 'CLI test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design-cli');
    expect(data.title).toBe('CLI test bug');
    expect(data.body).toContain('### Description');
    expect(data.body).toContain('@ant-design/cli');
    expect(data.url).toContain('https://github.com/ant-design/ant-design-cli/issues/new');
  });

  it('should include description in bug-cli report', () => {
    const out = run('bug-cli', '--title', 'Test', '--description', 'Info crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toContain('Info crashes');
  });
});
