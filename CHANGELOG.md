# Changelog

## [6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4) (2026-03-24)

- Update antd metadata ([v4@4.24.16](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-0f73f4b6da46cd62e857a1f41ea51e697389f2c62a0775fcfc545edd653c5e2c), [v5@5.29.3](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-6b390e384eeea7f593730f71f071bf947ec0fac7a19f6d32b91e13191b177a58), [v6@6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


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
