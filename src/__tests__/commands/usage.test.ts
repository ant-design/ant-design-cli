import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('usage', () => {
  it('should scan usage in current directory', { timeout: 30000 }, async () => {
    const out = await run('usage', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('components');
  });

  it('should display text output when components are found', async () => {
    const tmpDir = join(__dirname, '__tmp_usage_text__');
    const fixture = join(tmpDir, 'test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import { Button, Form } from 'antd';\nconst App = () => <Form><Form.Item><Button>Test</Button></Form.Item></Form>;`);
      const out = await run('usage', tmpDir);
      expect(out).toContain('Scanned');
      expect(out).toContain('Button');
      expect(out).toContain('Form');
      expect(out).toContain('Total:');
      expect(out).toContain('Form.Item');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should show message when no antd imports found', async () => {
    const tmpDir = join(__dirname, '__tmp_usage_empty__');
    const fixture = join(tmpDir, 'test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `const App = () => <div>No antd here</div>;`);
      const out = await run('usage', tmpDir);
      expect(out).toContain('No antd imports found');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should display non-components section when present', async () => {
    const tmpDir = join(__dirname, '__tmp_usage_noncomp__');
    const fixture = join(tmpDir, 'test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import { Button, theme } from 'antd';\nconst { useToken } = theme;\nconst App = () => <Button>Test</Button>;`);
      const out = await run('usage', tmpDir);
      expect(out).toContain('Non-component antd exports');
      expect(out).toContain('theme');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should filter results to a specific component', async () => {
    const tmpDir = join(__dirname, '__tmp_usage_filter__');
    const fixture = join(tmpDir, 'test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import { Button, Input } from 'antd';\nconst App = () => <><Button>Test</Button><Input /></>;`);
      const out = await run('usage', tmpDir, '--filter', 'Button', '--format', 'json');
      const data = JSON.parse(out);
      expect(data.components).toHaveLength(1);
      expect(data.components[0].name).toBe('Button');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should skip type-only antd imports', async () => {
    const tmpDir = join(__dirname, '__tmp_usage_type__');
    const fixture = join(tmpDir, 'test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import type { ButtonProps } from 'antd';\nimport { type FormProps, Button } from 'antd';\nconst x: ButtonProps = {};\nconst y: FormProps = {};\nconst App = () => <Button>x</Button>;\nvoid x; void y;`);
      const out = await run('usage', tmpDir, '--format', 'json');
      const data = JSON.parse(out);
      // type-only imports are excluded from the import count; only Button (value import) shows
      const button = data.components.find((c: { name: string }) => c.name === 'Button');
      expect(button).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should skip files with parse errors', async () => {
    const tmpDir = join(__dirname, '__tmp_usage_broken__');
    const fixture = join(tmpDir, 'test.tsx');
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(fixture, `import { Button } from 'antd';\nconst App = () => { broken( <Button };`);
      const out = await run('usage', tmpDir, '--format', 'json');
      const data = JSON.parse(out);
      // Parser error → file is skipped, components empty
      expect(data.components).toEqual([]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});