# Doctor Command Enhancements — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Add 4 new checks to `antd doctor`, plus a `satisfies()` semver helper

---

## Background

The existing `doctor` command has 6 checks covering antd installation, React compatibility, duplicate antd instances, theme config, babel plugins, and CSS-in-JS presence. This spec adds 4 new checks targeting common runtime issues caused by duplicate packages and incompatible peer dependency versions.

---

## New Checks

### 1. `dayjs-duplicate`

**Problem:** Multiple dayjs instances cause `.isSame()` failures, `dayjs.extend()` plugins only applying to one instance, and locale mismatches.

**Detection:**
- Call `findDuplicateVersions(cwd, 'dayjs')` — scans top-level + one level of nested `node_modules`
- If distinct version count > 1 → `fail`

**Output:**
```
✗ [dayjs-duplicate] Found 2 dayjs installations: 1.11.10, 1.11.13
  → Run `npm dedupe` or check your monorepo hoisting config
```

**Severity:** `error`

---

### 2. `cssinjs-duplicate`

**Problem:** Multiple `@ant-design/cssinjs` instances cause CSS token injection to run twice, leading to style conflicts and SSR hash mismatches.

**Detection:**
- Call `findDuplicateVersions(cwd, '@ant-design/cssinjs')` — scans top-level + one level of nested `node_modules`
- If distinct version count > 1 → `fail`

**Output:**
```
✗ [cssinjs-duplicate] Found 2 @ant-design/cssinjs installations: 1.21.0, 1.22.1
  → Run `npm dedupe` or check your monorepo hoisting config
```

**Severity:** `error`

---

### 3. `cssinjs-compat`

**Problem:** antd declares a peer dependency on `@ant-design/cssinjs`; installing an incompatible version causes style token failures or missing CSS variable support.

**Detection:**
- Read `ctx.antdPkg.peerDependencies['@ant-design/cssinjs']` for the required range
- If `antdPkg` is null or no such peerDep → `pass` (v4 doesn't use cssinjs)
- If range exists but `ctx.cssinjsPkg` is null (not installed at top-level) → `warn`
- Otherwise call `satisfies(ctx.cssinjsPkg.version, range)` → false → `fail`

**Output (fail):**
```
✗ [cssinjs-compat] @ant-design/cssinjs 1.19.0 is not compatible with antd 5.22.0 (requires >=1.21.0)
  → Run `npm install @ant-design/cssinjs@>=1.21.0`
```

**Output (warn — not installed):**
```
⚠ [cssinjs-compat] antd 5.22.0 requires @ant-design/cssinjs but it is not installed
  → Run `npm install @ant-design/cssinjs`
```

**Severity:** `error` (incompatible version), `warning` (not installed)

---

### 4. `icons-compat`

**Problem:** `@ant-design/icons` is a peer dependency of antd; major version mismatches cause icon rendering failures or missing icons.

**Detection:**
- Read `ctx.antdPkg.peerDependencies['@ant-design/icons']` for the required range
- If `antdPkg` is null or no such peerDep → `pass`
- If range exists but `ctx.iconsPkg` is null (not installed) → `pass` (icons are optional; absence is not an error)
- Otherwise call `satisfies(ctx.iconsPkg.version, range)` → false → `warn`

**Output (warn):**
```
⚠ [icons-compat] @ant-design/icons 4.8.0 may not be compatible with antd 5.22.0 (requires >=5.0.0)
  → Run `npm install @ant-design/icons@>=5.0.0`
```

**Severity:** `warning` (icons are optional; warn rather than fail)

---

## Supporting Change: `satisfies(version, range)` in `version.ts`

A lightweight semver range checker to avoid adding the `semver` package as a runtime dependency. Handles all range formats observed in antd peerDependencies:

| Format | Example | Logic |
|--------|---------|-------|
| `>=x.y.z` | `>=1.21.0` | installed >= lower bound |
| `>x.y.z` | `>1.20.0` | installed > lower bound |
| `^x.y.z` | `^1.21.0` | same major, installed >= lower bound |
| `~x.y.z` | `~1.21.0` | same major+minor, installed >= lower bound |
| `x.y.z` | `1.21.0` | exact match |
| `x` / `x.y` | `5` / `5.0` | major (and optional minor) must match |

**Signature:**
```ts
export function satisfies(version: string, range: string): boolean
```

`satisfies` is a **named export** from `src/data/version.ts`, consistent with the existing `compare()` and `valid()` exports.

Returns `true` if `version` satisfies `range`. Returns `true` for unrecognized range formats (fail-open to avoid false positives).

---

## Changes to `DoctorContext`

Add two new fields to `buildContext`. Following the existing pattern, `buildContext()` reads these upfront:

```ts
interface DoctorContext {
  // existing fields ...
  cssinjsPkg: any | null;   // node_modules/@ant-design/cssinjs/package.json (top-level only)
  iconsPkg: any | null;     // node_modules/@ant-design/icons/package.json (top-level only)
}
```

"Installed" means present at top-level `node_modules/<pkg>`. Nested-only presence is treated the same as not installed (missing from `DoctorContext`).

---

## Changes to `checkDuplicateInstall` / New Helper

Extract a reusable `findDuplicateVersions(cwd, pkgPath)` helper that:
1. Attempts to read `node_modules/<pkgPath>/package.json`; if absent, no version is added from the top level (not an error)
2. Recursively scans `node_modules/*/node_modules/<pkgPath>/package.json` for nested versions at one level deep (consistent with the existing `checkDuplicateInstall` pattern; deeper nesting is uncommon and excluded for performance)
3. Pools all collected version strings (top-level if present + nested) into one array
4. Returns a **deduplicated** array of distinct version strings

If count of distinct versions > 1, the check fails. "Duplicate" means more than one distinct version string across all locations. If no versions are found (package not installed anywhere), returns an empty array and the check passes.

Used by:
- `checkDuplicateInstall` (antd) — refactored to use the helper
- `checkDayjsDuplicate` (dayjs)
- `checkCssinjsDuplicate` (@ant-design/cssinjs)

---

## Files Changed

| File | Change |
|------|--------|
| `src/data/version.ts` | Add `satisfies(version, range)` export |
| `src/commands/doctor.ts` | Add 4 new check functions, expand `DoctorContext`, extract `findDuplicateVersions` helper |

No new dependencies required.

---

## Out of Scope

- `vite-locale`: Vite + antd locale production-mode warning (deferred)
- `dayjs-locale`: dayjs locale package installation check (deferred)
- `cssinjs-layer`: StyleProvider layer mode + icon conflict check (deferred)
