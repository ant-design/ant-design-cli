# Upgrade Command Design

## Overview

Add an `antd upgrade` command that upgrades the CLI itself to the latest version by detecting the package manager used for installation and executing the corresponding upgrade command.

## Command Interface

```
antd upgrade [options]
```

**Options (inherited global):**
- `--format json|text|markdown` — output format
- `--lang en|zh` — language

**No command-specific options.** No `--version` to target a specific version, no `--dry-run`, no `--yes` confirmation skip.

**Exit codes:**
- `0` — upgrade succeeded or already up to date
- `1` — user error (network unreachable, package manager not detected)
- `2` — system error (upgrade command execution failed, version unchanged after upgrade)

## Package Manager Detection

New module: `src/utils/detect-pm.ts`

**Algorithm:**
1. `execFile('which', ['antd'])` (Unix) / `execFile('where', ['antd'])` (Windows) to get binary absolute path
2. Match path keywords in priority order to infer package manager:

| Path Keyword | Package Manager |
|---|---|
| `.utoo` or `utoo/global` | `utoo` |
| `.cnpm` or `cnpm/global` | `cnpm` |
| `yarn/global` | `yarn` |
| `.pnpm-global` or `pnpm/global` | `pnpm` |
| `.bun` or `bun/install/global` | `bun` |
| Other (`.npm-global`, `nvm`, `.nvm`, `lib/node_modules`, etc.) | `npm` |

3. If `which`/`where` fails (binary not in PATH), return `null`

**Type:**
```typescript
type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'cnpm' | 'utoo';
```

**Upgrade commands per package manager:**

| Package Manager | Upgrade Command |
|---|---|
| `npm` | `npm install -g @ant-design/cli@latest` |
| `yarn` | `yarn global add @ant-design/cli@latest` |
| `pnpm` | `pnpm add -g @ant-design/cli@latest` |
| `bun` | `bun add -g @ant-design/cli@latest` |
| `cnpm` | `cnpm install -g @ant-design/cli@latest` |
| `utoo` | `ut install -g @ant-design/cli@latest` |

## Main Flow

`src/commands/upgrade.ts` — `registerUpgradeCommand(program)`

```
1. fetchLatestVersion()     → get latest version (reuse from update-check.ts)
2. compare(latest, current) → version comparison
   ├─ no upgrade needed → output "Already up to date" → exit 0
   └─ upgrade needed → continue
3. detectPackageManager()   → infer PM from binary path
   ├─ null → print error + manual command suggestion → exit 1
   └─ pm → continue
4. Build upgrade command (per table above)
5. execFile(pm, args)       → execute upgrade
   ├─ failure → print error + manual command suggestion → exit 2
   └─ success → continue
6. Verify upgraded version
   ├─ version unchanged → warn "upgrade command succeeded but version unchanged, check permissions" → exit 2
   └─ version updated → output success → exit 0
```

**Key details:**
- Step 1 reuses `fetchLatestVersion()` with existing 3-mirror race (npmjs, npmmirror, unpkg) + 3s timeout + 24h cache
- Step 5 uses `child_process.execFile()` with 120s timeout (global installs can be slow)
- Step 5 passes through stdout/stderr to terminal (`stdio: 'inherit'`) so users see install progress
- Step 6 verifies by executing `antd --cli-version` via `execFile` (the in-process `__CLI_VERSION__` is baked in at build time and won't reflect the upgrade)

## Error Handling

| Scenario | Exit Code | Error Code | Suggestion |
|---|---|---|---|
| Network error (fetchLatestVersion fails) | 1 | `NETWORK_ERROR` | Check network connection and retry |
| Package manager not detected | 1 | `PM_NOT_FOUND` | Manual command: `npm i -g @ant-design/cli@latest` |
| Upgrade command execution failed | 2 | `UPGRADE_FAILED` | Manual command with the detected PM |
| Version unchanged after upgrade | 2 | `VERSION_UNCHANGED` | Check permissions or try manual command |

## Output Formats

### Already up to date

**text:**
```
Already up to date: v6.4.3
```

**markdown:**
```markdown
## Upgrade

| Field | Value |
|---|---|
| Current Version | 6.4.3 |
| Status | Already up to date |
```

**json:**
```json
{"currentVersion":"6.4.3","message":"Already up to date"}
```

### Upgrade succeeded

**text:**
```
Upgrading @ant-design/cli: v6.4.3 → v6.4.4
Running: npm install -g @ant-design/cli@latest
... (passthrough package manager output) ...
Successfully upgraded to v6.4.4
```

**markdown:**
```markdown
## Upgrade

| Field | Value |
|---|---|
| Previous Version | 6.4.3 |
| New Version | 6.4.4 |
| Package Manager | npm |
```

**json:**
```json
{"previousVersion":"6.4.3","newVersion":"6.4.4","packageManager":"npm"}
```

## File Changes

### New files

| File | Purpose |
|---|---|
| `src/commands/upgrade.ts` | Command registration + main flow |
| `src/utils/detect-pm.ts` | Package manager detection logic |
| `src/__tests__/commands/upgrade.test.ts` | Unit tests |
| `src/__tests__/utils/detect-pm.test.ts` | Unit tests |

### Modified files

| File | Change |
|---|---|
| `src/index.ts` | Import and call `registerUpgradeCommand` |
| `src/output/error.ts` | Add `NETWORK_ERROR`, `PM_NOT_FOUND`, `UPGRADE_FAILED`, `VERSION_UNCHANGED` error codes |
| `spec.md` | Add upgrade command specification |

## Testing Strategy

- `detect-pm.test.ts`: mock `which`/`where` to return different paths, verify detection for all 6 package managers + null case
- `upgrade.test.ts`: mock `fetchLatestVersion`, `execFile`, `detectPackageManager`, verify all 4 branches (already up to date / upgrade success / PM not found / upgrade failed) + all 3 output formats
- No real network requests or install commands — all external calls are mocked

## Reused Infrastructure

- `src/utils/update-check.ts` — `fetchLatestVersion()` for checking latest version
- `src/data/version.ts` — `compare()` for semver comparison
- `src/output/formatter.ts` — `output()` for format dispatch
- `src/output/error.ts` — `createError()`, `printError()`, `ErrorCodes` for error handling
- `__CLI_VERSION__` — compile-time constant for current CLI version