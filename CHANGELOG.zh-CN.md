# 更新日志

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
