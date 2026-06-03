import { describe, it, expect, vi } from 'vitest';
import { run, runCLI } from '../helper.js';

// Mock issue module at module level with safe defaults to prevent real gh CLI calls.
// Per CLAUDE.md: checkGhAvailable and submitViaGh must use vi.fn() with safe defaults,
// never vi.fn(actualFunction) which would use the real function as fallback.
vi.mock('../../utils/issue.js', () => ({
  checkGhAvailable: vi.fn(() => false),
  submitViaGh: vi.fn(() => ({ issueNumber: 0, url: '' })),
  buildAntdIssueBody: vi.fn((_fields) => 'mock antd issue body'),
  buildCliIssueBody: vi.fn((_fields) => 'mock cli issue body'),
  buildIssueUrl: vi.fn((_repo, _title, _body) => 'https://github.com/mock/repo/issues/new'),
  collectAntdEnv: vi.fn(() => ({ antd: '5.0.0', react: '18.0.0', system: 'darwin', browser: '-' })),
  collectCliEnv: vi.fn(() => ({ cli: '1.0.0', node: 'v20.0.0', system: 'darwin' })),
}));

import { checkGhAvailable, submitViaGh } from '../../utils/issue.js';

const mockCheckGh = vi.mocked(checkGhAvailable);
const mockSubmitViaGh = vi.mocked(submitViaGh);

describe('bug', () => {
  it('should preview a bug report as text', async () => {
    const out = await run('bug', '--title', 'Test bug');
    expect(out).toContain('Repository: ant-design/ant-design');
    expect(out).toContain('Title: Test bug');
    expect(out).toContain('--- Issue Body ---');
    expect(out).toContain('To submit, re-run with --submit flag.');
  });

  it('should preview a bug report as JSON', async () => {
    const out = await run('bug', '--title', 'Test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design');
    expect(data.title).toBe('Test bug');
    expect(data.url).toContain('https://github.com/mock/repo/issues/new');
  });

  it('should include provided fields in bug report', async () => {
    const out = await run('bug', '--title', 'Test', '--steps', 'Click button', '--expected', 'Works', '--actual', 'Crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toBeTruthy();
    expect(data.url).toBeTruthy();
  });

  it('should preview bug report as markdown (raw body)', async () => {
    const out = await run('bug', '--title', 'Test', '--format', 'markdown');
    expect(out).toContain('mock antd issue body');
    expect(out).not.toContain('Repository:');
  });

  it('should error when --title is missing for bug', async () => {
    const result = await runCLI('bug', '--format', 'json');
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('TITLE_REQUIRED');
    expect(err.message).toContain('--title');
  });
});

describe('bug-cli', () => {
  it('should preview a bug-cli report as text', async () => {
    const out = await run('bug-cli', '--title', 'CLI test bug');
    expect(out).toContain('Repository: ant-design/ant-design-cli');
    expect(out).toContain('Title: CLI test bug');
  });

  it('should preview a bug-cli report as JSON', async () => {
    const out = await run('bug-cli', '--title', 'CLI test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design-cli');
    expect(data.title).toBe('CLI test bug');
    expect(data.url).toContain('https://github.com/mock/repo/issues/new');
  });

  it('should include description in bug-cli report', async () => {
    const out = await run('bug-cli', '--title', 'Test', '--description', 'Info crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toBeTruthy();
  });

  it('should error when --title is missing for bug-cli', async () => {
    const result = await runCLI('bug-cli', '--format', 'json');
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('TITLE_REQUIRED');
    expect(err.message).toContain('--title');
  });

  it('should preview bug-cli report as markdown (raw body)', async () => {
    const out = await run('bug-cli', '--title', 'CLI Test', '--format', 'markdown');
    expect(out).toContain('mock cli issue body');
    expect(out).not.toContain('Repository:');
  });
});

describe('bug --submit', () => {
  it('errors when gh is missing', async () => {
    mockCheckGh.mockReturnValue(false);
    const result = await runCLI('bug', '--title', 'X', '--submit', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('GH_NOT_FOUND');
  });

  it('prints created issue URL on success (text)', async () => {
    mockCheckGh.mockReturnValue(true);
    mockSubmitViaGh.mockReturnValue({
      issueNumber: 123,
      url: 'https://github.com/ant-design/ant-design/issues/123',
    });
    const out = await run('bug', '--title', 'X', '--submit');
    expect(out).toContain('Issue created:');
    expect(out).toContain('/issues/123');
  });

  it('returns JSON when --format json on success', async () => {
    mockCheckGh.mockReturnValue(true);
    mockSubmitViaGh.mockReturnValue({
      issueNumber: 42,
      url: 'https://github.com/ant-design/ant-design/issues/42',
    });
    const out = await run('bug', '--title', 'X', '--submit', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.issueNumber).toBe(42);
    expect(data.repo).toBe('ant-design/ant-design');
  });

  it('reports failure with exit code 2 when gh throws', async () => {
    mockCheckGh.mockReturnValue(true);
    mockSubmitViaGh.mockImplementation(() => {
      throw new Error('auth failed');
    });
    const result = await runCLI('bug', '--title', 'X', '--submit', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('GH_SUBMIT_FAILED');
    expect(err.message).toContain('auth failed');
  });
});

describe('bug-cli --submit', () => {
  it('errors when gh is missing', async () => {
    mockCheckGh.mockReturnValue(false);
    const result = await runCLI('bug-cli', '--title', 'X', '--submit', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('GH_NOT_FOUND');
  });

  it('prints created issue URL on success (text)', async () => {
    mockCheckGh.mockReturnValue(true);
    mockSubmitViaGh.mockReturnValue({
      issueNumber: 7,
      url: 'https://github.com/ant-design/ant-design-cli/issues/7',
    });
    const out = await run('bug-cli', '--title', 'X', '--submit');
    expect(out).toContain('Issue created:');
    expect(out).toContain('/issues/7');
  });

  it('returns JSON when --format json on success', async () => {
    mockCheckGh.mockReturnValue(true);
    mockSubmitViaGh.mockReturnValue({
      issueNumber: 9,
      url: 'https://github.com/ant-design/ant-design-cli/issues/9',
    });
    const out = await run('bug-cli', '--title', 'X', '--submit', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.issueNumber).toBe(9);
    expect(data.repo).toBe('ant-design/ant-design-cli');
  });

  it('reports failure with exit code 2 when gh throws', async () => {
    mockCheckGh.mockReturnValue(true);
    mockSubmitViaGh.mockImplementation(() => {
      throw new Error('auth failed');
    });
    const result = await runCLI('bug-cli', '--title', 'X', '--submit', '--format', 'json');
    expect(result.exitCode).toBe(2);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('GH_SUBMIT_FAILED');
    expect(err.message).toContain('auth failed');
  });
});