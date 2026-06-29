import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { run, runCLI } from './helper.js';

const { version: cliVersion } = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string };

describe('CLI', () => {
  it('should show help', async () => {
    const out = await run('--help');
    expect(out).toContain('Ant Design CLI');
    expect(out).toContain('/ ___ |');
    expect(out).toContain(`antd ${cliVersion}`);
    expect(out).toContain('antd');
    expect(out).toContain('list');
    expect(out).toContain('info');
    expect(out).toContain('demo');
  });

  it('should show help with version when no command is provided', async () => {
    const out = await run();
    expect(out).toContain(`antd ${cliVersion}`);
    expect(out).toContain('Usage: antd [options] [command]');
  });

  it('should show help with version with -h', async () => {
    const out = await run('-h');
    expect(out).toContain(`antd ${cliVersion}`);
    expect(out).toContain('Usage: antd [options] [command]');
  });

  it('should show CLI version with -V', async () => {
    const out = await run('-V');
    expect(out).toMatch(/^\d+\.\d+\.\d+[-\w.]*$/);
  });

  it('should reject -v because CLI version uses -V', async () => {
    const result = await runCLI('-v');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("unknown option '-v'");
  });

  it('should not treat bare --version as a CLI version alias', async () => {
    const out = await run('--version');
    expect(out).not.toBe(cliVersion);
  });

  it('should output error as JSON to stderr', async () => {
    const result = await runCLI('info', 'Btn', '--format', 'json');
    expect(result.stdout).toBe('');
    const data = JSON.parse(result.stderr);
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
    expect(data.suggestion).toContain('Button');
  });

  it('should reject invalid --format values', async () => {
    const result = await runCLI('info', 'Button', '--format', 'csv');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid format 'csv'");
    expect(result.stderr).toContain('json, text, markdown');
  });

  it('should not print an internal stack trace for invalid global options', () => {
    const env = { ...process.env };
    delete env.VITEST;
    const result = spawnSync(process.execPath, ['dist/index.js', 'list', '--format', 'csv'], {
      cwd: process.cwd(),
      env: { ...env, NO_UPDATE_CHECK: '1' },
      encoding: 'utf-8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid format 'csv'");
    expect(result.stderr).not.toContain('Error: EXIT:1');
    expect(result.stderr).not.toContain('at Object.callback');
  });

  it('should reject invalid --lang values', async () => {
    const result = await runCLI('info', 'Button', '--lang', 'fr');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid language 'fr'");
    expect(result.stderr).toContain('en, zh');
  });

  it('should accept valid --format and --lang values', async () => {
    const result = await runCLI('info', 'Button', '--format', 'json', '--lang', 'zh');
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.name).toBe('Button');
  });
});
