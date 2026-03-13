# @ant-design/cli

[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)

CLI tool for querying antd knowledge and analyzing antd usage in projects. Designed for Code Agents (Claude Code, Cursor, Copilot, etc.) to invoke via shell and parse structured output.

## Features

- **Agent-First** — Structured JSON output designed for Code Agents (Claude Code, Cursor, Copilot) to parse and act on directly
- **Offline-First** — Local metadata cache with on-demand fetch, no network required for cached queries
- **Multi-Version** — Full support for antd v4 / v5 / v6+, with cross-version API diffing and migration guides
- **Complete Knowledge** — Components, props, tokens, demos, semantic structure, and changelog in one place
- **Project-Aware** — Auto-detects your antd version, scans usage, lints best practices, and diagnoses configuration issues
- **Auto-Fix Migration** — `antd migrate --apply` runs codemods with dry-run safety, git stash backup, and before/after diffs

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
antd changelog 6.3.0               # exact version
antd changelog 5.10.0..5.20.0      # version range
antd changelog diff 4.24.0 5.0.0   # API diff between versions
antd changelog diff 4.24.0 5.0.0 Select  # component-specific diff
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
antd migrate 4 5                    # full migration checklist
antd migrate 4 5 --component Select # component-specific migration
antd migrate 4 5 --apply ./src      # auto-fix (dry-run first)
antd migrate --format json
```

## Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format | `text` |
| `--version <v>` | Target antd version | auto-detect |
| `--lang en\|zh` | Output language | `en` |
| `--no-cache` | Skip local cache | `false` |
| `--detail` | Full information output | `false` |
