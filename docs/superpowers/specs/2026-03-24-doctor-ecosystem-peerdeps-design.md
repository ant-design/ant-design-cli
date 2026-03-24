# Design: antd doctor — Ecosystem peerDeps Compatibility Check

**Date:** 2026-03-24
**Status:** Approved

## Summary

Extend `antd doctor` to dynamically scan all installed `@ant-design/*` packages and verify that each package's `peerDependencies` are satisfied by the currently installed environment. This covers both:

1. **Ecosystem → antd**: does the installed antd version satisfy what pro-components / charts / etc. require?
2. **Ecosystem → other deps**: does the installed react / cssinjs / icons version satisfy each ecosystem package's requirements?

## Background

The current `doctor` command already checks:
- `cssinjs-compat`: from antd's peerDeps perspective — does installed cssinjs satisfy antd's requirement?
- `icons-compat`: same for icons

These are kept as-is. The new check is complementary: it goes in the other direction, asking "does the installed environment satisfy what each ecosystem package needs?"

## Design

### Data Collection (`DoctorContext`)

Add to `buildContext()`:
- Scan `node_modules/@ant-design/` (i.e. `readdirSync(join(cwd, 'node_modules', '@ant-design'))`) to discover all installed scoped packages. Note: `antd` itself lives at `node_modules/antd/`, NOT under `@ant-design/`, so it will never appear in this scan.
- For each entry, read `node_modules/@ant-design/<entry>/package.json` to extract: `version`, `peerDependencies`, `peerDependenciesMeta`
- Add `ecosystemPackages: EcosystemPackage[]` field to `DoctorContext`
- Add `getInstalledVersion(cwd, pkgName): string | null` helper function that reads `node_modules/<pkgName>/package.json`. This is a standalone helper and is self-contained within the new check; it does not replace existing `ctx.cssinjsPkg` / `ctx.iconsPkg` fields used by existing checks.

```typescript
interface EcosystemPackage {
  name: string;            // e.g. "@ant-design/pro-components"
  shortName: string;       // e.g. "pro-components"
  version: string;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
}
```

### New Check Function

```
checkEcosystemPeerDeps(ctx: DoctorContext): CheckResult[]
```

Algorithm per installed ecosystem package:
1. Skip packages with no `peerDependencies` field (no check emitted)
2. For each entry in `peerDependencies`:
   - Look up installed version of that dep via `getInstalledVersion()`
   - **If not installed**: `warn` (regardless of optional/required — follows the same pattern as `checkCssinjsCompat`)
   - **If installed but version doesn't satisfy range** (via `satisfies()`): `fail` with severity=error
   - **Range format limitation**: `satisfies()` does not support compound ranges like `">=5.0.0 <6.0.0"` or `">=4 || >=5"`. For any range that `satisfies()` cannot parse, it fails-open (returns `true`, i.e. treated as compatible). This is intentional v1 scope: false negatives are preferred over false positives for unknown range formats.
3. Aggregate violations for the package into one `CheckResult`:
   - Any version-incompatible dep → `status: 'fail'`, `severity: 'error'`
   - Only missing deps (not installed) → `status: 'warn'`, `severity: 'warning'`
   - No issues → `status: 'pass'`
4. `name` format: `ecosystem-compat:<shortName>` (e.g. `ecosystem-compat:pro-components`)

### message/suggestion split

For a failing check:
- `message`: `"@ant-design/pro-components 2.7.0 peerDep issues: antd requires >=5.16.0 (installed: 5.10.0)"` — summarizes the violation(s) in the message
- `suggestion`: `"Run \`npm install antd@latest\`"` — the actionable fix

For multiple violations, the message concatenates them with `; `.

### Integration

In `registerDoctorCommand` action:
```typescript
const checks: CheckResult[] = [
  // existing checks...
  ...checkEcosystemPeerDeps(ctx),
];
```

The function returns `CheckResult[]` (empty if no ecosystem packages are found).

### Skip Logic

Packages to skip during ecosystem scan:
- `antd` itself
- Packages with no `peerDependencies` field (e.g. icon SVG assets, color utilities)

### Output (text format)

```
antd Doctor

  ✓ [antd-installed] antd 5.10.0 is installed
  ✓ [react-compat] React 18.2.0 is compatible with antd 5.10.0
  ...
  ✗ [ecosystem-compat:pro-components] @ant-design/pro-components 2.7.0 peerDep issues:
    → antd requires >=5.16.0 (installed: 5.10.0) — run `npm install antd@latest`
  ✓ [ecosystem-compat:icons] @ant-design/icons 5.3.0 satisfies all peerDependencies
  ✓ [ecosystem-compat:cssinjs] @ant-design/cssinjs 1.11.0 satisfies all peerDependencies

Summary: 5 passed, 0 warnings, 1 failed
```

### Output (JSON format, appended to existing checks array)

```json
{
  "name": "ecosystem-compat:pro-components",
  "status": "fail",
  "severity": "error",
  "message": "@ant-design/pro-components 2.7.0 peerDep issues: antd requires >=5.16.0 (installed: 5.10.0)",
  "suggestion": "Run `npm install antd@latest` to satisfy @ant-design/pro-components peerDependencies"
}
```

## Files Changed

- `src/commands/doctor.ts` — main changes
- `spec.md` — update doctor checks list
- `src/__tests__/cli.test.ts` — add ecosystem peerDep test cases

## Testing

- Mock `node_modules/@ant-design/pro-components/package.json` with peerDeps
- Test: incompatible antd version → `status: 'fail'`, `severity: 'error'`
- Test: missing optional peerDep (via `peerDependenciesMeta`) → `status: 'warn'`
- Test: missing required (non-optional) peerDep → `status: 'warn'` (follows `checkCssinjsCompat` precedent: "not installed" = warn, not fail)
- Test: all satisfied → `status: 'pass'`
- Test: no ecosystem packages installed → no new checks added
- Test: package with no peerDependencies → skipped (no check emitted)
- Test: compound range (`>=5.0.0 <6.0.0`) that `satisfies()` cannot parse → treated as compatible (fail-open)

## Non-Goals

- Network requests to npm registry (all checks are local file reads only)
- Checking non-`@ant-design/*` packages (e.g., `antd-mobile`)
- Modifying existing `cssinjs-compat` / `icons-compat` checks (kept as-is)
