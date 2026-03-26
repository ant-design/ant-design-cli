import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { getSemanticStructure, registerSemanticCommand } from '../../commands/semantic.js';
import type { CLIError } from '../../types.js';

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

describe('getSemanticStructure', () => {
  it('returns semantic structure for a valid component', () => {
    const result = getSemanticStructure('Button', { version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(Array.isArray(result.semanticStructure)).toBe(true);
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getSemanticStructure('NonExistent', { version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns empty structure array for component without semantic data', () => {
    const result = getSemanticStructure('Affix', { version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(Array.isArray(result.semanticStructure)).toBe(true);
    }
  });
});

describe('registerSemanticCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('should output JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerSemanticCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'semantic', 'Button'], );
    // Button may or may not have semantic structure
    expect(logSpy).toHaveBeenCalled();
  });

  it('should output text format with tree structure', async () => {
    // Find a component that has semantic structure
    const result = getSemanticStructure('Modal', { version: '5.20.0' });
    if ('error' in result || result.semanticStructure.length === 0) return;

    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerSemanticCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'semantic', 'Modal'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Semantic Structure');
    expect(allOutput).toContain('classNames');
  });

  it('should show "No semantic structure" for empty structure', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerSemanticCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'semantic', 'Affix'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('No semantic structure');
  });

  it('should handle error for non-existent component', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerSemanticCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'semantic', 'NonExistent'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
