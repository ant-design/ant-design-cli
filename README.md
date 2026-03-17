<div align="center">

# @ant-design/cli

[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**CLI tool for querying antd component knowledge and analyzing antd usage in your projects.**

Designed for Code Agents (Claude Code, Cursor, Copilot, etc.) to invoke via shell and parse structured output.

[English](./README.md) · [中文](./README.zh-CN.md)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **Agent-Ready** | Every command supports `--format json` with clean, parseable output and structured error codes — built for Claude Code, Cursor, and Copilot tool calls |
| 📋 **Multi-Format Output** | Every command supports `--format text\|json\|markdown` — aligned tables for humans, JSON for scripts and agents, Markdown for docs and reports |
| 📦 **Fully Offline** | Props, tokens, demos, and changelogs for v4/v5/v6 are all bundled at install — no network calls, no latency |
| 🔀 **Multi-Version** | Query any antd version; diff APIs between two versions; browse changelogs with categorized change types (feature / fix / breaking / deprecation) |
| 🧠 **Deep Component Data** | Props with types and defaults; Design Tokens; runnable demo source code; semantic `classNames` / `styles` structure — all queryable from the terminal |
| 🔍 **Project Analysis** | Scan component usage stats; lint deprecated props, a11y gaps, and performance pitfalls; `doctor` diagnoses React compat, duplicate installs, and config issues |
| 🚚 **Migration Guides** | Detailed v4→v5 and v5→v6 checklists with auto-fixable / manual split; `--apply` generates an agent-ready prompt for automated execution |

## 📦 Install

```bash
# npm
npm install -g @ant-design/cli

# pnpm
pnpm add -g @ant-design/cli

# bun
bun add -g @ant-design/cli

# utoo
utoo install @ant-design/cli
```

## 🚀 Quick Start

```bash
# Query a component's API
antd info Button

# List all components
antd list

# Scan antd usage in your project
antd usage ./src

# Migrate from v4 to v5
antd migrate 4 5
```

## 📖 Commands

### Knowledge Query

#### `antd list`

List all components with one-line descriptions and categories.

```bash
antd list
antd list --format json
antd list --version 5.0.0
```

<details>
<summary>Example output</summary>

```
Component  Category      Description
---------  ------------  -----------------------------------------------------------
Button     General       To trigger an operation.
Table      Data Display  A table displays rows of data.
Select     Data Entry    Select component to select value from options.
Input      Data Entry    A basic widget for getting the user input as a text field.
Form       Data Entry    High performance Form component with data scope management.
Modal      Feedback      Modal dialogs.
Space      Layout        Set components spacing.
Flex       Layout        Flex layout container.
Grid       Layout        24 Grids System.
```

</details>

---

#### `antd info <Component>`

Query component API: props, type definitions, default values.

```bash
antd info Button
antd info Button --detail
antd info Button --version 4.24.0
antd info Button --format json
```

<details>
<summary>Example output</summary>

```
Button — To trigger an operation.

Property      Type                                              Default
------------  ------------------------------------------------  -------
block         boolean                                           false
classNames    Record<SemanticDOM, string>                       -
color         default | primary | danger                        default
danger        boolean                                           false
disabled      boolean                                           false
ghost         boolean                                           false
href          string                                            -
htmlType      submit | reset | button                           button
icon          ReactNode                                         -
iconPosition  start | end                                       start
loading       boolean | { delay: number }                       false
shape         default | circle | round                          default
size          large | middle | small                            middle
styles        Record<SemanticDOM, CSSProperties>                -
target        string                                            -
type          primary | default | dashed | text | link          default
variant       outlined | dashed | solid | filled | text | link  -
onClick       (event: React.MouseEvent) => void                 -
```

</details>

---

#### `antd demo <Component> [name]`

Get demo source code.

```bash
antd demo Button                    # list all demos for Button
antd demo Button basic              # get specific demo code
antd demo Button basic --format json
```

---

#### `antd token [component]`

Query Design Tokens.

```bash
antd token                          # list all global tokens
antd token Button                   # component-level tokens
antd token --version 4.24.0
```

<details>
<summary>Example output</summary>

```
Button Component Tokens:

Token                Type    Default
-------------------  ------  ----------------
borderColorDisabled  string  #d9d9d9
colorPrimaryHover    string  #4096ff
contentFontSize      number  14
defaultBg            string  #ffffff
defaultBorderColor   string  #d9d9d9
defaultColor         string  rgba(0,0,0,0.88)
paddingBlock         number  4
paddingInline        number  15
```

</details>

---

#### `antd semantic <Component>`

Query the semantic customization structure (`classNames` and `styles` keys).

```bash
antd semantic Table
antd semantic Table --format json
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

---

#### `antd changelog [version]`

Query changelog entries and compare API differences between versions.

```bash
antd changelog 5.22.0              # exact version
antd changelog 5.21.0..5.24.0     # version range (both ends inclusive)
antd changelog --format json
```

---

### Project Analysis

#### `antd doctor`

Diagnose project-level configuration issues.

```bash
antd doctor
antd doctor --format json
```

---

#### `antd usage [dir]`

Scan project for antd component/API usage statistics.

```bash
antd usage                          # scan current directory
antd usage ./src                    # scan specific directory
antd usage --format json
```

---

#### `antd lint [file/dir]`

Check antd usage against best practices.

```bash
antd lint ./src
antd lint ./src/pages/home.tsx
antd lint --only deprecated         # only check deprecated APIs
antd lint --only a11y               # only check accessibility
antd lint --only performance        # only check performance
antd lint --only best-practice      # only check best practices
antd lint --format json
```

---

#### `antd migrate <from> <to>`

Version migration guide with optional auto-fix.

```bash
antd migrate 4 5                          # full migration checklist
antd migrate 4 5 --component Select       # component-specific migration
antd migrate 4 5 --apply ./src            # output agent migration prompt for ./src
antd migrate 4 5 --format json            # structured output for agents
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

---

## ⚙️ Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format | `text` |
| `--version <v>` | Target antd version | auto-detect |
| `--lang en\|zh` | Output language | `en` |
| `--detail` | Full information output | `false` |
| `-V, --cli-version` | Print CLI version number | — |

## 🤖 Use with AI Agents

Add the following to your `CLAUDE.md` (or equivalent agent config) to let your Code Agent automatically invoke the CLI for antd-related queries:

````markdown
## Ant Design

Use `@ant-design/cli` to query antd component knowledge:

- `antd info <Component>` — get props, types, and defaults
- `antd demo <Component> [name]` — get demo source code
- `antd token <Component>` — get design tokens
- `antd migrate 4 5 --apply ./src` — generate migration instructions
- `antd lint ./src` — check for best practice violations

Always prefer `--format json` for programmatic parsing.
````

## 📄 License

[MIT](./LICENSE) © Ant Design
