import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerMigrateCommand } from '../../commands/migrate.js';
import { V4_TO_V5_STEPS } from '../../commands/migrate-v4-to-v5.js';
import { V5_TO_V6_STEPS } from '../../commands/migrate-v5-to-v6.js';

function createProgram(format = 'text') {
  const program = new Command();
  program.option('--format <format>', '', format);
  program.option('--version <version>', '');
  program.option('--lang <lang>', '', 'en');
  program.option('--detail', '', false);
  program.exitOverride();
  registerMigrateCommand(program);
  return program;
}

describe('migrate command', () => {
  it('valid migration 4 to 5 in text format', async () => {
    const program = createProgram('text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '4', '5']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();

    expect(logged).toContain('Migration Guide');
    expect(logged).toContain('v4');
    expect(logged).toContain('v5');
    expect(logged).toContain('Total:');
  });

  it('valid migration 5 to 6 in json format', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '5', '6']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    expect(result.from).toBe('5');
    expect(result.to).toBe('6');
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('total');
    expect(result.summary).toHaveProperty('autoFixable');
    expect(result.summary).toHaveProperty('manual');
  });

  it('valid migration in markdown format', async () => {
    const program = createProgram('markdown');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '4', '5']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();

    expect(logged).toContain('# Migration Guide');
  });

  it('invalid migration 3 to 4 shows error with available migrations', async () => {
    const program = createProgram('text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '3', '4']);

    const errOutput = errSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();
    errSpy.mockRestore();

    expect(errOutput).toContain('No migration guide available');
    expect(errOutput).toContain('Available migrations');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('component filter: --component Modal shows only Modal steps', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '4', '5', '--component', 'Modal']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    expect(result.steps.length).toBeGreaterThan(0);
    for (const step of result.steps) {
      expect(step.component.toLowerCase()).toBe('modal');
    }
  });

  it('component filter with non-existent component shows error', async () => {
    const program = createProgram('text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '4', '5', '--component', 'NonExistentXyz']);

    const errOutput = errSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();
    errSpy.mockRestore();

    expect(errOutput).toContain('No migration steps found');
    expect(errOutput).toContain('NonExistentXyz');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('apply mode: --apply ./src in text shows Auto-Migration Prompt', async () => {
    const program = createProgram('text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '4', '5', '--apply', './src']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();

    expect(logged).toContain('Auto-Migration Prompt');
    expect(logged).toContain('./src');
  });

  it('apply mode in json includes autoFixSteps and manualSteps', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', '4', '5', '--apply', './src']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    expect(result).toHaveProperty('autoFixSteps');
    expect(result).toHaveProperty('manualSteps');
    expect(result).toHaveProperty('targetDir', './src');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('totalAutoFix');
    expect(result.summary).toHaveProperty('totalManual');
  });

  it('V4_TO_V5_STEPS has valid structure', () => {
    expect(Array.isArray(V4_TO_V5_STEPS)).toBe(true);
    expect(V4_TO_V5_STEPS.length).toBeGreaterThan(0);

    for (const step of V4_TO_V5_STEPS) {
      expect(step).toHaveProperty('component');
      expect(step).toHaveProperty('breaking');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('autoFixable');
      expect(typeof step.component).toBe('string');
      expect(typeof step.breaking).toBe('boolean');
      expect(typeof step.description).toBe('string');
      expect(typeof step.autoFixable).toBe('boolean');
    }
  });

  it('V5_TO_V6_STEPS has valid structure', () => {
    expect(Array.isArray(V5_TO_V6_STEPS)).toBe(true);
    expect(V5_TO_V6_STEPS.length).toBeGreaterThan(0);

    for (const step of V5_TO_V6_STEPS) {
      expect(step).toHaveProperty('component');
      expect(step).toHaveProperty('breaking');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('autoFixable');
      expect(typeof step.component).toBe('string');
      expect(typeof step.breaking).toBe('boolean');
      expect(typeof step.description).toBe('string');
      expect(typeof step.autoFixable).toBe('boolean');
    }
  });

  it('version prefix stripping: v4 and v5 work same as 4 and 5', async () => {
    const program = createProgram('json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'migrate', 'v4', 'v5']);

    const logged = logSpy.mock.calls.map((c) => c[0]).join('');
    logSpy.mockRestore();
    const result = JSON.parse(logged);

    expect(result.from).toBe('4');
    expect(result.to).toBe('5');
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
