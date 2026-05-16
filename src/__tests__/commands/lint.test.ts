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
});