import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { output } from '../output/formatter.js';
import { readJson } from '../utils/scan.js';

export type EnvinfoValue = string | { version?: string; path?: string } | null;
export type EnvinfoData = Record<string, Record<string, EnvinfoValue>>;

export interface EnvResult {
  envinfo: EnvinfoData;
  dependencies: Record<string, string | null>;
  ecosystem: Record<string, string>;
  buildTools: Record<string, string>;
}

/**
 * Run envinfo to collect full system environment information.
 * This includes: System, Binaries, Managers, Utilities, Servers, IDEs, Languages, Databases, Browsers
 */
export async function collectEnvinfo(cwd?: string): Promise<EnvinfoData> {
  try {
    const envinfo = await import('envinfo');
    const raw = await envinfo.default.run(
      {
        System: ['OS', 'CPU', 'Memory', 'Shell'],
        Binaries: ['Node', 'Yarn', 'npm', 'pnpm', 'bun', 'Deno'],
        Managers: ['Cargo', 'Homebrew', 'pip3', 'RubyGems'],
        Utilities: ['Make', 'GCC', 'Git', 'Clang', 'FFmpeg', 'Curl', 'OpenSSL'],
        Servers: ['Apache'],
        IDEs: ['VSCode', 'Claude Code', 'Vim', 'Xcode'],
        Languages: ['Bash', 'Perl', 'Python3', 'Ruby', 'Rust'],
        Databases: ['SQLite'],
        Browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
      },
      { json: true },
    );
    const parsed = JSON.parse(raw);
    const result: EnvinfoData = {};

    for (const [category, items] of Object.entries(parsed)) {
      result[category] = {};
      for (const [name, info] of Object.entries(items as Record<string, unknown>)) {
        if (typeof info === 'string') {
          result[category][name] = info;
        } else if (info && typeof info === 'object') {
          result[category][name] = info as { version?: string; path?: string };
        } else {
          result[category][name] = null;
        }
      }
    }

    // Add npm registry to Binaries (use cwd to respect project-level .npmrc)
    result.Binaries = result.Binaries || {};
    try {
      const registry = execFileSync('npm', ['config', 'get', 'registry'], {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      result.Binaries['Registry'] = registry;
    } catch {
      result.Binaries['Registry'] = null;
    }

    return result;
  } catch {
    return {};
  }
}

const CORE_DEPS = ['antd', 'react', 'react-dom', 'dayjs', '@ant-design/cssinjs', '@ant-design/icons'];

export function collectDependencies(cwd: string): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const dep of CORE_DEPS) {
    const pkg = readJson(join(cwd, 'node_modules', dep, 'package.json'));
    result[dep] = pkg?.version ?? null;
  }
  return result;
}

export function scanEcosystem(cwd: string): Record<string, string> {
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
  // Frameworks
  'umi', '@umijs/max', 'next', 'remix', 'gatsby', 'create-react-app', 'ice',
  'rax', 'taro', 'remax', 'modern-js',
  // Bundlers
  'webpack', 'vite', 'esbuild', 'rollup', '@rspack/core', 'turbopack', 'farm',
  // Compilers
  'typescript', '@babel/core', '@swc/core',
  // CSS
  'less', 'sass', 'tailwindcss', 'styled-components', 'postcss',
];

const ENVINFO_ORDER = ['System', 'Binaries', 'Managers', 'Utilities', 'Servers', 'IDEs', 'Languages', 'Databases', 'Browsers'];

export function collectBuildTools(cwd: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tool of BUILD_TOOLS) {
    const pkg = readJson(join(cwd, 'node_modules', tool, 'package.json'));
    if (pkg?.version) result[tool] = pkg.version;
  }
  return result;
}

/** Extract version string from EnvinfoValue (string or {version, path} object) */
function getDisplayValue(value: EnvinfoValue): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return value.version || null;
}

export function formatText(data: EnvResult): string {
  const lines: string[] = ['Environment', ''];

  const section = (title: string, entries: Record<string, EnvinfoValue>, showNull: boolean) => {
    const filtered = showNull
      ? Object.entries(entries)
      : Object.entries(entries).filter(([, v]) => getDisplayValue(v) !== null);
    if (filtered.length === 0) return;

    lines.push(`  ${title}:`);
    const maxKey = Math.max(...filtered.map(([k]) => k.length));
    for (const [key, value] of filtered) {
      const display = getDisplayValue(value);
      lines.push(`    ${key.padEnd(maxKey + 1)} ${display ?? 'Not found'}`);
    }
    lines.push('');
  };

  for (const cat of ENVINFO_ORDER) {
    if (data.envinfo[cat]) {
      section(cat, data.envinfo[cat], false);
    }
  }

  section('Dependencies', data.dependencies, true);
  section('Ecosystem', data.ecosystem, false);
  section('Build Tools', data.buildTools, false);

  return lines.join('\n');
}

export function formatMarkdown(data: EnvResult): string {
  const lines: string[] = ['## Environment', ''];

  const table = (title: string, col1: string, col2: string, entries: Record<string, EnvinfoValue>, showNull: boolean) => {
    const filtered = showNull
      ? Object.entries(entries)
      : Object.entries(entries).filter(([, v]) => getDisplayValue(v) !== null);
    if (filtered.length === 0) return;

    lines.push(`### ${title}`, '');
    lines.push(`| ${col1} | ${col2} |`);
    lines.push('|------|---------|');
    for (const [key, value] of filtered) {
      const display = getDisplayValue(value);
      lines.push(`| ${key} | ${display ?? 'Not found'} |`);
    }
    lines.push('');
  };

  for (const cat of ENVINFO_ORDER) {
    if (data.envinfo[cat]) {
      table(cat, 'Item', 'Version', data.envinfo[cat], false);
    }
  }

  table('Dependencies', 'Package', 'Version', data.dependencies, true);
  table('Ecosystem', 'Package', 'Version', data.ecosystem, false);
  table('Build Tools', 'Package', 'Version', data.buildTools, false);

  return lines.join('\n');
}

/* v8 ignore start -- entry-point action; covered by e2e tests in cli.test.ts */
export function registerEnvCommand(program: Command): void {
  program
    .command('env [dir]')
    .description('Collect antd-related environment information for bug reporting')
    .action(async (dir?: string) => {
      const opts = program.opts<GlobalOptions>();
      const cwd = dir ? (isAbsolute(dir) ? dir : join(process.cwd(), dir)) : process.cwd();

      const data: EnvResult = {
        envinfo: await collectEnvinfo(cwd),
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
/* v8 ignore stop */