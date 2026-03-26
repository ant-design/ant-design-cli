import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { getTokens, registerTokenCommand } from '../../commands/token.js';
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

describe('getTokens', () => {
  it('returns global tokens for v5', () => {
    const result = getTokens(undefined, { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'tokens' in result && !('component' in result)) {
      expect(Array.isArray(result.tokens)).toBe(true);
    }
  });

  it('returns component tokens for a valid component', () => {
    const result = getTokens('Button', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'component' in result) {
      expect(result.component).toBe('Button');
      expect(Array.isArray(result.tokens)).toBe(true);
    }
  });

  it('returns CLIError for v4 (unsupported)', () => {
    const result = getTokens(undefined, { lang: 'en', version: '4.24.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('UNSUPPORTED_VERSION_FEATURE');
    expect(err.message).toContain('v4');
  });

  it('returns CLIError for non-existent component', () => {
    const result = getTokens('NonExistent', { lang: 'en', version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });
});

describe('registerTokenCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('should output global tokens in JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token'], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.tokens).toBeDefined();
  });

  it('should output global tokens in text format', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Global Design Tokens');
  });

  it('should output global tokens in markdown format', async () => {
    const program = createProgram({ format: 'markdown', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Global Design Tokens');
  });

  it('should output component tokens in JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token', 'Button'], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.component).toBe('Button');
  });

  it('should output component tokens in text format', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token', 'Button'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Button Component Tokens');
  });

  it('should handle error for v4', async () => {
    const program = createProgram({ format: 'text', version: '4.24.0' });
    registerTokenCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('should show "No component tokens" for component without tokens', async () => {
    // Mock resolveComponent to return a component with no tokens
    const loader = await import('../../data/loader.js');
    vi.spyOn(loader, 'resolveComponent').mockReturnValue({
      comp: { name: 'NoTokenComp', tokens: [] } as any,
    });
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token', 'NoTokenComp'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('No component tokens available');
    vi.restoreAllMocks();
  });

  it('should show "No global token data" when store has no global tokens', async () => {
    // Mock loadMetadataForVersion to return empty global tokens
    const loader = await import('../../data/loader.js');
    vi.spyOn(loader, 'loadMetadataForVersion').mockReturnValue({
      components: [],
      globalTokens: [],
      changelog: [],
    } as any);
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerTokenCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'token'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('No global token data available');
    vi.restoreAllMocks();
  });
});
