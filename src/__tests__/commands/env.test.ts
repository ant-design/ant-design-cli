import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCLI } from '../helper.js';

async function runEnvInTempDir(packages: Record<string, object>): Promise<any> {
  const tempDir = mkdtempSync(join(tmpdir(), 'antd-cli-env-'));
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
      const result = await runCLI('env', '--format', 'json', tempDir);
      return JSON.parse(result.stdout);
    } finally {
      cwdSpy.mockRestore();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('env', () => {
  it('should output text format with Environment header', { timeout: 20000 }, async () => {
    const result = await runCLI('env');
    expect(result.stdout).toContain('Environment');
    expect(result.stdout).toContain('System:');
    expect(result.stdout).toContain('Binaries:');
    expect(result.stdout).toContain('Node');
  });

  it('should output valid JSON', async () => {
    const result = await runCLI('env', '--format', 'json');
    const data = JSON.parse(result.stdout);
    expect(data).toHaveProperty('envinfo');
    expect(data).toHaveProperty('dependencies');
    expect(data).toHaveProperty('ecosystem');
    expect(data).toHaveProperty('buildTools');
    expect(data.envinfo.System).toBeTruthy();
    expect(data.envinfo.Binaries.Node).toBeTruthy();
  });

  it('should output markdown format', async () => {
    const result = await runCLI('env', '--format', 'markdown');
    expect(result.stdout).toContain('## Environment');
    expect(result.stdout).toContain('### System');
    expect(result.stdout).toContain('| Item | Version |');
  });

  it('should detect dependencies from target dir', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      'react': { name: 'react', version: '18.3.1' },
      'react-dom': { name: 'react-dom', version: '18.3.1' },
    });
    expect(data.dependencies.antd).toBe('5.22.0');
    expect(data.dependencies.react).toBe('18.3.1');
    expect(data.dependencies['react-dom']).toBe('18.3.1');
    expect(data.dependencies.dayjs).toBeNull();
  });

  it('should scan ecosystem packages', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      '@ant-design/pro-components': { name: '@ant-design/pro-components', version: '2.8.1' },
      '@ant-design/charts': { name: '@ant-design/charts', version: '2.2.1' },
      'rc-field-form': { name: 'rc-field-form', version: '2.7.0' },
    });
    expect(data.ecosystem['@ant-design/pro-components']).toBe('2.8.1');
    expect(data.ecosystem['@ant-design/charts']).toBe('2.2.1');
    expect(data.ecosystem['rc-field-form']).toBe('2.7.0');
  });

  it('should not include core deps in ecosystem', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      '@ant-design/cssinjs': { name: '@ant-design/cssinjs', version: '1.22.1' },
      '@ant-design/icons': { name: '@ant-design/icons', version: '5.5.2' },
      '@ant-design/pro-components': { name: '@ant-design/pro-components', version: '2.8.1' },
    });
    expect(data.dependencies['@ant-design/cssinjs']).toBe('1.22.1');
    expect(data.dependencies['@ant-design/icons']).toBe('5.5.2');
    expect(data.ecosystem['@ant-design/cssinjs']).toBeUndefined();
    expect(data.ecosystem['@ant-design/icons']).toBeUndefined();
    expect(data.ecosystem['@ant-design/pro-components']).toBe('2.8.1');
  });

  it('should detect build tools', async () => {
    const data = await runEnvInTempDir({
      'antd': { name: 'antd', version: '5.22.0' },
      'typescript': { name: 'typescript', version: '5.6.3' },
      'vite': { name: 'vite', version: '6.0.0' },
    });
    expect(data.buildTools.typescript).toBe('5.6.3');
    expect(data.buildTools.vite).toBe('6.0.0');
  });
});