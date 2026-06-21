import { describe, expect, it, vi } from 'vitest';

const execSyncMock = vi.fn(() => {
  const error = new Error('network failed') as Error & { stderr: Buffer };
  error.stderr = Buffer.from('fatal: unable to access remote');
  throw error;
});

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
  execFileSync: vi.fn(),
}));

describe('sync tag fetching', () => {
  it('fails closed when release tags cannot be fetched', async () => {
    const { fetchTags } = await import('../../../scripts/sync.js');

    expect(() => fetchTags(6)).toThrow(/fatal: unable to access remote/);
  });
});
