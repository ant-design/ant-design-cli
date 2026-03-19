# @ant-design/cli Design Spec

## Overview

A CLI tool for Code Agents to query antd knowledge and analyze antd usage in projects. Agents invoke it via shell commands and parse structured output (JSON/text/markdown) to assist developers working with antd.

## Product Positioning

- **Target user**: Code Agents (Claude Code, Cursor, Copilot, etc.)
- **Invocation**: Pure CLI, agents execute via shell
- **Data strategy**: Bundled — all metadata is included in the CLI package, no remote fetch required
- **Output principle**: Concise by default, `--detail` for full information

## Package Structure

Single package:

| Package | Purpose |
|---|---|
| `@ant-design/cli` | CLI logic, globally installed, provides `antd` command |

### Bundled Data

Metadata for all major versions is bundled inside `@ant-design/cli`:

```
@ant-design/cli
└── data/
    ├── versions.json        # version index: minor series → snapshot tag
    ├── v4.json              # latest v4 (from highest v4.x tag)
    ├── v4.0.9.json          # snapshot for 4.0.x series
    ├── v4.1.5.json          # snapshot for 4.1.x series
    ├── ...                  # one file per minor series
    ├── v4.24.16.json        # snapshot for 4.24.x series
    ├── v5.json              # latest v5
    ├── v5.0.7.json          # snapshot for 5.0.x series
    ├── ...
    ├── v6.json              # latest v6
    └── ...
```

**`data/versions.json`** maps each minor series to its representative snapshot tag:

```json
{
  "v4": { "4.0": "4.0.9", "4.1": "4.1.5", "4.24": "4.24.16" },
  "v5": { "5.0": "5.0.7", "5.29": "5.29.3" },
  "v6": { "6.3": "6.3.2" }
}
```

### Version Snapshot Resolution

When `--version 4.3.5` is requested, `loadMetadataForVersion("4.3.5")` resolves the best snapshot:

1. **Exact minor match** — look up `"4.3"` in `versions.json["v4"]` → e.g. `"4.3.4"` → load `data/v4.3.4.json`
2. **Nearest earlier minor** — if `"4.3"` is absent, find the largest available minor ≤ 4.3 (e.g. `"4.1"`) → load that snapshot
3. **Fallback** — load `data/v4.json` (latest)

### Data Layer Notes

- Each version file contains both `en` and `zh` descriptions, keyed by language
- `semantic` data extracted from `components/*/demo/_semantic.tsx` files
- Data is auto-extracted from antd source via `scripts/extract.ts`
- A GitHub Actions workflow (`sync.yml`) runs daily: for each major version it extracts the latest snapshot and any new minor-series snapshots, then updates `versions.json`
- Historical snapshots can be bootstrapped locally via `scripts/bootstrap-snapshots.ts`
- CLI version aligns with the latest antd version (e.g., antd 6.3.2 → CLI 6.3.2)
- The components schema is consistent across major versions to enable cross-version diffing

## Commands (12)

### Knowledge Query (8)

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
antd info Button                          # concise: props name, type, default
antd info Button --detail                 # full: + description, since, deprecated, FAQ
antd info Button --version 4.24.0         # v4 API
antd info Button --format json            # structured output for agents
```

JSON output (concise):
```json
{
  "name": "Splitter",
  "description": "Split panels to isolate",
  "props": [
    {"name": "layout", "type": "`horizontal` | `vertical`", "default": "`horizontal`"},
    {"name": "lazy", "type": "`boolean`", "default": "`false`"}
  ],
  "subComponentProps": {
    "Splitter.Panel": [
      {"name": "defaultSize", "type": "`number | string`", "default": "-"},
      {"name": "resizable", "type": "`boolean`", "default": "`true`"}
    ]
  }
}
```

For components without sub-components (e.g. Button), `subComponentProps` is omitted.

JSON output (--detail):
```json
{
  "name": "Button",
  "description": "To trigger an operation.",
  "whenToUse": "A button means an operation (or a series of operations)...",
  "props": [
    {
      "name": "type",
      "type": "primary | default | dashed | text | link",
      "default": "default",
      "description": "Set button type",
      "since": "1.0.0",
      "deprecated": false,
      "required": false
    }
  ],
  "methods": [],
  "related": ["Button.Group", "Dropdown.Button"],
  "faq": []
}
```

Text output for components with sub-components shows main props first, then each sub-component section labeled with its full name (e.g. `Splitter.Panel`).

#### `antd doc <Component>`

Output the full API documentation for a component in markdown format. Useful for agents that need the complete component reference in one call.

```bash
antd doc Button                          # output full markdown docs to stdout
antd doc Button --format json            # structured output with name and doc fields
antd doc Button --lang zh                # Chinese documentation
```

JSON output:
```json
{
  "name": "Button",
  "doc": "## Button\n\nTo trigger an operation.\n\n### When To Use\n..."
}
```

For text and markdown formats, the raw markdown content is written directly to stdout with no additional decoration. Returns error `DOC_NOT_AVAILABLE` if documentation is not available for the component (e.g. older CLI versions without doc data).

#### `antd demo <Component> [name]`

Get demo source code. Returns TSX code and its markdown description.

```bash
antd demo Button                    # list all demos for Button
antd demo Button basic              # get specific demo code
antd demo Button basic --format json
```

JSON output:
```json
{
  "component": "Button",
  "demo": "basic",
  "title": "Basic Usage",
  "description": "There are `primary` button, `default` button, `dashed` button, `text` button and `link` button in antd.",
  "code": "import React from 'react';\nimport { Button } from 'antd';\n\nconst App: React.FC = () => (\n  <Button type=\"primary\">Primary Button</Button>\n);\n\nexport default App;"
}
```

#### `antd token [component]`

Query Design Tokens.

```bash
antd token                          # list all global tokens
antd token Button                   # component-level tokens with defaults
antd token --version 4.24.0         # v4 has no token system, shows a hint
```


#### `antd semantic <Component>`

Query the semantic customization structure of a component — the available `classNames` and `styles` keys. Data extracted from `components/*/demo/_semantic.tsx` files.

```bash
antd semantic Table
antd semantic Table --format json
```

Output (text):
```
Table Semantic Structure:
├── header         # Table header area
├── body           # Table body area
├── footer         # Table footer area
├── cell           # Table cell
├── row            # Table row
└── wrapper        # Outer wrapper

Usage:
  <Table classNames={{ header: 'my-header', cell: 'my-cell' }} />
  <Table styles={{ header: { background: '#fff' } }} />
```

Output (json):
```json
{
  "name": "Table",
  "semanticStructure": [
    {"key": "header", "description": "Table header area"},
    {"key": "body", "description": "Table body area"},
    {"key": "footer", "description": "Table footer area"},
    {"key": "cell", "description": "Table cell"},
    {"key": "row", "description": "Table row"},
    {"key": "wrapper", "description": "Outer wrapper"}
  ]
}
```

#### `antd changelog [version]`

Query changelog entries and compare API differences between versions.

```bash
antd changelog 6.3.0               # exact version
antd changelog 5.10.0..5.20.0      # version range (inclusive, must be full semver)
antd changelog --format json
antd changelog diff 4.24.0 5.0.0             # all breaking changes
antd changelog diff 4.24.0 5.0.0 Select      # Select-specific changes
```

Version range uses `<from>..<to>` syntax (inclusive on both ends). Both `from` and `to` must be full semver (e.g. `5.10.0`, not `5.10`). Single version returns only that exact version's entries.

API diff mode (`changelog diff`) output includes: added props, removed props, changed types, renamed props. Cross-major-version diffing (e.g. v4 vs v5) is supported because the components schema is consistent across versions.

### Project Analysis (4)

#### `antd doctor`

Diagnose project-level configuration issues.

```bash
antd doctor                         # run in project root
antd doctor --format json
```

Checks:
- antd version compatibility with React/Node versions
- Duplicate antd installations
- Theme config validity
- CSS-in-JS configuration correctness
- Babel/webpack antd-related plugin configuration
- `dayjs-duplicate` — detects multiple dayjs installations in node_modules; severity: error
- `cssinjs-duplicate` — detects multiple @ant-design/cssinjs installations in node_modules; severity: error
- `cssinjs-compat` — checks @ant-design/cssinjs version satisfies antd peerDependencies range; severity: error (incompatible version) / warning (not installed)
- `icons-compat` — checks @ant-design/icons version satisfies antd peerDependencies range; severity: warning (icons are optional)

JSON output:
```json
{
  "version": "5.20.0",
  "checks": [
    {"name": "react-compat", "status": "pass", "message": "React 18.2.0 is compatible with antd 5.20.0"},
    {"name": "duplicate-install", "status": "fail", "severity": "error", "message": "Found 2 antd installations: 5.20.0, 5.18.0", "suggestion": "Run `npm dedupe` or check your dependency tree"},
    {"name": "theme-config", "status": "pass", "message": "Theme config is valid"},
    {"name": "cssinjs", "status": "warn", "severity": "warning", "message": "No @ant-design/cssinjs found, SSR style extraction will not work"},
    {"name": "dayjs-duplicate", "status": "fail", "severity": "error", "message": "Found 2 dayjs installations", "suggestion": "Run `npm dedupe` to resolve duplicate dayjs versions"},
    {"name": "cssinjs-duplicate", "status": "fail", "severity": "error", "message": "Found 2 @ant-design/cssinjs installations", "suggestion": "Run `npm dedupe` to resolve duplicate @ant-design/cssinjs versions"},
    {"name": "cssinjs-compat", "status": "fail", "severity": "error", "message": "@ant-design/cssinjs 1.5.0 does not satisfy antd peer requirement >=1.11.0", "suggestion": "Run `npm install @ant-design/cssinjs` (requires >=1.11.0)"},
    {"name": "icons-compat", "status": "warn", "severity": "warning", "message": "@ant-design/icons 5.0.0 does not satisfy antd peer requirement >=5.1.0", "suggestion": "Run `npm install @ant-design/icons` (requires >=5.1.0)"}
  ],
  "summary": {"pass": 2, "warn": 2, "fail": 3}
}
```

#### `antd usage [dir]`

Scan project for antd component/API usage statistics. Detects direct imports (`import { Button } from 'antd'`), sub-component usage (`Form.Item`, `Table.Column`), and named imports from sub-paths.

```bash
antd usage                          # scan current directory
antd usage ./src                    # scan specific directory
antd usage --filter Button          # filter results to a specific component
antd usage ./src -f Form            # combine directory and filter
antd usage --format json
```

JSON output:
```json
{
  "scanned": 42,
  "components": [
    {"name": "Button", "imports": 18, "files": ["src/pages/home.tsx", "src/components/Header.tsx"]},
    {"name": "Form", "imports": 12, "subComponents": {"Form.Item": 35, "Form.List": 3}},
    {"name": "Table", "imports": 8, "files": ["src/pages/list.tsx"]}
  ],
  "summary": {"totalComponents": 15, "totalImports": 87}
}
```

#### `antd lint [file/dir]`

Check antd usage against best practices. Uses AST parsing (TypeScript compiler API) to analyze source files.

```bash
antd lint ./src
antd lint ./src/pages/home.tsx
antd lint --only deprecated         # only check deprecated APIs
antd lint --only a11y               # only check accessibility
antd lint --only performance        # only check performance
antd lint --only best-practice      # only check best practices
antd lint --format json
```

JSON output:
```json
{
  "issues": [
    {
      "file": "src/pages/home.tsx",
      "line": 12,
      "rule": "deprecated",
      "severity": "warning",
      "message": "Button `ghost` prop is deprecated since 5.12.0, use `variant=\"outlined\"` instead"
    }
  ],
  "summary": {"total": 1, "deprecated": 1, "a11y": 0, "performance": 0, "best-practice": 0}
}
```

Note: This is complementary to ESLint. `antd lint` focuses on antd-specific knowledge (deprecated APIs per version, antd best practices) that generic ESLint rules cannot cover.

#### `antd migrate <from> <to>`

Version migration guide with optional auto-fix.

```bash
antd migrate 4 5                    # full migration checklist
antd migrate 4 5 --component Select # Select-specific migration
antd migrate 4 5 --apply ./src      # auto-fix what can be auto-fixed
antd migrate --format json
```

Safety model for `--apply`:
- Always runs in **dry-run mode** first, printing changes before applying
- Requires explicit `--apply --confirm` to actually write files
- Creates a git stash backup before writing (`antd-migrate-backup-<timestamp>`)
- Reports every file changed with before/after diff
- Delegates to existing `@ant-design/codemod-v5` / `@ant-design/codemod-v6` packages for actual transforms
- If no codemod package is available for the target version, falls back to guide-only mode

JSON output (guide mode):
```json
{
  "from": "4",
  "to": "5",
  "steps": [
    {
      "component": "Select",
      "breaking": true,
      "description": "Prop `dropdownClassName` renamed to `popupClassName`",
      "autoFixable": true,
      "codemod": "v5-props-changed-migration"
    },
    {
      "component": "Global",
      "breaking": true,
      "description": "Less variables removed, use Design Token instead",
      "autoFixable": false,
      "guide": "See https://ant.design/docs/react/migrate-less-variables"
    }
  ],
  "summary": {"total": 42, "autoFixable": 28, "manual": 14}
}
```

## Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format. `json` includes all data with no decoration. | `text` |
| `--version <v>` | Target antd version (full semver, e.g. `5.20.0`) | auto-detect from project |
| `--lang en\|zh` | Output language | `en` |
| `--detail` | Full information output (more fields in response) | `false` |

Note: `--quiet` removed. `--format json` already provides clean structured output for agents. `--format text` is for human-readable output and always includes formatting.

## Version Detection

Priority order:

1. `--version` flag (highest)
2. Installed version in `node_modules/antd/package.json`
3. Declared version in project `package.json` dependencies
4. Latest stable version (fallback)

Resolution: The CLI maps the resolved version to a major version data directory (e.g. `5.20.0` → `v5/`), then filters props/tokens by `since` and `deprecated` fields against the exact version. If the resolved version does not exist as a published antd version (e.g. `5.999.0`), the CLI warns and uses the latest known version within that major.

## Error Handling

All commands return a standard error shape when they fail:

```json
{
  "error": true,
  "code": "COMPONENT_NOT_FOUND",
  "message": "Component 'Btn' not found",
  "suggestion": "Did you mean 'Button'?"
}
```

Exit codes:
- `0` — success
- `1` — user error (invalid args, component not found)
- `2` — system error (file read failure, data corruption)

Common error codes: `COMPONENT_NOT_FOUND`, `VERSION_NOT_FOUND`, `NO_PROJECT_DETECTED`, `UNSUPPORTED_VERSION_FEATURE` (e.g. tokens for v4).

## Technical Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  CLI Layer   │────>│  Data Layer  │────>│  Data Sources    │
│              │     │              │     │                  │
│  12 commands │     │  Version     │     │  Bundled data    │
│  Flag parse  │     │   routing    │     │  data/v4,v5,v6   │
│  Output fmt  │     │  Filtering   │     │  (JSON files)    │
└─────────────┘     └──────────────┘     └──────────────────┘
```

### Tech Stack

- Language: TypeScript + Node.js
- CLI framework: `commander`
- Minimum Node version: 18+
- Package name: `@ant-design/cli`
- Global command: `antd`

### Data Extraction Pipeline

The extraction script `scripts/extract.ts` runs against an antd source checkout to produce bundled JSON files:

```bash
npx tsx scripts/extract.ts --antd-dir ~/Projects/ant-design --output data/v6.json
```

Extraction sources:

| Data | Source | Method |
|------|--------|--------|
| Component list, category, description | `components/*/index.{en-US,zh-CN}.md` frontmatter | `gray-matter` YAML parsing |
| When To Use | `index.{en-US,zh-CN}.md` `## When To Use` section | Markdown section extraction |
| Props | `index.{en-US,zh-CN}.md` `## API` tables | Markdown table parsing |
| Demos | `components/*/demo/*.tsx` + `*.md` | File read + bilingual md parsing |
| Tokens | `components/version/token-meta.json` | Direct JSON read |
| Semantic | `components/*/demo/_semantic.tsx` | Regex extraction of locales + semantics |
| Changelog | `CHANGELOG.{en-US,zh-CN}.md` | Markdown heading/emoji parsing |
| FAQ | `index.{en-US,zh-CN}.md` `## FAQ` section | Markdown section extraction |

Extractors are organized as `scripts/extractors/*.ts` modules (components, props, demos, tokens, semantic, changelog, faq).

### Update Check

After each command completes, the CLI silently checks whether a newer version is available on npm and prints a notice to **stderr** if so. The check runs at most once per 24 hours; results are cached locally.

**Cache file:** `~/.config/antd-cli/update-check.json`

```json
{ "lastChecked": 1710000000000, "latestVersion": "0.2.0" }
```

**Notice format (stderr only):**

```
╭────────────────────────────────────────╮
│  Update available: 0.1.1 → 0.2.0       │
│  Run: npm i -g @ant-design/cli          │
╰────────────────────────────────────────╯
```

**Behavior details:**

- Skipped when `CI=1` or `NO_UPDATE_CHECK=1` is set
- Uses `registry.npmjs.org` with a 3 s timeout; failures are silent
- Output goes to **stderr**, so `--format json` stdout is never polluted
- No new production dependencies — uses only built-in Node modules (`node:https`, `node:fs`, `node:os`, `node:path`)

### Automated Data Sync

GitHub Actions workflow `.github/workflows/sync.yml` runs daily:

1. For each major version (v4, v5, v6), find the latest antd release tag via `git ls-remote`
2. Checkout antd source at that tag
3. Run `scripts/extract.ts` to generate new data
4. If data changed, commit and push
5. Align CLI version with the latest antd version and publish to npm

The CLI version is kept in sync with antd — e.g., when antd publishes v6.3.2, the CLI is also published as v6.3.2.

## Output Examples

### `antd info Table --format json` (concise)

```json
{
  "name": "Table",
  "description": "A table displays rows of data.",
  "props": [
    {"name": "columns", "type": "ColumnsType<T>", "default": "-"},
    {"name": "dataSource", "type": "T[]", "default": "-"},
    {"name": "loading", "type": "boolean | SpinProps", "default": "false"},
    {"name": "pagination", "type": "false | TablePaginationConfig", "default": "-"},
    {"name": "rowKey", "type": "string | (record) => string", "default": "key"},
    {"name": "rowSelection", "type": "object", "default": "-"},
    {"name": "scroll", "type": "{x, y}", "default": "-"},
    {"name": "size", "type": "large | middle | small", "default": "large"}
  ]
}
```

### `antd diff 4.24.0 5.0.0 Select --format json`

```json
{
  "component": "Select",
  "from": "4.24.0",
  "to": "5.0.0",
  "added": [
    {"name": "popupClassName", "type": "string"}
  ],
  "removed": [
    {"name": "dropdownClassName", "replacement": "popupClassName"}
  ],
  "changed": [
    {"name": "dropdownMatchSelectWidth", "renamed": "popupMatchSelectWidth"}
  ]
}
```
