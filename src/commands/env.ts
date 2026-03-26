import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { platform, release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { output } from '../output/formatter.js';
import { readJson } from '../utils/scan.js';

interface EnvResult {
  system: Record<string, string>;
  binaries: Record<string, string>;
  browsers: Record<string, string | null>;
  dependencies: Record<string, string | null>;
  ecosystem: Record<string, string>;
  buildTools: Record<string, string>;
}

function collectSystem(): Record<string, string> {
  const p = platform();
  const r = release();
  let os: string;
  if (p === 'darwin') {
    const parts = r.split('.');
    const major = parseInt(parts[0], 10);
    // Darwin 24.x = macOS 15.x, Darwin 23.x = macOS 14.x, etc.
    const macMajor = major - 9;
    const macMinor = parts[1] || '0';
    os = `macOS ${macMajor}.${macMinor}`;
  } else if (p === 'win32') {
    os = `Windows ${r}`;
  } else {
    os = `${p} ${r}`;
  }
  return { OS: os };
}

function tryExec(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function getVersion(cmd: string): string | null {
  const out = tryExec(cmd, ['--version']);
  if (!out) return null;
  const match = out.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : out;
}

function collectBinaries(): Record<string, string> {
  const result: Record<string, string> = {};
  result.Node = process.version.replace(/^v/, '');

  const managers = ['npm', 'pnpm', 'yarn', 'bun', 'utoo'];
  for (const mgr of managers) {
    const ver = getVersion(mgr);
    if (ver) result[mgr] = ver;
  }

  const registry = tryExec('npm', ['config', 'get', 'registry']);
  if (registry) result.Registry = registry;

  return result;
}

async function collectBrowsers(): Promise<Record<string, string | null>> {
  try {
    const envinfo = await import('envinfo');
    const raw = await envinfo.default.run(
      { Browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'] },
      { json: true },
    );
    const parsed = JSON.parse(raw);
    const browsers = parsed.Browsers || {};
    const result: Record<string, string | null> = {};
    for (const [name, info] of Object.entries(browsers)) {
      const val = (info as { version: string })?.version;
      result[name] = val || null;
    }
    return result;
  } catch {
    return {};
  }
}

const CORE_DEPS = ['antd', 'react', 'react-dom', 'dayjs', '@ant-design/cssinjs', '@ant-design/icons'];

function collectDependencies(cwd: string): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const dep of CORE_DEPS) {
    const pkg = readJson(join(cwd, 'node_modules', dep, 'package.json'));
    result[dep] = pkg?.version ?? null;
  }
  return result;
}

function scanEcosystem(cwd: string): Record<string, string> {
  const result: Record<string, string> = {};
  const coreSet = new Set(CORE_DEPS);

  // @ant-design/* packages
  const scopeDir = join(cwd, 'node_modules', '@ant-design');
  try {
    const entries = readdirSync(scopeDir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const fullName = `@ant-design/${entry}`;
      if (coreSet.has(fullName)) continue;
      const pkg = readJson(join(scopeDir, entry, 'package.json'));
      if (pkg?.version) result[fullName] = pkg.version;
    }
  } catch { /* scope dir doesn't exist */ }

  // rc-* packages
  const nmDir = join(cwd, 'node_modules');
  try {
    const entries = readdirSync(nmDir);
    for (const entry of entries) {
      if (!entry.startsWith('rc-')) continue;
      const pkg = readJson(join(nmDir, entry, 'package.json'));
      if (pkg?.version) result[entry] = pkg.version;
    }
  } catch { /* node_modules doesn't exist */ }

  return result;
}

const BUILD_TOOLS = [
  'umi', 'next', '@umijs/max', 'create-react-app', 'ice',
  'webpack', 'vite', 'esbuild', 'rollup', '@rspack/core',
  'typescript', '@babel/core', '@swc/core',
  'less', 'sass', 'tailwindcss', 'styled-components', 'postcss',
];

function collectBuildTools(cwd: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tool of BUILD_TOOLS) {
    const pkg = readJson(join(cwd, 'node_modules', tool, 'package.json'));
    if (pkg?.version) result[tool] = pkg.version;
  }
  return result;
}

function formatText(data: EnvResult): string {
  const lines: string[] = ['Environment', ''];

  const section = (title: string, entries: Record<string, string | null>, showNull: boolean) => {
    const filtered = showNull
      ? Object.entries(entries)
      : Object.entries(entries).filter(([, v]) => v !== null);
    if (filtered.length === 0) return;

    lines.push(`  ${title}:`);
    const maxKey = Math.max(...filtered.map(([k]) => k.length));
    for (const [key, value] of filtered) {
      lines.push(`    ${key.padEnd(maxKey + 1)} ${value ?? 'Not found'}`);
    }
    lines.push('');
  };

  section('System', data.system, true);
  section('Binaries', data.binaries, false);
  section('Browsers', data.browsers, false);
  section('Dependencies', data.dependencies, true);
  section('Ecosystem', data.ecosystem, false);
  section('Build Tools', data.buildTools, false);

  return lines.join('\n');
}

function formatMarkdown(data: EnvResult): string {
  const lines: string[] = ['## Environment', ''];

  const table = (title: string, col1: string, col2: string, entries: Record<string, string | null>, showNull: boolean) => {
    const filtered = showNull
      ? Object.entries(entries)
      : Object.entries(entries).filter(([, v]) => v !== null);
    if (filtered.length === 0) return;

    lines.push(`### ${title}`, '');
    lines.push(`| ${col1} | ${col2} |`);
    lines.push('|------|---------|');
    for (const [key, value] of filtered) {
      lines.push(`| ${key} | ${value ?? 'Not found'} |`);
    }
    lines.push('');
  };

  table('System', 'Item', 'Version', data.system, true);
  table('Binaries', 'Item', 'Version', data.binaries, false);
  table('Browsers', 'Browser', 'Version', data.browsers, false);
  table('Dependencies', 'Package', 'Version', data.dependencies, true);
  table('Ecosystem', 'Package', 'Version', data.ecosystem, false);
  table('Build Tools', 'Package', 'Version', data.buildTools, false);

  return lines.join('\n');
}

export function registerEnvCommand(program: Command): void {
  program
    .command('env [dir]')
    .description('Collect antd-related environment information for bug reporting')
    .action(async (dir?: string) => {
      const opts = program.opts<GlobalOptions>();
      const cwd = dir ? (isAbsolute(dir) ? dir : join(process.cwd(), dir)) : process.cwd();

      const data: EnvResult = {
        system: collectSystem(),
        binaries: collectBinaries(),
        browsers: await collectBrowsers(),
        dependencies: collectDependencies(cwd),
        ecosystem: scanEcosystem(cwd),
        buildTools: collectBuildTools(cwd),
      };

      if (opts.format === 'json') {
        output(data, 'json');
      } else if (opts.format === 'markdown') {
        console.log(formatMarkdown(data));
      } else {
        console.log(formatText(data));
      }
    });
}
