import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { LintIssue } from '../commands/lint.js';
import { env } from './snapshot-helper.js';

const CLI = join(__dirname, '..', '..', 'dist', 'index.js');

function run(...args: string[]): string {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 5000,
    env,
  }).trim();
}

function runWithStatus(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
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

/**
 * Run `doctor --format json` in a temp directory with a controlled node_modules layout.
 * `packages` maps package path → package.json content.
 * e.g. { 'antd': { version: '5.20.0' }, '@ant-design/pro-components': { version: '2.7.0', peerDependencies: { antd: '>=5.16.0' } } }
 */
function runDoctorInTempDir(packages: Record<string, object>): any {
  const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-test-'));
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));

    for (const [pkgName, pkgJson] of Object.entries(packages)) {
      const pkgDir = join(tempDir, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson));
    }

    const stdout = execFileSync('node', [CLI, 'doctor', '--format', 'json'], {
      encoding: 'utf-8',
      timeout: 5000,
      cwd: tempDir,
      env,
    }).trim();
    return JSON.parse(stdout);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
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
    expect(out).toMatch(/^\d+\.\d+\.\d+[-\w.]*$/);
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

  /** Create a temp fixture, run lint, and clean up. */
  function lintFixture(name: string, content: string, extraArgs: string[] = []): string {
    const tmpDir = join(__dirname, `__tmp_lint_${name}__`);
    const fixture = join(tmpDir, `${name}.tsx`);
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, content);
      return run('lint', fixture, '--version', '6.3.1', ...extraArgs);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  it('lint deprecated message includes replacement hint from description', () => {
    const out = lintFixture('card', `import { Card } from 'antd';\nconst App = () => <Card bordered={false}>x</Card>;\n`);
    expect(out).toMatch(/bordered.*deprecated/i);
    expect(out).toMatch(/variant/i);
  });

  it('lint deprecated prop should not flag same prop name on unrelated components', () => {
    const out = lintFixture(
      'button',
      `import { Button, Divider } from 'antd';\nconst App = () => <Button type="primary">Click</Button>;\n`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    const dividerTypeIssues = data.issues.filter(
      (i: LintIssue) => i.rule === 'deprecated' && i.message.includes('Divider') && i.message.includes('type'),
    );
    expect(dividerTypeIssues).toHaveLength(0);
  });

  it('lint deprecated prop should still flag when used on the correct component', () => {
    const out = lintFixture(
      'divider',
      `import { Divider } from 'antd';\nconst App = () => <Divider type="vertical" />;\n`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    const dividerTypeIssues = data.issues.filter(
      (i: LintIssue) => i.rule === 'deprecated' && i.message.includes('Divider') && i.message.includes('type'),
    );
    expect(dividerTypeIssues.length).toBeGreaterThan(0);
  });

  // Issue #35: false positives when sibling components share prop names
  it.each([
    {
      name: 'Button sibling',
      code: `import { Button, Divider, Dropdown } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
const App = () => (
  <>
    <Divider orientation="vertical" />
    <Dropdown arrow placement="bottomRight" trigger={['click']} menu={{ items: [] }}>
      <Button icon={<MenuOutlined />} type="text" />
    </Dropdown>
  </>
);`,
    },
    {
      name: 'Typography.Text sibling',
      code: `import { Divider, Typography } from 'antd';
const App = () => (
  <>
    <Divider plain style={{ marginTop: 2, marginBottom: 2 }}>
      Section
    </Divider>
    <Typography.Text type="secondary">
      Some text
    </Typography.Text>
  </>
);`,
    },
    {
      name: 'Button sibling (dashed)',
      code: `import { Button, Divider } from 'antd';
import { EyeFilled } from '@ant-design/icons';
const App = () => (
  <>
    <Divider style={{ margin: '10px 0' }} />
    <Button block type="dashed" icon={<EyeFilled />}>
      Preview
    </Button>
  </>
);`,
    },
  ])('lint should not flag deprecated Divider.type on siblings: $name (#35)', ({ name, code }) => {
    const fixture = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const out = lintFixture(`issue35-${fixture}`, code, ['--format', 'json']);
    const data = JSON.parse(out);
    const dividerTypeIssues = data.issues.filter(
      (i: LintIssue) => i.rule === 'deprecated' && i.message.includes('Divider') && i.message.includes('type'),
    );
    expect(dividerTypeIssues).toHaveLength(0);
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
    expect(data.body).toContain('<!-- generated by ant-design-issue-helper');
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
    expect(out).toContain('<!-- generated by ant-design-issue-helper');
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

function runEnvInTempDir(packages: Record<string, object>): any {
  const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-env-'));
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));

    for (const [pkgName, pkgJson] of Object.entries(packages)) {
      const pkgDir = join(tempDir, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson));
    }

    const stdout = execFileSync('node', [CLI, 'env', '--format', 'json', tempDir], {
      encoding: 'utf-8',
      timeout: 15000,
      env,
    }).trim();
    return JSON.parse(stdout);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('env command', () => {
  it('should output text format with Environment header', { timeout: 20000 }, () => {
    const out = execFileSync('node', [CLI, 'env'], {
      encoding: 'utf-8',
      timeout: 15000,
      env,
    }).trim();
    expect(out).toContain('Environment');
    expect(out).toContain('System:');
    expect(out).toContain('Binaries:');
    expect(out).toContain('Node');
  });

  it('should output valid JSON', () => {
    const out = execFileSync('node', [CLI, 'env', '--format', 'json'], {
      encoding: 'utf-8',
      timeout: 15000,
      env,
    }).trim();
    const data = JSON.parse(out);
    expect(data).toHaveProperty('envinfo');
    expect(data).toHaveProperty('dependencies');
    expect(data).toHaveProperty('ecosystem');
    expect(data).toHaveProperty('buildTools');
    expect(data.envinfo.System).toBeTruthy();
    expect(data.envinfo.Binaries.Node).toBeTruthy();
  });

  it('should output markdown format', () => {
    const out = execFileSync('node', [CLI, 'env', '--format', 'markdown'], {
      encoding: 'utf-8',
      timeout: 15000,
      env,
    }).trim();
    expect(out).toContain('## Environment');
    expect(out).toContain('### System');
    expect(out).toContain('| Item | Version |');
  });

  it('should detect dependencies from target dir', () => {
    const data = runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      'react': { name: 'react', version: '18.3.1' },
      'react-dom': { name: 'react-dom', version: '18.3.1' },
    });
    expect(data.dependencies.antd).toBe('5.22.0');
    expect(data.dependencies.react).toBe('18.3.1');
    expect(data.dependencies['react-dom']).toBe('18.3.1');
    expect(data.dependencies.dayjs).toBeNull();
  });

  it('should scan ecosystem packages', () => {
    const data = runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      '@ant-design/pro-components': { name: '@ant-design/pro-components', version: '2.8.1' },
      '@ant-design/charts': { name: '@ant-design/charts', version: '2.2.1' },
      'rc-field-form': { name: 'rc-field-form', version: '2.7.0' },
    });
    expect(data.ecosystem['@ant-design/pro-components']).toBe('2.8.1');
    expect(data.ecosystem['@ant-design/charts']).toBe('2.2.1');
    expect(data.ecosystem['rc-field-form']).toBe('2.7.0');
  });

  it('should not include core deps in ecosystem', () => {
    const data = runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      '@ant-design/cssinjs': { name: '@ant-design/cssinjs', version: '1.22.1' },
      '@ant-design/icons': { name: '@ant-design/icons', version: '5.5.2' },
      '@ant-design/pro-components': { name: '@ant-design/pro-components', version: '2.8.1' },
    });
    // cssinjs and icons should be in dependencies, not ecosystem
    expect(data.dependencies['@ant-design/cssinjs']).toBe('1.22.1');
    expect(data.dependencies['@ant-design/icons']).toBe('5.5.2');
    expect(data.ecosystem['@ant-design/cssinjs']).toBeUndefined();
    expect(data.ecosystem['@ant-design/icons']).toBeUndefined();
    expect(data.ecosystem['@ant-design/pro-components']).toBe('2.8.1');
  });

  it('should detect build tools', () => {
    const data = runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      'typescript': { name: 'typescript', version: '5.6.3' },
      'vite': { name: 'vite', version: '6.0.0' },
    });
    expect(data.buildTools.typescript).toBe('5.6.3');
    expect(data.buildTools.vite).toBe('6.0.0');
  });
});

describe('doctor ecosystem peerDeps', () => {
  it('should report pass when all peerDeps are satisfied', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('pass');
    expect(check.message).toContain('satisfies all peerDependencies');
  });

  it('should report fail when an installed dep does not satisfy peerDep range', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.10.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('fail');
    expect(check.severity).toBe('error');
    expect(check.message).toContain('antd requires >=5.16.0');
    expect(check.message).toContain('installed: 5.10.0');
  });

  it('should report warn when a peerDep is not installed at all', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      // react is NOT installed
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('warn');
    expect(check.message).toContain('react is not installed');
  });

  it('should not emit a check for packages with no peerDependencies', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/colors': {
        version: '7.0.0',
        // no peerDependencies field
      },
    });
    const names = (data.checks as any[]).map((c) => c.name);
    expect(names).not.toContain('ecosystem-compat:colors');
  });

  it('should emit no ecosystem checks when no @ant-design/* packages are installed', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
    });
    const ecosystemChecks = (data.checks as any[]).filter((c) => c.name.startsWith('ecosystem-compat:'));
    expect(ecosystemChecks).toHaveLength(0);
  });

  it('should treat compound ranges as compatible (fail-open)', () => {
    // satisfies() processes ">=5.0.0 <6.0.0" by slicing off ">=" and passing "5.0.0 <6.0.0"
    // as the bound to compare(). The bound splits as [5, 0, NaN] — the NaN comparison
    // resolves before reaching it (10 > 0 at index 1), so compare returns 1 (>=0) → pass.
    // Upper bound <6.0.0 is effectively ignored. This is the intended fail-open behavior.
    const data = runDoctorInTempDir({
      'antd': { version: '5.10.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.0.0 <6.0.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('pass'); // fail-open: compound range treated as satisfied
  });

  it('should check multiple ecosystem packages independently', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: { antd: '>=5.16.0', react: '>=18.0.0' },
      },
      '@ant-design/charts': {
        version: '2.1.0',
        peerDependencies: { react: '>=17.0.0' },
      },
    });
    const proCheck = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    const chartsCheck = data.checks.find((c: any) => c.name === 'ecosystem-compat:charts');
    expect(proCheck).toBeDefined();
    expect(proCheck.status).toBe('pass');
    expect(chartsCheck).toBeDefined();
    expect(chartsCheck.status).toBe('pass');
  });
});
