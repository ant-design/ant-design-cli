<div align="center">

<br>

<img src="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg" alt="Ant Design" width="72">

<h1>Ant Design CLI</h1>

**Ant Design on your command line.**<br>
Query component knowledge, analyze project usage, and guide migrations — fully offline.

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

## 🤔 Why

Code agents (Claude Code, Codex, Gemini CLI) write better antd code when they have instant access to the right API data. This CLI gives them exactly that — **every prop, token, demo, and changelog entry for antd v3 / v4 / v5 / v6**, bundled locally, queryable in milliseconds.

```bash
npx skills add ant-design/ant-design-cli    # install as an agent skill
```

<br>

## ✨ Highlights

- 📦 **Fully offline** — All metadata ships with the package. No network calls, no latency, no API keys.
- 🎯 **Version-accurate** — 55+ per-minor snapshots across v3/v4/v5/v6. Query the exact API surface of `antd@5.3.0`, not just "latest v5".
- 🤖 **Agent-optimized** — `--format json` on every command. Structured errors with codes and suggestions. Clean stdout/stderr separation.
- 🌍 **Bilingual** — Every component name, description, and doc has both English and Chinese. Switch with `--lang zh`.
- 🔮 **Smart matching** — Typo `Buttn`? The CLI suggests `Button` using Levenshtein distance, with first-letter preference.
- 🧩 **18 commands** — From prop lookup to project-wide lint, from design token queries to cross-version API diffing.
- 🔌 **MCP server** — `antd mcp` starts a stdio server for native IDE integration (Claude Code, Cursor, VS Code, etc.).

<br>

## 📦 Install

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

## 🤖 Agent Integration

The CLI ships with a [skill file](./skills/antd/SKILL.md) that teaches code agents *when* and *how* to use each command:

```bash
npx skills add ant-design/ant-design-cli
```

Or simply tell your code agent:

> Install `@ant-design/cli` and the antd skill from `ant-design/ant-design-cli`

The agent will handle `npm install`, `npx skills add`, and start using the CLI automatically.

Works with [Claude Code](https://claude.ai/code), [Cursor](https://cursor.sh), [Codex](https://openai.com/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and any agent supporting the [skills](https://github.com/nicepkg/agent-skills) protocol.

### MCP Server

For IDEs that support [Model Context Protocol](https://modelcontextprotocol.io), the CLI can run as an MCP server:

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

Or if you have the CLI installed globally (`npm i -g @ant-design/cli`):

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

This exposes 8 tools (`antd_list`, `antd_info`, `antd_doc`, `antd_demo`, `antd_token`, `antd_design_md`, `antd_semantic`, `antd_changelog`) and 2 prompts (`antd-expert`, `antd-page-generator`) for native IDE integration.

<br>

## 🚀 Quick Start

```bash
antd list                           # All components with versions
antd info Button                    # Component props, types, defaults
antd doc Button                     # Full markdown documentation
antd demo Select basic              # Runnable demo source code
antd token DatePicker               # Design Token values (v5+)
antd design.md                      # Design-language document (design.md)
antd semantic Table                 # classNames / styles structure
antd changelog 4.24.0 5.0.0 Select  # API diff across versions
antd doctor                         # Diagnose project issues
antd env                            # Collect env info for bug reports
antd usage ./src                    # Analyze antd imports in project
antd lint ./src                     # Check deprecated APIs & best practices
antd migrate 3 4                    # v3 → v4 migration guide
antd migrate 4 5 --apply ./src      # Agent-ready migration prompt
antd mcp                            # Start MCP server for IDE integration
antd setup --client claude          # Set up MCP/Skill for AI agents
antd upgrade                        # Upgrade CLI to latest version
```

<br>

## 📖 Commands

### 📚 Knowledge Query

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

### 🔍 Project Analysis

| Command | Description |
|---|---|
| [`antd doctor`](#antd-doctor) | 10 diagnostic checks: React compat, duplicates, peer deps, SSR, babel plugins |
| [`antd env [dir]`](#antd-env-dir) | Collect all antd-related environment info for bug reporting or AI diagnosis |
| [`antd usage [dir]`](#antd-usage-dir) | Import stats, sub-component breakdown (`Form.Item`), non-component exports |
| [`antd lint [target]`](#antd-lint-target) | Deprecated APIs, accessibility gaps, performance issues, best practices |
| [`antd migrate <from> <to>`](#antd-migrate-from-to) | Migration checklist with auto-fixable/manual split and `--apply` agent prompt |

### 🐛 Issue Reporting

| Command | Description |
|---|---|
| [`antd bug`](#antd-bug) | File a bug to ant-design/ant-design with auto-collected environment info |
| [`antd bug-cli`](#antd-bug-cli) | File a bug to ant-design/ant-design-cli |

### 🔧 CLI Management

| Command | Description |
|---|---|
| [`antd mcp`](#antd-mcp) | Start MCP stdio server for IDE agent integration |
| [`antd setup`](#antd-setup) | Write local MCP config or install skills for Claude Code, Cursor, VS Code, or Codex |
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

Runs 10 checks against your project: antd installed and bundled known-bug version data, React version compat, duplicate antd/dayjs/cssinjs installs, peer dependency satisfaction, theme config, babel-plugin-import usage, and CSS-in-JS setup. All checks use bundled/local data and do not make network calls.

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

Four rule categories: `deprecated`, `a11y`, `usage`, `performance`. Deprecation rules are derived from metadata at runtime, so they're always version-accurate.

```bash
antd lint ./src
antd lint ./src --only deprecated
antd lint ./src --only a11y
antd lint ./src --only usage
antd lint ./src --diff              # check changed files only
antd lint --staged                  # check staged files only
antd lint ./src --only deprecated --format json --antd-alias @shared-components
```

`usage` checks include antd-specific prop/API mistakes such as Form.Item conflicts, Upload controlled value conflicts, static feedback APIs that should use `App.useApp()` in v5+, and v5+ Select children APIs that should use `options`.

Use `--antd-alias <source>` to treat additional package names as aliases of `antd`. Repeat the flag for multiple wrapper packages; `antd` remains enabled by default.

Use `--diff [base]` to lint changed git files only. By default it compares with `origin/main`'s merge-base, falling back to `HEAD`; pass a base ref such as `main` to override it. Use `--staged` to lint only staged files.

Files that cannot be read or parsed are reported as skipped instead of being silently ignored. JSON output includes `skippedFiles`, `partial`, and `summary.skipped`; text and markdown output include a skipped-files section.

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

### `antd setup`

Configure a local AI agent project with Ant Design MCP and/or the bundled `skills/antd` guidance. The command can write the client-specific MCP config file, install a client-appropriate skill or skill reference, and add managed instructions for agents.

```bash
antd setup --client claude              # write .mcp.json
antd setup --client cursor              # write .cursor/mcp.json
antd setup --client vscode              # write .vscode/mcp.json
antd setup --client codex               # install Codex project skill
antd setup --client github-actions      # write .github/workflows/antd-cli.yml
antd setup --client claude --dry-run    # preview without writing files
antd setup --client claude --project ./my-app
antd setup --client claude --version 5.29.3 --lang zh
antd setup --client claude --check      # verify existing config
antd setup --client claude --mode skill # install Claude skill and write instructions
antd setup --client claude --mode both  # write MCP config, install skill, and write instructions
antd setup --client claude --write-instructions
```

Modes:

| Mode | Behavior |
|---|---|
| `mcp` | Writes the client MCP config only. This is the default. |
| `skill` | Installs the bundled Ant Design guidance for the selected client and writes a managed instruction block. |
| `both` | Writes MCP config, installs the skill or skill reference, and writes the managed instruction block. |
| `ci` | Writes a GitHub Actions workflow. This mode is only supported by `--client github-actions`. |

Supported clients:

| Client | Config file | Server key | Skill target | Instructions file |
|---|---|---|---|---|
| `claude` | `.mcp.json` | `mcpServers` | `.claude/skills/antd/` | `CLAUDE.md` |
| `cursor` | `.cursor/mcp.json` | `mcpServers` | `.agents/skills/antd/` shared skill | `AGENTS.md` |
| `vscode` | `.vscode/mcp.json` | `servers` | `.agents/skills/antd/` shared skill | `AGENTS.md` |
| `codex` | - | - | `.agents/skills/antd/` shared skill | `AGENTS.md` |
| `github-actions` | `.github/workflows/antd-cli.yml` | - | - | - |

Generated server entry:

```json
{
  "mcpServers": {
    "antd": {
      "command": "npx",
      "args": ["-y", "@ant-design/cli", "mcp", "--version", "5.29.3", "--lang", "zh"]
    }
  }
}
```

Skill instructions are written to the selected client's instruction file: Claude uses `CLAUDE.md`; Cursor, VS Code, and Codex use `AGENTS.md`. Claude gets a native project skill under `.claude/skills/antd/`; Cursor, VS Code, and Codex get the same bundled guidance under `.agents/skills/antd/` and an instruction block telling agents when to use it.

Codex setup currently supports skill installation only. Use `antd setup --client codex --mode skill`, or omit `--mode` because Codex defaults to `skill`.

GitHub Actions setup writes an advisory pull-request workflow that runs `npm ci`, `npm run build`, `npx -y @ant-design/cli doctor --format json`, and `npx -y @ant-design/cli lint ./src --format json`. Use `--check` to verify that the workflow matches the generated content.

Use `--check` to validate an existing setup without writing files. It exits with code `0` when the selected mode is configured, and `1` when config, skill files, or instructions are missing or different.

Use `--write-instructions` with the default `mcp` mode to also add an idempotent managed block to the selected agent instructions file, telling agents to use the configured `antd` MCP server before generating Ant Design code. With `--check`, it also verifies that instruction block.

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
