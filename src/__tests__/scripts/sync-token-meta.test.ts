import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execSyncMock = vi.fn((cmd: string, options?: { cwd?: string }) => {
  if (cmd.startsWith('npm pack')) {
    writeFileSync(join(options!.cwd!, 'antd-6.4.4.tgz'), '');
  }
  return '';
});

const execFileSyncMock = vi.fn((_cmd: string, _args: string[], options?: { cwd?: string }) => {
  const tokenPath = join(options!.cwd!, 'package', 'es', 'version', 'token-meta.json');
  mkdirSync(join(options!.cwd!, 'package', 'es', 'version'), { recursive: true });
  writeFileSync(tokenPath, '{"version":"fresh"}');
});

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
  execFileSync: execFileSyncMock,
}));

describe('sync token metadata', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = join(tmpdir(), `antd-cli-sync-token-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(workdir, 'components', 'version'), { recursive: true });
    writeFileSync(join(workdir, 'components', 'version', 'token-meta.json'), '{"version":"stale"}');
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('replaces existing token-meta.json before extracting a new tag', async () => {
    const { fetchTokenMeta } = await import('../../../scripts/sync.js');

    fetchTokenMeta(workdir, '6.4.4');

    expect(readFileSync(join(workdir, 'components', 'version', 'token-meta.json'), 'utf8')).toBe('{"version":"fresh"}');
  });
});
