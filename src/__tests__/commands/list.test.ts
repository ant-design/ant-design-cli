import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { listComponents, registerListCommand } from '../../commands/list.js';

function createProgram(opts: { format?: string; version?: string; lang?: string; detail?: boolean } = {}) {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  program.option('--format <format>', 'Output format', opts.format ?? 'text');
  program.option('--version <version>', 'Target antd version', opts.version);
  program.option('--lang <lang>', 'Output language', opts.lang ?? 'en');
  program.option('--detail', 'Full information output', opts.detail ?? false);
  return program;
}

describe('listComponents', () => {
  it('returns an array of ComponentSummary for v5', () => {
    const result = listComponents({ version: '5.20.0' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const first = result[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('nameZh');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('descriptionZh');
    expect(first).toHaveProperty('since');
    expect(first).toHaveProperty('category');
    expect(typeof first.name).toBe('string');
  });

  it('returns components for v4', () => {
    const result = listComponents({ version: '4.24.0' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes Button component', () => {
    const result = listComponents({ version: '5.20.0' });
    const button = result.find((c) => c.name === 'Button');
    expect(button).toBeDefined();
    expect(button!.name).toBe('Button');
  });
});

describe('registerListCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerListCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'list'], );
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toHaveProperty('name');
  });

  it('should output text format with table', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerListCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'list'], );
    const output = logSpy.mock.calls[0][0];
    expect(output).toContain('Component');
    expect(output).toContain('Button');
  });

  it('should output markdown format', async () => {
    const program = createProgram({ format: 'markdown', version: '5.20.0' });
    registerListCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'list'], );
    const output = logSpy.mock.calls[0][0];
    expect(output).toContain('# antd Components');
    expect(output).toContain('| **Button**');
  });

  it('should handle empty components list', async () => {
    const program = createProgram({ format: 'text', version: '99.0.0' });
    registerListCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'list'], );
    const output = logSpy.mock.calls[0][0];
    expect(output).toContain('No component data available');
  });

  it('should handle empty components list in JSON', async () => {
    const program = createProgram({ format: 'json', version: '99.0.0' });
    registerListCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'list'], );
    const output = logSpy.mock.calls[0][0];
    expect(JSON.parse(output)).toEqual([]);
  });
});
