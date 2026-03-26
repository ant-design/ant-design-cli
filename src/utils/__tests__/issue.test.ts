/**
 * Direct unit tests for issue.ts utility functions.
 * Covers checkGhAvailable false path (lines 160-161) and submitViaGh (lines 170-183).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: vi.fn(actual.execFileSync),
  };
});

import { execFileSync } from 'node:child_process';
import { checkGhAvailable, submitViaGh } from '../issue.js';

const mockedExecFileSync = vi.mocked(execFileSync);

describe('checkGhAvailable', () => {
  afterEach(() => {
    mockedExecFileSync.mockReset();
  });

  it('should return false when gh command throws', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('command not found');
    });
    expect(checkGhAvailable()).toBe(false);
  });

  it('should return true when gh command succeeds', () => {
    mockedExecFileSync.mockImplementation(() => Buffer.from('gh version 2.0.0'));
    expect(checkGhAvailable()).toBe(true);
  });
});

describe('submitViaGh', () => {
  afterEach(() => {
    mockedExecFileSync.mockReset();
  });

  it('should parse issue number from gh output URL', () => {
    mockedExecFileSync.mockReturnValue(
      'https://github.com/ant-design/ant-design/issues/123\n' as any
    );

    const result = submitViaGh('ant-design/ant-design', 'Test title', 'Test body');
    expect(result.issueNumber).toBe(123);
    expect(result.url).toBe('https://github.com/ant-design/ant-design/issues/123');
  });

  it('should return issueNumber 0 when output has no issue number', () => {
    mockedExecFileSync.mockReturnValue('unexpected output\n' as any);

    const result = submitViaGh('ant-design/ant-design', 'Test', 'Body');
    expect(result.issueNumber).toBe(0);
    expect(result.url).toBe('unexpected output');
  });

  it('should pass correct arguments to execFileSync', () => {
    mockedExecFileSync.mockReturnValue(
      'https://github.com/org/repo/issues/1\n' as any
    );

    submitViaGh('org/repo', 'My Title', 'My Body');

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'create', '--repo', 'org/repo', '--title', 'My Title', '--body', 'My Body'],
      { encoding: 'utf-8', timeout: 30000 },
    );
  });
});
