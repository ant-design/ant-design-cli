# Doctor Command Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new checks to `antd doctor` — `dayjs-duplicate`, `cssinjs-duplicate`, `cssinjs-compat`, `icons-compat` — plus a `satisfies()` semver helper in `version.ts`.

**Architecture:** The `satisfies()` helper goes in `src/data/version.ts` as a pure function. A `findDuplicateVersions()` helper is extracted in `src/commands/doctor.ts` (refactoring the existing `checkDuplicateInstall`). Two new context fields (`cssinjsPkg`, `iconsPkg`) are added to `DoctorContext` and loaded in `buildContext()`.

**Tech Stack:** TypeScript, Node.js ESM, vitest for tests. No new runtime dependencies.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/data/version.ts` | Modify | Add `export function satisfies(version, range)` |
| `src/data/version.test.ts` | Create | Unit tests for `satisfies()` |
| `src/commands/doctor.ts` | Modify | Extract `findDuplicateVersions`, expand `DoctorContext`, add 4 new check functions, register them |
| `spec.md` | Modify | Document new checks |

---

## Chunk 1: `satisfies()` semver helper

### Task 1: Unit-test and implement `satisfies()` in `version.ts`

**Files:**
- Modify: `src/data/version.ts`
- Modify: `src/data/__tests__/version.test.ts` (add new `describe('satisfies()')` block)

- [ ] **Step 1: Write the failing tests**

In `src/data/__tests__/version.test.ts`, append a new `describe('satisfies()')` block:

```ts
import { describe, it, expect } from 'vitest';
import { satisfies } from './version.js';

describe('satisfies()', () => {
  // >= operator
  it('passes when version meets >= bound', () => {
    expect(satisfies('1.21.0', '>=1.21.0')).toBe(true);
    expect(satisfies('1.22.0', '>=1.21.0')).toBe(true);
    expect(satisfies('2.0.0', '>=1.21.0')).toBe(true);
  });
  it('fails when version is below >= bound', () => {
    expect(satisfies('1.20.9', '>=1.21.0')).toBe(false);
    expect(satisfies('0.9.0', '>=1.0.0')).toBe(false);
  });

  // > operator
  it('passes when version is strictly above > bound', () => {
    expect(satisfies('1.21.1', '>1.21.0')).toBe(true);
  });
  it('fails when version equals > bound', () => {
    expect(satisfies('1.21.0', '>1.21.0')).toBe(false);
  });

  // ^ operator (same major, >= minor.patch)
  it('passes for ^ when same major and >= bound', () => {
    expect(satisfies('1.21.0', '^1.21.0')).toBe(true);
    expect(satisfies('1.22.0', '^1.21.0')).toBe(true);
  });
  it('fails for ^ when major differs', () => {
    expect(satisfies('2.0.0', '^1.21.0')).toBe(false);
    expect(satisfies('0.21.0', '^1.21.0')).toBe(false);
  });
  it('fails for ^ when below bound within same major', () => {
    expect(satisfies('1.20.0', '^1.21.0')).toBe(false);
  });

  // ~ operator (same major+minor, >= patch)
  it('passes for ~ when same major+minor and >= patch', () => {
    expect(satisfies('1.21.0', '~1.21.0')).toBe(true);
    expect(satisfies('1.21.5', '~1.21.0')).toBe(true);
  });
  it('fails for ~ when minor differs', () => {
    expect(satisfies('1.22.0', '~1.21.0')).toBe(false);
    expect(satisfies('1.20.0', '~1.21.0')).toBe(false);
  });

  // exact version
  it('passes for exact version match', () => {
    expect(satisfies('1.21.0', '1.21.0')).toBe(true);
  });
  it('fails for exact version mismatch', () => {
    expect(satisfies('1.21.1', '1.21.0')).toBe(false);
  });

  // bare major / major.minor
  it('passes when major matches bare major range', () => {
    expect(satisfies('5.0.0', '5')).toBe(true);
    expect(satisfies('5.99.0', '5')).toBe(true);
  });
  it('fails when major differs for bare major range', () => {
    expect(satisfies('4.0.0', '5')).toBe(false);
    expect(satisfies('6.0.0', '5')).toBe(false);
  });
  it('passes when major+minor matches x.y range', () => {
    expect(satisfies('5.1.0', '5.1')).toBe(true);
    expect(satisfies('5.1.9', '5.1')).toBe(true);
  });
  it('fails when minor differs for x.y range', () => {
    expect(satisfies('5.2.0', '5.1')).toBe(false);
  });

  // fail-open for unrecognized range
  it('returns true (fail-open) for unrecognized range format', () => {
    expect(satisfies('1.0.0', '||1.x')).toBe(true);
    expect(satisfies('1.0.0', '*')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/afc163/Projects/ant-design-cli/.claude/worktrees/doctor-enhancements
npx vitest run src/data/version.test.ts
```

Expected: All tests fail with "satisfies is not a function" or similar import error.

- [ ] **Step 3: Implement `satisfies()` in `src/data/version.ts`**

Append after the `valid()` function:

```ts
/**
 * Check if a version string satisfies a semver range.
 * Supports: >=, >, ^, ~, exact x.y.z, bare x, bare x.y
 * Returns true for unrecognized range formats (fail-open).
 */
export function satisfies(version: string, range: string): boolean {
  // Strip whitespace
  range = range.trim();
  version = version.trim();

  // >= operator
  if (range.startsWith('>=')) {
    const bound = range.slice(2).trim();
    return compare(version, bound) >= 0;
  }
  // > operator
  if (range.startsWith('>')) {
    const bound = range.slice(1).trim();
    return compare(version, bound) > 0;
  }
  // ^ operator: same major, >= bound
  if (range.startsWith('^')) {
    const bound = range.slice(1).trim();
    const vParts = version.split('.').map(Number);
    const bParts = bound.split('.').map(Number);
    if (vParts[0] !== bParts[0]) return false;
    return compare(version, bound) >= 0;
  }
  // ~ operator: same major+minor, >= patch
  if (range.startsWith('~')) {
    const bound = range.slice(1).trim();
    const vParts = version.split('.').map(Number);
    const bParts = bound.split('.').map(Number);
    if (vParts[0] !== bParts[0] || vParts[1] !== bParts[1]) return false;
    return compare(version, bound) >= 0;
  }
  // bare major (e.g. "5") or major.minor (e.g. "5.1")
  const parts = range.split('.');
  if (parts.length <= 2 && parts.every(p => /^\d+$/.test(p))) {
    const vParts = version.split('.').map(Number);
    const rParts = parts.map(Number);
    if (vParts[0] !== rParts[0]) return false;
    if (rParts.length === 2 && vParts[1] !== rParts[1]) return false;
    return true;
  }
  // exact version (x.y.z)
  if (/^\d+\.\d+\.\d+/.test(range)) {
    return compare(version, range) === 0;
  }
  // Unrecognized range — fail-open
  return true;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/data/version.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/version.ts src/data/__tests__/version.test.ts
git commit -m "feat: add satisfies() semver range helper to version.ts"
```

---

## Chunk 2: `findDuplicateVersions` helper + refactor

### Task 2: Extract `findDuplicateVersions` and refactor `checkDuplicateInstall`

**Files:**
- Modify: `src/commands/doctor.ts`

The existing `checkDuplicateInstall` manually scans for nested antd installations. Extract this logic into a reusable `findDuplicateVersions(cwd, pkgPath)` helper, then call it from `checkDuplicateInstall`.

- [ ] **Step 1: Add `findDuplicateVersions` helper and refactor `checkDuplicateInstall`**

Open `src/commands/doctor.ts`. Replace the entire `checkDuplicateInstall` function with:

```ts
/**
 * Scans top-level node_modules and one level of nested node_modules for
 * installations of pkgPath (e.g. 'dayjs' or '@ant-design/cssinjs').
 * Returns a deduplicated array of distinct version strings found.
 * If the package is not installed anywhere, returns [].
 */
function findDuplicateVersions(cwd: string, pkgPath: string): string[] {
  const versions: string[] = [];

  // 1. Top-level install
  const topPkg = readJson(join(cwd, 'node_modules', pkgPath, 'package.json'));
  if (topPkg?.version) versions.push(topPkg.version);

  // 2. One level of nesting: node_modules/*/node_modules/<pkgPath>
  const nmDir = join(cwd, 'node_modules');
  try {
    const entries = readdirSync(nmDir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === pkgPath) continue;
      const nestedPkg = readJson(join(nmDir, entry, 'node_modules', pkgPath, 'package.json'));
      if (nestedPkg?.version) versions.push(nestedPkg.version);
    }
  } catch {
    // ignore read errors (e.g. node_modules doesn't exist)
  }

  // Deduplicate
  return [...new Set(versions)];
}

function checkDuplicateInstall(ctx: DoctorContext): CheckResult {
  const versions = findDuplicateVersions(ctx.cwd, 'antd');

  if (versions.length > 1) {
    return {
      name: 'duplicate-install',
      status: 'fail',
      severity: 'error',
      message: `Found ${versions.length} antd installations: ${versions.join(', ')}`,
      suggestion: 'Run `npm dedupe` or check your dependency tree',
    };
  }

  return {
    name: 'duplicate-install',
    status: 'pass',
    message: 'No duplicate antd installations detected',
  };
}
```

- [ ] **Step 2: Build and run existing doctor e2e test to confirm no regression**

```bash
npm run build && npx vitest run src/__tests__/cli.test.ts --reporter=verbose 2>&1 | grep -E "doctor|PASS|FAIL"
```

Expected: All 3 doctor tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "refactor: extract findDuplicateVersions helper in doctor command"
```

---

## Chunk 3: Duplicate checks + context expansion

### Task 3: Add `cssinjsPkg`/`iconsPkg` to context, add `dayjs-duplicate` and `cssinjs-duplicate`

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Expand `DoctorContext` and `buildContext()`, and refactor `checkCssInJs`**

In `src/commands/doctor.ts`, update the `DoctorContext` interface and `buildContext` function, then update `checkCssInJs` to use the pre-loaded `ctx.cssinjsPkg` instead of re-reading the file:

```ts
interface DoctorContext {
  cwd: string;
  antdPkg: any | null;
  antdMajor: number;
  projectPkg: any | null;
  reactPkg: any | null;
  cssinjsPkg: any | null;  // add
  iconsPkg: any | null;    // add
}

function buildContext(cwd: string): DoctorContext {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const antdMajor = antdPkg ? parseInt(antdPkg.version.split('.')[0], 10) : 0;
  const projectPkg = readJson(join(cwd, 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));
  const cssinjsPkg = readJson(join(cwd, 'node_modules', '@ant-design', 'cssinjs', 'package.json'));
  const iconsPkg = readJson(join(cwd, 'node_modules', '@ant-design', 'icons', 'package.json'));
  return { cwd, antdPkg, antdMajor, projectPkg, reactPkg, cssinjsPkg, iconsPkg };
}
```

Also replace `checkCssInJs` to use context instead of reading the file again:

```ts
function checkCssInJs(ctx: DoctorContext): CheckResult {
  if (!ctx.cssinjsPkg) {
    return {
      name: 'cssinjs',
      status: 'warn',
      severity: 'warning',
      message: 'No @ant-design/cssinjs found, SSR style extraction will not work',
      suggestion: 'Install @ant-design/cssinjs if you need SSR support',
    };
  }
  return {
    name: 'cssinjs',
    status: 'pass',
    message: '@ant-design/cssinjs is installed',
  };
}
```

- [ ] **Step 2: Add `checkDayjsDuplicate` and `checkCssinjsDuplicate` functions**

Add after `checkDuplicateInstall`:

```ts
function checkDayjsDuplicate(ctx: DoctorContext): CheckResult {
  const versions = findDuplicateVersions(ctx.cwd, 'dayjs');

  if (versions.length > 1) {
    return {
      name: 'dayjs-duplicate',
      status: 'fail',
      severity: 'error',
      message: `Found ${versions.length} dayjs installations: ${versions.join(', ')}`,
      suggestion: 'Run `npm dedupe` or check your monorepo hoisting config',
    };
  }

  return {
    name: 'dayjs-duplicate',
    status: 'pass',
    message: 'No duplicate dayjs installations detected',
  };
}

function checkCssinjsDuplicate(ctx: DoctorContext): CheckResult {
  const versions = findDuplicateVersions(ctx.cwd, '@ant-design/cssinjs');

  if (versions.length > 1) {
    return {
      name: 'cssinjs-duplicate',
      status: 'fail',
      severity: 'error',
      message: `Found ${versions.length} @ant-design/cssinjs installations: ${versions.join(', ')}`,
      suggestion: 'Run `npm dedupe` or check your monorepo hoisting config',
    };
  }

  return {
    name: 'cssinjs-duplicate',
    status: 'pass',
    message: 'No duplicate @ant-design/cssinjs installations detected',
  };
}
```

- [ ] **Step 3: Register the two new checks in the `action()` handler**

Find the `checks` array in `registerDoctorCommand` and add the two new checks:

```ts
const checks: CheckResult[] = [
  checkAntdInstalled(ctx),
  checkReactCompat(ctx),
  checkDuplicateInstall(ctx),
  checkDayjsDuplicate(ctx),       // add
  checkCssinjsDuplicate(ctx),     // add
  checkThemeConfig(ctx),
  checkBabelPlugins(ctx),
  checkCssInJs(ctx),
];
```

- [ ] **Step 4: Build and run doctor e2e tests**

```bash
npm run build && npx vitest run src/__tests__/cli.test.ts --reporter=verbose 2>&1 | grep -E "doctor|PASS|FAIL"
```

Expected: All 3 doctor tests still pass. The JSON output now contains `dayjs-duplicate` and `cssinjs-duplicate` check names.

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat: add dayjs-duplicate and cssinjs-duplicate checks to doctor"
```

---

## Chunk 4: Compatibility checks

### Task 4: Add `cssinjs-compat` and `icons-compat` checks

**Files:**
- Modify: `src/commands/doctor.ts`
- Modify: `src/index.ts` (import `satisfies` if needed — check if it's already imported via version.ts)

- [ ] **Step 1: Import `satisfies` at the top of `doctor.ts`**

At the top of `src/commands/doctor.ts`, add the import:

```ts
import { satisfies } from '../data/version.js';
```

- [ ] **Step 2: Add `checkCssinjsCompat` function**

Add after `checkCssinjsDuplicate`:

```ts
function checkCssinjsCompat(ctx: DoctorContext): CheckResult {
  const range = ctx.antdPkg?.peerDependencies?.['@ant-design/cssinjs'];

  if (!ctx.antdPkg || !range) {
    return {
      name: 'cssinjs-compat',
      status: 'pass',
      message: 'No @ant-design/cssinjs peer dependency required (antd v4)',
    };
  }

  if (!ctx.cssinjsPkg) {
    return {
      name: 'cssinjs-compat',
      status: 'warn',
      severity: 'warning',
      message: `antd ${ctx.antdPkg.version} requires @ant-design/cssinjs but it is not installed`,
      suggestion: 'Run `npm install @ant-design/cssinjs`',
    };
  }

  if (!satisfies(ctx.cssinjsPkg.version, range)) {
    return {
      name: 'cssinjs-compat',
      status: 'fail',
      severity: 'error',
      message: `@ant-design/cssinjs ${ctx.cssinjsPkg.version} is not compatible with antd ${ctx.antdPkg.version} (requires ${range})`,
      suggestion: `Run \`npm install @ant-design/cssinjs@${range}\``,
    };
  }

  return {
    name: 'cssinjs-compat',
    status: 'pass',
    message: `@ant-design/cssinjs ${ctx.cssinjsPkg.version} is compatible with antd ${ctx.antdPkg.version}`,
  };
}
```

- [ ] **Step 3: Add `checkIconsCompat` function**

Add after `checkCssinjsCompat`:

```ts
function checkIconsCompat(ctx: DoctorContext): CheckResult {
  const range = ctx.antdPkg?.peerDependencies?.['@ant-design/icons'];

  if (!ctx.antdPkg || !range) {
    return {
      name: 'icons-compat',
      status: 'pass',
      message: 'No @ant-design/icons peer dependency declared',
    };
  }

  if (!ctx.iconsPkg) {
    // Icons are optional — absence is not an error
    return {
      name: 'icons-compat',
      status: 'pass',
      message: '@ant-design/icons is not installed (optional)',
    };
  }

  if (!satisfies(ctx.iconsPkg.version, range)) {
    return {
      name: 'icons-compat',
      status: 'warn',
      severity: 'warning',
      message: `@ant-design/icons ${ctx.iconsPkg.version} may not be compatible with antd ${ctx.antdPkg.version} (requires ${range})`,
      suggestion: `Run \`npm install @ant-design/icons@${range}\``,
    };
  }

  return {
    name: 'icons-compat',
    status: 'pass',
    message: `@ant-design/icons ${ctx.iconsPkg.version} is compatible with antd ${ctx.antdPkg.version}`,
  };
}
```

- [ ] **Step 4: Register the two new checks in `registerDoctorCommand`**

```ts
const checks: CheckResult[] = [
  checkAntdInstalled(ctx),
  checkReactCompat(ctx),
  checkDuplicateInstall(ctx),
  checkDayjsDuplicate(ctx),
  checkCssinjsDuplicate(ctx),
  checkCssinjsCompat(ctx),        // add
  checkIconsCompat(ctx),          // add
  checkThemeConfig(ctx),
  checkBabelPlugins(ctx),
  checkCssInJs(ctx),
];
```

- [ ] **Step 5: Build and run all tests**

```bash
npm run build && npx vitest run
```

Expected: All tests pass. The `doctor --format json` output now includes all 10 checks.

- [ ] **Step 6: Verify the 4 new check names appear in JSON output**

```bash
node dist/index.js doctor --format json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.checks.map(c=>c.name).join('\n'))"
```

Expected output includes:
```
dayjs-duplicate
cssinjs-duplicate
cssinjs-compat
icons-compat
```

- [ ] **Step 7: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat: add cssinjs-compat and icons-compat checks to doctor"
```

---

## Chunk 5: spec.md + e2e test coverage

### Task 5: Update spec.md and add e2e test assertions for new checks

**Files:**
- Modify: `spec.md`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Add e2e assertions for new check names**

In `src/__tests__/cli.test.ts`, update the existing `'should show doctor as JSON'` test to also verify the new checks are present. The test runs in the CLI repo itself, so `dayjs`/`@ant-design/cssinjs` may or may not be installed — we only assert the check names exist in the output, not their pass/fail status:

```ts
it('should show doctor as JSON', () => {
  const out = run('doctor', '--format', 'json');
  const data = JSON.parse(out);
  expect(data.checks).toBeDefined();
  expect(data.summary).toBeDefined();
  // Verify all new check names are present
  const names = (data.checks as Array<{ name: string }>).map(c => c.name);
  expect(names).toContain('dayjs-duplicate');
  expect(names).toContain('cssinjs-duplicate');
  expect(names).toContain('cssinjs-compat');
  expect(names).toContain('icons-compat');
});
```

- [ ] **Step 2: Build and run e2e tests**

```bash
npm run build && npx vitest run src/__tests__/cli.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Update `spec.md` to document the new checks**

Find the `doctor` command section in `spec.md` and update the checks list to include the 4 new checks with their names, what they detect, and severity.

> Look for the `doctor` section — it will have a list of existing checks. Add entries for `dayjs-duplicate`, `cssinjs-duplicate`, `cssinjs-compat`, `icons-compat` following the same format as existing entries.

- [ ] **Step 4: Commit**

```bash
git add spec.md src/__tests__/cli.test.ts
git commit -m "docs: update spec.md and tests for new doctor checks"
```

---

## Done

All 5 tasks complete. The `doctor` command now has 10 checks total (6 existing + 4 new).
