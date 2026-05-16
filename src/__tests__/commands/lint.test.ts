import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { LintIssue } from '../../commands/lint.js';
import { run, runCLI } from '../helper.js';

describe('lint', () => {
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

  it('should detect namespace import performance issues', async () => {
    const out = await lintFixture(
      'namespace',
      `import * as Antd from 'antd';\nconst App = () => <Antd.Button>Test</Antd.Button>;`,
      ['--only', 'performance', '--format', 'json'],
    );
    const data = JSON.parse(out);
    expect(data.issues.some((i: LintIssue) => i.rule === 'performance' && i.message.includes('wildcard'))).toBe(true);
  });
});