<div align="center">

<br>

<img src="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg" alt="Ant Design" width="72">

<h1>@ant-design/cli</h1>

**命令行上的 Ant Design。**<br>
查询组件知识、分析项目用量、指导版本迁移 — 完全离线。

<br>

[![npm version](https://img.shields.io/npm/v/@ant-design/cli?color=blue&label=npm)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli?color=blue)](https://www.npmjs.com/package/@ant-design/cli)
[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ant-design/ant-design-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/ant-design/ant-design-cli)
[![install size](https://packagephobia.com/badge?p=@ant-design/cli)](https://packagephobia.com/result?p=@ant-design/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [中文](./README.zh-CN.md) · [更新日志](./CHANGELOG.zh-CN.md)

</div>

<br>

## 🤔 为什么

Code Agent（Claude Code、Codex、Gemini CLI）在拥有即时 API 数据访问能力时，能写出更好的 antd 代码。这个 CLI 正是为此而生 — **antd v4 / v5 / v6 的每个 Prop、Token、Demo 和 Changelog 条目**，本地打包，毫秒级查询。

```bash
npx skills add ant-design/ant-design-cli    # 安装为 Agent Skill
```

<br>

## ✨ 亮点

- 📦 **完全离线** — 所有元数据随包安装，无需网络请求，无延迟，无 API Key。
- 🎯 **版本精确** — 跨 v4/v5/v6 的 55+ 小版本快照。查询 `antd@5.3.0` 的精确 API，而非仅 "最新 v5"。
- 🤖 **Agent 优化** — 所有命令支持 `--format json`。结构化错误码与修复建议。stdout/stderr 严格分离。
- 🌍 **双语输出** — 每个组件名、描述和文档均有中英文。通过 `--lang zh` 切换。
- 🔮 **智能纠错** — 输入 `Buttn`？CLI 基于 Levenshtein 距离建议 `Button`，优先匹配首字母相同的候选。
- 🧩 **15 条命令** — 从 Prop 查询到项目级 Lint，从 Design Token 到跨版本 API 对比。
- 🔌 **MCP 服务** — `antd mcp` 启动 stdio 服务，原生集成 Claude Desktop、Cursor 等 IDE。

<br>

## 📦 安装

```bash
npm install -g @ant-design/cli
```

<details>
<summary>其他包管理器</summary>

```bash
pnpm add -g @ant-design/cli
bun add -g @ant-design/cli
```

</details>

<br>

## 🤖 Agent 集成

CLI 内置 [Skill 文件](./skills/antd/SKILL.md)，指导 Code Agent 在正确的时机调用正确的命令：

```bash
npx skills add ant-design/ant-design-cli
```

或者直接告诉你的 Code Agent：

> 安装 `@ant-design/cli` 和 `ant-design/ant-design-cli` 的 antd skill

Agent 会自动完成 `npm install`、`npx skills add`，并开始使用 CLI。

### MCP 服务

支持 [Model Context Protocol](https://modelcontextprotocol.io) 的 IDE 可直接将 CLI 作为 MCP 服务使用：

```json
{
  "mcpServers": {
    "antd": {
      "command": "antd",
      "args": ["mcp"]
    }
  }
}
```

如需固定 antd 版本，在 `args` 数组中添加 `"--version", "5.20.0"`。

提供 7 个工具（`antd_list`、`antd_info`、`antd_doc`、`antd_demo`、`antd_token`、`antd_semantic`、`antd_changelog`）和 2 个提示词（`antd-expert`、`antd-page-generator`）。

支持 [Claude Code](https://claude.ai/code)、[Cursor](https://cursor.sh)、[Codex](https://openai.com/codex)、[Gemini CLI](https://github.com/google-gemini/gemini-cli) 等所有兼容 [skills](https://github.com/nicepkg/agent-skills) 协议的 Agent。

<br>

## 🚀 快速开始

```bash
antd list                           # 所有组件及版本信息
antd info Button                    # 组件 Props、类型、默认值
antd doc Button                     # 完整 Markdown 文档
antd demo Select basic              # 可运行的 Demo 源码
antd token DatePicker               # Design Token 值（v5+）
antd semantic Table                 # classNames / styles 结构
antd changelog 4.24.0 5.0.0 Select  # 跨版本 API 差异对比
antd doctor                         # 诊断项目配置问题
antd env                            # 收集环境信息用于 Bug 报告
antd usage ./src                    # 分析项目中的 antd 导入
antd lint ./src                     # 检查废弃 API 和最佳实践
antd migrate 4 5 --apply ./src      # 生成 Agent 迁移提示
```

<br>

## 📖 命令

### 📚 知识查询

| 命令 | 说明 |
|---|---|
| [`antd list`](#antd-list) | 列出所有组件，含双语名称、分类和引入版本 |
| [`antd info <Component>`](#antd-info-component) | Props 表格，含类型、默认值、引入版本和废弃状态 |
| [`antd doc <Component>`](#antd-doc-component) | 组件完整 Markdown 文档 |
| [`antd demo <Component> [name]`](#antd-demo-component-name) | 可运行的 Demo 源码（TSX） |
| [`antd token [Component]`](#antd-token-component) | 全局或组件级 Design Token |
| [`antd semantic <Component>`](#antd-semantic-component) | 语义化 `classNames` / `styles` 结构及用法示例 |
| [`antd changelog`](#antd-changelog-v1-v2-component) | Changelog 条目、版本范围或跨版本 API 对比 |

### 🔍 项目分析

| 命令 | 说明 |
|---|---|
| [`antd doctor`](#antd-doctor) | 10 项诊断检查：React 兼容性、重复安装、peer 依赖、SSR、babel 插件 |
| [`antd env [dir]`](#antd-env-dir) | 一键收集 antd 相关环境信息，用于 Bug 报告或 AI 辅助诊断 |
| [`antd usage [dir]`](#antd-usage-dir) | 导入统计、子组件分布（`Form.Item`）、非组件导出 |
| [`antd lint [target]`](#antd-lint-target) | 废弃 API、无障碍缺陷、性能问题、最佳实践 |
| [`antd migrate <from> <to>`](#antd-migrate-from-to) | 迁移清单，区分自动修复/手动处理，`--apply` 生成 Agent 提示 |

### 🐛 问题反馈

| 命令 | 说明 |
|---|---|
| [`antd bug`](#antd-bug) | 向 ant-design/ant-design 报告 Bug，自动收集环境信息 |
| [`antd bug-cli`](#antd-bug-cli) | 向 ant-design/ant-design-cli 报告 Bug |

<br>

---

### `antd list`

```bash
antd list                           # 所有组件
antd list --version 5.0.0           # v5.0.0 中可用的组件
```

<details>
<summary>示例输出</summary>

```
Component       组件名     Description                                                Since
--------------  -------  -------------------------------------------------------  ------
Button          按钮       To trigger an operation.                                  4.0.0
Table           表格       A table displays rows of data.                            4.0.0
Form            表单       High performance Form component with data scope management. 4.0.0
Select          选择器      Select component to select value from options.            4.0.0
Modal           对话框      Modal dialogs.                                            4.0.0
ColorPicker     颜色选择器   Used for color selection.                                 5.5.0
...
```

</details>

### `antd info <Component>`

```bash
antd info Button                    # Props 表格
antd info Button --detail           # + 描述、引入版本、废弃状态、FAQ
antd info Button --version 4.24.0   # v4 API 快照
```

<details>
<summary>示例输出</summary>

```
Button (按钮) — To trigger an operation.

Property         Type                                          Default   Since
---------------  --------------------------------------------  --------  ------
autoInsertSpace  boolean                                       true      5.17.0
block            boolean                                       false     -
classNames       Record<SemanticDOM, string>                   -         5.4.0
disabled         boolean                                       false     -
href             string                                        -         -
icon             ReactNode                                     -         -
loading          boolean | { delay: number, icon: ReactNode }  false     -
size             large | middle | small                        middle    -
type             primary | default | dashed | text | link      default   -
variant          outlined | dashed | solid | filled | text     -         5.13.0
onClick          (event: React.MouseEvent) => void             -         -
```

</details>

### `antd doc <Component>`

```bash
antd doc Button                     # 完整 Markdown 文档输出到 stdout
antd doc Button --format json       # { name, doc }
antd doc Button --lang zh           # 中文文档
```

### `antd demo <Component> [name]`

```bash
antd demo Button                    # 列出所有可用 Demo
antd demo Button basic              # 获取 Demo 源码
```

### `antd token [Component]`

```bash
antd token                          # 全局 Token（colorPrimary、borderRadius 等）
antd token Button                   # 组件级 Token
```

### `antd semantic <Component>`

```bash
antd semantic Table
```

<details>
<summary>示例输出</summary>

```
Table Semantic Structure:
├── header    # 表头区域
├── body      # 表体区域
├── footer    # 表尾区域
├── cell      # 单元格
├── row       # 行
└── wrapper   # 外层容器

Usage:
  <Table classNames={{ header: 'my-header' }} />
  <Table styles={{ header: { background: '#fff' } }} />
```

</details>

### `antd changelog [v1] [v2] [component]`

```bash
antd changelog 5.22.0               # 单个版本
antd changelog 5.21.0..5.24.0       # 版本范围（两端包含）
antd changelog 4.24.0 5.0.0         # 两个版本间的 API 差异
antd changelog 4.24.0 5.0.0 Select  # 仅对比 Select 的 API
```

---

### `antd doctor`

对项目执行 10 项检查：antd 是否安装、React 版本兼容性、antd/dayjs/cssinjs 重复安装、peer 依赖满足度、主题配置、babel-plugin-import 使用、CSS-in-JS 配置。

```bash
antd doctor
antd doctor --format json
```

### `antd env [dir]`

一键收集 antd 相关的所有环境信息 — 系统、Node、包管理器、浏览器、依赖包、生态包（`@ant-design/*`、`rc-*`）和构建工具。

```bash
antd env                            # 文本输出（粘贴到 GitHub Issue）
antd env --format json              # 结构化 JSON，供 AI 消费
antd env --format markdown          # Markdown 表格输出
antd env ./my-project               # 扫描指定项目目录
```

<details>
<summary>示例输出</summary>

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

</details>

### `antd usage [dir]`

```bash
antd usage                          # 扫描当前目录
antd usage ./src                    # 扫描指定目录
antd usage -f Button                # 过滤特定组件
```

### `antd lint [target]`

四类规则：`deprecated`（废弃 API）、`a11y`（无障碍）、`performance`（性能）、`best-practice`（最佳实践）。废弃规则从元数据动态生成，始终与检测到的 antd 版本保持同步。

```bash
antd lint ./src
antd lint ./src --only deprecated
antd lint ./src --only a11y
antd lint ./src --only deprecated --format json --antd-alias @shared-components
```

使用 `--antd-alias <source>` 可以把额外包名视为 `antd` 的别名；可重复传入多个包装包名，且默认仍会匹配 `antd`。

### `antd migrate <from> <to>`

v4→v5 包含 25+ 迁移步骤，v5→v6 包含 30+。每个步骤包含组件名、破坏性标记、搜索正则和前后代码对比。

```bash
antd migrate 4 5                    # 完整迁移清单
antd migrate 4 5 --component Select # 指定组件
antd migrate 4 5 --apply ./src      # 生成 Agent 迁移提示
```

<details>
<summary>示例输出</summary>

```
Migration Guide: v4 → v5

  Select:
    🔧 [BREAKING] Prop `dropdownClassName` renamed to `popupClassName`
    🔧 [BREAKING] Prop `dropdownMatchSelectWidth` renamed to `popupMatchSelectWidth`

Total: 2 steps (2 auto-fixable, 0 manual)
```

</details>

### `antd bug`

```bash
antd bug --title "DatePicker 选择日期时崩溃"
antd bug --title "..." --steps "1. 点击" --expected "正常" --actual "崩溃"
antd bug --title "..." --submit     # 通过 gh CLI 提交
```

### `antd bug-cli`

```bash
antd bug-cli --title "info 命令在 v4 组件上崩溃"
antd bug-cli --title "..." --submit
```

<br>

## ⚙️ 全局参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--format json\|text\|markdown` | 输出格式 | `text` |
| `--version <v>` | 目标 antd 版本（如 `5.20.0`） | 自动检测 |
| `--lang en\|zh` | 输出语言 | `en` |
| `--detail` | 包含扩展信息 | `false` |
| `-V, --cli-version` | 打印 CLI 版本号 | — |

**版本自动检测**：`--version` 参数 → `node_modules/antd` → `package.json` 依赖声明 → 回退 `5.24.0`

<br>

## 📄 开源协议

[MIT](./LICENSE) © [Ant Design](https://ant.design)
