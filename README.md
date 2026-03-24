<div align="center">

<br>

<img src="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg" alt="Ant Design" width="72">

<h1>@ant-design/cli</h1>

**Ant Design on your command line.**<br>
Query component knowledge, analyze project usage, and guide migrations — fully offline.

<br>

[![npm version](https://img.shields.io/npm/v/@ant-design/cli?color=blue&label=npm)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli?color=blue)](https://www.npmjs.com/package/@ant-design/cli)
[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [中文](./README.zh-CN.md) · [Changelog](./CHANGELOG.md)

</div>

<br>

## 🤔 Why

Code agents (Claude Code, Cursor, Copilot, Codex, Gemini CLI) write better antd code when they have instant access to the right API data. This CLI gives them exactly that — **every prop, token, demo, and changelog entry for antd v4 / v5 / v6**, bundled locally, queryable in milliseconds.

```bash
npx skills add ant-design/ant-design-cli    # install as an agent skill
```

<br>

## ✨ Highlights

- 📦 **Fully offline** — All metadata ships with the package. No network calls, no latency, no API keys.
- 🎯 **Version-accurate** — 55+ per-minor snapshots across v4/v5/v6. Query the exact API surface of `antd@5.3.0`, not just "latest v5".
- 🤖 **Agent-optimized** — `--format json` on every command. Structured errors with codes and suggestions. Clean stdout/stderr separation.
- 🌍 **Bilingual** — Every component name, description, and doc has both English and Chinese. Switch with `--lang zh`.
- 🔮 **Smart matching** — Typo `Buttn`? The CLI suggests `Button` using Levenshtein distance, with first-letter preference.
- 🧩 **14 commands** — From prop lookup to project-wide lint, from design token queries to cross-version API diffing.

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

<br>

## 🚀 Quick Start

```bash
antd info Button                    # Component props, types, defaults
antd demo Select basic              # Runnable demo source code
antd token DatePicker               # Design Token values (v5+)
antd semantic Table                 # classNames / styles structure
antd changelog 4.24.0 5.0.0 Select  # API diff across versions
antd doctor                         # Diagnose project issues
antd lint ./src                     # Check deprecated APIs & best practices
antd migrate 4 5 --apply ./src      # Agent-ready migration prompt
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
| [`antd semantic <Component>`](#antd-semantic-component) | Semantic `classNames` / `styles` structure with usage examples |
| [`antd changelog`](#antd-changelog-v1-v2-component) | Changelog entries, version ranges, or cross-version API diff |

### 🔍 Project Analysis

| Command | Description |
|---|---|
| [`antd doctor`](#antd-doctor) | 10 diagnostic checks: React compat, duplicates, peer deps, SSR, babel plugins |
| [`antd usage [dir]`](#antd-usage-dir) | Import stats, sub-component breakdown (`Form.Item`), non-component exports |
| [`antd lint [target]`](#antd-lint-target) | Deprecated APIs, accessibility gaps, performance issues, best practices |
| [`antd migrate <from> <to>`](#antd-migrate-from-to) | Migration checklist with auto-fixable/manual split and `--apply` agent prompt |

### 🐛 Issue Reporting

| Command | Description |
|---|---|
| [`antd bug`](#antd-bug) | File a bug to ant-design/ant-design with auto-collected environment info |
| [`antd bug-cli`](#antd-bug-cli) | File a bug to ant-design/ant-design-cli |

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
```

### `antd migrate <from> <to>`

v4→v5 covers 25+ migration steps; v5→v6 covers 30+. Each step includes component name, breaking flag, search pattern, and before/after code.

```bash
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

<br>

## 📄 License

[MIT](./LICENSE) © [Ant Design](https://ant.design)
