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

  it('should run doctor in Chinese with --lang zh', async () => {
    const out = await run('doctor', '--lang', 'zh');
    expect(out).toContain('antd 诊断');
    expect(out).toContain('摘要');
  });

  it('should run doctor as markdown', async () => {
    const out = await run('doctor', '--format', 'markdown');
    expect(out).toContain('## antd Doctor');
    expect(out).toContain('| Status | Check | Message |');
    expect(out).toContain('PASS');
    expect(out).toContain('**Summary:**');
  });

  it('should run doctor as markdown in Chinese', async () => {
    const out = await run('doctor', '--format', 'markdown', '--lang', 'zh');
    expect(out).toContain('## antd 诊断');
    expect(out).toContain('| 状态 | 检查项 | 信息 |');
    expect(out).toContain('通过');
    expect(out).toContain('**摘要：**');
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

  it('should fail react-compat when react major is too low for antd v5', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      'react': { version: '17.0.0' },
    });
    const check = data.checks.find((c: any) => c.name === 'react-compat');
    expect(check?.status).toBe('fail');
    expect(check?.suggestion).toContain('React 18');
  });

  it('should warn when @ant-design/cssinjs is required but missing', async () => {
    const data = await runDoctorInTempDir({
      'antd': {
        version: '5.20.0',
        peerDependencies: { '@ant-design/cssinjs': '^1.0.0' },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'cssinjs-compat');
    expect(check?.status).toBe('warn');
    expect(check?.message).toContain('not installed');
  });

  it('should fail cssinjs-compat when installed version mismatches peer range', async () => {
    const data = await runDoctorInTempDir({
      'antd': {
        version: '5.20.0',
        peerDependencies: { '@ant-design/cssinjs': '^99.0.0' },
      },
      '@ant-design/cssinjs': { version: '1.0.0' },
    });
    const check = data.checks.find((c: any) => c.name === 'cssinjs-compat');
    expect(check?.status).toBe('fail');
    expect(check?.suggestion).toContain('@ant-design/cssinjs');
  });

  it('should pass icons-compat when not installed (optional)', async () => {
    const data = await runDoctorInTempDir({
      'antd': {
        version: '5.20.0',
        peerDependencies: { '@ant-design/icons': '^5.0.0' },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'icons-compat');
    expect(check?.status).toBe('pass');
    expect(check?.message).toContain('not installed');
  });

  it('should warn icons-compat when installed version does not satisfy range', async () => {
    const data = await runDoctorInTempDir({
      'antd': {
        version: '5.20.0',
        peerDependencies: { '@ant-design/icons': '^5.0.0' },
      },
      '@ant-design/icons': { version: '4.0.0' },
    });
    const check = data.checks.find((c: any) => c.name === 'icons-compat');
    expect(check?.status).toBe('warn');
  });

  it('should warn cssinjs when not installed (for SSR)', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
    });
    const check = data.checks.find((c: any) => c.name === 'cssinjs');
    expect(check?.status).toBe('warn');
  });

  it('should fail cssinjs-duplicate when multiple installations exist', async () => {
    // The helper's mkdirSync(..., { recursive: true }) creates nested paths verbatim,
    // so 'sub/node_modules/@ant-design/cssinjs' lands at the nested location
    // findDuplicateVersions() scans.
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/cssinjs': { version: '1.0.0' },
      'sub/node_modules/@ant-design/cssinjs': { version: '1.1.0' },
    } as never);
    const check = data.checks.find((c: any) => c.name === 'cssinjs-duplicate');
    expect(check?.status).toBe('fail');
    expect(check?.message).toContain('1.0.0');
    expect(check?.message).toContain('1.1.0');
  });
});

describe('doctor babel-plugin-import', () => {
  it('warns when babel-plugin-import is configured in .babelrc with antd v5+', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-babel-'));
    try {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));
      writeFileSync(join(tempDir, '.babelrc'), JSON.stringify({ plugins: [['babel-plugin-import', { libraryName: 'antd' }]] }));
      mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0', peerDependencies: {} }));

      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      try {
        const result = await runCLI('doctor', '--format', 'json');
        const data = JSON.parse(result.stdout);
        const check = data.checks.find((c: any) => c.name === 'babel-plugin');
        expect(check?.status).toBe('warn');
        expect(check?.message).toContain('babel-plugin-import');
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes cssinjs-compat when version satisfies the peer range', async () => {
    const data = await runDoctorInTempDir({
      'antd': {
        version: '5.20.0',
        peerDependencies: { '@ant-design/cssinjs': '^1.0.0' },
      },
      '@ant-design/cssinjs': { version: '1.5.0' },
    });
    const check = data.checks.find((c: any) => c.name === 'cssinjs-compat');
    expect(check?.status).toBe('pass');
  });

  it('fails ecosystem-compat with both incompatible version AND missing peer dep', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.10.0', peerDependencies: {} },
      // react missing, antd version too low for required >=5.16.0
      '@ant-design/pro-components': {
        version: '2.7.0',
        peerDependencies: {
          antd: '>=5.16.0',
          react: '>=18.0.0',
        },
      },
    });
    const check = data.checks.find((c: any) => c.name === 'ecosystem-compat:pro-components');
    expect(check?.status).toBe('fail');
    // Message should mention both failure types
    expect(check?.message).toContain('antd');
    expect(check?.message).toContain('react');
  });

  it('passes icons-compat when icons version satisfies range', async () => {
    const data = await runDoctorInTempDir({
      'antd': {
        version: '5.20.0',
        peerDependencies: { '@ant-design/icons': '^5.0.0' },
      },
      '@ant-design/icons': { version: '5.3.0' },
    });
    const check = data.checks.find((c: any) => c.name === 'icons-compat');
    expect(check?.status).toBe('pass');
  });

  it('passes cssinjs check when installed', async () => {
    const data = await runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/cssinjs': { version: '1.0.0' },
    });
    const check = data.checks.find((c: any) => c.name === 'cssinjs');
    expect(check?.status).toBe('pass');
  });

  it('fails duplicate-install when antd is installed at two nested paths', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-dup-'));
    try {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }));
      // Top-level antd
      mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.10.0', peerDependencies: {} }));
      // Nested antd at node_modules/x/node_modules/antd with different version
      mkdirSync(join(tempDir, 'node_modules', 'some-dep', 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'some-dep', 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0' }));

      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      try {
        const result = await runCLI('doctor', '--format', 'json');
        const data = JSON.parse(result.stdout);
        const check = data.checks.find((c: any) => c.name === 'duplicate-install');
        expect(check?.status).toBe('fail');
        expect(check?.message).toContain('5.10.0');
        expect(check?.message).toContain('5.20.0');
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails dayjs-duplicate when dayjs is installed at two paths', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-dayjs-'));
    try {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }));
      mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0', peerDependencies: {} }));
      mkdirSync(join(tempDir, 'node_modules', 'dayjs'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'dayjs', 'package.json'), JSON.stringify({ version: '1.11.0' }));
      mkdirSync(join(tempDir, 'node_modules', 'some-dep', 'node_modules', 'dayjs'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'some-dep', 'node_modules', 'dayjs', 'package.json'), JSON.stringify({ version: '1.12.0' }));

      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      try {
        const result = await runCLI('doctor', '--format', 'json');
        const data = JSON.parse(result.stdout);
        const check = data.checks.find((c: any) => c.name === 'dayjs-duplicate');
        expect(check?.status).toBe('fail');
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('warns theme-config when package.json has theme field on antd v5+', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-theme-'));
    try {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'p',
        version: '1.0.0',
        theme: { primaryColor: '#000' },
      }));
      mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0', peerDependencies: {} }));

      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      try {
        const result = await runCLI('doctor', '--format', 'json');
        const data = JSON.parse(result.stdout);
        const check = data.checks.find((c: any) => c.name === 'theme-config');
        expect(check?.status).toBe('warn');
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('skips dotfile entries and version-less packages inside @ant-design scope dir', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-scope-'));
    try {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }));
      mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0', peerDependencies: {} }));

      // Dotfile-style nested entry (e.g. .package-lock or .pnpm) — should be skipped
      mkdirSync(join(tempDir, 'node_modules', '@ant-design', '.bin'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', '@ant-design', '.bin', 'package.json'), JSON.stringify({ version: '0.0.0' }));

      // Versionless package — should be skipped at line 72
      mkdirSync(join(tempDir, 'node_modules', '@ant-design', 'broken'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', '@ant-design', 'broken', 'package.json'), JSON.stringify({ name: 'no-version' }));

      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      try {
        const result = await runCLI('doctor', '--format', 'json');
        const data = JSON.parse(result.stdout);
        // No ecosystem check should reference the .bin or broken entries
        const names = (data.checks as { name: string }[]).map((c) => c.name);
        expect(names).not.toContain('ecosystem-compat:.bin');
        expect(names).not.toContain('ecosystem-compat:broken');
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('warns when babel-plugin-import is configured in package.json babel field', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-babel-pkg-'));
    try {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        babel: { plugins: [['babel-plugin-import', { libraryName: 'antd' }]] },
      }));
      mkdirSync(join(tempDir, 'node_modules', 'antd'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'antd', 'package.json'), JSON.stringify({ version: '5.20.0', peerDependencies: {} }));

      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      try {
        const result = await runCLI('doctor', '--format', 'json');
        const data = JSON.parse(result.stdout);
        const check = data.checks.find((c: any) => c.name === 'babel-plugin');
        expect(check?.status).toBe('warn');
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});