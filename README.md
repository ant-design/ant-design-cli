<div align="center">

# @ant-design/cli

[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**CLI tool for querying Ant Design component knowledge and analyzing antd usage in projects.**

Built for Code Agents (Claude Code, Cursor, Copilot, Codex, Gemini CLI) — structured output, fully offline, zero config.

[English](./README.md) · [中文](./README.zh-CN.md)

</div>

---

## Features

- **Agent-Ready** — Every command supports `--format json` with clean, parseable output and structured error codes
- **Fully Offline** — Props, tokens, demos, and changelogs for v4 / v5 / v6 are bundled at install time
- **Multi-Version** — Query any antd version with per-minor snapshots; diff APIs between two versions
- **Deep Component Data** — Props, Design Tokens, demo source code, semantic `classNames` / `styles` structure
- **Project Analysis** — Usage scanning, deprecated API linting, a11y checks, `doctor` diagnostics
- **Migration Guides** — v4→v5 and v5→v6 checklists with auto-fixable / manual split

## Install

```bash
npm install -g @ant-design/cli
```

Or install as a [skill](https://github.com/nicepkg/agent-skills) for your code agent:

```bash
npx skills add ant-design/ant-design-cli
```

## Quick Start

```bash
antd info Button                    # Query component API
antd list                           # List all components
antd demo Button basic              # Get demo source code
antd token Button                   # Query Design Tokens
antd changelog 4.24.0 5.0.0 Select  # Diff API between versions
antd usage ./src                    # Scan antd usage in project
antd doctor                         # Diagnose project issues
antd migrate 4 5                    # Migration guide v4 → v5
```

## Commands

### Knowledge Query

#### `antd list`

List all components with descriptions and categories.

```bash
antd list
antd list --version 5.0.0
antd list --format json
```

<details>
<summary>Example output</summary>

```
Component       组件名    Description                                               Since
--------------  -----  -------------------------------------------------------  ------
Button          按钮     To trigger an operation.                                  4.0.0
Table           表格     A table displays rows of data.                            4.0.0
Form            表单     High performance Form component with data scope management. 4.0.0
Select          选择器    Select component to select value from options.            4.0.0
Modal           对话框    Modal dialogs.                                            4.0.0
DatePicker      日期选择框  To select or input a date.                               4.0.0
Input           输入框    A basic widget for getting the user input.                4.0.0
...
```

</details>

---

#### `antd info <Component>`

Query component API: props, type definitions, default values. Use `--detail` for full docs including descriptions, `since` versions, deprecated status, and FAQ.

```bash
antd info Button
antd info Button --detail
antd info Button --version 4.24.0
antd info Button --format json
```

<details>
<summary>Example output</summary>

```
Button (按钮) — To trigger an operation.

Property         Type                                                        Default   Since
---------------  ----------------------------------------------------------  --------  ------
autoInsertSpace  boolean                                                     true      5.17.0
block            boolean                                                     false     -
classNames       Record<SemanticDOM, string>                                 -         5.4.0
danger           boolean                                                     false     -
disabled         boolean                                                     false     -
ghost            boolean                                                     false     -
href             string                                                      -         -
htmlType         submit | reset | button                                     button    -
icon             ReactNode                                                   -         -
iconPosition     start | end                                                 start     5.17.0
loading          boolean | { delay: number, icon: ReactNode }                false     -
shape            default | circle | round                                    default   -
size             large | middle | small                                      middle    -
styles           Record<SemanticDOM, CSSProperties>                          -         5.4.0
type             primary | default | dashed | text | link                    default   -
variant          outlined | dashed | solid | filled | text | link            -         5.13.0
onClick          (event: React.MouseEvent) => void                           -         -
```

</details>

---

#### `antd doc <Component>`

Output full API documentation for a component in markdown.

```bash
antd doc Button                     # full markdown docs to stdout
antd doc Button --format json       # structured { name, doc }
antd doc Button --lang zh           # Chinese docs
```

---

#### `antd demo <Component> [name]`

Get demo source code. Without a name, lists all available demos.

```bash
antd demo Button                    # list all demos for Button
antd demo Button basic              # get specific demo source code
antd demo Button basic --format json
```

---

#### `antd token [component]`

Query Design Tokens (v5+ only).

```bash
antd token                          # list all global tokens
antd token Button                   # component-level tokens
antd token --format json
```

<details>
<summary>Example output</summary>

```
Button Component Tokens:

Token                     Type    Default
------------------------  ------  -------
contentFontSize           number
contentFontSizeLG         number
contentFontSizeSM         number
dangerColor               string
dangerShadow              string
defaultActiveBg           string
defaultActiveBorderColor  string
defaultActiveColor        string
defaultBg                 string
...
```

</details>

---

#### `antd semantic <Component>`

Query the semantic customization structure — available `classNames` and `styles` keys.

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

#### `antd changelog [v1] [v2] [component]`

Query changelog entries, view version ranges, or diff API between two versions.

```bash
antd changelog 5.22.0               # single version changelog
antd changelog 5.21.0..5.24.0       # version range (inclusive)
antd changelog 4.24.0 5.0.0         # diff all API changes between versions
antd changelog 4.24.0 5.0.0 Select  # diff Select API only
antd changelog --format json
```

---

### Project Analysis

#### `antd doctor`

Diagnose project-level configuration issues: React compatibility, duplicate installs, theme config, babel plugins, CSS-in-JS setup.

```bash
antd doctor
antd doctor --format json
```

---

#### `antd usage [dir]`

Scan project for antd component/API usage statistics. Detects imports, sub-components (`Form.Item`), and non-component exports (`message`, `theme`).

```bash
antd usage                          # scan current directory
antd usage ./src                    # scan specific directory
antd usage -f Button                # filter to a specific component
antd usage --format json
```

---

#### `antd lint [file/dir]`

Check antd usage against best practices. Complements ESLint with antd-specific knowledge.

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

Version migration guide with auto-fixable / manual breakdown.

```bash
antd migrate 4 5                    # full migration checklist
antd migrate 4 5 --component Select # component-specific migration
antd migrate 4 5 --apply ./src      # output agent migration prompt
antd migrate 4 5 --format json
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

### Issue Reporting

#### `antd bug`

Report a bug to `ant-design/ant-design`. Auto-collects environment info.

```bash
antd bug --title "DatePicker crashes with dayjs 2.0"
antd bug --title "..." --steps "1. Click button" --expected "Works" --actual "Crashes"
antd bug --title "..." --reproduction "https://codesandbox.io/s/xxx"
antd bug --title "..." --submit          # submit via gh CLI
```

#### `antd bug-cli`

Report a bug to `ant-design/ant-design-cli`.

```bash
antd bug-cli --title "antd info crashes on v4 components"
antd bug-cli --title "..." --submit
```

---

## Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format | `text` |
| `--version <v>` | Target antd version (e.g. `5.20.0`) | auto-detect |
| `--lang en\|zh` | Output language | `en` |
| `--detail` | Full information output | `false` |
| `-V, --cli-version` | Print CLI version number | — |

## Use with Code Agents

The CLI ships with a [skill file](./skills/antd/SKILL.md) that teaches code agents when and how to use each command. One command to install:

```bash
npx skills add ant-design/ant-design-cli
```

Works with Claude Code, Cursor, Codex, Gemini CLI, and any agent that supports the [skills](https://github.com/nicepkg/agent-skills) protocol.

## License

[MIT](./LICENSE) © Ant Design
