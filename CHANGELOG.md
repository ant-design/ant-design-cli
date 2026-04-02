# Changelog

## [6.3.5](https://github.com/ant-design/ant-design-cli/compare/v6.3.5-beta.0...v6.3.5) (2026-03-30)

### New Features

- Add `antd env` command — prints a full environment snapshot including Node.js, OS, browser, antd version, package manager, and build tool. Useful for bug reports and AI agent context.

### Bug Fixes

- Fix `antd lint` reporting incorrect line numbers (always showing line 0) ([#65](https://github.com/ant-design/ant-design-cli/pull/65))

### Other Changes

- Update antd metadata ([v6@6.3.5](https://github.com/ant-design/ant-design-cli/compare/v6.3.5-beta.0...v6.3.5#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- Bundle all dependencies into the package — eliminates 180+ transitive packages from your `node_modules` ([#64](https://github.com/ant-design/ant-design-cli/pull/64))

## [6.3.5-beta.0](https://github.com/ant-design/ant-design-cli/compare/v6.3.4...v6.3.5-beta.0) (2026-03-25)

### New Features

- feat: add `antd mcp` command — MCP server with 7 tools and 2 prompts for IDE integration (#38)

### Bug Fixes

- fix: run update check when using `-V` flag (#42)
- fix(lint): rewrite all rules with oxc-parser AST analysis (#40)
- fix(lint): avoid false positives for deprecated prop rule on unrelated components (#36)

### Other Changes

- refactor: extract core functions from 7 command modules (#38)
- chore: keep JSON in git, exclude from npm via .npmignore (#41)
- ci: add npm pack size detection workflow and badge (#39)
- Update skill to instruct code agents to auto-update CLI when "Update available" notice appears (#42)

## [6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4) (2026-03-24)

### Bug Fixes

- fix: show nameZh and since in info command output (#5)
- fix: restore missing name field in globalTokens for token command (#10)

### Other Changes

- Update antd metadata ([v4@4.24.16](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-0f73f4b6da46cd62e857a1f41ea51e697389f2c62a0775fcfc545edd653c5e2c), [v5@5.29.3](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-6b390e384eeea7f593730f71f071bf947ec0fac7a19f6d32b91e13191b177a58), [v6@6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- ci: switch to GitHub Actions OIDC publishing, remove NPM_TOKEN (#7)
- ci: migrate to semantic-release for automated versioning and publishing (#14)
- chore: simplify sync workflow (#11)
- chore: remove unused sample-data directory (#12)


## 6.3.3 (2026-03-24)

First release of `@ant-design/cli`. A CLI tool for querying Ant Design component knowledge and analyzing antd usage in projects. Designed for AI code agents (Claude Code, Cursor, Copilot, etc.) with structured output support.

### 📚 Knowledge Query

- **`antd list`** — List all antd components with descriptions and categories
- **`antd info <Component>`** — Query component API: props, types, default values; `--detail` for full docs, methods, FAQ
- **`antd doc <Component>`** — Output full API documentation in markdown
- **`antd demo <Component> [name]`** — Browse and retrieve demo source code
- **`antd token [component]`** — Query global and component-level Design Tokens (v5+)
- **`antd semantic <Component>`** — Show `classNames` and `styles` keys for semantic customization
- **`antd changelog [v1] [v2] [component]`** — View changelog entries or diff APIs across versions

### 🔍 Project Analysis

- **`antd doctor`** — Diagnose project configuration issues (React compat, duplicate installs, theme config, SSR)
- **`antd usage [dir]`** — Scan project for component usage statistics and sub-component breakdown
- **`antd lint [file/dir]`** — Check antd best practices (deprecated APIs, a11y, performance)
- **`antd migrate <from> <to>`** — Version migration guide with breaking changes and auto-fix support

### 🐛 Issue Reporting

- **`antd bug`** — Report a bug to ant-design/ant-design with auto-collected environment info
- **`antd bug-cli`** — Report a bug to ant-design/ant-design-cli

### ✨ Highlights

- 🧩 14 commands covering knowledge query, project analysis, and issue reporting
- 📦 Multi-version support: bundled metadata for antd v4, v5, v6 — fully offline
- 🎯 Per-minor-version snapshots for precise API data at any antd version
- 🔄 Auto-detect project antd version from `node_modules` or `package.json`
- 🤖 All commands support `--format json|text|markdown` and `--lang en|zh`
- 🔮 Fuzzy matching with "Did you mean?" suggestions on typos
- 🔀 Cross-version API diffing (e.g. v4 vs v5)
- 🔗 Skill file for seamless integration with code agents (`npx skills add ant-design/ant-design-cli`)
- 🛡️ Standard error format with error codes and actionable suggestions
