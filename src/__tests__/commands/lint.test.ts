import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Command } from 'commander';
import { registerLintCommand } from '../../commands/lint.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpDir = join(tmpdir(), `antd-lint-test-${Date.now()}`);

function makeTmpFile(name: string, content: string): void {
  writeFileSync(join(tmpDir, name), content, 'utf-8');
}

async function runLint(
  args: string[] = [],
  format: string = 'json',
): Promise<string> {
  const program = new Command();
  program.option('--format <format>', '', format);
  program.option('--version <version>', '', '5.20.0');
  program.option('--lang <lang>', '', 'en');
  registerLintCommand(program);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  await program.parseAsync(['node', 'test', 'lint', ...args]);
  const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
  logSpy.mockRestore();
  return output;
}

function parseJson(output: string): { issues: any[]; summary: any } {
  return JSON.parse(output);
}

beforeAll(() => {
  mkdirSync(tmpDir, { recursive: true });

  // -- deprecated.tsx --
  makeTmpFile(
    'deprecated.tsx',
    `import { BackTop, Button, Input } from 'antd';

const App = () => (
  <div>
    <BackTop />
    <Button.Group>
      <Button>OK</Button>
    </Button.Group>
    <Input.Group>
      <Input />
    </Input.Group>
  </div>
);
`,
  );

  // -- a11y.tsx --
  makeTmpFile(
    'a11y.tsx',
    `import { Image } from 'antd';

const App = () => (
  <div>
    <Image src="foo.png" />
    <SearchIcon onClick={() => {}} />
  </div>
);
`,
  );

  // -- usage.tsx --
  makeTmpFile(
    'usage.tsx',
    `import { Form, Button, Checkbox, Divider, Select, Menu, QRCode, Typography, Radio, TreeSelect } from 'antd';

const App = () => (
  <div>
    <Form.Item shouldUpdate dependencies={['field']} />
    <Button ghost type="link">Link</Button>
    <Button ghost type="text">Text</Button>
    <Checkbox value="a" />
    <Divider type="vertical">child</Divider>
    <Select maxCount={3} />
    <Menu inlineCollapsed />
    <QRCode />
    <Typography.Link ellipsis={{ tooltip: true }} />
    <Typography.Text ellipsis={{ expandable: true, rows: 2 }} />
    <Radio optionType="button" />
    <TreeSelect multiple={false} treeCheckable />
  </div>
);
`,
  );

  // -- usage-expr.tsx -- (JSX expression container for string attrs)
  makeTmpFile(
    'usage-expr.tsx',
    `import { Button } from 'antd';

const App = () => (
  <div>
    <Button ghost type={"link"}>Link</Button>
  </div>
);
`,
  );

  // -- usage-computed.tsx -- (computed property keys in object attrs)
  makeTmpFile(
    'usage-computed.tsx',
    `import { Typography } from 'antd';

const App = () => (
  <Typography.Text ellipsis={{ 'expandable': true, 'rows': 2 }} />
);
`,
  );

  // -- usage-dynamic.tsx -- (dynamic expression for string attrs - covers getStringAttrValue fallback)
  makeTmpFile(
    'usage-dynamic.tsx',
    `import { Button, Select } from 'antd';

const myType = 'link';
const App = () => (
  <div>
    <Button ghost type={myType}>Dynamic</Button>
    <Select maxCount={3} mode={myType} />
  </div>
);
`,
  );

  // -- performance.tsx --
  makeTmpFile(
    'performance.tsx',
    `import { Select, TreeSelect } from 'antd';

const App = () => (
  <div>
    <Select virtual={false} />
    <TreeSelect virtual={false} />
  </div>
);
`,
  );

  // -- wildcard.tsx --
  makeTmpFile(
    'wildcard.tsx',
    `import * as Antd from 'antd';

const App = () => <Antd.Button />;
`,
  );

  // -- clean.tsx (no antd reference) --
  makeTmpFile(
    'clean.tsx',
    `import React from 'react';
const App = () => <div>Hello</div>;
`,
  );
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('lint command', () => {
  // --- Deprecated rules ---
  describe('deprecated rules', () => {
    it('detects BackTop usage', async () => {
      const out = await runLint([join(tmpDir, 'deprecated.tsx')]);
      const data = parseJson(out);
      const backTopIssues = data.issues.filter((i: any) => i.message.includes('BackTop'));
      expect(backTopIssues.length).toBeGreaterThanOrEqual(1);
      expect(backTopIssues[0].rule).toBe('deprecated');
      expect(backTopIssues[0].message).toContain('FloatButton.BackTop');
    });

    it('detects Button.Group usage', async () => {
      const out = await runLint([join(tmpDir, 'deprecated.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Button.Group'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].message).toContain('Space.Compact');
    });

    it('detects Input.Group usage', async () => {
      const out = await runLint([join(tmpDir, 'deprecated.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Input.Group'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].message).toContain('Space.Compact');
    });
  });

  // --- A11y rules ---
  describe('a11y rules', () => {
    it('detects Image without alt', async () => {
      const out = await runLint([join(tmpDir, 'a11y.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('alt'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].rule).toBe('a11y');
    });

    it('detects clickable icon without aria-label', async () => {
      const out = await runLint([join(tmpDir, 'a11y.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('aria-label'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].rule).toBe('a11y');
    });
  });

  // --- Usage rules ---
  describe('usage rules', () => {
    it('detects Form.Item shouldUpdate + dependencies', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('shouldUpdate'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].rule).toBe('usage');
    });

    it('detects Typography.Text ellipsis with computed string keys', async () => {
      const out = await runLint([join(tmpDir, 'usage-computed.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Typography.Text') && i.message.includes('expandable'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('handles dynamic expression attr values gracefully', async () => {
      const out = await runLint([join(tmpDir, 'usage-dynamic.tsx')]);
      const data = parseJson(out);
      // ghost attr exists but type is dynamic (not "link"/"text"), so no ghost warning
      const ghostIssues = data.issues.filter((i: any) => i.message.includes('ghost'));
      expect(ghostIssues.length).toBe(0);
    });

    it('detects Button ghost + link type via JSX expression container', async () => {
      const out = await runLint([join(tmpDir, 'usage-expr.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('ghost'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Button ghost + link type', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('ghost'));
      expect(issues.length).toBeGreaterThanOrEqual(2); // link and text
    });

    it('detects Checkbox value prop', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Checkbox') && i.message.includes('value'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Divider vertical with children', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Divider') && i.message.includes('children'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Select maxCount without multiple mode', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('maxCount'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Menu inlineCollapsed without inline mode', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('inlineCollapsed'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects QRCode without value', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('QRCode'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Typography.Link ellipsis object', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Typography.Link') && i.message.includes('ellipsis'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Typography.Text ellipsis with expandable/rows', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('Typography.Text') && i.message.includes('expandable'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects Radio optionType outside Radio.Group', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('optionType'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('detects TreeSelect multiple={false} + treeCheckable', async () => {
      const out = await runLint([join(tmpDir, 'usage.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('treeCheckable'));
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Performance rules ---
  describe('performance rules', () => {
    it('detects Select virtual={false}', async () => {
      const out = await runLint([join(tmpDir, 'performance.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('virtual'));
      expect(issues.length).toBe(2); // Select + TreeSelect
      expect(issues[0].rule).toBe('performance');
    });

    it('detects wildcard import', async () => {
      const out = await runLint([join(tmpDir, 'wildcard.tsx')]);
      const data = parseJson(out);
      const issues = data.issues.filter((i: any) => i.message.includes('wildcard'));
      expect(issues.length).toBe(1);
      expect(issues[0].rule).toBe('performance');
      expect(issues[0].severity).toBe('error');
    });
  });

  // --- --only filter ---
  describe('--only filter', () => {
    it('--only deprecated filters to deprecated issues only', async () => {
      const out = await runLint([tmpDir, '--only', 'deprecated']);
      const data = parseJson(out);
      for (const issue of data.issues) {
        expect(issue.rule).toBe('deprecated');
      }
      expect(data.summary.a11y).toBe(0);
      expect(data.summary.usage).toBe(0);
      // performance may have wildcard issues since --only=deprecated excludes them
      expect(data.summary.performance).toBe(0);
    });

    it('--only a11y filters to a11y issues only', async () => {
      const out = await runLint([tmpDir, '--only', 'a11y']);
      const data = parseJson(out);
      for (const issue of data.issues) {
        expect(issue.rule).toBe('a11y');
      }
      expect(data.summary.deprecated).toBe(0);
      expect(data.summary.usage).toBe(0);
    });

    it('--only usage filters to usage issues only', async () => {
      const out = await runLint([tmpDir, '--only', 'usage']);
      const data = parseJson(out);
      for (const issue of data.issues) {
        expect(issue.rule).toBe('usage');
      }
      expect(data.summary.deprecated).toBe(0);
      expect(data.summary.a11y).toBe(0);
    });

    it('--only performance filters to performance issues only', async () => {
      const out = await runLint([tmpDir, '--only', 'performance']);
      const data = parseJson(out);
      for (const issue of data.issues) {
        expect(issue.rule).toBe('performance');
      }
      expect(data.summary.deprecated).toBe(0);
      expect(data.summary.a11y).toBe(0);
      expect(data.summary.usage).toBe(0);
    });
  });

  // --- Output format ---
  describe('output format', () => {
    it('JSON output is valid and contains issues and summary', async () => {
      const out = await runLint([tmpDir]);
      const data = parseJson(out);
      expect(data).toHaveProperty('issues');
      expect(data).toHaveProperty('summary');
      expect(Array.isArray(data.issues)).toBe(true);
      expect(typeof data.summary.total).toBe('number');
      expect(data.summary.total).toBe(data.issues.length);
    });

    it('text output includes warning/error icons', async () => {
      const out = await runLint([tmpDir], 'text');
      // Should have warning icon for most issues
      expect(out).toContain('⚠');
      // Should have error icon for wildcard import
      expect(out).toContain('✗');
    });

    it('text output includes summary line', async () => {
      const out = await runLint([tmpDir], 'text');
      expect(out).toContain('Summary:');
      expect(out).toContain('deprecated');
      expect(out).toContain('a11y');
      expect(out).toContain('usage');
      expect(out).toContain('performance');
    });

    it('text output shows file paths and line numbers', async () => {
      const out = await runLint([tmpDir], 'text');
      expect(out).toContain('.tsx:');
      expect(out).toMatch(/\[deprecated\]|\[a11y\]|\[usage\]|\[performance\]/);
    });

    it('text output shows scanned file count', async () => {
      const out = await runLint([tmpDir], 'text');
      expect(out).toMatch(/Scanned \d+ files/);
    });
  });

  // --- Deprecated prop detection via metadata ---
  describe('deprecated prop from metadata', () => {
    it('detects deprecated props from component metadata', async () => {
      // DatePicker has deprecated prop `popupClassName` in v5.29
      makeTmpFile(
        'deprecated-prop.tsx',
        `import { DatePicker } from 'antd';

const App = () => (
  <div>
    <DatePicker popupClassName="custom" />
  </div>
);
`,
      );
      // Use v5.29.0 which has deprecated props in metadata
      const program = new Command();
      program.option('--format <format>', '', 'json');
      program.option('--version <version>', '', '5.29.0');
      program.option('--lang <lang>', '', 'en');
      registerLintCommand(program);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await program.parseAsync(['node', 'test', 'lint', join(tmpDir, 'deprecated-prop.tsx')]);
      const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
      logSpy.mockRestore();
      const data = parseJson(out);
      const depIssues = data.issues.filter((i: any) => i.rule === 'deprecated' && i.message.includes('popupClassName'));
      expect(depIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Edge cases ---
  describe('edge cases', () => {
    it('skips files without antd reference', async () => {
      const out = await runLint([join(tmpDir, 'clean.tsx')]);
      const data = parseJson(out);
      expect(data.issues.length).toBe(0);
    });

    it('handles empty directory with no issues', async () => {
      const emptyDir = join(tmpDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });
      const out = await runLint([emptyDir], 'text');
      expect(out).toContain('No issues found');
    });

    it('each issue has required fields', async () => {
      const out = await runLint([tmpDir]);
      const data = parseJson(out);
      for (const issue of data.issues) {
        expect(issue).toHaveProperty('file');
        expect(issue).toHaveProperty('line');
        expect(issue).toHaveProperty('rule');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('message');
        expect(typeof issue.line).toBe('number');
        expect(['warning', 'error']).toContain(issue.severity);
        expect(['deprecated', 'a11y', 'usage', 'performance']).toContain(issue.rule);
      }
    });

    it('handles scanning entire directory', async () => {
      const out = await runLint([tmpDir]);
      const data = parseJson(out);
      // Should find issues across multiple files
      expect(data.summary.total).toBeGreaterThan(10);
      expect(data.summary.deprecated).toBeGreaterThan(0);
      expect(data.summary.a11y).toBeGreaterThan(0);
      expect(data.summary.usage).toBeGreaterThan(0);
      expect(data.summary.performance).toBeGreaterThan(0);
    });
  });
});
