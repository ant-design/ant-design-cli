import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { run, runCLI } from './helper.js';

describe('CLI', () => {
  it('should show root help with the CLI version banner when no command is provided', async () => {
    const out = await run();
    expect(out).toMatch(/^▄▀█ █▄ █ ▀█▀   █▀▄ █▀▀ █▀▀ █ █▀▀ █▄ █   █▀▀ █   █/);
    expect(out).toContain('█▀█ █ ▀█  █    █▄▀ ██▄ ▄▄█ █ █▄█ █ ▀█   █▄▄ █▄▄ █');
    expect(out).toMatch(/@ant-design\/cli v\d+\.\d+\.\d+[-\w.]*/);
    expect(out).toContain('Usage: antd [options] [command]');
  });

  it('should show help', async () => {
    const out = await run('--help');
    expect(out).toMatch(/^▄▀█ █▄ █ ▀█▀   █▀▄ █▀▀ █▀▀ █ █▀▀ █▄ █   █▀▀ █   █/);
    expect(out).toContain('█▀█ █ ▀█  █    █▄▀ ██▄ ▄▄█ █ █▄█ █ ▀█   █▄▄ █▄▄ █');
    expect(out).toMatch(/@ant-design\/cli v\d+\.\d+\.\d+[-\w.]*/);
    expect(out).toContain('antd');
    expect(out).toContain('list');
    expect(out).toContain('info');
    expect(out).toContain('demo');
  });

  it('should show CLI version with -V', async () => {
    const out = await run('-V');
    expect(out).toMatch(/^\d+\.\d+\.\d+[-\w.]*$/);
    expect(out).not.toContain('ANT DESIGN');
  });

  it('should use only cfonts for the help banner dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies).toHaveProperty('cfonts');
    expect(pkg.dependencies).not.toHaveProperty('gradient-string');
    expect(pkg.dependencies).not.toHaveProperty('chalk-animation');
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
