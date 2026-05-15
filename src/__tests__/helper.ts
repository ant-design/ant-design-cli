import { vi } from 'vitest';
import { createProgram } from '../index.js';

process.env.NO_UPDATE_CHECK = '1';

export interface CLIRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI in-process via createProgram() + parseAsync().
 * Captures stdout, stderr, and exit code. Vitest can track coverage.
 */
export async function runCLI(...args: string[]): Promise<CLIRunResult> {
  const program = createProgram();
  let stdout = '';
  let stderr = '';
  let forcedExitCode: number | null = null;

  const logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    stdout += a.map(String).join(' ') + '\n';
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    stderr += a.map(String).join(' ') + '\n';
  });
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((data: unknown) => {
    stdout += String(data);
    return true;
  });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    forcedExitCode = typeof code === 'number' ? code : 0;
    // Throw to halt execution after process.exit, matching real behavior
    throw new Error(`EXIT:${forcedExitCode}`);
  });
  const origExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    await program.parseAsync(args, { from: 'user' });
  } catch (e: unknown) {
    // Re-throw unexpected errors; swallow process.exit throws
    if (!(e instanceof Error) || !/^EXIT:\d+$/.test(e.message)) {
      throw e;
    }
  }

  const result: CLIRunResult = {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode: forcedExitCode ?? (process.exitCode as number) ?? 0,
  };

  logSpy.mockRestore();
  errSpy.mockRestore();
  writeSpy.mockRestore();
  exitSpy.mockRestore();
  process.exitCode = origExitCode as number | undefined;

  return result;
}

/** Run CLI and return trimmed stdout. */
export async function run(...args: string[]): Promise<string> {
  const result = await runCLI(...args);
  return result.stdout;
}

/** Run CLI and return trimmed stderr (for error path testing). */
export async function runStderr(...args: string[]): Promise<string> {
  const result = await runCLI(...args);
  return result.stderr;
}