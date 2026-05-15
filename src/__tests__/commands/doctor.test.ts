import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run, runCLI } from '../helper.js';

async function runDoctorInTempDir(packages: Record<string, object>): Promise<any> {
  const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-test-'));
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));

    for (const [pkgName, pkgJson] of Object.entries(packages)) {
      const pkgDir = join(tempDir, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson));
    }

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    try {
      const result = await runCLI('doctor', '--format', 'json');
      return JSON.parse(result.stdout);
    } finally {
      cwdSpy.mockRestore();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('doctor', () => {
  it('should run doctor', async () => {
    const out = await run('doctor');
    expect(out).toContain('antd Doctor');
    expect(out).toContain('Summary');
  });

  it('should run doctor as markdown', async () => {
    const out = await run('doctor', '--format', 'markdown');
    expect(out).toContain('antd Doctor');
  });

  it('should show doctor as JSON', async () => {
    const out = await run('doctor', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.checks).toBeDefined();
    expect(data.summary).toBeDefined();
    const names = (data.checks as Array<{ name: string }>).map(c => c.name);
    expect(names).toContain('dayjs-duplicate');
    expect(names).toContain('cssinjs-duplicate');
    expect(names).toContain('cssinjs-compat');
    expect(names).toContain('icons-compat');
  });
});

describe('doctor ecosystem peerDeps', () => {
  it('should report pass when all peerDeps are satisfied', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('pass');
    expect(check.message).toContain('satisfies all peerDependencies');
  });

  it('should report fail when an installed dep does not satisfy peerDep range', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.10.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('fail');
    expect(check.severity).toBe('error');
    expect(check.message).toContain('antd requires >=5.16.0');
    expect(check.message).toContain('installed: 5.10.0');
  });

  it('should report warn when a peerDep is not installed at all', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('warn');
    expect(check.message).toContain('react is not installed');
  });

  it('should not emit a check for packages with no peerDependencies', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/colors': { version: '7.0.0' },
    });
    const names = (data.checks as any[]).map((c) => c.name);
    expect(names).not.toContain('ecosystem-compat:colors');
  });

  it('should emit no ecosystem checks when no @ant-design/* packages are installed', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
    });
    const ecosystemChecks = (data.checks as any[]).filter((c) => c.name.startsWith('ecosystem-compat:'));
    expect(ecosystemChecks).toHaveLength(0);
  });

  it('should treat compound ranges as compatible (fail-open)', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.10.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.0.0 <6.0.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check).toBeDefined();
    expect(check.status).toBe('pass');
  });

  it('should check multiple ecosystem packages independently', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      'react': { version: '18.2.0' },
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: { antd: '>=5.16.0', react: '>=18.0.0' },
      },
      '@ant-design/charts': {
        version: '2.1.0',
        peerDependencies: { react: '>=17.0.0' },
      },
    });
    const proCheck = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    const chartsCheck = data.checks.find((c: any) => c.name === 'ecosystem-compat:charts');
    expect(proCheck).toBeDefined();
    expect(proCheck.status).toBe('pass');
    expect(chartsCheck).toBeDefined();
    expect(chartsCheck.status).toBe('pass');
  });
});