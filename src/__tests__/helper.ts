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
  const errWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation((data: unknown) => {
    stderr += String(data);
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
    /* v8 ignore next 3 -- test helper safety net: no current test triggers a non-EXIT throw */
    if (!(e instanceof Error) || !/^EXIT:\d+$/.test(e.message)) {
      throw e;
    }
  } finally {
    const capturedExitCode = forcedExitCode ?? (process.exitCode as number) ?? 0;
    logSpy.mockRestore();
    errSpy.mockRestore();
    writeSpy.mockRestore();
    errWriteSpy.mockRestore();
    exitSpy.mockRestore();
    process.exitCode = origExitCode as number | undefined;
    forcedExitCode = capturedExitCode;
  }

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode: forcedExitCode,
  };
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
