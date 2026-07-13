import { describe, expect, it, vi } from 'vitest';

const execSyncMock = vi.fn((_command: string): string => {
  const error = new Error('network failed') as Error & { stderr: Buffer };
  error.stderr = Buffer.from('fatal: unable to access remote');
  throw error;
});
const execFileSyncMock = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
  execFileSync: execFileSyncMock,
}));

describe('sync tag fetching', () => {
  it('fails closed when release tags cannot be fetched', async () => {
    const { fetchTags } = await import('../../../scripts/sync.js');

    expect(() => fetchTags(6)).toThrow(/fatal: unable to access remote/);
  });

  it('passes checkout tags as a single argv entry', async () => {
    const { checkout } = await import('../../../scripts/sync.js');
    const workdir = '/tmp/antd-cli-checkout';
    const tag = '6.5.0; touch /tmp/antd-cli-pwned';
    execSyncMock.mockReturnValueOnce('');

    expect(checkout(workdir, tag)).toBe(true);
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'git',
      ['checkout', tag],
      expect.objectContaining({ cwd: workdir }),
    );
  });
});
