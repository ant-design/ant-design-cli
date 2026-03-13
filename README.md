# @ant-design/cli

[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)

CLI tool for querying antd knowledge and analyzing antd usage in projects. Designed for Code Agents (Claude Code, Cursor, Copilot, etc.) to invoke via shell and parse structured output.

## Features

- **Agent-First** — Structured JSON output designed for Code Agents (Claude Code, Cursor, Copilot) to parse and act on directly
- **Offline-First** — All metadata is fully bundled in the package — no network required at runtime
- **Multi-Version** — Full support for antd v4 / v5 / v6, with cross-version API diffing and migration guides
- **Bundled Knowledge** — Key components covered: props, tokens, demos, semantic structure, and changelog
- **Project-Aware** — Auto-detects your antd version, scans usage, lints best practices, and diagnoses configuration issues
- **Agent Migration** — `antd migrate --apply` outputs a structured migration prompt with before/after examples for Code Agents to execute

## Install

```bash
npm install -g @ant-design/cli
```

## Commands

### Knowledge Query

#### `antd list`

List all components with one-line descriptions and categories.

```bash
antd list
antd list --format json
antd list --version 5.0.0
```

#### `antd info <Component>`

Query component API: props, type definitions, default values.

```bash
antd info Button
antd info Button --detail
antd info Button --version 4.24.0
antd info Button --format json
```

#### `antd demo <Component> [name]`

Get demo source code.

```bash
antd demo Button                    # list all demos for Button
antd demo Button basic              # get specific demo code
antd demo Button basic --format json
```

#### `antd token [component]`

Query Design Tokens.

```bash
antd token                          # list all global tokens
antd token Button                   # component-level tokens
antd token --version 4.24.0
```

#### `antd search <keyword>`

Full-text search across component docs, demos, FAQ, and changelog.

```bash
antd search "virtual scroll"
antd search "form validation" --format json
```

#### `antd semantic <Component>`

Query the semantic customization structure (`classNames` and `styles` keys).

```bash
antd semantic Table
antd semantic Table --format json
```

#### `antd changelog [version]`

Query changelog entries and compare API differences between versions.

```bash
antd changelog 5.22.0              # exact version
antd changelog 5.21.0..5.24.0      # version range (both ends inclusive)
antd changelog --format json
```

### Project Analysis

#### `antd doctor`

Diagnose project-level configuration issues.

```bash
antd doctor
antd doctor --format json
```

#### `antd usage [dir]`

Scan project for antd component/API usage statistics.

```bash
antd usage                          # scan current directory
antd usage ./src                    # scan specific directory
antd usage --format json
```

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

#### `antd migrate <from> <to>`

Version migration guide with optional auto-fix.

```bash
antd migrate 4 5                          # full migration checklist
antd migrate 4 5 --component Select       # component-specific migration
antd migrate 4 5 --apply ./src            # output agent migration prompt for ./src
antd migrate 4 5 --format json            # structured output for agents
```

## Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format | `text` |
| `--version <v>` | Target antd version | auto-detect |
| `--lang en\|zh` | Output language | `en` |
| `--detail` | Full information output | `false` |

## Examples

### `antd list`

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

### `antd info Button`

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

### `antd search "virtual scroll"`

```
Search results for "virtual scroll":

  [81%] Table (FAQ)
    How to use virtual scroll?
  [77%] Select (props)
    virtual — Disable virtual scroll when set to false
  [20%] Table (props)
    virtual — Support virtual list
```

### `antd semantic Table`

```
Table Semantic Structure:
├── header         # Table header area
├── body         # Table body area
├── footer         # Table footer area
├── cell         # Table cell
├── row         # Table row
└── wrapper         # Outer wrapper

Usage:
  <Table classNames={{ header: 'my-header' }} />
  <Table styles={{ header: { background: '#fff' } }} />
```

### `antd migrate 4 5 --component Select`

```
Migration Guide: v4 → v5

  Select:
    🔧 [BREAKING] Prop `dropdownClassName` renamed to `popupClassName`
    🔧 [BREAKING] Prop `dropdownMatchSelectWidth` renamed to `popupMatchSelectWidth`

Total: 2 steps (2 auto-fixable, 0 manual)
```

### `antd token Button`

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
