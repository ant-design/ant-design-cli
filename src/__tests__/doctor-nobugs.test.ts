import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Force bug-versions to return null so the "no bugs" pass branch is taken.
vi.mock('../utils/bug-versions.js', () => ({
  findBugInfo: () => null,
  getBugVersions: async () => null,
  loadBundledBugVersions: () => null,
}));

const { runCLI } = await import('./helper.js');

describe('doctor antd-installed pass path', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-nobugs-'));
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }));
    mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0', peerDependencies: {} }));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  it('returns pass when no known bugs match the installed antd version', async () => {
    const result = await runCLI('doctor', '--format', 'json');
    cwdSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });

    const data = JSON.parse(result.stdout);
    const check = data.checks.find((c: { name: string }) => c.name === 'antd-installed');
    expect(check?.status).toBe('pass');
    expect(check?.message).toContain('5.20.0');
  });
});
