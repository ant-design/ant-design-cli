import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Command } from 'commander';
import { registerUsageCommand } from '../../commands/usage.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const tmpDir = join(import.meta.dirname, '__usage_test_tmp__');

beforeAll(() => {
  mkdirSync(tmpDir, { recursive: true });

  writeFileSync(
    join(tmpDir, 'app.tsx'),
    `import { Button, Form } from 'antd';\nexport default () => <div><Button /><Form><Form.Item /></Form></div>;`,
  );

  writeFileSync(
    join(tmpDir, 'page.tsx'),
    `import { Button, Table } from 'antd';\nexport default () => <div><Button /><Table /></div>;`,
  );

  writeFileSync(
    join(tmpDir, 'util.ts'),
    `import { message } from 'antd';\nmessage.info('hi');`,
  );

  writeFileSync(
    join(tmpDir, 'style.css'),
    `body {}`,
  );

  writeFileSync(
    join(tmpDir, 'no-antd.tsx'),
    `import React from 'react';`,
  );
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function createProgram(format = 'json') {
  const program = new Command();
  program.option('--format <format>', '', format);
  program.option('--version <version>', '', '5.20.0');
  program.option('--lang <lang>', '', 'en');
  program.option('--detail', '', false);
  program.exitOverride();
  registerUsageCommand(program);
  return program;
}

describe('usage command', () => {
  it('json format: returns scanned count, components, nonComponents, summary', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', tmpDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    expect(result).toHaveProperty('scanned');
    expect(result.scanned).toBeGreaterThan(0);
    expect(result).toHaveProperty('components');
    expect(Array.isArray(result.components)).toBe(true);
    expect(result).toHaveProperty('nonComponents');
    expect(Array.isArray(result.nonComponents)).toBe(true);
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('totalComponents');
    expect(result.summary).toHaveProperty('totalImports');
  });

  it('text format: shows component names and import counts', async () => {
    const program = createProgram('text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', tmpDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();

    expect(logged).toContain('Button');
    expect(logged).toContain('imports');
    expect(logged).toContain('Scanned');
  });

  it('detects sub-components like Form.Item', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', tmpDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    const form = result.components.find((c: any) => c.name === 'Form');
    expect(form).toBeDefined();
    expect(form.subComponents).toBeDefined();
    expect(form.subComponents['Form.Item']).toBeGreaterThan(0);
  });

  it('filter option (--filter Button) returns only Button', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', '--filter', 'Button', tmpDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    expect(result.components.length).toBe(1);
    expect(result.components[0].name).toBe('Button');
    expect(result.nonComponents.length).toBe(0);
  });

  it('detects non-component imports like message', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', tmpDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    const msg = result.nonComponents.find((c: any) => c.name === 'message');
    expect(msg).toBeDefined();
    expect(msg.imports).toBeGreaterThan(0);
  });

  it('no antd imports shows "No antd imports found."', async () => {
    const emptyDir = join(tmpDir, '__empty__');
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, 'index.tsx'), `import React from 'react';`);

    const program = createProgram('text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', emptyDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();

    expect(logged).toContain('No antd imports found.');

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it('handles unreadable files gracefully', async () => {
    // Create a directory named with .tsx extension to cause readFileSync to fail
    const fakeFile = join(tmpDir, 'unreadable.tsx');
    mkdirSync(fakeFile, { recursive: true });

    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', fakeFile]);
    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);
    // Should not crash, just return empty components
    expect(result.components.length).toBe(0);

    rmSync(fakeFile, { recursive: true, force: true });
  });

  it('resolves subComponentProps leaf names for knownComponents', async () => {
    // Use version 5.29.0 which has subComponentProps in metadata
    const program = new Command();
    program.option('--format <format>', '', 'json');
    program.option('--version <version>', '', '5.29.0');
    program.option('--lang <lang>', '', 'en');
    program.option('--detail', '', false);
    program.exitOverride();
    registerUsageCommand(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', tmpDir]);
    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    // With subComponentProps resolved, Form.Item's leaf "Item" is added to knownComponents,
    // so Form (which has subComponent Form.Item) should be classified as a component
    const formComp = result.components.find((c: any) => c.name === 'Form');
    expect(formComp).toBeDefined();
    expect(formComp.subComponents).toHaveProperty('Form.Item');
    // Form.Item should NOT appear as a nonComponent
    const nonCompNames = result.nonComponents.map((c: any) => c.name);
    expect(nonCompNames).not.toContain('Form.Item');
  });

  it('aggregates usage across multiple files', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'usage', tmpDir]);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    // Button is imported in both app.tsx and page.tsx
    const button = result.components.find((c: any) => c.name === 'Button');
    expect(button).toBeDefined();
    expect(button.imports).toBe(2);
    expect(button.files.length).toBe(2);
  });
});
