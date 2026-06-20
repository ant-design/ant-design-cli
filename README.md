<div align="center">

<br>

<img src="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg" alt="Ant Design" width="72">

<h1>Ant Design CLI</h1>

**Offline Ant Design knowledge for code agents.**<br>
Query versioned APIs, inspect project usage, and generate migration guidance without leaving the terminal.

<br>

[![npm version](https://img.shields.io/npm/v/@ant-design/cli?color=blue&label=npm)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli?color=blue)](https://www.npmjs.com/package/@ant-design/cli)
[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ant-design/ant-design-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/ant-design/ant-design-cli)
[![install size](https://packagephobia.com/badge?p=@ant-design/cli)](https://packagephobia.com/result?p=@ant-design/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [中文](./README.zh-CN.md) · [Changelog](./CHANGELOG.md)

</div>

<br>

## Why

Code agents write better Ant Design code when they can query the exact API surface before generating changes. `@ant-design/cli` packages versioned component metadata, demos, design tokens, changelogs, project analysis, and MCP tools into a single local CLI.

```bash
npx skills add ant-design/ant-design-cli    # install as an agent skill
```

<br>

## Capabilities

| Area | What it provides |
|---|---|
| Offline metadata | Props, docs, demos, tokens, semantic DOM, changelogs, and migration notes bundled with the package |
| Version snapshots | 55+ per-minor snapshots across antd v3/v4/v5/v6, resolved by `--version` or local project detection |
| Agent output | JSON on every command, structured errors, suggestions, and clean stdout/stderr separation |
| Project analysis | Usage scanning, antd-specific lint rules, environment collection, and project health diagnostics |
| Native integration | A stdio MCP server with 8 read-only tools and 2 prompts for Claude Code, Cursor, VS Code, Codex, and other agents |
| Bilingual docs | English and Chinese component names, descriptions, and documentation via `--lang en\|zh` |

<br>

## Install

```bash
npm install -g @ant-design/cli
```

<details>
<summary>Other package managers</summary>

```bash
pnpm add -g @ant-design/cli
bun add -g @ant-design/cli
```

</details>

<br>

## Agent Integration

Install the bundled [skill file](./skills/antd/SKILL.md) so compatible agents know when to query Ant Design metadata before editing code:

```bash
npx skills add ant-design/ant-design-cli
```

For IDEs that support [Model Context Protocol](https://modelcontextprotocol.io), run the CLI as a local MCP server:

```json
{
  "mcpServers": {
    "antd": {
      "command": "npx",
      "args": ["-y", "@ant-design/cli", "mcp"]
    }
  }
}
```

If the CLI is installed globally, you can also point the server at `antd` directly:

```json
{
  "mcpServers": {
    "antd": {
      "command": "antd",
      "args": ["mcp"]
    }
  }
}
```

To pin a specific antd version, add `"--version", "5.20.0"` to the `args` array.

The MCP server exposes 8 read-only tools (`antd_list`, `antd_info`, `antd_doc`, `antd_demo`, `antd_token`, `antd_design_md`, `antd_semantic`, `antd_changelog`) and 2 prompts (`antd-expert`, `antd-page-generator`).

Works with [Claude Code](https://claude.ai/code), [Cursor](https://cursor.sh), [Codex](https://openai.com/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and agents that support the [skills](https://github.com/nicepkg/agent-skills) protocol or MCP.

<br>

## Quick Start

```bash
# Knowledge queries
antd list                           # All components with versions
antd info Button                    # Component props, types, defaults
antd doc Button                     # Full markdown documentation
antd demo Select basic              # Runnable demo source code
antd token DatePicker               # Design Token values (v5+)
antd design.md                      # Design-language document (design.md)
antd semantic Table                 # classNames / styles structure
antd changelog 4.24.0 5.0.0 Select  # API diff across versions

# Project analysis
antd doctor                         # Diagnose project issues
antd env                            # Collect env info for bug reports
antd usage ./src                    # Analyze antd imports in project
antd lint ./src                     # Check deprecated APIs & best practices
antd migrate 3 4                    # v3 → v4 migration guide
antd migrate 4 5 --apply ./src      # Agent-ready migration prompt

# Agent integration and CLI management
antd mcp                            # Start MCP server for IDE integration
antd upgrade                        # Upgrade CLI to latest version
```

<br>

## Commands

### Knowledge Query

| Command | Description |
|---|---|
| [`antd list`](#antd-list) | List all components with bilingual names, categories, and `since` versions |
| [`antd info <Component>`](#antd-info-component) | Props table with types, defaults, `since`, and deprecated status |
| [`antd doc <Component>`](#antd-doc-component) | Full markdown documentation for a component |
| [`antd demo <Component> [name]`](#antd-demo-component-name) | Runnable demo source code (TSX) |
| [`antd token [Component]`](#antd-token-component) | Global or component-level Design Tokens |
| [`antd design.md`](#antd-designmd) | Design-language document (`design.md`) for AI design tools |
| [`antd semantic <Component>`](#antd-semantic-component) | Semantic `classNames` / `styles` structure with usage examples |
| [`antd changelog`](#antd-changelog-v1-v2-component) | Changelog entries, version ranges, or cross-version API diff |

### Project Analysis

| Command | Description |
|---|---|
| [`antd doctor`](#antd-doctor) | 10 diagnostic checks: React compat, duplicates, peer deps, SSR, babel plugins |
| [`antd env [dir]`](#antd-env-dir) | Collect all antd-related environment info for bug reporting or AI diagnosis |
| [`antd usage [dir]`](#antd-usage-dir) | Import stats, sub-component breakdown (`Form.Item`), non-component exports |
| [`antd lint [target]`](#antd-lint-target) | Deprecated APIs, accessibility gaps, performance issues, best practices |
| [`antd migrate <from> <to>`](#antd-migrate-from-to) | Migration checklist with auto-fixable/manual split and `--apply` agent prompt |

### Issue Reporting

| Command | Description |
|---|---|
| [`antd bug`](#antd-bug) | File a bug to ant-design/ant-design with auto-collected environment info |
| [`antd bug-cli`](#antd-bug-cli) | File a bug to ant-design/ant-design-cli |

### CLI Management

| Command | Description |
|---|---|
| [`antd mcp`](#antd-mcp) | Start MCP stdio server for IDE agent integration |
| [`antd upgrade`](#antd-upgrade) | Upgrade the CLI to the latest version |

<br>

---

### `antd list`

```bash
antd list                           # all components
antd list --version 5.0.0           # components available in v5.0.0
```

<details>
<summary>Example output</summary>

```
Component       组件名     Description                                                Since
--------------  -------  -------------------------------------------------------  ------
Button          按钮       To trigger an operation.                                  4.0.0
Table           表格       A table displays rows of data.                            4.0.0
Form            表单       High performance Form component with data scope management. 4.0.0
Select          选择器      Select component to select value from options.            4.0.0
Modal           对话框      Modal dialogs.                                            4.0.0
ColorPicker     颜色选择器   Used for color selection.                                 5.5.0
...
```

</details>

### `antd info <Component>`

```bash
antd info Button                    # props table
antd info Button --detail           # + descriptions, since, deprecated, FAQ
antd info Button --version 4.24.0   # v4 API snapshot
```

<details>
<summary>Example output</summary>

```
Button (按钮) — To trigger an operation.

Property         Type                                          Default   Since
---------------  --------------------------------------------  --------  ------
autoInsertSpace  boolean                                       true      5.17.0
block            boolean                                       false     -
classNames       Record<SemanticDOM, string>                   -         5.4.0
disabled         boolean                                       false     -
href             string                                        -         -
icon             ReactNode                                     -         -
loading          boolean | { delay: number, icon: ReactNode }  false     -
size             large | middle | small                        middle    -
type             primary | default | dashed | text | link      default   -
variant          outlined | dashed | solid | filled | text     -         5.13.0
onClick          (event: React.MouseEvent) => void             -         -
```

</details>

### `antd doc <Component>`

```bash
antd doc Button                     # full markdown docs to stdout
antd doc Button --format json       # { name, doc }
antd doc Button --lang zh           # Chinese documentation
```

### `antd demo <Component> [name]`

```bash
antd demo Button                    # list all available demos
antd demo Button basic              # get demo source code
```

### `antd token [Component]`

```bash
antd token                          # global tokens (colorPrimary, borderRadius, ...)
antd token Button                   # component-level tokens
```

### `antd design.md`

Output the antd **design-language document** (`design.md`) — a curated description of antd's default light theme, conformant with the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec. Where `antd token` lists individual token names, `antd design.md` describes the design language as a whole (color/typography/spacing/radius values plus the principles behind them), so AI design tools (Figma Make, Stitch, etc.) and agents can consume antd's design language directly.

```bash
antd design.md                      # design.md for the detected version
antd design.md --version 6.4.0      # design.md for a specific version
antd design.md --format json        # { doc }
```

`design.md` is **major-grained** (antd rewrites it only across major releases), so it is resolved by major version. A `design.md` is currently published only for **antd v6** — requesting a major without one (v3/v4/v5) returns `UNSUPPORTED_VERSION_FEATURE`. It mirrors the canonical `DESIGN.md` published at [`https://ant.design/design.md`](https://ant.design/design.md).

### `antd semantic <Component>`

```bash
antd semantic Table
```

<details>
<summary>Example output</summary>

```
Table Semantic Structure:
├── header    # Table header area
├── body      # Table body area
├── footer    # Table footer area
├── cell      # Table cell
├── row       # Table row
└── wrapper   # Outer wrapper

Usage:
  <Table classNames={{ header: 'my-header' }} />
  <Table styles={{ header: { background: '#fff' } }} />
```

</details>

### `antd changelog [v1] [v2] [component]`

```bash
antd changelog 5.22.0               # single version
antd changelog 5.21.0..5.24.0       # version range (inclusive)
antd changelog 4.24.0 5.0.0         # API diff between two versions
antd changelog 4.24.0 5.0.0 Select  # API diff for Select only
```

---

### `antd doctor`

Runs 10 checks against your project: antd installed, React version compat, duplicate antd/dayjs/cssinjs installs, peer dependency satisfaction, theme config, babel-plugin-import usage, and CSS-in-JS setup.

```bash
antd doctor
antd doctor --format json
```

### `antd env [dir]`

Collect all antd-related environment information — system, Node, package managers, browsers, dependencies, ecosystem packages (`@ant-design/*`, `rc-*`), and build tools — in one shot.

```bash
antd env                            # text output (paste into GitHub Issues)
antd env --format json              # structured JSON for AI consumption
antd env --format markdown          # markdown tables
antd env ./my-project               # scan a specific project directory
```

<details>
<summary>Example output</summary>

```text
Environment

  System:
    OS        macOS 15.3

  Binaries:
    Node      20.11.0
    pnpm      9.1.0
    Registry  https://registry.npmmirror.com/

  Browsers:
    Chrome    131.0.6778.86
    Safari    18.3

  Dependencies:
    antd                 5.22.0
    react                18.3.1
    react-dom            18.3.1
    dayjs                1.11.13
    @ant-design/cssinjs  1.22.1
    @ant-design/icons    5.5.2

  Ecosystem:
    @ant-design/pro-components  2.8.1
    rc-field-form               2.7.0

  Build Tools:
    umi         4.3.0
    typescript  5.6.3
    less        4.2.0
```

</details>

### `antd usage [dir]`

```bash
antd usage                          # scan current directory
antd usage ./src                    # scan specific directory
antd usage -f Button                # filter to one component
```

### `antd lint [target]`

Four rule categories: `deprecated`, `a11y`, `performance`, `best-practice`. Deprecation rules are derived from metadata at runtime, so they're always version-accurate.

```bash
antd lint ./src
antd lint ./src --only deprecated
antd lint ./src --only a11y
antd lint ./src --only deprecated --format json --antd-alias @shared-components
```

Use `--antd-alias <source>` to treat additional package names as aliases of `antd`. Repeat the flag for multiple wrapper packages; `antd` remains enabled by default.

### `antd migrate <from> <to>`

v3→v4 covers 15+ migration steps; v4→v5 covers 25+ migration steps; v5→v6 covers 30+. Each step includes component name, breaking flag, search pattern, and before/after code.

```bash
antd migrate 3 4                    # v3 → v4 migration
antd migrate 4 5                    # full checklist
antd migrate 4 5 --component Select # component-specific
antd migrate 4 5 --apply ./src      # generate agent migration prompt
```

<details>
<summary>Example output</summary>

```
Migration Guide: v4 → v5

  Select:
    🔧 [BREAKING] Prop `dropdownClassName` renamed to `popupClassName`
    🔧 [BREAKING] Prop `dropdownMatchSelectWidth` renamed to `popupMatchSelectWidth`

Total: 2 steps (2 auto-fixable, 0 manual)
```

</details>

### `antd bug`

```bash
antd bug --title "DatePicker crashes with dayjs 2.0"
antd bug --title "..." --steps "1. Click" --expected "Works" --actual "Crashes"
antd bug --title "..." --submit     # submit via gh CLI
```

### `antd bug-cli`

```bash
antd bug-cli --title "info command crashes on v4"
antd bug-cli --title "..." --submit
```

### `antd mcp`

Start an MCP (Model Context Protocol) stdio server for IDE agent integration. Exposes 8 tools and 2 prompts for native IDE integration (Claude Code, Cursor, VS Code, Codex, etc.).

```bash
antd mcp                                # start with auto-detected version
antd mcp --version 5.20.0 --lang zh     # pin version and language
```

Configuration:

```json
{
  "mcpServers": {
    "antd": {
      "command": "npx",
      "args": ["-y", "@ant-design/cli", "mcp"]
    }
  }
}
```

**MCP Tools (8):** `antd_list`, `antd_info`, `antd_doc`, `antd_demo`, `antd_token`, `antd_design_md`, `antd_semantic`, `antd_changelog`

**MCP Prompts (2):** `antd-expert`, `antd-page-generator`

### `antd upgrade`

Upgrade the CLI itself to the latest version published on npm. Automatically detects which package manager installed the CLI (npm, yarn, pnpm, bun, cnpm, utoo) and runs the corresponding upgrade command.

```bash
antd upgrade                        # upgrade to latest version
```

<details>
<summary>Example output</summary>

```text
Upgrading @ant-design/cli: v6.4.3 → v6.4.4
Running: npm install -g @ant-design/cli@latest
... (passthrough package manager output) ...
Successfully upgraded to v6.4.4
```

</details>

<br>

## ⚙️ Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format | `text` |
| `--version <v>` | Target antd version (e.g. `5.20.0`) | auto-detect |
| `--lang en\|zh` | Output language | `en` |
| `--detail` | Include extended information | `false` |
| `-V, --cli-version` | Print CLI version | — |

**Version auto-detection**: `--version` flag → `node_modules/antd` → `package.json` dependencies → fallback `5.24.0`

### Environment Variables

| Variable | Description |
|---|---|
| `ANTD_NO_AUTO_REPORT=1` | Disable bug-reporting suggestions from AI agents (see [#82](https://github.com/ant-design/ant-design-cli/issues/82)) |
| `NO_UPDATE_CHECK=1` | Skip the silent version update check |
| `CI=1` | Skip the silent version update check (same as `NO_UPDATE_CHECK=1`) |

<br>

## 📄 License

[MIT](./LICENSE) © [Ant Design](https://ant.design)
