## [6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4) (2026-03-17)


### Bug Fixes

* restore missing name field in globalTokens for token command ([#10](https://github.com/ant-design/ant-design-cli/issues/10)) ([e3e9ed2](https://github.com/ant-design/ant-design-cli/commit/e3e9ed2aed6e81b421a4a44a7cab3d0753fc3442))
* show nameZh and since in info command output ([#5](https://github.com/ant-design/ant-design-cli/issues/5)) ([17b9e0a](https://github.com/ant-design/ant-design-cli/commit/17b9e0a6f252afad26bca2bd59285f23f940a8ad))

# Changelog

## 0.1.0 (2026-03-14)

First release of `@ant-design/cli`, a CLI tool for querying Ant Design knowledge and analyzing antd usage in projects. Designed for AI code agents (Claude Code, Cursor, Copilot, etc.) with structured output support.

### Knowledge Query

- **`antd list`** — List all antd components with descriptions, grouped by category
- **`antd info <Component>`** — Query component API including props, types, default values; use `--detail` for full docs, methods, FAQ
- **`antd demo <Component> [name]`** — Browse and retrieve demo source code for any component
- **`antd token [component]`** — Query global and component-level Design Tokens (v5+)
- **`antd semantic <Component>`** — Show available `classNames` and `styles` keys for semantic customization
- **`antd changelog [v1] [v2] [component]`** — View changelog entries or compare API differences across versions

### Project Analysis

- **`antd doctor`** — Diagnose project configuration issues (React compatibility, duplicate installs, theme config, SSR setup)
- **`antd usage [dir]`** — Scan project files for component usage statistics and sub-component breakdown
- **`antd lint [file/dir]`** — Check antd-specific best practices (deprecated APIs, a11y, performance, coding patterns)
- **`antd migrate <from> <to>`** — Generate version migration guide with breaking changes, code examples, and auto-fix support

### Features

- Multi-version support: antd v4, v5, v6 with bundled metadata (no network required)
- Auto-detect project antd version from `node_modules` or `package.json`
- All commands support `--format json|text|markdown` for structured output
- Bilingual output with `--lang en|zh`
- Fuzzy matching with "Did you mean?" suggestions on typos
- Cross-version API diffing (e.g. v4 vs v5)
- Standard error format with error codes and actionable suggestions

---

## 0.1.0 (2026-03-14) 中文版

`@ant-design/cli` 首个版本发布。一款面向 AI 编程助手（Claude Code、Cursor、Copilot 等）的 Ant Design CLI 工具，支持知识查询与项目分析，提供结构化输出。

### 知识查询

- **`antd list`** — 列出所有 antd 组件，按分类分组展示描述信息
- **`antd info <Component>`** — 查询组件 API，包括 props、类型、默认值；使用 `--detail` 获取完整文档、方法和 FAQ
- **`antd demo <Component> [name]`** — 浏览和获取任意组件的示例源码
- **`antd token [component]`** — 查询全局和组件级 Design Token（v5+）
- **`antd semantic <Component>`** — 展示组件可用的 `classNames` 和 `styles` 语义化定制键
- **`antd changelog [v1] [v2] [component]`** — 查看更新日志或对比跨版本 API 差异

### 项目分析

- **`antd doctor`** — 诊断项目配置问题（React 兼容性、重复安装、主题配置、SSR 配置等）
- **`antd usage [dir]`** — 扫描项目文件，统计组件使用情况及子组件分布
- **`antd lint [file/dir]`** — 检查 antd 使用最佳实践（废弃 API、无障碍、性能、编码规范）
- **`antd migrate <from> <to>`** — 生成版本迁移指南，包含破坏性变更、代码示例和自动修复支持

### 特性

- 多版本支持：内置 antd v4、v5、v6 元数据，无需网络请求
- 自动检测项目 antd 版本（从 `node_modules` 或 `package.json`）
- 所有命令支持 `--format json|text|markdown` 结构化输出
- 双语输出，通过 `--lang en|zh` 切换
- 模糊匹配，输入错误时提供「你是不是想找？」建议
- 跨大版本 API 对比（如 v4 vs v5）
- 标准错误格式，包含错误码和可操作的修复建议
