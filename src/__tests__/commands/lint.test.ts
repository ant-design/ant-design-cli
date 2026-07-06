import { describe, it, expect } from 'vitest';
import { chmodSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { LintIssue } from '../../commands/lint.js';
import { run, runCLI } from '../helper.js';

describe('lint', () => {
  it('should lint current directory', { timeout: 30000 }, async () => {
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

  function gitFixture(name: string, fixtureDir?: string): string {
    const dir = fixtureDir ?? join(__dirname, `__tmp_lint_git_${name}__`);
    rmSync(dir, { recursive: true, force: true });
    try {
      mkdirSync(dir, { recursive: true });
      execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
      execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { antd: '6.3.1' } }));
      return dir;
    } catch (error) {
      rmSync(dir, { recursive: true, force: true });
      throw error;
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

  it('should support --only flag for filtering specific rule categories', async () => {
    const out = await lintFixture(
      'only-deprecated',
      `import { BackTop, Button } from 'antd';\nconst App = () => <><BackTop /><Button ghost type="link" /></>;`,
      ['--only', 'deprecated', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.every((i: LintIssue) => i.rule === 'deprecated')).toBe(true);
    expect(data.issues.some((i: LintIssue) => i.message.includes('BackTop'))).toBe(true);
  });

  it('should show no issues message when no issues found', async () => {
    const out = await lintFixture(
      'clean',
      `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;`,
    );
    expect(out).toContain('No issues found');
  });

  it('should support --antd-alias flag for custom import paths', async () => {
    const out = await lintFixture(
      'alias',
      `import { Button } from '@my/antd';\nconst App = () => <Button ghost type="link" />;`,
      ['--antd-alias', '@my/antd', '--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage')).toBe(true);
  });

  it('should lint only files changed from the diff base with --diff', async () => {
    const dir = gitFixture('diff');
    try {
      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;\n`);
      writeFileSync(join(dir, 'unchanged.tsx'), `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;\n`);
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button ghost type="link" />;\n`);

      const result = await runCLI('lint', dir, '--diff', 'HEAD', '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.total).toBe(1);
      expect(data.issues[0].file).toBe(join(dir, 'changed.tsx'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should default --diff to HEAD when origin/main is unavailable', async () => {
    const dir = gitFixture('diff-default');
    try {
      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;\n`);
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button ghost type="link" />;\n`);

      const result = await runCLI('lint', dir, '--diff', '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.total).toBe(1);
      expect(data.issues[0].file).toBe(join(dir, 'changed.tsx'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should support --diff when the lint target is a file', async () => {
    const dir = gitFixture('diff-file-target');
    try {
      const changedFile = join(dir, 'changed.tsx');
      writeFileSync(changedFile, `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;\n`);
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      writeFileSync(changedFile, `import { Button } from 'antd';\nconst App = () => <Button ghost type="link" />;\n`);

      const result = await runCLI('lint', changedFile, '--diff', 'HEAD', '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.total).toBe(1);
      expect(data.issues[0].file).toBe(changedFile);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should ignore non-source files selected by --diff', async () => {
    const dir = gitFixture('diff-non-source');
    try {
      writeFileSync(join(dir, 'notes.md'), '# notes\n');
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      writeFileSync(join(dir, 'notes.md'), '# changed notes\n');

      const result = await runCLI('lint', dir, '--diff', 'HEAD', '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.total).toBe(0);
      expect(data.issues).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')('should ignore changed git symlinks that do not resolve to files', async () => {
    const dir = gitFixture('diff-symlink-filters');
    try {
      mkdirSync(join(dir, 'target-a'));
      mkdirSync(join(dir, 'target-b'));
      symlinkSync('target-a', join(dir, 'linked-dir.tsx'), 'dir');
      symlinkSync('missing-a', join(dir, 'missing-link.tsx'));
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      rmSync(join(dir, 'linked-dir.tsx'), { force: true });
      rmSync(join(dir, 'missing-link.tsx'), { force: true });
      symlinkSync('target-b', join(dir, 'linked-dir.tsx'), 'dir');
      symlinkSync('missing-b', join(dir, 'missing-link.tsx'));

      const result = await runCLI('lint', dir, '--diff', 'HEAD', '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.total).toBe(0);
      expect(data.issues).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should include git stderr when --diff uses an invalid ref', async () => {
    const dir = gitFixture('diff-invalid-ref');
    try {
      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button ghost type="link" />;\n`);
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      const result = await runCLI('lint', dir, '--diff', 'not-a-real-ref');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not-a-real-ref');
      expect(result.stderr).not.toContain('Command failed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should fall back to git process error messages when stderr is unavailable', async () => {
    const dir = gitFixture('diff-git-missing');
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = '';
      const result = await runCLI('lint', dir, '--diff', 'HEAD');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('git');
      expect(result.stderr).not.toContain('git command failed');
    } finally {
      process.env.PATH = originalPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should lint only staged files with --staged', async () => {
    const dir = gitFixture('staged');
    try {
      writeFileSync(join(dir, 'staged.tsx'), `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;\n`);
      writeFileSync(join(dir, 'unstaged.tsx'), `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;\n`);
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      writeFileSync(join(dir, 'staged.tsx'), `import { Button } from 'antd';\nconst App = () => <Button ghost type="link" />;\n`);
      writeFileSync(join(dir, 'unstaged.tsx'), `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;\n`);
      execFileSync('git', ['add', 'staged.tsx'], { cwd: dir });

      const result = await runCLI('lint', dir, '--staged', '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.total).toBe(1);
      expect(data.issues[0].file).toBe(join(dir, 'staged.tsx'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should reject --diff and --staged without duplicating the error prefix', async () => {
    const result = await runCLI('lint', '--diff', 'HEAD', '--staged');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--diff and --staged cannot be used together');
    expect(result.stderr).not.toContain('Error: Error:');
  });

  it('should report missing git lint targets without an internal stack trace', async () => {
    const missing = join(__dirname, '__tmp_lint_git_missing__');
    rmSync(missing, { recursive: true, force: true });

    const result = await runCLI('lint', missing, '--diff', 'HEAD');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Lint target not found');
    expect(result.stderr).not.toContain('at ');
  });

  it('should not skip changed files when the repo parent path includes a skipped directory name', async () => {
    const parent = join(__dirname, '__tmp_lint_git_parent__', 'build');
    const dir = join(parent, 'repo');
    rmSync(join(__dirname, '__tmp_lint_git_parent__'), { recursive: true, force: true });
    try {
      gitFixture('parent-skip', dir);
      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;\n`);
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, stdio: 'ignore' });

      writeFileSync(join(dir, 'changed.tsx'), `import { Button } from 'antd';\nconst App = () => <Button ghost type="link" />;\n`);

      const result = await runCLI('lint', dir, '--diff', 'HEAD', '--format', 'json');
      const data = JSON.parse(result.stdout);
      expect(data.summary.total).toBe(1);
      expect(data.issues[0].file).toBe(join(dir, 'changed.tsx'));
    } finally {
      rmSync(join(__dirname, '__tmp_lint_git_parent__'), { recursive: true, force: true });
    }
  });

  it('should detect namespace import performance issues', async () => {
    const out = await lintFixture(
      'namespace',
      `import * as Antd from 'antd';\nconst App = () => <Antd.Button>Test</Antd.Button>;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('wildcard'))).toBe(true);
  });

  it('should warn on TreeSelect multiple={false} with treeCheckable', async () => {
    const out = await lintFixture(
      'treeselect',
      `import { TreeSelect } from 'antd';\nconst App = () => <TreeSelect multiple={false} treeCheckable />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('TreeSelect'))).toBe(true);
  });

  it('should warn on Select virtual={false}', async () => {
    const out = await lintFixture(
      'select-virtual',
      `import { Select } from 'antd';\nconst App = () => <Select virtual={false} />;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('virtual'))).toBe(true);
  });

  it('should warn on TreeSelect virtual={false} (performance)', async () => {
    const out = await lintFixture(
      'treeselect-virtual',
      `import { TreeSelect } from 'antd';\nconst App = () => <TreeSelect virtual={false} />;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('virtual'))).toBe(true);
  });

  it('should warn on Typography.Text ellipsis with expandable', async () => {
    const out = await lintFixture(
      'typography-text-ellipsis',
      `import { Typography } from 'antd';\nconst App = () => <Typography.Text ellipsis={{ expandable: true }}>x</Typography.Text>;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('expandable'))).toBe(true);
  });

  it('should warn on Radio optionType outside Radio.Group', async () => {
    const out = await lintFixture(
      'radio-optiontype',
      `import { Radio } from 'antd';\nconst App = () => <Radio optionType="button" />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('optionType'))).toBe(true);
  });

  it('should print human summary when issues found (non-json)', async () => {
    const out = await lintFixture(
      'human-output',
      `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;`,
    );
    expect(out).toMatch(/Scanned \d+ files/);
    expect(out).toContain('[a11y]');
    expect(out).toContain('Summary');
  });

  it('should warn on QRCode missing value prop', async () => {
    const out = await lintFixture(
      'qrcode',
      `import { QRCode } from 'antd';\nconst App = () => <QRCode />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('QRCode'))).toBe(true);
  });

  it('should warn on Typography.Link with object ellipsis', async () => {
    const out = await lintFixture(
      'typography-link',
      `import { Typography } from 'antd';\nconst App = () => <Typography.Link ellipsis={{ rows: 2 }}>x</Typography.Link>;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Typography.Link'))).toBe(true);
  });

  it('should recognise string attribute values inside JSX expression containers', async () => {
    // type={"link"} (braced form) should match same way as type="link"
    const out = await lintFixture(
      'button-braced',
      `import { Button } from 'antd';\nconst App = () => <Button ghost type={"link"} />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('ghost'))).toBe(true);
  });

  it('should warn on legacy BackTop usage', async () => {
    const out = await lintFixture(
      'backtop',
      `import { BackTop } from 'antd';\nconst App = () => <BackTop />;`,
      ['--only', 'deprecated', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'deprecated' && i.message.includes('BackTop'))).toBe(true);
  });

  it('should warn on Button.Group deprecation', async () => {
    const out = await lintFixture(
      'button-group',
      `import { Button } from 'antd';\nconst App = () => <Button.Group><Button>x</Button></Button.Group>;`,
      ['--only', 'deprecated', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'deprecated' && i.message.includes('Button.Group'))).toBe(true);
  });

  it('should warn on Input.Group deprecation', async () => {
    const out = await lintFixture(
      'input-group',
      `import { Input } from 'antd';\nconst App = () => <Input.Group><Input /></Input.Group>;`,
      ['--only', 'deprecated', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'deprecated' && i.message.includes('Input.Group'))).toBe(true);
  });

  it('should warn on Menu inlineCollapsed without mode="inline"', async () => {
    const out = await lintFixture(
      'menu',
      `import { Menu } from 'antd';\nconst App = () => <Menu inlineCollapsed mode="horizontal" items={[]} />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Menu'))).toBe(true);
  });

  it('should warn on Select maxCount without mode=multiple/tags', async () => {
    const out = await lintFixture(
      'select-maxcount',
      `import { Select } from 'antd';\nconst App = () => <Select maxCount={5} mode="single" />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('maxCount'))).toBe(true);
  });

  it('should warn on Form.Item using both shouldUpdate and dependencies', async () => {
    const out = await lintFixture(
      'form-item',
      `import { Form } from 'antd';\nconst App = () => <Form.Item shouldUpdate dependencies={['a']} />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('shouldUpdate'))).toBe(true);
  });

  it('should warn on static feedback APIs in antd v5+', async () => {
    const out = await lintFixture(
      'static-feedback',
      `import { message, notification, Modal } from 'antd';
message.success('Saved');
notification.open({ message: 'Saved' });
Modal.confirm({ title: 'Confirm' });
`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('message.success'))).toBe(true);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('notification.open'))).toBe(true);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Modal.confirm'))).toBe(true);
  });

  it('should not warn on dynamic or non-imported feedback member calls', async () => {
    const out = await lintFixture(
      'static-feedback-false-positives',
      `import { message } from 'antd';
const method = 'success';
message[method]('Saved');
const [api] = message.useMessage();
api.success('Saved');
getFeedback().message.success('Saved');
class Demo {
  run() {
    this.message.success('Saved');
  }
}
`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.filter((i: LintIssue) => i.rule === 'usage' && i.message.includes('feedback API'))).toHaveLength(0);
  });

  it('should warn on Upload controlled value conflicts', async () => {
    const out = await lintFixture(
      'upload-control',
      `import { Upload } from 'antd';
const App = () => (
  <>
    <Upload fileList={[]} defaultFileList={[]} />
    <Upload fileList={[]} />
    <Upload.Dragger fileList={[]} defaultFileList={[]} />
    <Upload.Dragger fileList={[]} />
  </>
);
`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.filter((i: LintIssue) => i.rule === 'usage' && i.message.includes('Upload'))).toHaveLength(4);
  });

  it('should warn on Select.Option children in antd v5+', async () => {
    const out = await lintFixture(
      'select-option-children',
      `import { Select } from 'antd';
const App = () => (
  <Select>
    <Select.Option value="a">A</Select.Option>
    <Select.OptGroup label="Group">
      <Select.Option value="b">B</Select.Option>
    </Select.OptGroup>
  </Select>
);
`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Select.Option'))).toBe(true);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Select.OptGroup'))).toBe(true);
  });

  it('should warn on icon onClick without aria-label', async () => {
    const out = await lintFixture(
      'icon-aria',
      `import { Button } from 'antd';\nimport CustomIcon from './icon';\nconst App = () => <><Button>X</Button><CustomIcon onClick={() => {}} /></>;`,
      ['--only', 'a11y', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'a11y' && i.message.includes('aria-label'))).toBe(true);
  });

  it('should detect default import performance issues', async () => {
    const out = await lintFixture(
      'default-import',
      `import antd from 'antd';\nconst App = () => <antd.Button>x</antd.Button>;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('default'))).toBe(true);
  });

  it('should use generic named import suggestion when default import members are unknown', async () => {
    const out = await lintFixture(
      'default-import-unused',
      `import antd from 'antd';\nconst App = () => <div>{String(Boolean(antd))}</div>;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('Use named imports instead'))).toBe(true);
  });

  it('should not flag default/namespace imports of non-JS assets (#185)', async () => {
    const out = await lintFixture(
      'asset-import',
      `import resetStyles from 'antd/dist/reset.css';\nimport iconUrl from 'antd/es/some-icon.svg';\nimport fontUrl from 'antd/fonts/icon.woff2';\nimport * as styles from 'antd/dist/styles.png';\nconst App = () => <div className={resetStyles}>{iconUrl}{fontUrl}{styles}</div>;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance')).toBe(false);
  });

  it('should still flag bare antd default import alongside asset imports (#185)', async () => {
    const out = await lintFixture(
      'asset-and-module-import',
      `import resetStyles from 'antd/dist/reset.css';\nimport antd from 'antd';\nconst App = () => <antd.Button>{resetStyles}</antd.Button>;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    const perfIssues = data.issues.filter((i: LintIssue) => i.rule === 'performance');
    expect(perfIssues.some((i: LintIssue) => i.message.includes('antd/dist/reset.css'))).toBe(false);
    expect(perfIssues.some((i: LintIssue) => i.message.includes('default') && i.message.includes("from antd."))).toBe(true);
  });

  it('should warn on Checkbox value outside Checkbox.Group', async () => {
    const out = await lintFixture(
      'checkbox-value',
      `import { Checkbox } from 'antd';\nconst App = () => <Checkbox value="x" />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Checkbox'))).toBe(true);
  });

  it('should warn on Divider type="vertical" with children', async () => {
    const out = await lintFixture(
      'divider-vertical',
      `import { Divider } from 'antd';\nconst App = () => <Divider type="vertical">label</Divider>;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('Divider'))).toBe(true);
  });

  it('should treat non-string Button type as null and skip ghost warning', async () => {
    // type={someVariable} is not a string literal — getStringAttrValue returns null,
    // so the ghost+type-link check should NOT fire.
    const out = await lintFixture(
      'button-non-literal',
      `import { Button } from 'antd';\nconst btnType = 'primary';\nconst App = () => <Button ghost type={btnType} />;`,
      ['--only', 'usage', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'usage' && i.message.includes('ghost'))).toBe(false);
  });

  it('should skip type-only antd imports (TS import type)', async () => {
    const out = await lintFixture(
      'type-only-import',
      `import type { ButtonProps } from 'antd';\nconst noop = (_p: ButtonProps) => null;\nexport default noop;`,
    );
    expect(out).toContain('No issues found');
  });

  it('should skip type-only named import specifiers (TS import { type X })', async () => {
    const out = await lintFixture(
      'type-only-specifier',
      `import { type ButtonProps, Button } from 'antd';\nconst noop = (_p: ButtonProps) => <Button>x</Button>;\nexport default noop;`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    // Should not throw and should produce 0 issues (no deprecations on this minimal usage)
    expect(Array.isArray(data.issues)).toBe(true);
  });

  it('should not crash on JSX with spread attributes', async () => {
    const out = await lintFixture(
      'jsx-spread',
      `import { Button } from 'antd';\nconst extra = { type: 'primary' };\nconst App = () => <Button {...extra} ghost />;`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(Array.isArray(data.issues)).toBe(true);
  });

  it('should not crash on member-expression JSX without dot fallback (single ident)', async () => {
    // Exercises the JSXOpeningElement path when compName is empty (rare).
    const out = await lintFixture(
      'jsx-unusual',
      `import { Button } from 'antd';\nconst App = () => (<><Button>OK</Button></>);`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(Array.isArray(data.issues)).toBe(true);
  });

  it('should still process Select without virtual attr in performance mode', async () => {
    // No virtual attr — exercises the isBooleanFalse(attrs, "virtual") false branch.
    const out = await lintFixture(
      'select-no-virtual',
      `import { Select } from 'antd';\nconst App = () => <Select mode="multiple" />;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('virtual'))).toBe(false);
  });

  it('should handle JSX namespaced element names (e.g. <svg:circle />)', async () => {
    // JSXNamespacedName produces an empty compName from getJSXElementName,
    // exercising the `if (!compName) return` early-out in the visitor.
    const out = await lintFixture(
      'jsx-namespaced',
      `import { Button } from 'antd';\nconst App = () => (<><Button>x</Button><svg:circle /></>);`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(Array.isArray(data.issues)).toBe(true);
  });

  it('should skip files that cannot be parsed (syntax error)', async () => {
    const out = await lintFixture(
      'unparseable',
      `import { Button } from 'antd';\nconst App = () => { broken( <Button };`,
      ['--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues).toEqual([]);
    expect(data.summary.skipped).toBe(1);
    expect(data.skippedFiles).toEqual([
      expect.objectContaining({
        reason: 'parse-error',
        file: expect.stringContaining('unparseable.tsx'),
      }),
    ]);
  });

  it('should show skipped files in text output', async () => {
    const out = await lintFixture(
      'unparseable-text',
      `import { Button } from 'antd';\nconst App = () => { broken( <Button };`,
    );
    expect(out).toContain('Skipped 1 file');
    expect(out).toContain('[parse-error]');
    expect(out).toContain('unparseable-text.tsx');
  });

  it('should show skipped files alongside text issues', async () => {
    const tmpDir = join(__dirname, '__tmp_lint_issue_and_skip__');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(join(tmpDir, 'issue.tsx'), `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;\n`);
      writeFileSync(join(tmpDir, 'broken.tsx'), `import { Button } from 'antd';\nconst App = () => { broken( <Button };\n`);

      const result = await runCLI('lint', tmpDir);

      expect(result.stdout).toContain('Found 1 issues');
      expect(result.stdout).toContain('Skipped files:');
      expect(result.stdout).toContain('broken.tsx');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should report files that cannot be read as skipped', async () => {
    const tmpDir = join(__dirname, '__tmp_lint_unreadable__');
    const fixture = join(tmpDir, 'unreadable.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import { Button } from 'antd';\nconst App = () => <Button>OK</Button>;\n`);
      chmodSync(fixture, 0o000);

      const result = await runCLI('lint', fixture, '--format', 'json');
      const data = JSON.parse(result.stdout);

      expect(data.summary.skipped).toBe(1);
      expect(data.skippedFiles[0]).toEqual(expect.objectContaining({
        file: fixture,
        reason: 'read-error',
      }));
    } finally {
      try {
        chmodSync(fixture, 0o600);
      } catch {
        // File may not exist if setup failed before writeFileSync.
      }
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should show skipped files in markdown output', async () => {
    const out = await lintFixture(
      'unparseable-markdown',
      `import { Button } from 'antd';\nconst App = () => { broken( <Button };`,
      ['--format', 'markdown'],
    );
    expect(out).toContain('## Lint Results');
    expect(out).toContain('### Skipped Files');
    expect(out).not.toContain('| Rule | Severity | Message | File |');
    expect(out).toContain('parse-error');
    expect(out).toContain('unparseable-markdown.tsx');
  });

  it('should output markdown table format', async () => {
    const out = await lintFixture(
      'markdown-output',
      `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;`,
      ['--format', 'markdown'],
    );
    expect(out).toContain('## Lint Results');
    expect(out).toContain('| Rule | Severity | Message | File |');
    expect(out).toContain('a11y');
    expect(out).toContain('**Summary:**');
  });

  it('should output markdown table in Chinese with --lang zh', async () => {
    const out = await lintFixture(
      'markdown-zh',
      `import { Image } from 'antd';\nconst App = () => <Image src="x.png" />;`,
      ['--format', 'markdown', '--lang', 'zh'],
    );
    expect(out).toContain('## Lint 结果');
    expect(out).toContain('| 规则 | 级别 | 信息 | 文件 |');
    expect(out).toContain('**摘要：**');
  });
});
