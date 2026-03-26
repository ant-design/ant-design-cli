import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { getComponentDoc, registerDocCommand } from '../../commands/doc.js';
import type { CLIError } from '../../types.js';

function createProgram(opts: { format?: string; version?: string; lang?: string; detail?: boolean } = {}) {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  program.option('--format <format>', 'Output format', opts.format ?? 'text');
  if (opts.version) {
    program.option('--version <version>', 'Target antd version', opts.version);
  } else {
    program.option('--version <version>', 'Target antd version');
  }
  program.option('--lang <lang>', 'Output language', opts.lang ?? 'en');
  program.option('--detail', 'Full information output', opts.detail ?? false);
  return program;
}

describe('getComponentDoc', () => {
  it('returns doc for a valid component', () => {
    const result = getComponentDoc('Button', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(typeof result.doc).toBe('string');
      expect(result.doc.length).toBeGreaterThan(0);
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getComponentDoc('NonExistent', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns Chinese doc when lang is zh', () => {
    const result = getComponentDoc('Button', { lang: 'zh', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(typeof result.doc).toBe('string');
    }
  });

  it('returns DOC_NOT_AVAILABLE error when component has no doc', async () => {
    // Mock resolveComponent to return a component with no doc
    const loader = await import('../../data/loader.js');
    vi.spyOn(loader, 'resolveComponent').mockReturnValue({
      comp: { name: 'FakeComp', nameZh: '', description: '', descriptionZh: '', props: [], demos: [], methods: [], related: [], faq: [], tokens: [], doc: '', docZh: '' } as any,
    });
    const result = getComponentDoc('FakeComp', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.code).toBe('DOC_NOT_AVAILABLE');
      expect(result.message).toContain('FakeComp');
    }
    vi.restoreAllMocks();
  });
});

describe('registerDocCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('should output doc in text format via stdout', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDocCommand(program);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'test', 'doc', 'Button'], );
    expect(writeSpy).toHaveBeenCalled();
    const output = writeSpy.mock.calls[0][0] as string;
    expect(output.length).toBeGreaterThan(0);
  });

  it('should output doc in JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerDocCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'doc', 'Button'], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.name).toBe('Button');
    expect(parsed.doc).toBeDefined();
  });

  it('should handle error for non-existent component', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDocCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'doc', 'NonExistent'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('should output markdown format (same as text for doc)', async () => {
    const program = createProgram({ format: 'markdown', version: '5.20.0' });
    registerDocCommand(program);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'test', 'doc', 'Button'], );
    expect(writeSpy).toHaveBeenCalled();
  });
});
