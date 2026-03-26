import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { getComponentDemo, registerDemoCommand } from '../../commands/demo.js';
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

describe('getComponentDemo', () => {
  it('returns demo list when no name specified', () => {
    const result = getComponentDemo('Button', { version: '5.20.0' });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'demos' in result) {
      expect(result.component).toBe('Button');
      expect(Array.isArray(result.demos)).toBe(true);
      expect(result.demos.length).toBeGreaterThan(0);
      expect(result.demos[0]).toHaveProperty('name');
      expect(result.demos[0]).toHaveProperty('title');
      expect(result.demos[0]).toHaveProperty('description');
    }
  });

  it('returns specific demo with code when name specified', () => {
    // First get list to find a valid demo name
    const listResult = getComponentDemo('Button', { version: '5.20.0' });
    if (!('error' in listResult) && 'demos' in listResult && listResult.demos.length > 0) {
      const demoName = listResult.demos[0].name;
      const result = getComponentDemo('Button', { version: '5.20.0', name: demoName });
      expect('error' in result).toBe(false);
      if (!('error' in result) && 'code' in result) {
        expect(result.component).toBe('Button');
        expect(result.demo).toBe(demoName);
        expect(typeof result.code).toBe('string');
        expect(result.code.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getComponentDemo('NonExistent', { version: '5.20.0' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('returns CLIError for non-existent demo', () => {
    const result = getComponentDemo('Button', { version: '5.20.0', name: 'nonexistent-demo' });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('DEMO_NOT_FOUND');
  });

  it('returns fuzzy match suggestion for close demo name', () => {
    // Get a real demo name then use a typo
    const listResult = getComponentDemo('Button', { version: '5.20.0' });
    if (!('error' in listResult) && 'demos' in listResult && listResult.demos.length > 0) {
      const realName = listResult.demos[0].name;
      // Create a typo by adding a character
      const typo = realName + 'x';
      const result = getComponentDemo('Button', { version: '5.20.0', name: typo });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.code).toBe('DEMO_NOT_FOUND');
        // Should have a suggestion since the typo is close
        if (result.suggestion) {
          expect(result.suggestion).toContain('Did you mean');
        }
      }
    }
  });
});

describe('registerDemoCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('should output demo list in text format', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDemoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'Button'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Button Demos');
  });

  it('should output demo list in JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerDemoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'Button'], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.component).toBe('Button');
    expect(parsed.demos).toBeDefined();
  });

  it('should output specific demo code in text format', async () => {
    // First get a demo name
    const listResult = getComponentDemo('Button', { version: '5.20.0' });
    if ('error' in listResult || !('demos' in listResult) || listResult.demos.length === 0) return;
    const demoName = listResult.demos[0].name;

    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDemoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'Button', demoName], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Button');
  });

  it('should output specific demo in JSON format', async () => {
    const listResult = getComponentDemo('Button', { version: '5.20.0' });
    if ('error' in listResult || !('demos' in listResult) || listResult.demos.length === 0) return;
    const demoName = listResult.demos[0].name;

    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerDemoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'Button', demoName], );
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.code).toBeDefined();
  });

  it('should handle error for non-existent component', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDemoCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'NonExistent'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('should handle error for non-existent demo', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDemoCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'Button', 'nonexistent-demo-xyz'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('should show "No demos available" for component without demos', async () => {
    // Mock resolveComponent to return a component with no demos
    const loader = await import('../../data/loader.js');
    vi.spyOn(loader, 'resolveComponent').mockReturnValue({
      comp: { name: 'NoDemoComp', demos: [] } as any,
    });
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerDemoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'demo', 'NoDemoComp'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('No demos available');
    vi.restoreAllMocks();
  });
});
