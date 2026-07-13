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
    ├── design-v6.md         # design-language doc for v6 (plain markdown, synced from antd's DESIGN.md, served by `antd design.md`)
    ├── v3.json.gz           # latest v3 (final version 3.26.20)
    ├── v3.26.20.json.gz     # snapshot for 3.26.x series
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
  "v3": { "3.26": "3.26.20" },
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

Version ordering uses semver precedence, including prerelease identifiers. For example, `6.0.0-beta.1 < 6.0.0-beta.2 < 6.0.0`.

### Data Layer Notes

- On load, component props are deduplicated by name (first entry wins).
- The extraction script handles `\|` (escaped pipes in markdown table cells) by replacing them with a placeholder before splitting. This ensures multi-value union types like `` `primary` \| `dashed` \| `link` `` are stored correctly as `` `primary` | `dashed` | `link` `` instead of being split across wrong columns.
- Each version file contains both `en` and `zh` descriptions, keyed by language
- `semantic` data extracted from `components/*/demo/_semantic.tsx` files
- Changelog extraction recognizes Unicode emoji prefixes (including country flags); only indented change bullets inherit the preceding component group, while top-level bullets resolve their own component context.
- Data is auto-extracted from antd source via `scripts/extract.ts`
- `data/design-v{major}.md` (the design-language document served by `antd design.md`) is **not** extracted but **copied verbatim** from antd's repo-root `DESIGN.md` during sync, since it is hand-curated prose, not derivable data. It is major-grained, so `scripts/sync.ts` checks out each major's latest tag and copies the file to `data/design-v{major}.md` (only `design-v6.md` exists today; antd has not published `DESIGN.md` for v3/v4/v5). If the source `DESIGN.md` is absent for a major, the existing bundled copy is kept rather than deleted.
- For v5+ design tokens, `scripts/sync.ts` fetches `token-meta.json` from the matching published `antd@{version}` tarball for each extracted tag and replaces any previous checkout copy before extraction, so token data cannot be reused across versions. Release values are passed as isolated process arguments rather than shell text; on Windows, npm is invoked through Node's `npm-cli.js` instead of the non-executable `npm.cmd` shim.
- A GitHub Actions workflow (`sync.yml`) runs hourly: for each major version it extracts the latest snapshot and any new minor-series snapshots, then updates `versions.json`
- Sync fails closed if release tags cannot be fetched for any configured major line, instead of publishing partially refreshed data.
- Stale snapshots (files not referenced by `versions.json`) are cleaned up automatically: when a new patch replaces an old one for the same minor series, the old file is removed inline; a final sweep after sync removes any orphaned snapshot files. `versions.json` is the source of truth — the cleanup scope derives from its contents, not from a hardcoded major-version list
- If `versions.json` cannot be parsed, sync fails closed instead of overwriting it with a partial index, so stale snapshot cleanup never runs from corrupted version metadata.
- `versions.json` is only updated when every indexed minor snapshot exists on disk, and `scripts/validate-data.ts --quiet` fails if any index entry points at a missing snapshot.
- Historical snapshots can be bootstrapped locally via `scripts/bootstrap-snapshots.ts`
- CLI version aligns with the latest antd version (e.g., antd 6.3.2 → CLI 6.3.2)
- The components schema is consistent across major versions to enable cross-version diffing

## Commands

### Root Help

`antd`, `antd -h`, and `antd --help` display the root help. The help output starts with one blank line, a small terminal-optimized Ant Design logo generated from the official SVG followed by a CFonts-rendered `ANT DESIGN CLI` banner using the `tiny` font, the current CLI package version as `@ant-design/cli v{version}`, and a plain solid divider line with the same visible length as the version label, followed by the normal Commander usage, options, and command list.

In an interactive TTY, the logo renders as a pre-generated ANSI truecolor half-block logo and the CFonts banner may render with color/gradient styling when terminal color is supported. The divider remains plain text. Non-TTY output, `NO_COLOR`, or `TERM=dumb` use a pre-generated ANSI-free Unicode fallback for snapshots, pipes, and tests.

The logo is pre-rendered by `npm run generate:logo`, which reads the committed `scripts/assets/antd-logo.svg` and writes fixed constants to `src/output/logo.ts`. Runtime help rendering must not read files, access the network, rasterize SVGs, or depend on image-processing packages such as `sharp`.

The banner is only part of the root help surface. `-V` / `--cli-version` continue to print only the raw CLI version string, and `--version <v>` remains the target antd version flag.

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

Most antd components inherit common props (`className`, `style`, `rootClassName`) via [Common Props](https://ant.design/docs/react/common-props). These are included in the output:

- **JSON format**: a `commonProps` array with `name`, `type`, `default`, `description`, `descriptionZh` fields. Omitted for `ConfigProvider` (which does not support common props).
- **Text/markdown format**: a separate "Common Props" table after the component-specific props table. Omitted for `ConfigProvider`.

Additionally, each component includes an `htmlElement` field indicating the underlying HTML element (e.g. Button → `"button"`, Input → `"input"`, Card → `"div"`). This tells consumers which native HTML attributes the component accepts. Omitted for `ConfigProvider`.

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
antd token --version 3.26.0         # v3 uses Less variables, shows a hint
```

**Note:** Design Tokens are only available in antd v5+. For v3 and v4, the command returns `UNSUPPORTED_VERSION_FEATURE` with a suggestion to use Less variables or upgrade to v5.


#### `antd design.md`

Output the antd **design-language document** (`design.md`) — a hand-curated description of antd's default light theme, conformant with the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec. It is the prose-and-token counterpart to `antd token`: where `token` lists individual token names, `design` describes the design language as a whole (color/typography/spacing/radius values plus the principles behind them), so AI design tools (Figma Make, Stitch, etc.) and agents can consume antd's design language directly.

```bash
antd design.md                       # output the design.md for the detected version
antd design.md --version 6.4.0       # design.md for a specific version (resolved by major)
antd design.md --format json         # structured output: { "doc": "..." }
```

The document has two parts:

- **YAML front-matter** — `colors`, `typography`, `rounded`, `spacing`, and `components` (12 core archetypes with their key states), with concrete values for the default light theme.
- **Prose sections** — Overview, Customization, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, and Do's and Don'ts.

**Version resolution:** `design.md` is **major-grained** — antd rewrites it only across major releases (e.g. v5 → v6), so it is resolved by the target major version (via `detectVersion()` / `--version`). A `design.md` is currently published only for **antd v6**; requesting a major without one (v3/v4/v5) returns `UNSUPPORTED_VERSION_FEATURE` with a hint, mirroring how `antd token` gates v3/v4. It mirrors the canonical `DESIGN.md` published at `https://ant.design/design.md`.


#### `antd semantic <Component>`

Query the semantic customization structure of a component — the available `classNames` and `styles` keys. Data extracted from `components/*/demo/_semantic.tsx` files.

```bash
antd semantic Table
antd semantic Table --format json
```

**Note:** Semantic structure is only available in antd v5+. For v3 and v4, the command returns `UNSUPPORTED_VERSION_FEATURE`.

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

**MCP Tools (8):**

| Tool | Description |
|---|---|
| `antd_list` | List all components with names, categories, descriptions |
| `antd_info` | Get component props API |
| `antd_doc` | Get full markdown documentation |
| `antd_demo` | Get demo source code |
| `antd_token` | Query Design Tokens |
| `antd_design_md` | Get the design-language document (`design.md`) |
| `antd_semantic` | Query semantic classNames/styles structure |
| `antd_changelog` | Query changelog or diff API changes between versions |

All tools include MCP annotations: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` — indicating they are read-only queries against bundled data with no side effects.

**MCP Prompts (2):**

| Prompt | Description |
|---|---|
| `antd-expert` | General antd expert — tool usage workflow, avoid duplicate calls, query-before-generate |
| `antd-page-generator` | Page generation assistant — fetch all relevant docs before coding |

Global `--version` and `--lang` are resolved once at server startup (not per tool call). All tool outputs are JSON. The server uses `@modelcontextprotocol/sdk` with stdio transport.

#### `antd setup`

Configure a local AI agent project with Ant Design MCP and/or the bundled `skills/antd` guidance. This is an onboarding helper for agent integrations: in `mcp` mode it writes the correct MCP client configuration file while `antd mcp` remains the stdio server that the agent starts; in `skill` mode it installs a client-appropriate skill or skill reference and writes agent instructions.

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
| `mcp` | Writes the client-specific MCP config only. This is the default. |
| `skill` | Installs the bundled Ant Design guidance for the selected client and writes an idempotent managed instruction block. It does not write MCP config. |
| `both` | Writes MCP config, installs the skill or skill reference, and writes the managed instruction block. The instructions prefer the configured `antd` MCP server and point to the local guidance for fallback. |
| `ci` | Writes a GitHub Actions workflow. This mode is only supported by `--client github-actions`; `github-actions` defaults to `ci`. |

Supported clients:

| Client | Config file | Server key | Skill target | Instructions file |
|---|---|---|---|---|
| `claude` | `.mcp.json` | `mcpServers` | `.claude/skills/antd/` | `CLAUDE.md` |
| `cursor` | `.cursor/mcp.json` | `mcpServers` | `.agents/skills/antd/` shared skill | `AGENTS.md` |
| `vscode` | `.vscode/mcp.json` | `servers` | `.agents/skills/antd/` shared skill | `AGENTS.md` |
| `codex` | - | - | `.agents/skills/antd/` shared skill | `AGENTS.md` |
| `github-actions` | `.github/workflows/antd-cli.yml` | - | - | - |

The command preserves existing MCP servers in the target file and adds or replaces the `antd` server entry:

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

When `--version` is provided, it is pinned into generated MCP server args. When `--lang zh` is provided, generated MCP args start in Chinese mode. English is the default and is omitted from generated args.

Skill instructions are written to the selected client's instruction file: Claude uses `CLAUDE.md`; Cursor, VS Code, and Codex use `AGENTS.md`. Claude gets a native project skill under `.claude/skills/antd/`; Cursor, VS Code, and Codex get the same bundled guidance under `.agents/skills/antd/`.

Codex setup currently supports skill installation only. `antd setup --client codex` defaults to `skill`; explicit `--mode mcp` or `--mode both` is rejected until a project-local Codex MCP config format is supported.

GitHub Actions setup writes `.github/workflows/antd-cli.yml` with an advisory pull-request workflow:

```yaml
name: Ant Design CLI

on:
  pull_request:

permissions:
  contents: read

jobs:
  antd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Run antd doctor
        run: npx -y @ant-design/cli doctor --format json
      - name: Run antd lint
        run: npx -y @ant-design/cli lint ./src --format json
```

When `--version` or `--lang zh` is provided, those options are appended to the generated `antd doctor` and `antd lint` commands. Explicit `--mode mcp`, `--mode skill`, or `--mode both` is rejected for `github-actions`; explicit `--mode ci` is rejected for agent clients.

`--check` validates the selected mode without writing files:

- `mcp` checks the `antd` MCP server entry.
- `skill` checks the copied skill or skill reference and the managed instruction block in the same agent instructions file that setup would write.
- `both` checks all of them.
- `ci` checks the generated GitHub Actions workflow content.

It exits `0` when the selected mode is configured and exits `1` when config, skill files, or instructions are missing or differ from the expected content.

Check output reports the selected setup targets. In text mode, each checked file or directory is printed with `Configured` or `Not configured`; in JSON output, `targets` contains the same selected files and directories while `file` remains the primary MCP config path for compatibility.

`--write-instructions` is a compatibility convenience for the default `mcp` mode. It writes the MCP-oriented block to the selected agent instructions file in addition to the MCP config. Existing content outside the managed block is preserved. Running the command again updates the managed block rather than duplicating it. When combined with `--check`, it also checks that the MCP-oriented instruction block is present in the same selected file.

Text output reports every file or directory that was actually changed, one per line. For example, `--mode both` can print the MCP config file, `.claude/skills/antd` or `.agents/skills/antd`, and the selected `CLAUDE.md` or `AGENTS.md` path.
In `--dry-run` mode, text output reports `Would write` only when the selected setup would change files; otherwise it reports `Already configured` for the selected setup targets.

JSON output:

```json
{
  "client": "claude",
  "mode": "both",
  "file": "/path/to/project/.mcp.json",
  "changed": true,
  "dryRun": false,
  "skillDir": "/path/to/project/.claude/skills/antd",
  "skillChanged": true,
  "instructionsFile": "/path/to/project/CLAUDE.md",
  "instructionsChanged": true,
  "config": {
    "mcpServers": {
      "antd": {
        "command": "npx",
        "args": ["-y", "@ant-design/cli", "mcp"]
      }
    }
  }
}
```

The `config` object is the full merged MCP config for the selected client. Existing server entries from the original config file are preserved and included alongside the added or updated `antd` entry.

Check JSON output:

```json
{
  "client": "claude",
  "mode": "mcp",
  "file": "/path/to/project/.mcp.json",
  "configured": true,
  "problems": [],
  "expected": {
    "command": "npx",
    "args": ["-y", "@ant-design/cli", "mcp"]
  },
  "actual": {
    "command": "npx",
    "args": ["-y", "@ant-design/cli", "mcp"]
  }
}
```

### Project Analysis

#### `antd doctor`

Diagnose project-level configuration issues.

```bash
antd doctor                         # run in project root
antd doctor --format json
```

Checks (in order):
1. `antd-installed` — verifies antd is installed in the project and checks the installed version against bundled BUG_VERSIONS data; severity: error. This check is fully offline and does not fetch remote bug metadata or write runtime cache.
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

Scan project for antd component/API usage statistics using AST-based analysis (powered by `oxc-parser`). Detects direct imports (`import { Button } from 'antd'`), default component imports from sub-paths (`import Button from 'antd/es/button'` / `antd/lib/button`), sub-component JSX usage (`<Form.Item>`, `<Table.Column>`), and named imports from sub-paths.

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
antd lint --diff                    # only check files changed from origin/main (fallback: HEAD)
antd lint --diff main               # only check files changed from a specific git base
antd lint --staged                  # only check staged git files
antd lint --format json
antd lint --only deprecated --format json --antd-alias @shared-components
```

Options:
- `--only <category>` — limit checks to `deprecated`, `a11y`, `usage`, or `performance`
- `--antd-alias <source>` — treat additional package names as aliases of `antd`; repeat the flag for multiple wrapper packages. `antd` remains enabled by default.
- `--diff [base]` — limit checks to changed git files. Without `base`, compares against the merge-base of `origin/main` and `HEAD`; if `origin/main` is unavailable, falls back to `HEAD`. When `base` is provided, compares against the merge-base of that ref and `HEAD`, falling back to the provided ref if no merge-base can be computed. Includes staged and unstaged working tree changes relative to the base.
- `--staged` — limit checks to staged git files. Cannot be combined with `--diff`.

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
  "skippedFiles": [
    {
      "file": "src/pages/broken.tsx",
      "reason": "parse-error",
      "message": "Unexpected token"
    }
  ],
  "partial": true,
  "summary": {"total": 1, "deprecated": 1, "a11y": 0, "usage": 0, "performance": 0, "skipped": 1}
}
```

When a file cannot be read or parsed, `antd lint` reports it in `skippedFiles` instead of silently dropping it. `partial` is `true` whenever at least one file was skipped. Text and markdown output include a skipped-files section with the reason and parser/read error message.

Note: This is complementary to ESLint. `antd lint` focuses on antd-specific knowledge (deprecated APIs per version, prop combination mistakes, antd accessibility) that generic ESLint rules cannot cover.

**Rule categories:**

- **deprecated** — Deprecated props (with replacement info from metadata) and deprecated components (`BackTop` → `FloatButton.BackTop`, `Button.Group` / `Input.Group` → `Space.Compact`). Deprecated prop detection uses AST traversal to precisely match props to their owning JSX element, eliminating false positives from sibling components.
- **a11y** — Accessibility: missing `alt` on Image, missing `aria-label` on clickable icons
- **usage** — Prop combination mistakes detected from antd runtime warnings:
  - Form.Item `shouldUpdate` + `dependencies` conflict
  - Button `ghost` + `type="link"` / `type="text"` conflict
  - Checkbox `value` prop outside Checkbox.Group (should be `checked`; `value` is valid inside Checkbox.Group)
  - Divider `type="vertical"` with children
  - Select `maxCount` without `mode="multiple"` / `mode="tags"`
  - Menu `inlineCollapsed` without `mode="inline"`
  - QRCode missing `value` prop
  - Typography.Link `ellipsis` as object (only boolean supported)
  - Typography.Text `ellipsis` with `expandable` / `rows` (not supported)
  - Radio `optionType` outside Radio.Group (only valid inside Radio.Group)
  - TreeSelect `multiple={false}` + `treeCheckable` conflict
  - antd v5+ static feedback APIs (`message.*`, `notification.*`, `Modal.confirm` / `Modal.info` / `Modal.success` / `Modal.error` / `Modal.warning` / `Modal.warn`) that cannot consume `ConfigProvider` context; use `App.useApp()` instead
  - antd v5+ Upload controlled/uncontrolled conflicts: using both `fileList` and `defaultFileList`, or using controlled `fileList` without `onChange`
  - antd v5+ Select children APIs (`Select.Option`, `Select.OptGroup`); use the `options` prop instead
- **performance** — Wildcard imports (`import * as`) from `antd`, configured `--antd-alias` packages, or their subpaths; default imports; disabling virtual scroll on Select. Locale paths (`antd/locale/*`, `antd/es/locale/*`, `antd/lib/locale/*`) are excluded since their default import is the documented pattern and there is no tree-shaking benefit to be gained. Non-module asset sources (any extension other than `.js/.jsx/.ts/.tsx/.mjs/.cjs/.mts/.cts`, e.g. `.css/.svg/.ttf/.woff2/.png`) are also excluded, since they resolve to a bundler asset with only a default export and have no named exports.

#### `antd migrate <from> <to>`

Version migration guide with optional auto-fix.

```bash
antd migrate 3 4                    # v3 → v4 migration checklist
antd migrate 4 5                    # v4 → v5 migration checklist
antd migrate 5 6                    # v5 → v6 migration checklist
antd migrate v4 v5                  # v prefix is accepted and normalized
antd migrate 4 5 --component Select # Select-specific migration
antd migrate 4 5 --apply ./src      # scan ./src and generate targeted migration prompts
antd migrate --format json
```

**Available migration paths:** v3→v4, v4→v5, v5→v6. Multi-version migrations (e.g., v3→v6) are not supported directly — migrate step by step.

Behavior of `--apply <dir>`:
- Scans the target directory for antd component imports (reuses the `usage` scanning logic)
- Filters migration steps to only those relevant to the project's actual component usage
- For steps with `searchPattern`, matches against file contents to identify affected files
- Outputs a targeted, agent-consumable migration prompt with `**Affected files:**` listed per step
- `Global` steps (design token migration, etc.) are always included regardless of component usage
- Components not imported in the project are excluded from the output

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

### CLI Management

#### `antd upgrade`

Upgrade the CLI itself to the latest version published on npm.

```bash
antd upgrade                        # upgrade to latest version
antd upgrade --format json          # structured JSON output
antd upgrade --lang zh              # Chinese output
```

The command automatically detects which package manager was used to install the CLI by resolving the binary path (`which antd` on Unix, `where antd` on Windows) and matching path keywords:

| Path Keyword | Package Manager |
|---|---|
| `.utoo` or `utoo/global` | `utoo` |
| `.cnpm` or `cnpm/global` | `cnpm` |
| `yarn/global` | `yarn` |
| `.pnpm-global` or `pnpm/global` | `pnpm` |
| `.bun` or `bun/install/global` | `bun` |
| Other (path recognized) | `npm` (fallback) |

> If `which`/`where` fails entirely (binary not in PATH), detection returns `null` and the command exits with `PM_NOT_FOUND`.

Each package manager uses its own global upgrade command:

| Package Manager | Upgrade Command |
|---|---|
| `npm` | `npm install -g @ant-design/cli@latest` |
| `yarn` | `yarn global add @ant-design/cli@latest` |
| `pnpm` | `pnpm add -g @ant-design/cli@latest` |
| `bun` | `bun add -g @ant-design/cli@latest` |
| `cnpm` | `cnpm install -g @ant-design/cli@latest` |
| `utoo` | `ut install -g @ant-design/cli@latest` |

**Flow:**

1. Fetch the latest version from npm (reuses the existing `fetchLatestVersion()` with 3-mirror race: npmjs, npmmirror, unpkg)
2. Compare with current CLI version (`__CLI_VERSION__`)
3. If already up to date, output and exit 0
4. Detect the package manager from the binary path; if detection fails, print error with manual command suggestion and exit 1
5. Execute the corresponding upgrade command via `child_process.spawn` (120s timeout, `stdio: 'inherit'` for passthrough, `shell: true` on Windows for `.cmd` compatibility)
6. Verify the upgraded version by running `antd --cli-version`; if version unchanged, warn and exit 2

**Exit codes:**
- `0` — success (upgraded or already up to date)
- `1` — user error (network error, package manager not detected)
- `2` — system error (upgrade command failed, version unchanged after upgrade)

**Error codes:** `NETWORK_ERROR`, `PM_NOT_FOUND`, `UPGRADE_FAILED`, `VERSION_UNCHANGED`

**Output (already up to date, text):**
```text
Already up to date: v6.4.3
```

**Output (already up to date, json):**
```json
{"currentVersion":"6.4.3","message":"Already up to date"}
```

**Output (upgrade succeeded, text):**
```text
Upgrading @ant-design/cli: v6.4.3 → v6.4.4
Running: npm install -g @ant-design/cli@latest
... (passthrough package manager output) ...
Successfully upgraded to v6.4.4
```

**Output (upgrade succeeded, json):**
```json
{"previousVersion":"6.4.3","newVersion":"6.4.4","packageManager":"npm"}
```

**Output (upgrade succeeded, markdown):**
```markdown
## Upgrade

| Field | Value |
|---|---|
| Previous Version | 6.4.3 |
| New Version | 6.4.4 |
| Package Manager | npm |
```

## Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format json\|text\|markdown` | Output format. `json` includes all data with no decoration. | `text` |
| `--version <v>` | Target antd version (full semver, e.g. `5.20.0`) | auto-detect from project |
| `--lang en\|zh` | Output language | `en` |
| `--detail` | Full information output (more fields in response) | `false` |
| `-V`, `--cli-version` | Print the raw CLI package version and exit | - |

Note: `--quiet` removed. `--format json` already provides clean structured output for agents. `--format text` is for human-readable output and always includes formatting.

## Version Detection

Priority order:

1. `--version` flag (highest)
2. Installed version in `node_modules/antd/package.json`
3. Declared version in project `package.json` dependencies
4. Fallback version — the latest bundled major, resolved dynamically from the highest `data/v{N}.json` snapshot's `version` field (e.g. `6.4.3`), so it tracks "latest" as new majors are synced instead of going stale

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

Common error codes: `COMPONENT_NOT_FOUND`, `VERSION_NOT_FOUND`, `NO_PROJECT_DETECTED`, `UNSUPPORTED_VERSION_FEATURE` (e.g. tokens for v3/v4), `NETWORK_ERROR`, `PM_NOT_FOUND`, `UPGRADE_FAILED`, `VERSION_UNCHANGED`.

Invalid global options such as `--format` and `--lang` exit with code `1` and print only the validation message to stderr; internal sentinel errors or Node.js stack traces must not be shown to users.

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
- Terminal help effects: `cfonts` for the root help banner
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
| Changelog | `CHANGELOG.{en-US,zh-CN}.md` | Markdown heading, Unicode emoji, and indentation-aware component parsing |
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
│  Run: antd upgrade                      │
│  Or:  npm i -g @ant-design/cli          │
╰────────────────────────────────────────╯
```

**Behavior details:**

- Skipped when `CI=1` or `NO_UPDATE_CHECK=1` is set
- Bug-reporting suggestions in SKILL.md and MCP prompts are skipped when `ANTD_NO_AUTO_REPORT=1` is set
- Uses `registry.npmjs.org` with a 3 s timeout; failures are silent
- Output goes to **stderr**, so `--format json` stdout is never polluted
- No new production dependencies — uses only built-in Node modules (`node:https`, `node:fs`, `node:os`, `node:path`)

### Self-Upgrade

The `antd upgrade` command upgrades the CLI to the latest version. It detects the package manager from the binary path and executes the matching global install command. Key modules:

| Module | Purpose |
|---|---|
| `src/commands/upgrade.ts` | Command registration + main flow |
| `src/utils/detect-pm.ts` | Package manager detection from binary path |
| `src/utils/update-check.ts` | `fetchLatestVersion()` reused for version check |

The command reuses the existing `fetchLatestVersion()` (3-mirror race + 24h cache) for checking the latest version, and `compare()` from `src/data/version.ts` for semver comparison.

### Automated Data Sync

GitHub Actions workflow `.github/workflows/sync.yml` runs hourly:

1. For each major version (v4, v5, v6), find the latest antd release tag via `git ls-remote`
2. Before syncing, compare each bundled primary snapshot with the latest stable npm version for that major line
3. Checkout antd source at that tag
4. Run `scripts/extract.ts` to generate new data
5. Run `scripts/validate-data.ts --quiet` to fail on critical data formatting issues while reporting known upstream snapshot gaps as warnings
6. If data changed, commit and push
7. Align CLI version with the latest antd version and publish to npm

The CLI version is kept in sync with antd — e.g., when antd publishes v6.3.2, the CLI is also published as v6.3.2.
If sync produces data-only changes while the current CLI version has already been published, the workflow commits and pushes those data changes without attempting to republish the same npm version.
If the package version was already committed but a previous publish attempt failed, `scripts/publish.ts` recovers missing release artifacts without requiring a new version bump. The sync gate treats a missing npm package, git tag, or GitHub Release for the synced v6 version as `needs_publish=true`; the check step passes `GH_TOKEN` so GitHub Release lookup can run in Actions.
Npm registry lookups fail closed: only explicit package/version not-found errors are treated as unpublished; network, registry, or auth failures stop the workflow instead of triggering a false recovery.
GitHub Releases are created only after npm publish succeeds, so public release notes do not appear before the package is installable.

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
