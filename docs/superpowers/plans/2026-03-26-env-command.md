# `antd env` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `antd env` command that collects all antd-related environment information for bug reporting and AI diagnosis.

**Architecture:** Single new command file `src/commands/env.ts` with collector functions for system, binaries, browsers, dependencies, ecosystem packages, and build tools. Uses `envinfo` for browser detection, built-in Node modules for everything else.

**Tech Stack:** Node.js built-in modules (`node:os`, `node:fs`, `node:child_process`), `envinfo` (browser detection only), existing `readJson()` utility.

---

### Task 1: Install envinfo dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install envinfo**

Run: `npm install envinfo`

- [ ] **Step 2: Verify installation**

Run: `node -e "import('envinfo').then(e => e.default.run({Browsers: ['Chrome']}, {json: true}).then(console.log))"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add envinfo dependency for browser detection"
```

---

### Task 2: Implement env command

**Files:**
- Create: `src/commands/env.ts`

- [ ] **Step 1: Create the env command file**

```typescript
import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { platform, release, type as osType, version as osVersion } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { output } from '../output/formatter.js';
import { readJson } from '../utils/scan.js';

interface EnvResult {
  system: { os: string };
  binaries: Record<string, string | null>;
  browsers: Record<string, string | null>;
  dependencies: Record<string, string | null>;
  ecosystem: Record<string, string>;
  buildTools: Record<string, string>;
}

function collectSystem(): { os: string } {
  const p = platform();
  const r = release();
  let os: string;
  if (p === 'darwin') {
    // Extract macOS version from Darwin kernel version
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
  return { os };
}

function tryExec(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function getVersion(cmd: string): string | null {
  const out = tryExec(cmd, ['--version']);
  if (!out) return null;
  // Extract version number from output like "9.1.0" or "v20.11.0" or "npm 10.2.0"
  const match = out.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : out;
}

function collectBinaries(): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  result.Node = process.version.replace(/^v/, '');

  // Package managers — detect all that are available
  const managers = ['npm', 'pnpm', 'yarn', 'bun', 'utoo'];
  for (const mgr of managers) {
    const ver = getVersion(mgr);
    if (ver) result[mgr] = ver;
  }

  // Registry
  const registry = tryExec('npm', ['config', 'get', 'registry']);
  if (registry) result.Registry = registry;

  return result;
}

async function collectBrowsers(): Promise<Record<string, string | null>> {
  try {
    const envinfo = await import('envinfo');
    const raw = await envinfo.default.run(
      { Browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'] },
      { json: true }
    );
    const parsed = JSON.parse(raw);
    const browsers = parsed.Browsers || {};
    const result: Record<string, string | null> = {};
    for (const [name, info] of Object.entries(browsers)) {
      // envinfo returns "Not Found" or version string
      const val = info as string;
      result[name] = val === 'Not Found' ? null : val;
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

  // @ant-design/* packages (excluding those already in core deps)
  const coreSet = new Set(CORE_DEPS);
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
  'umi', 'next', '@umijs/max', 'create-react-app', 'ice',
  // Bundlers
  'webpack', 'vite', 'esbuild', 'rollup', '@rspack/core',
  // Compilers
  'typescript', '@babel/core', '@swc/core',
  // CSS
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
    // Calculate max key length for alignment
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
      const cwd = dir ? (dir.startsWith('/') ? dir : join(process.cwd(), dir)) : process.cwd();

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
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/env.ts
git commit -m "feat: add antd env command implementation"
```

---

### Task 3: Register env command in index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add import**

Add after the `registerBugCommand` import line:

```typescript
import { registerEnvCommand } from './commands/env.js';
```

- [ ] **Step 2: Register the command**

Add `registerEnvCommand(program);` in the "Project Analysis commands" section, after `registerMigrateCommand(program);`.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register env command in CLI entry point"
```

---

### Task 4: Add tests

**Files:**
- Create: `src/__tests__/commands/env.test.ts`

- [ ] **Step 1: Write unit tests**

Test the env command with a mock project directory (create temp dirs with fake node_modules). Test:
- System info returns OS string
- Binaries returns Node version
- Dependencies reads from node_modules
- Ecosystem scans @ant-design/* and rc-* packages
- Build tools detects installed packages
- JSON output is valid JSON
- Text output contains expected sections

- [ ] **Step 2: Add e2e test in cli.test.ts**

Add a test case for `antd env` and `antd env --format json` in the e2e test file.

- [ ] **Step 3: Run tests**

Run: `npm run build && npm run test`

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/commands/env.test.ts src/__tests__/cli.test.ts
git commit -m "test: add env command tests"
```

---

### Task 5: Update spec.md

**Files:**
- Modify: `spec.md`

- [ ] **Step 1: Add env command documentation**

Add an `env` section to spec.md following the pattern of other commands, documenting the command syntax, options, output formats with examples, and collected information sections.

- [ ] **Step 2: Commit**

```bash
git add spec.md
git commit -m "docs: add env command to spec.md"
```
