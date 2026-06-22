# Changelog

## [6.4.5](https://github.com/ant-design/ant-design-cli/compare/v6.4.4...v6.4.5) (2026-06-22)

- Update antd metadata ([v6@6.4.5](https://github.com/ant-design/ant-design-cli/compare/v6.4.4...v6.4.5#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


## [6.4.4](https://github.com/ant-design/ant-design-cli/compare/v6.4.3...v6.4.4) (2026-06-12)

### Features

- New `antd design.md` command — outputs antd's design language specification (colors, typography, spacing, radius, and design principles) in [design.md](https://github.com/google-labs-code/design.md) format, ready for AI design tools like Figma Make and Stitch. Also available as `antd_design_md` MCP tool ([#147](https://github.com/ant-design/ant-design-cli/pull/147), [ant-design#57701](https://github.com/ant-design/ant-design/issues/57701))
- New `antd upgrade` command — update the CLI to the latest version without leaving your terminal ([#123](https://github.com/ant-design/ant-design-cli/pull/123))
- All commands now support `--format markdown` output and `--lang zh` for Chinese labels ([#146](https://github.com/ant-design/ant-design-cli/pull/146))
- `antd info` now shows a note about common props (`className` / `style` / `rootClassName`) shared by all components ([#139](https://github.com/ant-design/ant-design-cli/pull/139))

### Bug Fixes

- Fix version auto-detection defaulting to v5 instead of v6 when antd is not installed locally ([#150](https://github.com/ant-design/ant-design-cli/pull/150))
- `antd mcp` now shows a helpful message when run directly in a terminal instead of silently hanging ([#154](https://github.com/ant-design/ant-design-cli/pull/154))
- Fix some components (e.g. those with only sub-component props) failing to display in `antd info` ([#152](https://github.com/ant-design/ant-design-cli/pull/152))
- Fix missing or malformed prop metadata and token data for some components across v5/v6 ([#138](https://github.com/ant-design/ant-design-cli/pull/138), [#132](https://github.com/ant-design/ant-design-cli/pull/132), [#122](https://github.com/ant-design/ant-design-cli/pull/122), [#125](https://github.com/ant-design/ant-design-cli/pull/125))
- Fix markdown table output with special characters being incorrectly escaped ([#136](https://github.com/ant-design/ant-design-cli/pull/136))
- Fix invalid `--format` or `--lang` values being silently ignored instead of showing an error ([#141](https://github.com/ant-design/ant-design-cli/pull/141))
- Fix version parsing, `antd upgrade` comparison, and `antd semantic --lang zh` crash ([#127](https://github.com/ant-design/ant-design-cli/pull/127))

### Security

- Fix potential shell injection in build scripts ([#137](https://github.com/ant-design/ant-design-cli/pull/137), [#134](https://github.com/ant-design/ant-design-cli/pull/134))
- Upgrade `qs` to 6.15.2 to resolve CVE-2026-8723 ([#121](https://github.com/ant-design/ant-design-cli/pull/121))

### Other Changes

- Reduce npm package size by excluding skills `node_modules` ([#144](https://github.com/ant-design/ant-design-cli/pull/144))
- Add Codex and OpenAI Agents support ([#151](https://github.com/ant-design/ant-design-cli/pull/151))
- Improve sync workflow reliability ([#155](https://github.com/ant-design/ant-design-cli/pull/155), [#156](https://github.com/ant-design/ant-design-cli/pull/156), [#135](https://github.com/ant-design/ant-design-cli/pull/135), [#133](https://github.com/ant-design/ant-design-cli/pull/133))
- Bump dependencies ([#149](https://github.com/ant-design/ant-design-cli/pull/149), [#148](https://github.com/ant-design/ant-design-cli/pull/148), [#130](https://github.com/ant-design/ant-design-cli/pull/130), [#119](https://github.com/ant-design/ant-design-cli/pull/119), [#117](https://github.com/ant-design/ant-design-cli/pull/117))
- Update antd metadata to v6.4.4 ([diff](https://github.com/ant-design/ant-design-cli/compare/v6.4.3...v6.4.4#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))

---

### 新功能

- 新增 `antd design.md` 命令，输出 antd 设计语言规范（颜色、字体、间距、圆角及设计原则），兼容 [design.md](https://github.com/google-labs-code/design.md) 格式，可被 Figma Make、Stitch 等 AI 设计工具直接使用，同时提供 `antd_design_md` MCP tool ([#147](https://github.com/ant-design/ant-design-cli/pull/147), [ant-design#57701](https://github.com/ant-design/ant-design/issues/57701))
- 新增 `antd upgrade` 命令，在终端内一键升级 CLI 到最新版本 ([#123](https://github.com/ant-design/ant-design-cli/pull/123))
- 所有命令新增 `--format markdown` 输出格式和 `--lang zh` 中文显示支持 ([#146](https://github.com/ant-design/ant-design-cli/pull/146))
- `antd info` 输出中新增所有组件通用属性（`className` / `style` / `rootClassName`）的说明 ([#139](https://github.com/ant-design/ant-design-cli/pull/139))

### Bug 修复

- 修复未安装 antd 时版本自动检测错误回退到 v5 而非最新 v6 的问题 ([#150](https://github.com/ant-design/ant-design-cli/pull/150))
- `antd mcp` 在终端中直接运行时现在会显示友好提示，不再静默挂起 ([#154](https://github.com/ant-design/ant-design-cli/pull/154))
- 修复部分组件（仅有子组件属性的组件）在 `antd info` 中无法正常显示的问题 ([#152](https://github.com/ant-design/ant-design-cli/pull/152))
- 修复 v5/v6 中部分组件的属性元数据和 Token 数据缺失或格式错误的问题 ([#138](https://github.com/ant-design/ant-design-cli/pull/138), [#132](https://github.com/ant-design/ant-design-cli/pull/132), [#122](https://github.com/ant-design/ant-design-cli/pull/122), [#125](https://github.com/ant-design/ant-design-cli/pull/125))
- 修复 Markdown 表格输出中特殊字符转义不正确的问题 ([#136](https://github.com/ant-design/ant-design-cli/pull/136))
- 修复传入无效的 `--format` 或 `--lang` 值时被静默忽略而未报错的问题 ([#141](https://github.com/ant-design/ant-design-cli/pull/141))
- 修复版本解析、`antd upgrade` 版本比较和 `antd semantic --lang zh` 崩溃等问题 ([#127](https://github.com/ant-design/ant-design-cli/pull/127))

### 安全

- 修复构建脚本中潜在的命令注入风险 ([#137](https://github.com/ant-design/ant-design-cli/pull/137), [#134](https://github.com/ant-design/ant-design-cli/pull/134))
- 升级 `qs` 至 6.15.2，修复 CVE-2026-8723 安全漏洞 ([#121](https://github.com/ant-design/ant-design-cli/pull/121))

### 其他变更

- 排除 skills 的 node_modules，减小包体积 ([#144](https://github.com/ant-design/ant-design-cli/pull/144))
- 新增 Codex 及 OpenAI Agents 支持 ([#151](https://github.com/ant-design/ant-design-cli/pull/151))
- 提升数据同步流程的稳定性 ([#155](https://github.com/ant-design/ant-design-cli/pull/155), [#156](https://github.com/ant-design/ant-design-cli/pull/156), [#135](https://github.com/ant-design/ant-design-cli/pull/135), [#133](https://github.com/ant-design/ant-design-cli/pull/133))
- 升级依赖 ([#149](https://github.com/ant-design/ant-design-cli/pull/149), [#148](https://github.com/ant-design/ant-design-cli/pull/148), [#130](https://github.com/ant-design/ant-design-cli/pull/130), [#119](https://github.com/ant-design/ant-design-cli/pull/119), [#117](https://github.com/ant-design/ant-design-cli/pull/117))
- 同步 antd 元数据至 v6.4.4 ([diff](https://github.com/ant-design/ant-design-cli/compare/v6.4.3...v6.4.4#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


## [6.4.3](https://github.com/ant-design/ant-design-cli/compare/v6.4.2...v6.4.3) (2026-05-18)

### Bug Fixes

- Fix async `postAction` hook not being properly awaited — use `parseAsync()` instead of synchronous `parse()` ([#113](https://github.com/ant-design/ant-design-cli/pull/113))
- Fix semver OR-range (`||`) false positives in peer dependency checks and incorrect `^0.x` minor-locking behavior by replacing hand-rolled semver parser with the `semver` package ([#109](https://github.com/ant-design/ant-design-cli/pull/109))
- Fix CJK character width misalignment in table output (e.g. `antd list --lang zh`) using `string-width` ([#109](https://github.com/ant-design/ant-design-cli/pull/109))
- Fix `compare()` returning incorrect results for null/undefined inputs ([#111](https://github.com/ant-design/ant-design-cli/pull/111))

### Other Changes

- Replace custom Levenshtein distance and recursive directory walker with `fast-levenshtein` and `fast-glob` packages ([#109](https://github.com/ant-design/ant-design-cli/pull/109))
- Extract shared `fetchWithTimeout` and `fetchFirstJson` helpers to eliminate duplicated HTTP patterns ([#109](https://github.com/ant-design/ant-design-cli/pull/109))
- Sync bundled antd CLI skill with current command surface ([#114](https://github.com/ant-design/ant-design-cli/pull/114))
- Remove stale v6 snapshots and prevent re-accumulation, reducing package size by ~4.3 MB (29.6 MB → 25.3 MB) ([#107](https://github.com/ant-design/ant-design-cli/pull/107))
- Convert e2e tests to in-process execution for better performance ([#112](https://github.com/ant-design/ant-design-cli/pull/112))
- Reach 100% line, statement, and function test coverage ([#115](https://github.com/ant-design/ant-design-cli/pull/115), [#116](https://github.com/ant-design/ant-design-cli/pull/116))
- Update antd metadata ([v6@6.4.3](https://github.com/ant-design/ant-design-cli/compare/v6.4.2...v6.4.3#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


## [6.4.2](https://github.com/ant-design/ant-design-cli/compare/v6.4.1...v6.4.2) (2026-05-14)

- Update antd metadata ([v6@6.4.2](https://github.com/ant-design/ant-design-cli/compare/v6.4.1...v6.4.2#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


## [6.4.1](https://github.com/ant-design/ant-design-cli/compare/v6.4.0...v6.4.1) (2026-05-14)

- Update antd metadata ([v6@6.4.1](https://github.com/ant-design/ant-design-cli/compare/v6.4.0...v6.4.1#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


## [6.4.0](https://github.com/ant-design/ant-design-cli/compare/v6.3.7...v6.4.0) (2026-05-14)

### New Features

- `doctor` command now checks for known bugs in the installed antd version and displays related issue links ([#89](https://github.com/ant-design/ant-design-cli/pull/89))

### Bug Fixes

- Fix lint false positives for `Checkbox.Group`/`Radio.Group` — `value` on `Checkbox` inside `Checkbox.Group` and `optionType` on `Radio` inside `Radio.Group` are no longer incorrectly warned ([#93](https://github.com/ant-design/ant-design-cli/pull/93), closes [#91](https://github.com/ant-design/ant-design-cli/issues/91))
- Fix lint performance rule incorrectly flagging locale default imports like `import enUS from 'antd/locale/en_US'` and improve suggestion to use actual component names instead of always suggesting `Button` ([#104](https://github.com/ant-design/ant-design-cli/pull/104), closes [#99](https://github.com/ant-design/ant-design-cli/issues/99), [#101](https://github.com/ant-design/ant-design-cli/issues/101))

### Other Changes

- Refactor update check to query multiple sources concurrently ([#89](https://github.com/ant-design/ant-design-cli/pull/89))
- Update antd metadata ([v6@6.4.0](https://github.com/ant-design/ant-design-cli/compare/v6.3.7...v6.4.0#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- Configure Dependabot for grouped updates as npm ecosystem ([#102](https://github.com/ant-design/ant-design-cli/pull/102))
- Bump dependencies and resolve security alerts ([#103](https://github.com/ant-design/ant-design-cli/pull/103), [#105](https://github.com/ant-design/ant-design-cli/pull/105))


## [6.3.7](https://github.com/ant-design/ant-design-cli/compare/v6.3.6...v6.3.7) (2026-04-27)

- Update antd metadata ([v4@4.24.16](https://github.com/ant-design/ant-design-cli/compare/v6.3.6...v6.3.7#diff-0f73f4b6da46cd62e857a1f41ea51e697389f2c62a0775fcfc545edd653c5e2c), [v5@5.29.3](https://github.com/ant-design/ant-design-cli/compare/v6.3.6...v6.3.7#diff-6b390e384eeea7f593730f71f071bf947ec0fac7a19f6d32b91e13191b177a58), [v6@6.3.7](https://github.com/ant-design/ant-design-cli/compare/v6.3.6...v6.3.7#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))


## [6.3.6](https://github.com/ant-design/ant-design-cli/compare/v6.3.5...v6.3.6) (2026-04-17)

### New Features

- Add antd v3 support — `antd list`, `antd info`, `antd doc`, `antd demo`, `antd migrate 3 4` now work with v3 projects ([#77](https://github.com/ant-design/ant-design-cli/pull/77))
- Add `--antd-alias` flag to `antd lint` for recognizing wrapper import sources ([#81](https://github.com/ant-design/ant-design-cli/pull/81))
- Enhance `antd env` with full envinfo output ([#75](https://github.com/ant-design/ant-design-cli/pull/75))
- Add MCP tool annotations for better IDE integration ([#79](https://github.com/ant-design/ant-design-cli/pull/79))

### Bug Fixes

- Fix `antd token` outputting plain text instead of valid JSON when no tokens available ([#80](https://github.com/ant-design/ant-design-cli/pull/80))
- Fix sync workflow never detecting new antd versions ([#83](https://github.com/ant-design/ant-design-cli/pull/83))
- Fix AI assistant proactively suggesting bug reports; bug reporting is now user-initiated only, with `ANTD_NO_AUTO_REPORT=1` to fully opt out ([#85](https://github.com/ant-design/ant-design-cli/pull/85), closes [#82](https://github.com/ant-design/ant-design-cli/issues/82))

### Other Changes

- Update antd metadata ([v6@6.3.6](https://github.com/ant-design/ant-design-cli/compare/v6.3.5...v6.3.6#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- Require Node.js >= 20 (Commander v14 compatibility) ([#76](https://github.com/ant-design/ant-design-cli/pull/76))


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
