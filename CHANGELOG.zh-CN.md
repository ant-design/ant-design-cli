# 更新日志

## [6.3.6](https://github.com/ant-design/ant-design-cli/compare/v6.3.5...v6.3.6) (2026-04-17)

### 新功能

- 新增 antd v3 支持 — `antd list`、`antd info`、`antd doc`、`antd demo`、`antd migrate 3 4` 现可用于 v3 项目 ([#77](https://github.com/ant-design/ant-design-cli/pull/77))
- `antd lint` 新增 `--antd-alias` 参数，支持识别二次封装的 import 来源 ([#81](https://github.com/ant-design/ant-design-cli/pull/81))
- `antd env` 增强为完整的环境信息输出 ([#75](https://github.com/ant-design/ant-design-cli/pull/75))
- MCP 工具新增 annotations，改善 IDE 集成体验 ([#79](https://github.com/ant-design/ant-design-cli/pull/79))

### Bug 修复

- 修复 `antd token` 在无组件 token 时输出纯文本而非有效 JSON 的问题 ([#80](https://github.com/ant-design/ant-design-cli/pull/80))
- 修复同步工作流无法检测 antd 新版本的问题 ([#83](https://github.com/ant-design/ant-design-cli/pull/83))
- 修复 AI 助手主动建议提交 Bug 报告的问题；Bug 报告改为仅用户主动触发，新增 `ANTD_NO_AUTO_REPORT=1` 环境变量可完全关闭提示 ([#85](https://github.com/ant-design/ant-design-cli/pull/85), closes [#82](https://github.com/ant-design/ant-design-cli/issues/82))

### 其他变更

- 同步 antd 元数据 ([v6@6.3.6](https://github.com/ant-design/ant-design-cli/compare/v6.3.5...v6.3.6#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- 最低 Node.js 版本要求提升至 20（Commander v14 兼容性） ([#76](https://github.com/ant-design/ant-design-cli/pull/76))


## 6.3.5

### 新功能

- 新增 `antd env` 命令 — 输出完整的环境快照，包括 Node.js、操作系统、浏览器、antd 版本、包管理器和构建工具，方便提交 Bug 报告或为 AI Agent 提供上下文

### Bug 修复

- 修复 `antd lint` 报告的行号始终为 0 的问题 ([#65](https://github.com/ant-design/ant-design-cli/pull/65))

### 其他变更

- 同步 antd 元数据 ([v6@6.3.5](https://github.com/ant-design/ant-design-cli/compare/v6.3.5-beta.0...v6.3.5#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- 将所有依赖打包进 dist，安装后 `node_modules` 中不再出现 180+ 个传递依赖 ([#64](https://github.com/ant-design/ant-design-cli/pull/64))

## [6.3.5-beta.0](https://github.com/ant-design/ant-design-cli/compare/v6.3.4...v6.3.5-beta.0) (2026-03-25)

### 新功能

- 新增 `antd mcp` 命令 — 提供 7 个工具和 2 个提示词的 MCP 服务器，支持 IDE 集成 (#38)

### Bug 修复

- 修复使用 `-V` 时不触发更新检查的问题 (#42)
- 重写 lint 规则，基于 oxc-parser AST 分析 (#40)
- 修复废弃属性规则对无关组件的误报 (#36)

### 其他变更

- 重构：从 7 个命令模块中提取核心函数 (#38)
- 将 JSON 数据保留在 git 中，通过 .npmignore 排除 (#41)
- CI：新增 npm 包体积检测和 badge (#39)
- 更新 Skill 文件，指导 Code Agent 在出现更新提示时自动更新 CLI (#42)

## [6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4) (2026-03-24)

### Bug 修复

- 修复 info 命令输出缺少 nameZh 和 since 字段的问题 (#5)
- 修复 token 命令 globalTokens 缺少 name 字段的问题 (#10)

### 其他变更

- 同步 antd 元数据 ([v4@4.24.16](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-0f73f4b6da46cd62e857a1f41ea51e697389f2c62a0775fcfc545edd653c5e2c), [v5@5.29.3](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-6b390e384eeea7f593730f71f071bf947ec0fac7a19f6d32b91e13191b177a58), [v6@6.3.4](https://github.com/ant-design/ant-design-cli/compare/v6.3.3...v6.3.4#diff-ebaa5874f72b5c0a62edf9d98d6ae55fffc16dc881ade7a697e589c8614c7436))
- CI：切换到 GitHub Actions OIDC 发布 (#7)
- CI：迁移到 semantic-release 自动版本管理 (#14)
- 简化同步工作流 (#11)
- 移除未使用的 sample-data 目录 (#12)


## 6.3.3 (2026-03-24)

`@ant-design/cli` 首个版本发布。面向 AI 编程助手（Claude Code、Cursor、Copilot 等）的 Ant Design 命令行工具，支持组件知识查询与项目分析，提供结构化输出。

### 📚 知识查询

- **`antd list`** — 列出所有 antd 组件，展示双语名称、描述和分类
- **`antd info <Component>`** — 查询组件 API，包括 Props、类型、默认值；`--detail` 获取完整文档、方法和 FAQ
- **`antd doc <Component>`** — 输出完整的组件 API 文档（Markdown 格式）
- **`antd demo <Component> [name]`** — 获取组件示例源码，可直接运行
- **`antd token [component]`** — 查询全局和组件级 Design Token（v5+）
- **`antd semantic <Component>`** — 展示组件 `classNames` 和 `styles` 语义化定制结构
- **`antd changelog [v1] [v2] [component]`** — 查看更新日志或对比跨版本 API 差异

### 🔍 项目分析

- **`antd doctor`** — 诊断项目配置问题（React 兼容性、重复安装、主题配置、SSR 等 10 项检查）
- **`antd usage [dir]`** — 扫描项目文件，统计组件使用情况、子组件分布和非组件导出
- **`antd lint [file/dir]`** — 检查 antd 使用最佳实践（废弃 API、无障碍、性能、编码规范）
- **`antd migrate <from> <to>`** — 版本迁移指南，包含破坏性变更、代码示例和自动修复支持

### 🐛 问题反馈

- **`antd bug`** — 向 ant-design/ant-design 报告 Bug，自动收集环境信息
- **`antd bug-cli`** — 向 ant-design/ant-design-cli 报告 Bug

### ✨ 亮点

- 🧩 14 条命令，覆盖知识查询、项目分析和问题反馈
- 📦 内置 antd v4 / v5 / v6 全版本元数据，完全离线运行
- 🎯 按小版本快照存储，精确匹配任意 antd 版本的 API 数据
- 🔄 自动检测项目 antd 版本（`node_modules` → `package.json` → 回退默认）
- 🤖 所有命令支持 `--format json|text|markdown` 和 `--lang en|zh` 双语输出
- 🔮 基于 Levenshtein 距离的模糊匹配，输入错误时提供「你是不是想找？」建议
- 🔀 跨大版本 API 对比，支持智能重命名检测
- 🔗 内置 Skill 文件，一键集成到各类 Code Agent
- 🛡️ 标准错误格式，包含错误码和可操作的修复建议
