# `antd env` Command Design

## Overview

A single command to collect all antd-related environment information from a React project, producing a structured "environment snapshot" for bug reporting or AI-assisted diagnosis.

## Command

```
antd env [dir]
```

Positional `[dir]` argument follows the convention of `antd usage [dir]` and `antd lint [file/dir]`.

### Options

- `--format json|text|markdown` — Output format (default: `text`)
- `--lang en|zh` — Output language (default: `en`)

## Information Collected

Six sections, organized from system-level down to project-specific:

### 1. System

- OS name and version (via `node:os`)

### 2. Binaries

- Node.js version (via `process.version`)
- Package manager: detect which of npm/pnpm/yarn/bun is available and their versions (via `execFileSync`)
- npm registry: current configured registry URL (via `npm config get registry` or equivalent)

### 3. Browsers

- Chrome, Firefox, Safari (macOS only), Edge — installed system versions
- Uses `envinfo` for browser detection, which abstracts platform-specific checks (plist on macOS, `--version` on Linux, registry on Windows)

### 4. Core Dependencies

Actual installed versions read from `node_modules/*/package.json`:

- `antd`
- `react`
- `react-dom`
- `dayjs`
- `@ant-design/cssinjs`
- `@ant-design/icons`

### 5. Ecosystem Packages (dynamic scan)

Dynamically discovered — only installed packages are listed:

- All `@ant-design/*` packages (pro-components, pro-table, charts, x, etc.)
- All `rc-*` (react-component) packages

### 6. Build Tools

Checks `node_modules` for presence and version of:

- Frameworks: `umi`, `next`, `@umijs/max`, `create-react-app`, `ice`
- Bundlers: `webpack`, `vite`, `esbuild`, `rollup`, `rspack`
- Compilers: `typescript`, `@babel/core`, `@swc/core`
- CSS: `less`, `sass`, `tailwindcss`, `styled-components`, `postcss`

## Output Formats

### Text (default)

Designed to be copy-pasted into GitHub Issues:

```
Environment

  System:
    OS:              macOS 15.3

  Binaries:
    Node:            20.11.0
    pnpm:            9.1.0
    Registry:        https://registry.npmmirror.com/

  Browsers:
    Chrome:          131.0.6778.86
    Safari:          18.3

  Dependencies:
    antd:                5.22.0
    react:               18.3.1
    react-dom:           18.3.1
    dayjs:               1.11.13
    @ant-design/cssinjs: 1.22.1
    @ant-design/icons:   5.5.2

  Ecosystem:
    @ant-design/pro-components: 2.8.1
    @ant-design/charts:         2.2.1
    rc-field-form:              2.7.0
    rc-table:                   7.49.0

  Build Tools:
    umi:             4.3.0
    typescript:      5.6.3
    less:            4.2.0
```

### JSON (`--format json`)

```json
{
  "system": {
    "os": "macOS 15.3"
  },
  "binaries": {
    "node": "20.11.0",
    "pnpm": "9.1.0",
    "registry": "https://registry.npmmirror.com/"
  },
  "browsers": {
    "chrome": "131.0.6778.86",
    "safari": "18.3",
    "edge": null,
    "firefox": null
  },
  "dependencies": {
    "antd": "5.22.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "dayjs": "1.11.13",
    "@ant-design/cssinjs": "1.22.1",
    "@ant-design/icons": "5.5.2"
  },
  "ecosystem": {
    "@ant-design/pro-components": "2.8.1",
    "rc-field-form": "2.7.0"
  },
  "buildTools": {
    "umi": "4.3.0",
    "typescript": "5.6.3",
    "less": "4.2.0"
  }
}
```

### Markdown (`--format markdown`)

```markdown
## Environment

### System

| Item | Version |
|------|---------|
| OS | macOS 15.3 |

### Binaries

| Item | Version |
|------|---------|
| Node | 20.11.0 |
| pnpm | 9.1.0 |
| Registry | https://registry.npmmirror.com/ |

### Browsers

| Browser | Version |
|---------|---------|
| Chrome | 131.0.6778.86 |
| Safari | 18.3 |

### Dependencies

| Package | Version |
|---------|---------|
| antd | 5.22.0 |
| react | 18.3.1 |
| react-dom | 18.3.1 |
| dayjs | 1.11.13 |
| @ant-design/cssinjs | 1.22.1 |
| @ant-design/icons | 5.5.2 |

### Ecosystem

| Package | Version |
|---------|---------|
| @ant-design/pro-components | 2.8.1 |
| rc-field-form | 2.7.0 |

### Build Tools

| Package | Version |
|---------|---------|
| umi | 4.3.0 |
| typescript | 5.6.3 |
| less | 4.2.0 |
```

## Error Handling

- **No `node_modules` directory**: Print system/binaries/browsers info normally. For dependency sections, show a warning: `Dependencies not found. Run npm install first.` Use exit code `0` (partial success — system info is still useful).
- **No `package.json`**: Same partial behavior. System info is always available.
- **Individual package read failures**: Skip silently, treat as not installed.

## Integration with `antd bug`

The existing `antd bug` command uses `collectAntdEnv()` from `src/utils/issue.ts` to gather a small subset of environment info (antd, react, system, browser). After `antd env` is implemented:

- `antd bug` will be updated to use the env collection logic internally, replacing `collectAntdEnv()`.
- The `collectAntdEnv()` function will be refactored to delegate to the shared env utilities.
- This is a follow-up task, not part of the initial implementation.

## Implementation

### Dependencies

- `envinfo` — Used only for browser detection (Chrome, Firefox, Safari, Edge installed versions). All other information is collected using built-in Node modules (`node:os`, `node:fs`, `node:child_process`, `process.version`), consistent with the project's minimal-dependency approach.

### Architecture

```
src/commands/env.ts
  → collectSystemInfo()        # node:os — OS info
  → collectBinaries()          # process.version + execFileSync — Node, package managers
  → collectBrowsers()          # envinfo — installed browser versions
  → collectDependencies(cwd)   # readJson from node_modules — core deps
  → scanEcosystem(cwd)         # readdir + readJson — @ant-design/* and rc-*
  → collectBuildTools(cwd)     # readJson from node_modules — build tool versions
  → output(result, format)     # Format and print
```

### Key Implementation Details

1. **System/Binaries**: Use `node:os` for OS, `process.version` for Node, `execFileSync` to detect package manager versions (npm/pnpm/yarn/bun), `npm config get registry` for registry URL
2. **Browsers**: Use `envinfo` — the one dependency that provides real value here (cross-platform browser detection logic is non-trivial)
3. **Core Dependencies**: Read `node_modules/<pkg>/package.json` using the existing `readJson()` utility from `scan.ts`
4. **Ecosystem scan**: `readdirSync('node_modules/@ant-design')` and filter `node_modules/rc-*`, read each `package.json` for version
5. **Build Tools**: Predefined list, check `node_modules/<pkg>/package.json` existence and version
6. **Not-found core deps**: Show `Not found` in text, `null` in JSON
7. **Ecosystem/rc-* packages**: Only list installed ones (no "Not found" noise)

### What This Command Does NOT Do

- Does not run project code or start dev servers
- Does not scan source files (that's `usage` / `lint`)
- Does not make compatibility judgments (that's `doctor`)
- Does not fetch remote data

## File Changes

1. **New file**: `src/commands/env.ts` — Command implementation
2. **Modified**: `src/index.ts` — Register the `env` command
3. **Modified**: `spec.md` — Document the new command
4. **New dependency**: `envinfo` in `package.json` (used only for browser detection)
