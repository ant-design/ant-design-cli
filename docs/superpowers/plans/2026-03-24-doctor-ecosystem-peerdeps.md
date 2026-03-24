# Doctor Ecosystem peerDeps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `antd doctor` to dynamically scan all installed `@ant-design/*` packages and verify each package's `peerDependencies` are satisfied by the installed environment.

**Architecture:** Scan `node_modules/@ant-design/` at runtime, read each package's `peerDependencies`, then use the existing `satisfies()` helper to check installed versions. One `CheckResult` per ecosystem package. Returns an empty array if no ecosystem packages are found, so the command stays backward-compatible. Note: `@ant-design/cssinjs` and `@ant-design/icons` ARE included in the scan — they check different things from the existing `cssinjs-compat`/`icons-compat` checks (those check antd's requirements, new checks verify the packages' own peerDep requirements).

**Tech Stack:** TypeScript, Node.js `fs.readdirSync`, existing `readJson` from `src/utils/scan.ts`, existing `satisfies()` from `src/data/version.ts`.

---

## File Map

| File | Change |
|---|---|
| `src/commands/doctor.ts` | Add `EcosystemPackage` interface, `getInstalledVersion()`, `scanEcosystemPackages()`, `checkEcosystemPeerDeps()`, update `DoctorContext`, update `buildContext()`, integrate into checks array |
| `spec.md` | Add new ecosystem-compat check items to the doctor checks list |
| `src/__tests__/cli.test.ts` | Add integration tests using a temp dir with fake `node_modules/@ant-design/*` |

---

## Task 1: Create feature branch

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/doctor-ecosystem-peerdeps
```

Expected: now on branch `feat/doctor-ecosystem-peerdeps`.

---

## Task 2: Write failing tests (TDD — tests first)

**Files:**
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Add `node:os` import at the top of the test file**

At the top of `src/__tests__/cli.test.ts`, after the existing imports, add:

```typescript
import { tmpdir } from 'node:os';
```

- [ ] **Step 2: Add `runDoctorInTempDir` helper function**

Add after the existing `runWithStatus` helper (before the `describe` block):

```typescript
/**
 * Run `doctor --format json` in a temp directory with a controlled node_modules layout.
 * `packages` maps package path → package.json content.
 * e.g. { 'antd': { version: '5.20.0' }, '@ant-design/pro-components': { version: '2.7.0', peerDependencies: { antd: '>=5.16.0' } } }
 */
function runDoctorInTempDir(packages: Record<string, object>): any {
  const tempDir = join(tmpdir(), `antd-cli-test-${Date.now()}`);
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));

    for (const [pkgName, pkgJson] of Object.entries(packages)) {
      const pkgDir = join(tempDir, 'node_modules', pkgName);
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson));
    }

    const stdout = execFileSync('node', [CLI, 'doctor', '--format', 'json'], {
      encoding: 'utf-8',
      timeout: 5000,
      cwd: tempDir,
    }).trim();
    return JSON.parse(stdout);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 3: Add the ecosystem peerDeps test suite**

Add a new `describe` block at the end of the file (inside the existing `describe('CLI e2e', ...)` or as a sibling — either placement is fine):

```typescript
describe('doctor ecosystem peerDeps', () => {
  it('should report pass when all peerDeps are satisfied', () => {
    const data = runDoctorInTempDir({
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

  it('should report fail when an installed dep does not satisfy peerDep range', () => {
    const data = runDoctorInTempDir({
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

  it('should report warn when a peerDep is not installed at all', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      // react is NOT installed
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

  it('should not emit a check for packages with no peerDependencies', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
      '@ant-design/colors': {
        version: '7.0.0',
        // no peerDependencies field
      },
    });
    const names = (data.checks as any[]).map((c) => c.name);
    expect(names).not.toContain('ecosystem-compat:colors');
  });

  it('should emit no ecosystem checks when no @ant-design/* packages are installed', () => {
    const data = runDoctorInTempDir({
      'antd': { version: '5.20.0', peerDependencies: {} },
    });
    const ecosystemChecks = (data.checks as any[]).filter((c) => c.name.startsWith('ecosystem-compat:'));
    expect(ecosystemChecks).toHaveLength(0);
  });

  it('should treat compound ranges as compatible (fail-open)', () => {
    // satisfies() processes ">=5.0.0 <6.0.0" by slicing off ">=" and passing "5.0.0 <6.0.0"
    // as the bound to compare(). The bound splits as [5, 0, NaN] — the NaN comparison
    // resolves before reaching it (10 > 0 at index 1), so compare returns 1 (>=0) → pass.
    // Upper bound <6.0.0 is effectively ignored. This is the intended fail-open behavior.
    const data = runDoctorInTempDir({
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
    expect(check.status).toBe('pass'); // fail-open: compound range treated as satisfied
  });

  it('should check multiple ecosystem packages independently', () => {
    const data = runDoctorInTempDir({
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
```

- [ ] **Step 4: Build and run tests to confirm they FAIL (red phase)**

```bash
npm run build && npx vitest run src/__tests__/cli.test.ts --reporter=verbose 2>&1 | grep -A3 "ecosystem"
```

Expected: tests in the `doctor ecosystem peerDeps` suite fail with "check is undefined" or similar. The existing tests still pass. This confirms the tests are correctly wired.

- [ ] **Step 5: Commit the failing tests**

```bash
git add src/__tests__/cli.test.ts
git commit -m "test: add failing ecosystem peerDeps tests for doctor command (TDD red)"
```

---

## Task 3: Implement ecosystem scan helpers

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Add `EcosystemPackage` interface**

In `src/commands/doctor.ts`, add after the existing `DoctorContext` interface (after line 26):

```typescript
interface EcosystemPackage {
  name: string;       // e.g. "@ant-design/pro-components"
  shortName: string;  // e.g. "pro-components"
  version: string;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
}
```

- [ ] **Step 2: Update `DoctorContext` to include `ecosystemPackages`**

Add the `ecosystemPackages` field to the existing `DoctorContext` interface:

```typescript
interface DoctorContext {
  cwd: string;
  antdPkg: any | null;
  antdMajor: number;
  projectPkg: any | null;
  reactPkg: any | null;
  cssinjsPkg: any | null;
  iconsPkg: any | null;
  ecosystemPackages: EcosystemPackage[];  // ← new field
}
```

- [ ] **Step 3: Add `getInstalledVersion` helper**

Add after `buildContext()`:

```typescript
/**
 * Read the installed version of a package from node_modules.
 * Returns null if not installed. Handles scoped packages (e.g. "@ant-design/cssinjs").
 */
function getInstalledVersion(cwd: string, pkgName: string): string | null {
  const pkg = readJson(join(cwd, 'node_modules', pkgName, 'package.json'));
  return pkg?.version ?? null;
}
```

- [ ] **Step 4: Add `scanEcosystemPackages` helper**

Add after `getInstalledVersion`:

```typescript
/**
 * Scan node_modules/@ant-design/ for all installed scoped packages that declare peerDependencies.
 * Packages with no peerDependencies are skipped (no check emitted for them).
 * Note: antd itself lives at node_modules/antd/, not here, so it will never appear in this scan.
 */
function scanEcosystemPackages(cwd: string): EcosystemPackage[] {
  const scopeDir = join(cwd, 'node_modules', '@ant-design');
  let entries: string[];
  try {
    entries = readdirSync(scopeDir);
  } catch {
    return [];
  }

  const result: EcosystemPackage[] = [];
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const pkg = readJson(join(scopeDir, entry, 'package.json'));
    if (!pkg?.version) continue;
    const peerDeps: Record<string, string> = pkg.peerDependencies ?? {};
    if (Object.keys(peerDeps).length === 0) continue;
    result.push({
      name: `@ant-design/${entry}`,
      shortName: entry,
      version: pkg.version,
      peerDependencies: peerDeps,
      peerDependenciesMeta: pkg.peerDependenciesMeta ?? {},
    });
  }
  return result;
}
```

- [ ] **Step 5: Update `buildContext()` to populate `ecosystemPackages`**

Replace the existing `buildContext` function body to add the new field:

```typescript
function buildContext(cwd: string): DoctorContext {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const antdMajor = antdPkg ? parseInt(antdPkg.version.split('.')[0], 10) : 0;
  const projectPkg = readJson(join(cwd, 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));
  const cssinjsPkg = readJson(join(cwd, 'node_modules', '@ant-design', 'cssinjs', 'package.json'));
  const iconsPkg = readJson(join(cwd, 'node_modules', '@ant-design', 'icons', 'package.json'));
  const ecosystemPackages = scanEcosystemPackages(cwd);
  return { cwd, antdPkg, antdMajor, projectPkg, reactPkg, cssinjsPkg, iconsPkg, ecosystemPackages };
}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

## Task 4: Implement `checkEcosystemPeerDeps` and integrate

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Add `checkEcosystemPeerDeps` function**

Add after the existing `checkCssInJs` function:

```typescript
function checkEcosystemPeerDeps(ctx: DoctorContext): CheckResult[] {
  return ctx.ecosystemPackages.map((pkg) => {
    const failures: string[] = [];  // installed but version doesn't satisfy range
    const warnings: string[] = [];  // not installed at all
    const suggestions: string[] = [];

    for (const [dep, range] of Object.entries(pkg.peerDependencies)) {
      const installedVersion = getInstalledVersion(ctx.cwd, dep);

      if (installedVersion === null) {
        warnings.push(`${dep} is not installed (requires ${range})`);
        suggestions.push(`npm install ${dep}`);
      } else if (!satisfies(installedVersion, range)) {
        failures.push(`${dep} requires ${range} (installed: ${installedVersion})`);
        suggestions.push(`npm install ${dep}@"${range}"`);
      }
    }

    if (failures.length > 0) {
      // Combine failures and warnings into one message; show the first suggestion
      const allIssues = [...failures, ...warnings].join('; ');
      return {
        name: `ecosystem-compat:${pkg.shortName}`,
        status: 'fail' as const,
        severity: 'error' as const,
        message: `${pkg.name} ${pkg.version} peerDep issues: ${allIssues}`,
        suggestion: `Run \`${suggestions[0]}\``,
      };
    }

    if (warnings.length > 0) {
      return {
        name: `ecosystem-compat:${pkg.shortName}`,
        status: 'warn' as const,
        severity: 'warning' as const,
        message: `${pkg.name} ${pkg.version} peerDep issues: ${warnings.join('; ')}`,
        suggestion: `Run \`${suggestions[0]}\``,
      };
    }

    return {
      name: `ecosystem-compat:${pkg.shortName}`,
      status: 'pass' as const,
      message: `${pkg.name} ${pkg.version} satisfies all peerDependencies`,
    };
  });
}
```

- [ ] **Step 2: Integrate into the checks array**

In `registerDoctorCommand`'s `action()`, update the `checks` array:

```typescript
const checks: CheckResult[] = [
  checkAntdInstalled(ctx),
  checkReactCompat(ctx),
  checkDuplicateInstall(ctx),
  checkDayjsDuplicate(ctx),
  checkCssinjsDuplicate(ctx),
  checkCssinjsCompat(ctx),
  checkIconsCompat(ctx),
  checkThemeConfig(ctx),
  checkBabelPlugins(ctx),
  checkCssInJs(ctx),
  ...checkEcosystemPeerDeps(ctx),
];
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Build and run all tests (green phase)**

```bash
npm run build && npm run test
```

Expected: all tests pass, including the new ecosystem peerDeps suite.

- [ ] **Step 5: Commit implementation**

```bash
git add src/commands/doctor.ts
git commit -m "feat: implement checkEcosystemPeerDeps in doctor command"
```

---

## Task 5: Update spec.md

**Files:**
- Modify: `spec.md`

- [ ] **Step 1: Add ecosystem-compat check description**

In `spec.md`, find the doctor checks list (section `antd doctor`, "Checks (in order):"). After item 10 (`cssinjs`), add:

```
11. `ecosystem-compat:<shortName>` (dynamic, 0–N checks, one per installed `@ant-design/*` package with peerDependencies) — scans `node_modules/@ant-design/` and for each package that declares `peerDependencies`, checks that each required dep's installed version satisfies the range. Uses `satisfies()` with fail-open for unrecognized range formats (e.g. compound `>=x <y`). Packages with empty `peerDependencies` are skipped. If no `@ant-design/*` packages are installed, no checks are added. severity: error (version incompatible) / warning (dep not installed).
```

- [ ] **Step 2: Commit spec update**

```bash
git add spec.md
git commit -m "docs: update spec.md with ecosystem-compat doctor check documentation"
```

---

## Task 6: Final verification and PR

- [ ] **Step 1: Run full test suite**

```bash
npm run build && npm run test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
node dist/index.js doctor
node dist/index.js doctor --format json
```

Expected: valid output with "antd Doctor" header and summary. No crash. If run from within the CLI project directory (which has no `@ant-design/*` packages), no `ecosystem-compat:*` checks appear in the output.

- [ ] **Step 4: Push branch and create PR**

```bash
git push -u origin feat/doctor-ecosystem-peerdeps
gh pr create --title "feat: add ecosystem peerDeps compatibility check to antd doctor" --body "$(cat <<'EOF'
## Summary

- Extends `antd doctor` to dynamically scan all installed `@ant-design/*` packages
- For each package that declares `peerDependencies`, checks that each dep satisfies the required version range
- Reports one `CheckResult` per package: `ecosystem-compat:<shortName>` (e.g. `ecosystem-compat:pro-components`)
- Covers pro-components series, @ant-design/charts, @ant-design/x, icons, cssinjs, and any other future `@ant-design/*` package
- Uses fail-open for unrecognized range formats (compound `>=x <y` etc.)
- Returns no checks if no `@ant-design/*` ecosystem packages are installed — fully backward-compatible

## Test plan
- [ ] All existing tests pass with no regressions
- [ ] New integration tests cover 7 scenarios: pass, fail (incompatible version), warn (not installed), skipped (no peerDeps), empty scan (no checks), compound range (fail-open), multiple packages
- [ ] TypeScript compiles without errors
- [ ] Manual smoke test of `antd doctor` and `antd doctor --format json`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
