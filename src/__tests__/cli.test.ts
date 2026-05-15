import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { LintIssue } from '../commands/lint.js';
import { runCLI } from './helper.js';

async function run(...args: string[]): Promise<string> {
  const result = await runCLI(...args);
  return result.stdout;
}

async function runWithStatus(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runCLI(...args);
}

/**
 * Run `doctor --format json` in a temp directory with a controlled node_modules layout.
 * `packages` maps package path → package.json content.
 */
async function runDoctorInTempDir(packages: Record<string, object>): Promise<any> {
  const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-test-'));
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));

    for (const [pkgName, pkgJson] of Object.entries(packages)) {
      const pkgDir = join(tempDir, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson));
    }

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    try {
      const result = await runCLI('doctor', '--format', 'json');
      return JSON.parse(result.stdout);
    } finally {
      cwdSpy.mockRestore();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('CLI e2e', () => {
  it('should show help', async () => {
    const out = await run('--help');
    expect(out).toContain('antd');
    expect(out).toContain('list');
    expect(out).toContain('info');
    expect(out).toContain('demo');
  });

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

  it('should show component info', async () => {
    const out = await run('info', 'Button');
    expect(out).toContain('Button');
    expect(out).toContain('type');
    expect(out).toContain('disabled');
  });

  it('should show component info as JSON', async () => {
    const out = await run('info', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Button');
    expect(data.props.length).toBeGreaterThan(0);
  });

  it('should show detailed component info', async () => {
    const out = await run('info', 'Button', '--detail');
    expect(out).toContain('When to use');
    expect(out).toContain('Description');
  });

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

  it('should show component tokens', async () => {
    const out = await run('token', 'Button');
    expect(out).toContain('contentFontSize');
    expect(out).toContain('defaultBg');
  });

  it('should show semantic structure', async () => {
    const out = await run('semantic', 'Drawer');
    expect(out).toContain('header');
    expect(out).toContain('body');
    expect(out).toContain('classNames');
  });

  it('should suggest correct name for typos', async () => {
    const result = await runWithStatus('info', 'Btn');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Did you mean 'Button'");
  });

  it('should handle unknown component', async () => {
    const result = await runWithStatus('info', 'NonExistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });


  // ─── Doc command ────────────────────────────────────────────────────

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
    const result = await runWithStatus('doc', 'NonExistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should suggest correct name for doc typo', async () => {
    const result = await runWithStatus('doc', 'Btn');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Did you mean 'Button'");
  });

  it('should show changelog', async () => {
    const out = await run('changelog', '5.21.0');
    expect(out).toContain('5.21.0');
    expect(out).toContain('Segmented');
  });

  it('should show changelog range', async () => {
    const out = await run('changelog', '5.20.0..5.22.0');
    expect(out).toContain('5.20.0');
    expect(out).toContain('5.21.0');
    expect(out).toContain('5.22.0');
  });

  it('should show migration guide', async () => {
    const out = await run('migrate', '4', '5');
    expect(out).toContain('Migration Guide');
    expect(out).toContain('Select');
    expect(out).toContain('popupClassName');
  });

  it('should show migration guide as JSON', async () => {
    const out = await run('migrate', '4', '5', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.from).toBe('4');
    expect(data.to).toBe('5');
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('should run doctor', async () => {
    const out = await run('doctor');
    expect(out).toContain('antd Doctor');
    expect(out).toContain('Summary');
  });


  it('should output error as JSON to stderr', async () => {
    const result = await runWithStatus('info', 'Btn', '--format', 'json');
    // JSON errors go to stderr, stdout should be empty
    expect(result.stdout).toBe('');
    const data = JSON.parse(result.stderr);
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
    expect(data.suggestion).toContain('Button');
  });

  it('should show CLI version with -V', async () => {
    const out = await run('-V');
    expect(out).toMatch(/^\d+\.\d+\.\d+[-\w.]*$/);
  });

  it('should support --lang zh', async () => {
    const out = await run('list', '--lang', 'zh');
    expect(out).toContain('按钮');
  });

  it('should support --lang zh for info', async () => {
    const out = await run('info', 'Button', '--lang', 'zh');
    expect(out).toContain('按钮用于开始一个即时操作');
  });

  it('should show list as markdown', async () => {
    const out = await run('list', '--format', 'markdown');
    expect(out).toContain('# antd Components');
    expect(out).toContain('**Button**');
  });

  it('should show token as JSON', async () => {
    const out = await run('token', 'Button', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('Button');
    expect(data.tokens.length).toBeGreaterThan(0);
  });

  it('should show semantic as JSON', async () => {
    const out = await run('semantic', 'Drawer', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Drawer');
    expect(data.semanticStructure.length).toBeGreaterThan(0);
  });

  it('should handle demo not found', async () => {
    const result = await runWithStatus('demo', 'Button', 'nonexistent');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('should handle changelog version not found', async () => {
    const result = await runWithStatus('changelog', '5.99.99');
    expect(result.exitCode).toBe(1);
  });

  it('should show changelog as JSON', async () => {
    const out = await run('changelog', '5.21.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].version).toBe('5.21.0');
  });

  it('should show doctor as JSON', async () => {
    const out = await run('doctor', '--format', 'json');
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
    const result = await runWithStatus('migrate', '3', '6');
    expect(result.exitCode).toBe(1);
  });

  // ─── Additional edge case tests ─────────────────────────────────────────


  // Doctor edge cases
  it('should run doctor as markdown', async () => {
    const out = await run('doctor', '--format', 'markdown');
    expect(out).toContain('antd Doctor');
  });

  // Token edge cases
  it('should show global tokens', async () => {
    const out = await run('token');
    expect(out).toContain('Global Design Tokens');
    expect(out).toContain('Type');
  });

  it('should handle unknown component for token', async () => {
    const result = await runWithStatus('token', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });

  // Semantic edge cases
  it('should handle unknown component for semantic', async () => {
    const result = await runWithStatus('semantic', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });

  // Info edge cases
  it('should show info as markdown', async () => {
    const out = await run('info', 'Button', '--format', 'markdown');
    expect(out).toContain('Button');
    expect(out).toContain('type');
  });

  // Usage command
  it('should scan usage in current directory', async () => {
    const out = await run('usage', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('components');
  });

  // Lint command
  it('should lint current directory', async () => {
    const out = await run('lint', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('issues');
  });

  /** Create a temp fixture, run lint, and clean up. */
  async function lintFixture(name: string, content: string, extraArgs: string[] = []): Promise<string> {
    const tmpDir = join(__dirname, `__tmp_lint_${name}__`);
    const fixture = join(tmpDir, `${name}.tsx`);
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, content);
      const result = await runCLI('lint', fixture, '--version', '6.3.1', ...extraArgs);
      return result.stdout;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  it('lint deprecated message includes replacement hint from description', async () => {
    const out = await lintFixture('card', `import { Card } from 'antd';\nconst App = () => <Card bordered={false}>x</Card>;\n`);
    expect(out).toMatch(/bordered.*deprecated/i);
    expect(out).toMatch(/variant/i);
  });

  it('lint deprecated prop should not flag same prop name on unrelated components', async () => {
    const out = await lintFixture(
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

  it('lint deprecated prop should still flag when used on the correct component', async () => {
    const out = await lintFixture(
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
  ])('lint should not flag deprecated Divider.type on siblings: $name (#35)', async ({ name, code }) => {
    const fixture = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const out = await lintFixture(`issue35-${fixture}`, code, ['--format', 'json']);
    const data = JSON.parse(out);
    const dividerTypeIssues = data.issues.filter(
      (i: LintIssue) => i.rule === 'deprecated' && i.message.includes('Divider') && i.message.includes('type'),
    );
    expect(dividerTypeIssues).toHaveLength(0);
  });

  it('changelog should error when from > to', async () => {
    const result = await runWithStatus('changelog', '5.5.0', '5.1.0');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('newer than');
  });

  // Changelog edge cases
  it('should show API diff between versions', async () => {
    const out = await run('changelog', '5.0.0', '5.24.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('from');
    expect(data).toHaveProperty('to');
  });

  // v5→v6 migration completeness
  it('should show v5 to v6 migration with many steps', async () => {
    const out = await run('migrate', '5', '6', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.steps.length).toBeGreaterThan(10);
    // Should include both breaking and non-breaking
    const breaking = data.steps.filter((s: any) => s.breaking);
    const nonBreaking = data.steps.filter((s: any) => !s.breaking);
    expect(breaking.length).toBeGreaterThan(0);
    expect(nonBreaking.length).toBeGreaterThan(0);
  });

  // v4→v5 migration completeness
  it('should show v4 to v5 migration with 30+ steps', async () => {
    const out = await run('migrate', '4', '5', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.steps.length).toBeGreaterThanOrEqual(30);
  });

  // antd bug command
  it('should preview a bug report as text', async () => {
    const out = await run('bug', '--title', 'Test bug');
    expect(out).toContain('Repository: ant-design/ant-design');
    expect(out).toContain('Title: Test bug');
    expect(out).toContain('--- Issue Body ---');
    expect(out).toContain('### Reproduction link');
    expect(out).toContain('To submit, re-run with --submit flag.');
  });

  it('should preview a bug report as JSON', async () => {
    const out = await run('bug', '--title', 'Test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design');
    expect(data.title).toBe('Test bug');
    expect(data.body).toContain('<!-- generated by ant-design-issue-helper');
    expect(data.url).toContain('https://github.com/ant-design/ant-design/issues/new');
  });

  it('should include provided fields in bug report', async () => {
    const out = await run('bug', '--title', 'Test', '--steps', 'Click button', '--expected', 'Works', '--actual', 'Crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toContain('Click button');
    expect(data.body).toContain('Works');
    expect(data.body).toContain('Crashes');
  });

  it('should preview bug report as markdown (raw body)', async () => {
    const out = await run('bug', '--title', 'Test', '--format', 'markdown');
    expect(out).toContain('<!-- generated by ant-design-issue-helper');
    expect(out).not.toContain('Repository:');
  });

  it('should error when --title is missing for bug', async () => {
    const result = await runWithStatus('bug', '--format', 'json');
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('TITLE_REQUIRED');
    expect(err.message).toContain('--title');
  });

  // antd bug-cli command
  it('should preview a bug-cli report as text', async () => {
    const out = await run('bug-cli', '--title', 'CLI test bug');
    expect(out).toContain('Repository: ant-design/ant-design-cli');
    expect(out).toContain('Title: CLI test bug');
    expect(out).toContain('### Description');
  });

  it('should preview a bug-cli report as JSON', async () => {
    const out = await run('bug-cli', '--title', 'CLI test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design-cli');
    expect(data.title).toBe('CLI test bug');
    expect(data.body).toContain('### Description');
    expect(data.body).toContain('@ant-design/cli');
    expect(data.url).toContain('https://github.com/ant-design/ant-design-cli/issues/new');
  });

  it('should include description in bug-cli report', async () => {
    const out = await run('bug-cli', '--title', 'Test', '--description', 'Info crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toContain('Info crashes');
  });
});

async function runEnvInTempDir(packages: Record<string, object>): Promise<any> {
  const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-env-'));
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));

    for (const [pkgName, pkgJson] of Object.entries(packages)) {
      const pkgDir = join(tempDir, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson));
    }

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    try {
      const result = await runCLI('env', '--format', 'json', tempDir);
      return JSON.parse(result.stdout);
    } finally {
      cwdSpy.mockRestore();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('env command', () => {
  it('should output text format with Environment header', { timeout: 20000 }, async () => {
    const result = await runCLI('env');
    expect(result.stdout).toContain('Environment');
    expect(result.stdout).toContain('System:');
    expect(result.stdout).toContain('Binaries:');
    expect(result.stdout).toContain('Node');
  });

  it('should output valid JSON', async () => {
    const result = await runCLI('env', '--format', 'json');
    const data = JSON.parse(result.stdout);
    expect(data).toHaveProperty('envinfo');
    expect(data).toHaveProperty('dependencies');
    expect(data).toHaveProperty('ecosystem');
    expect(data).toHaveProperty('buildTools');
    expect(data.envinfo.System).toBeTruthy();
    expect(data.envinfo.Binaries.Node).toBeTruthy();
  });

  it('should output markdown format', async () => {
    const result = await runCLI('env', '--format', 'markdown');
    expect(result.stdout).toContain('## Environment');
    expect(result.stdout).toContain('### System');
    expect(result.stdout).toContain('| Item | Version |');
  });

  it('should detect dependencies from target dir', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      'react': { name: 'react', version: '18.3.1' },
      'react-dom': { name: 'react-dom', version: '18.3.1' },
    });
    expect(data.dependencies.antd).toBe('5.22.0');
    expect(data.dependencies.react).toBe('18.3.1');
    expect(data.dependencies['react-dom']).toBe('18.3.1');
    expect(data.dependencies.dayjs).toBeNull();
  });

  it('should scan ecosystem packages', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      '@ant-design/pro-components': { name: '@ant-design/pro-components', version: '2.8.1' },
      '@ant-design/charts': { name: '@ant-design/charts', version: '2.2.1' },
      'rc-field-form': { name: 'rc-field-form', version: '2.7.0' },
    });
    expect(data.ecosystem['@ant-design/pro-components']).toBe('2.8.1');
    expect(data.ecosystem['@ant-design/charts']).toBe('2.2.1');
    expect(data.ecosystem['rc-field-form']).toBe('2.7.0');
  });

  it('should not include core deps in ecosystem', async () => {
    const data = await runEnvInTempDir({
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

  it('should detect build tools', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      'typescript': { name: 'typescript', version: '5.6.3' },
      'vite': { name: 'vite', version: '6.0.0' },
    });
    expect(data.buildTools.typescript).toBe('5.6.3');
    expect(data.buildTools.vite).toBe('6.0.0');
  });
});

describe('doctor ecosystem peerDeps', () => {
  it('should report pass when all peerDeps are satisfied', async () => {
    const data = await runDoctorInTempDir({
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

  it('should report fail when an installed dep does not satisfy peerDep range', async () => {
    const data = await runDoctorInTempDir({
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

  it('should report warn when a peerDep is not installed at all', async () => {
    const data = await runDoctorInTempDir({
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

  it('should not emit a check for packages with no peerDependencies', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/colors': {
        version: '7.0.0',
        // no peerDependencies field
      },
    });
    const names = (data.checks as any[]).map((c) => c.name);
    expect(names).not.toContain('ecosystem-compat:colors');
  });

  it('should emit no ecosystem checks when no @ant-design/* packages are installed', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
    });
    const ecosystemChecks = (data.checks as any[]).filter((c) => c.name.startsWith('ecosystem-compat:'));
    expect(ecosystemChecks).toHaveLength(0);
  });

  it('should treat compound ranges as compatible (fail-open)', async () => {
    const data = await runDoctorInTempDir({
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

  it('should check multiple ecosystem packages independently', async () => {
    const data = await runDoctorInTempDir({
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