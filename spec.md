# @ant-design/cli Design Spec

## Overview

A CLI tool for Code Agents to query antd knowledge and analyze antd usage in projects. Agents invoke it via shell commands and parse structured output (JSON/text/markdown) to assist developers working with antd.

## Product Positioning

- **Target user**: Code Agents (Claude Code, Codex, Gemini CLI, etc.)
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
    ├── versions.json        # version index: minor series → snapshot tag (always plain JSON)
    ├── v4.json.gz           # latest v4 (gzip-compressed in published package)
    ├── v4.0.9.json.gz       # snapshot for 4.0.x series
    ├── v4.1.5.json.gz       # snapshot for 4.1.x series
    ├── ...                  # one .json.gz file per minor series
    ├── v4.24.16.json.gz     # snapshot for 4.24.x series
    ├── v5.json.gz           # latest v5
    ├── v5.0.7.json.gz       # snapshot for 5.0.x series
    ├── ...
    ├── v6.json.gz           # latest v6
    └── ...
```

> **Note on data format:** In the git repository, data files are stored as plain `.json` for readable diffs. During `npm pack`/`npm publish`, a `prepack` hook compresses them to `.json.gz` (gzip level 9), reducing package size from ~136MB to ~25MB. A `postpack` hook restores them to `.json` afterward. The loader transparently supports both formats via `zlib.gunzipSync()` with fallback to plain JSON.

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

- On load, component props are deduplicated by name (first entry wins).
- The extraction script handles `\|` (escaped pipes in markdown table cells) by replacing them with a placeholder before splitting. This ensures multi-value union types like `` `primary` \| `dashed` \| `link` `` are stored correctly as `` `primary` | `dashed` | `link` `` instead of being split across wrong columns.
- Each version file contains both `en` and `zh` descriptions, keyed by language
- `semantic` data extracted from `components/*/demo/_semantic.tsx` files
- Data is auto-extracted from antd source via `scripts/extract.ts`
- A GitHub Actions workflow (`sync.yml`) runs daily: for each major version it extracts the latest snapshot and any new minor-series snapshots, then updates `versions.json`
- Historical snapshots can be bootstrapped locally via `scripts/bootstrap-snapshots.ts`
- CLI version aligns with the latest antd version (e.g., antd 6.3.2 → CLI 6.3.2)
- The components schema is consistent across major versions to enable cross-version diffing

## Commands

### Knowledge Query

#### `antd list`

List all components with one-line descriptions and categories.

```bash
antd list
antd list --format json
antd list --version 5.0.0
```

JSON output includes bilingual fields:
```json
[
  {"name": "Button", "nameZh": "按钮", "description": "To trigger an operation.", "descriptionZh": "按钮用于开始一个即时操作。", "since": "0.x"}
]
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
antd changelog 4.24.0 5.0.0             # all breaking changes
antd changelog 4.24.0 5.0.0 Select      # Select-specific changes
```

Version range uses `<from>..<to>` syntax (inclusive on both ends). Both `from` and `to` must be full semver (e.g. `5.10.0`, not `5.10`). Single version returns only that exact version's entries.

API diff mode (`changelog <v1> <v2>`) output includes: added props, removed props, changed types, renamed props. Cross-major-version diffing (e.g. v4 vs v5) is supported because the components schema is consistent across versions.

### Agent Integration

#### `antd mcp`

Start an MCP (Model Context Protocol) stdio server for IDE agent integration. Exposes antd knowledge-query tools directly to agents in Claude Desktop, Cursor, and other MCP-compatible IDEs.

```bash
antd mcp                                # start with auto-detected version
antd mcp --version 5.20.0 --lang zh     # pin version and language at startup
```

IDE configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "antd": {
      "command": "antd",
      "args": ["mcp", "--version", "5.20.0"]
    }
  }
}
```

**MCP Tools (7):**

| Tool | Description |
|---|---|
| `antd_list` | List all components with names, categories, descriptions |
| `antd_info` | Get component props API |
| `antd_doc` | Get full markdown documentation |
| `antd_demo` | Get demo source code |
| `antd_token` | Query Design Tokens |
| `antd_semantic` | Query semantic classNames/styles structure |
| `antd_changelog` | Query changelog or diff API changes between versions |

**MCP Prompts (2):**

| Prompt | Description |
|---|---|
| `antd-expert` | General antd expert — tool usage workflow, avoid duplicate calls, query-before-generate |
| `antd-page-generator` | Page generation assistant — fetch all relevant docs before coding |

Global `--version` and `--lang` are resolved once at server startup (not per tool call). All tool outputs are JSON. The server uses `@modelcontextprotocol/sdk` with stdio transport.

### Project Analysis

#### `antd doctor`

Diagnose project-level configuration issues.

```bash
antd doctor                         # run in project root
antd doctor --format json
```

Checks (in order):
1. `antd-installed` — verifies antd is installed in the project; severity: error
2. `react-compat` — antd version compatibility with React version
3. `duplicate-install` — detects multiple antd installations
4. `dayjs-duplicate` — detects multiple dayjs installations in node_modules; severity: error
5. `cssinjs-duplicate` — detects multiple @ant-design/cssinjs installations in node_modules; severity: error
6. `cssinjs-compat` — checks @ant-design/cssinjs version satisfies antd peerDependencies range; severity: error (incompatible version) / warning (not installed)
7. `icons-compat` — checks @ant-design/icons version satisfies antd peerDependencies range; severity: warning (icons are optional)
8. `theme-config` — theme config validity
9. `babel-plugins` — checks for deprecated babel-plugin-import usage with antd v5+
10. `cssinjs` — CSS-in-JS configuration correctness
11. `ecosystem-compat:<shortName>` (dynamic, 0–N checks, one per installed `@ant-design/*` package with peerDependencies) — scans `node_modules/@ant-design/` and for each package that declares `peerDependencies`, checks that each required dep's installed version satisfies the range. Uses `satisfies()` with fail-open for unrecognized range formats (e.g. compound `>=x <y`). Packages with empty `peerDependencies` are skipped. If no `@ant-design/*` packages are installed, no checks are added. severity: error (version incompatible) / warning (dep not installed). Covers pro-components series, @ant-design/charts, @ant-design/x, @ant-design/icons, @ant-design/cssinjs, and any future `@ant-design/*` package.

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

Scan project for antd component/API usage statistics using AST-based analysis (powered by `oxc-parser`). Detects direct imports (`import { Button } from 'antd'`), sub-component JSX usage (`<Form.Item>`, `<Table.Column>`), and named imports from sub-paths.

```bash
antd usage                          # scan current directory
antd usage ./src                    # scan specific directory
antd usage --filter Button          # filter results to a specific component (short: -f)
antd usage ./src -f Form            # combine directory and filter
antd usage --format json
```

Imports are cross-referenced against the antd metadata for the detected version. Known antd component exports (e.g. `Button`, `Form`, `Row`, `Col`) appear in `components`. Non-component antd exports (e.g. `message`, `notification`, `theme`) are reported separately in `nonComponents`. TypeScript `import { type X }` syntax is handled — type-only imports are excluded entirely (they are not runtime values and have no component usage to track). Sub-component usage detection uses AST traversal to precisely identify JSX elements (e.g. `<Form.Item>`, `<Table.Column>`), automatically excluding method or hook calls (e.g. `Form.useForm()`, `Modal.confirm()`).

The scanner skips directories named `node_modules`, `dist`, `build`, `.next`, `.git`, and any directory whose name starts with `.umi` (covers `.umi`, `.umi-production`, `.umi-test`, etc.).

JSON output:
```json
{
  "scanned": 42,
  "components": [
    {"name": "Button", "imports": 18, "files": ["src/pages/home.tsx", "src/components/Header.tsx"]},
    {"name": "Form", "imports": 12, "subComponents": {"Form.Item": 35, "Form.List": 3}},
    {"name": "Table", "imports": 8, "files": ["src/pages/list.tsx"]}
  ],
  "nonComponents": [
    {"name": "message", "imports": 5, "files": ["src/utils/notify.ts"]},
    {"name": "theme", "imports": 2, "files": ["src/theme.ts"]}
  ],
  "summary": {"totalComponents": 15, "totalImports": 87}
}
```

#### `antd lint [file/dir]`

Check antd usage against best practices. Uses AST-based analysis (powered by `oxc-parser`) on source files for precise detection.

```bash
antd lint ./src
antd lint ./src/pages/home.tsx
antd lint --only deprecated         # only check deprecated APIs
antd lint --only a11y               # only check accessibility
antd lint --only usage              # only check usage mistakes
antd lint --only performance        # only check performance
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
      "message": "Button `ghost` is deprecated (since 5.12.0). Please use `variant` instead"
    }
  ],
  "summary": {"total": 1, "deprecated": 1, "a11y": 0, "usage": 0, "performance": 0}
}
```

Note: This is complementary to ESLint. `antd lint` focuses on antd-specific knowledge (deprecated APIs per version, prop combination mistakes, antd accessibility) that generic ESLint rules cannot cover.

**Rule categories:**

- **deprecated** — Deprecated props (with replacement info from metadata) and deprecated components (`BackTop` → `FloatButton.BackTop`, `Button.Group` / `Input.Group` → `Space.Compact`). Deprecated prop detection uses AST traversal to precisely match props to their owning JSX element, eliminating false positives from sibling components.
- **a11y** — Accessibility: missing `alt` on Image, missing `aria-label` on clickable icons
- **usage** — Prop combination mistakes detected from antd runtime warnings:
  - Form.Item `shouldUpdate` + `dependencies` conflict
  - Button `ghost` + `type="link"` / `type="text"` conflict
  - Checkbox `value` prop (should be `checked`)
  - Divider `type="vertical"` with children
  - Select `maxCount` without `mode="multiple"` / `mode="tags"`
  - Menu `inlineCollapsed` without `mode="inline"`
  - QRCode missing `value` prop
  - Typography.Link `ellipsis` as object (only boolean supported)
  - Typography.Text `ellipsis` with `expandable` / `rows` (not supported)
  - Radio `optionType` on Radio (only on Radio.Group)
  - TreeSelect `multiple={false}` + `treeCheckable` conflict
- **performance** — Wildcard imports, disabling virtual scroll on Select

#### `antd migrate <from> <to>`

Version migration guide with optional auto-fix.

```bash
antd migrate 4 5                    # full migration checklist
antd migrate v4 v5                  # v prefix is accepted and normalized
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

#### `antd env [dir]`

Collect all antd-related environment information for bug reporting or AI-assisted diagnosis.

```bash
antd env                           # text output (copy-paste to GitHub Issues)
antd env --format json             # structured JSON for AI consumption
antd env --format markdown         # markdown tables
antd env /path/to/project          # scan a specific project directory
```

Collects six categories of information:

1. **System** — OS name and version
2. **Binaries** — Node.js version, package managers (npm/pnpm/yarn/bun), npm registry URL
3. **Browsers** — Installed system browser versions (Chrome, Firefox, Safari, Edge)
4. **Dependencies** — Core antd-related packages (antd, react, react-dom, dayjs, @ant-design/cssinjs, @ant-design/icons)
5. **Ecosystem** — All installed `@ant-design/*` and `rc-*` packages
6. **Build Tools** — Frameworks (umi, next, remix, gatsby, taro, etc.), bundlers (webpack, vite, rspack, turbopack, farm), compilers (typescript, babel, swc), CSS tools (less, sass, tailwindcss)

Text output example:
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

JSON output:
```json
{
  "system": {"OS": "macOS 15.3"},
  "binaries": {"Node": "20.11.0", "pnpm": "9.1.0", "Registry": "https://registry.npmmirror.com/"},
  "browsers": {"Chrome": "131.0.6778.86", "Safari": "18.3"},
  "dependencies": {"antd": "5.22.0", "react": "18.3.1", "react-dom": "18.3.1", "dayjs": "1.11.13", "@ant-design/cssinjs": "1.22.1", "@ant-design/icons": "5.5.2"},
  "ecosystem": {"@ant-design/pro-components": "2.8.1", "rc-field-form": "2.7.0"},
  "buildTools": {"umi": "4.3.0", "typescript": "5.6.3", "less": "4.2.0"}
}
```

Notes:
- Does not run project code — purely static scanning of `node_modules` and system
- Uninstalled core deps show as "Not found" (text) or `null` (JSON)
- Ecosystem/rc-* packages only list installed ones
- Uses `envinfo` for cross-platform browser detection

### Issue Reporting

#### `antd bug`

Report a bug to the antd repository (`ant-design/ant-design`). Auto-collects environment info and generates issue content in the antd-issue-helper format.

```bash
antd bug --title "DatePicker crashes with dayjs 2.0"
antd bug --title "..." --steps "1. Click button" --expected "Works" --actual "Crashes"
antd bug --title "..." --reproduction "https://codesandbox.io/s/xxx"
antd bug --title "..." --submit          # submit via gh CLI
antd bug --title "..." --format json     # structured output for agent preview
```

Preview mode (default) outputs the assembled issue for review. `--submit` creates the issue via `gh issue create`. Returns error `GH_NOT_FOUND` if `gh` is not available.

JSON output (preview):
```json
{
  "repo": "ant-design/ant-design",
  "title": "DatePicker crashes",
  "body": "<!-- generated by @ant-design/cli... -->",
  "url": "https://github.com/ant-design/ant-design/issues/new?..."
}
```

#### `antd bug-cli`

Report a bug to the CLI repository (`ant-design/ant-design-cli`). Same interface as `antd bug` but with `--description` instead of `--reproduction`, targeting the CLI repo.

```bash
antd bug-cli --title "antd info crashes on v4 components"
antd bug-cli --title "..." --description "Detailed description..."
antd bug-cli --title "..." --submit
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
4. Fallback version `5.24.0` (latest stable at time of build)

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
│  Commands    │     │  Version     │     │  Bundled data    │
│  Flag parse  │     │   routing    │     │  data/v4,v5,v6   │
│  Output fmt  │     │  Filtering   │     │  (JSON files)    │
└─────────────┘     └──────────────┘     └──────────────────┘
```

### Tech Stack

- Language: TypeScript + Node.js
- CLI framework: `commander`
- Minimum Node version: 20+
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

### `antd changelog 4.24.0 5.0.0 Select --format json`

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
