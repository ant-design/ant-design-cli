import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectEnvinfo } from '../commands/env.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
const mockedExec = vi.mocked(execFileSync);

describe('collectEnvinfo', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps non-string, non-object values to null', async () => {
    // Mock envinfo to return a numeric (non-string, non-object) value
    vi.doMock('envinfo', () => ({
      default: {
        run: vi.fn().mockResolvedValue(JSON.stringify({
          System: { Numeric: 123, NullVal: null, StringVal: 'x', ObjVal: { version: '1' } },
        })),
      },
    }));
    mockedExec.mockReturnValueOnce('https://registry.npmjs.org\n');
    const { collectEnvinfo: collect } = await import('../commands/env.js');
    const data = await collect();
    expect(data.System.Numeric).toBeNull();
    expect(data.System.NullVal).toBeNull();
    expect(data.System.StringVal).toBe('x');
    expect(data.Binaries['Registry']).toBe('https://registry.npmjs.org');
    vi.doUnmock('envinfo');
  });

  it('falls back to null Registry when npm config fails', async () => {
    vi.doMock('envinfo', () => ({
      default: {
        run: vi.fn().mockResolvedValue(JSON.stringify({
          Binaries: { Node: '20.0.0' },
        })),
      },
    }));
    mockedExec.mockImplementationOnce(() => {
      throw new Error('npm not found');
    });
    const { collectEnvinfo: collect } = await import('../commands/env.js');
    const data = await collect();
    expect(data.Binaries['Registry']).toBeNull();
    vi.doUnmock('envinfo');
  });

  it('returns empty object when envinfo crashes', async () => {
    vi.doMock('envinfo', () => ({
      default: {
        run: vi.fn().mockRejectedValue(new Error('envinfo failed')),
      },
    }));
    const { collectEnvinfo: collect } = await import('../commands/env.js');
    const data = await collect();
    expect(data).toEqual({});
    vi.doUnmock('envinfo');
  });
});

describe('scanEcosystem dotfile skipping', () => {
  it('skips dotted entries inside @ant-design scope', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { scanEcosystem } = await import('../commands/env.js');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-scan-'));
    try {
      mkdirSync(join(tempDir, 'node_modules', '@ant-design', '.cache'), { recursive: true });
      writeFileSync(
        join(tempDir, 'node_modules', '@ant-design', '.cache', 'package.json'),
        JSON.stringify({ version: '0.0.0' }),
      );
      mkdirSync(join(tempDir, 'node_modules', '@ant-design', 'real-pkg'), { recursive: true });
      writeFileSync(
        join(tempDir, 'node_modules', '@ant-design', 'real-pkg', 'package.json'),
        JSON.stringify({ version: '1.0.0' }),
      );
      const result = scanEcosystem(tempDir);
      expect(result['@ant-design/.cache']).toBeUndefined();
      expect(result['@ant-design/real-pkg']).toBe('1.0.0');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
